package main

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

var (
	cryptMagic = []byte("\x00GITCRYPT\x00")
)

// the recipe from shelf/hooks/worktree-seed.sh: the key lives in the main .git, and the
// unlock runs `git status`, which dies on the clean filter unless both filters are off
func unlock(r *Run, _ []string, _ Flags) (any, error) {
	tree, err := top()
	if err != nil {
		return nil, err
	}
	name, _ := git("symbolic-ref", "--quiet", "--short", "HEAD")
	r.Open(name.out)
	var locked []string
	if err := r.Step("scan", "reading the git-crypt set", func() (string, error) {
		var err error
		locked, err = lockedPaths(tree)
		return plural(len(locked), "file") + " hold ciphertext", err
	}); err != nil {
		return nil, err
	}
	if len(locked) == 0 {
		r.ran = len(r.steps)
		r.Done("nothing to decrypt", "")
		return ordered{{"tree", tree}, {"unlocked", 0}}, nil
	}
	if err := r.Step("decrypt", "git-crypt unlock", func() (string, error) { return "unlocked with the main key", decrypt(tree) }); err != nil {
		return nil, err
	}
	if err := r.Step("verify", "reading the set again", func() (string, error) {
		left, err := lockedPaths(tree)
		if err == nil && len(left) > 0 {
			err = &Fail{Msg: "still ciphertext: " + strings.Join(left, ", "), Next: "git-crypt status"}
		}
		return "no ciphertext left", err
	}); err != nil {
		return nil, err
	}
	r.Done(plural(len(locked), "file")+" decrypted", "")
	return ordered{{"tree", tree}, {"unlocked", len(locked)}}, nil
}

func decrypt(tree string) error {
	common, err := mustGit("rev-parse", "rev-parse", "--path-format=absolute", "--git-common-dir")
	if err != nil {
		return err
	}
	key := filepath.Join(common, "git-crypt/keys/default")
	if !exists(key) {
		return &Fail{Refused: true, Msg: "no git-crypt key at " + key, Next: "run git-crypt unlock in the main checkout first"}
	}
	gitDir, err := mustGit("rev-parse", "rev-parse", "--path-format=absolute", "--git-dir")
	if err != nil {
		return err
	}
	if !exists(filepath.Join(gitDir, "git-crypt")) {
		env := []string{"GIT_CONFIG_COUNT=2", "GIT_CONFIG_KEY_0=filter.git-crypt.clean", "GIT_CONFIG_VALUE_0=cat",
			"GIT_CONFIG_KEY_1=filter.git-crypt.required", "GIT_CONFIG_VALUE_1=false"}
		if unlocked, _ := run(tree, env, "", "git-crypt", "unlock", key); !unlocked.ok {
			return &Fail{Msg: "git-crypt unlock failed — its output is above", Next: "git-crypt status", Log: nonBlank(unlocked.log)}
		}
	}

	// in a real frame tree the unlock decrypts by itself; in a fresh fixture git sees the
	// ciphertext as unchanged and never re-smudges it. so the set is read again, and a file
	// is removed only while its raw bytes ARE its index blob
	still, err := lockedPaths(tree)
	if err != nil {
		return err
	}
	for _, path := range still {
		raw, err := mustGitIn(tree, "hash-object", "hash-object", "--no-filters", "--", path)
		if err != nil {
			return err
		}
		staged, err := mustGitIn(tree, "ls-files", "ls-files", "-s", "--", path)
		if err != nil {
			return err
		}
		if fields := strings.Fields(staged); len(fields) < 2 || fields[1] != raw {
			return &Fail{Refused: true, Msg: path + " differs from its index blob — not touching it",
				Next: "git -c filter.git-crypt.clean=cat diff -- " + path}
		}
		if err := os.Remove(filepath.Join(tree, path)); err != nil {
			return err
		}
		if _, err := mustGitIn(tree, "checkout", "checkout", "--", path); err != nil {
			return err
		}
	}
	left, err := lockedPaths(tree)
	if err != nil {
		return err
	}
	if len(left) > 0 {
		return &Fail{Msg: "still ciphertext: " + strings.Join(left, ", "), Next: "git-crypt status"}
	}
	return nil
}

func assertUnlocked(tree string) error {
	locked, err := lockedPaths(tree)
	if err != nil {
		return err
	}
	if len(locked) > 0 {
		return &Fail{Refused: true, Msg: fmt.Sprintf("git-crypt files hold ciphertext here (%s) — any add dies on the clean filter", strings.Join(locked, ", ")),
			Next: "x lane unlock"}
	}
	return nil
}

func lockedPaths(tree string) ([]string, error) {
	attributes, err := os.ReadFile(filepath.Join(tree, ".gitattributes"))
	if err != nil || !bytes.Contains(attributes, []byte("git-crypt")) {
		return nil, nil
	}
	files, err := mustGitIn(tree, "ls-files", "ls-files", "-z")
	if err != nil {
		return nil, err
	}
	attrs, _ := run(tree, nil, files, "git", "check-attr", "-z", "--stdin", "filter")
	fields := strings.Split(attrs.out, "\x00")
	var crypted []string
	for i := 0; i+2 < len(fields); i += 3 {
		if fields[i+2] == "git-crypt" && startsWithMagic(filepath.Join(tree, fields[i])) {
			crypted = append(crypted, fields[i])
		}
	}
	return crypted, nil
}

func startsWithMagic(path string) bool {
	file, err := os.Open(path)
	if err != nil {
		return false
	}
	defer file.Close()
	head := make([]byte, len(cryptMagic))
	n, _ := file.Read(head)
	return bytes.Equal(head[:n], cryptMagic)
}
