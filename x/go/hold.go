package main

import (
	"crypto/sha256"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"
)

// held is the work a commit's hooks must not see: unstaged edits and untracked files outside the
// named paths. a hook (frame's `pnpm test`) reads the whole tree, and lefthook stashes only the
// partially staged files, so a fully unstaged wip file can fail the gate it has nothing to do with.
// the files move into the git dir — the same volume, so a rename never copies — never the shared
// stash stack another session could pop
type held struct {
	dir   string
	files []heldFile
}

type heldFile struct {
	path    string // from the tree root
	tracked bool   // the index version is checked out while it is held
	deleted bool   // gone from the tree, in the index: held as an absence
	sum     string
}

func holdAside(tree string, named []string) (*held, error) {
	// raw, never trimmed: an unstaged edit that sorts first opens the output with its status space
	raw, err := cmdIn(tree, "git", "status", "--porcelain=v1", "-z", "--untracked-files=all").Output()
	if err != nil {
		return nil, &Fail{Msg: "git status failed: " + err.Error(), Next: "git status"}
	}
	status := string(raw)
	gitDir, err := mustGitIn(tree, "rev-parse", "rev-parse", "--path-format=absolute", "--git-dir")
	if err != nil {
		return nil, err
	}
	h := &held{dir: filepath.Join(gitDir, "x-held", time.Now().UTC().Format("20060102T150405Z")+fmt.Sprintf("-%d", os.Getpid()))}

	var pending []heldFile
	fields := strings.Split(status, "\x00")
	for i := 0; i < len(fields); i++ {
		entry := fields[i]
		if len(entry) < 4 {
			continue
		}
		code, path := entry[:2], entry[3:]
		// a rename's old path follows it as its own field
		if code[0] == 'R' || code[0] == 'C' {
			i++
		}
		if isNamed(path, named) {
			continue
		}
		switch {
		case code == "??":
			pending = append(pending, heldFile{path: path})
		case code[1] == 'D':
			pending = append(pending, heldFile{path: path, tracked: true, deleted: true})
		case code[1] != ' ':
			pending = append(pending, heldFile{path: path, tracked: true})
		}
	}
	// a file joins the restore list the moment its tree state changed, never before: restore removes
	// a tracked file's index copy, and an untaken one would lose the work still in it
	for _, f := range pending {
		moved, err := h.take(tree, &f)
		if moved {
			h.files = append(h.files, f)
		}
		if err != nil {
			return h, err
		}
	}
	return h, nil
}

func isNamed(path string, named []string) bool {
	return slices.ContainsFunc(named, func(name string) bool {
		name = strings.TrimSuffix(filepath.ToSlash(filepath.Clean(name)), "/")
		return name == "." || path == name || strings.HasPrefix(path, name+"/")
	})
}

// take reports whether the tree changed, so a failure halfway still restores what moved
func (h *held) take(tree string, f *heldFile) (bool, error) {
	if !f.deleted {
		sum, err := checksum(filepath.Join(tree, f.path))
		if err != nil {
			return false, err
		}
		f.sum = sum
		if err := os.MkdirAll(filepath.Dir(filepath.Join(h.dir, f.path)), 0o700); err != nil {
			return false, err
		}
		if err := os.Rename(filepath.Join(tree, f.path), filepath.Join(h.dir, f.path)); err != nil {
			return false, err
		}
	}
	if f.tracked {
		_, err := mustGitIn(tree, "checkout", "checkout", "--", f.path)
		return true, err
	}
	return true, nil
}

// restore puts every held file back and reads each one again; any difference is a failure that
// names the held dir, which is kept until every file is back
func (h *held) restore(tree string) error {
	var lost []string
	for _, f := range h.files {
		target := filepath.Join(tree, f.path)
		if f.tracked {
			_ = os.Remove(target)
		}
		if f.deleted {
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			lost = append(lost, f.path)
			continue
		}
		if err := os.Rename(filepath.Join(h.dir, f.path), target); err != nil {
			lost = append(lost, f.path)
			continue
		}
		if sum, err := checksum(target); err != nil || sum != f.sum {
			lost = append(lost, f.path)
		}
	}
	if len(lost) > 0 {
		return &Fail{Msg: "held files did not come back byte for byte: " + strings.Join(lost, ", "),
			Next: "copy them back from " + h.dir}
	}
	_ = os.RemoveAll(h.dir)
	_ = os.Remove(filepath.Dir(h.dir))
	return nil
}

// a symlink's sum is its target, so a held link is checked as a link; a dir (git lists a nested repo
// as one) sums every name, size and mode under it
func checksum(path string) (string, error) {
	info, err := os.Lstat(path)
	if err != nil {
		return "", err
	}
	sum := sha256.New()
	if info.IsDir() {
		err := filepath.WalkDir(path, func(at string, entry fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			inner, err := entry.Info()
			if err != nil {
				return err
			}
			rel, _ := filepath.Rel(path, at)
			fmt.Fprintf(sum, "%s %d %o\n", rel, inner.Size(), inner.Mode())
			return nil
		})
		return fmt.Sprintf("dir %x", sum.Sum(nil)), err
	}
	if info.Mode()&os.ModeSymlink != 0 {
		target, err := os.Readlink(path)
		if err != nil {
			return "", err
		}
		sum.Write([]byte("link:" + target))
	} else {
		file, err := os.Open(path)
		if err != nil {
			return "", err
		}
		defer file.Close()
		if _, err := io.Copy(sum, file); err != nil {
			return "", err
		}
	}
	return fmt.Sprintf("%x %o", sum.Sum(nil), info.Mode().Perm()), nil
}
