package main

import (
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
)

// what a change to a mod reaches: the test files that are it, import it (a hooks file, or a test world a test pulls in, however
// deep), or carry its name (hooks/<name>.ts → <name>.test.ts, for a hook the host loads and no test imports). a mod's whole suite
// is ~0.2 cpu-s a test, so a push runs this and the whole suite only on --whole or when a change reaches every test
// (FRM-678, dima's «run only what a change reaches»)

var importSpec = regexp.MustCompile(`(?:\bfrom|\bimport|\brequire)\s*\(?\s*['"](\.{1,2}/[^'"]+)['"]`)

// the tests reached, the changed code no test reaches, and whether the change reaches every test (a manifest, a tsconfig or a
// file the host loads before any test runs). changed holds paths relative to the mod; overlay is the mod's copy holding the change
func testsReached(overlay string, changed []string) (reached, unreached []string, all bool) {
	importers := map[string][]string{}
	var tests []string
	_ = filepath.WalkDir(overlay, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		rel, _ := filepath.Rel(overlay, path)
		rel = filepath.ToSlash(rel)
		if entry.IsDir() {
			if entry.Name() == "node_modules" || rel == ".claude-plugin/types" {
				return filepath.SkipDir
			}
			return nil
		}
		if !isSourceFile(rel) {
			return nil
		}
		if isTestFile(rel) {
			tests = append(tests, rel)
		}
		body, err := os.ReadFile(path)
		if err != nil {
			return nil
		}
		for _, m := range importSpec.FindAllStringSubmatch(string(body), -1) {
			if target := resolveImport(overlay, rel, m[1]); target != "" {
				importers[target] = append(importers[target], rel)
			}
		}
		return nil
	})
	// every file that imports `file`, however deep, and the file itself
	importedBy := func(file string) map[string]bool {
		set := map[string]bool{}
		var walk func(string)
		walk = func(f string) {
			if set[f] {
				return
			}
			set[f] = true
			for _, importer := range importers[f] {
				walk(importer)
			}
		}
		walk(file)
		return set
	}
	stem := func(path string) string {
		return strings.TrimSuffix(strings.TrimSuffix(strings.TrimSuffix(filepath.Base(path), ".tsx"), ".ts"), ".test")
	}
	seen := map[string]bool{}
	for _, file := range changed {
		switch {
		case strings.HasSuffix(file, ".md") || strings.HasPrefix(file, "types/"):
		case isTestFile(file):
			seen[file] = true
		case isSourceFile(file):
			own := importedBy(file)
			for _, test := range tests {
				if strings.HasPrefix(file, "hooks/") && stem(test) == stem(file) {
					own[test] = true
				}
			}
			isReached := false
			for _, test := range tests {
				if own[test] {
					seen[test], isReached = true, true
				}
			}
			if !isReached {
				unreached = append(unreached, file)
			}
		default:
			// a manifest, a tsconfig, a json the host reads: the engine loads it before any test starts
			all = true
		}
	}
	for _, test := range tests {
		if seen[test] {
			reached = append(reached, test)
		}
	}
	slices.Sort(reached)
	return reached, slices.Compact(unreached), all
}

func isSourceFile(rel string) bool {
	return strings.HasSuffix(rel, ".ts") || strings.HasSuffix(rel, ".tsx")
}

// the file an import in `from` names, relative to the mod: as written, with an extension, or an index; "" when none is there
func resolveImport(overlay, from, spec string) string {
	base := filepath.ToSlash(filepath.Join(filepath.Dir(from), spec))
	for _, candidate := range []string{base, base + ".ts", base + ".tsx", base + "/index.ts", strings.TrimSuffix(base, ".js") + ".ts"} {
		if info, err := os.Stat(filepath.Join(overlay, candidate)); err == nil && !info.IsDir() && isSourceFile(candidate) {
			return candidate
		}
	}
	return ""
}
