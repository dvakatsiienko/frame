package main

import (
	"os"
	"path/filepath"
	"slices"
	"strings"
)

// the bump is written before the holds and the gates read the paths, and its undo puts it back on any stop before the
// commit lands: the manifest, and its index entry too past a dry run, which staged nothing in the shared index
func bumpForCommit(r *Run, tree string, call commitCall, paths []string) (bumped *bumpTarget, withManifest []string, undo func(), err error) {
	if call.bumpName == "" {
		r.skip("bump", "refresh")
		return nil, paths, func() {}, nil
	}
	var was []byte
	var index string
	if err := r.Step("bump", "the plugin's patch version", func() (string, error) {
		b, said, err := planBump(tree, call.bumpName)
		if err != nil {
			return "", err
		}
		if was, err = os.ReadFile(b.manifest); err != nil {
			return "", err
		}
		// the index entry as it stood, so a stop puts back a staged edit too, never only HEAD's
		staged, _ := git("ls-files", "-s", "--", b.manifest)
		index = staged.out
		if err := writeVersion(b.manifest, b.from, b.to); err != nil {
			return "", err
		}
		bumped = &b
		return said, nil
	}); err != nil {
		return nil, paths, nil, err
	}
	rel, _ := filepath.Rel(tree, bumped.manifest)
	if !slices.Contains(paths, rel) {
		paths = append(paths, rel)
	}
	return bumped, paths, func() {
		_ = os.WriteFile(bumped.manifest, was, 0o644)
		if call.dry {
			return
		}
		// `<mode> <sha> <stage>\t<path>`: the entry before the bump goes back as it was
		if mode, rest, ok := strings.Cut(index, " "); ok {
			if sha, _, ok := strings.Cut(rest, " "); ok {
				_, _ = git("update-index", "--cacheinfo", mode+","+sha+","+rel)
				return
			}
		}
		_, _ = git("reset", "-q", "--", rel)
	}, nil
}
