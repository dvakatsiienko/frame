package main

import (
	"encoding/json"
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
// (FRM-678, dima's «run only what a change reaches»). a host test (its callback takes `$`) boots the mod through the engine, which
// loads the entry hooks.json names, so it reaches everything that entry imports, though it imports no hooks file itself

var importSpec = regexp.MustCompile(`(?:\bfrom|\bimport|\brequire)\s*\(?\s*['"](\.{1,2}/[^'"]+)['"]`)

// a callback whose first parameter is `$`, anywhere in the file: a host test, read wide on purpose (a miss would skip a test a change reaches)
var hostCallback = regexp.MustCompile(`\(\s*\$\s*[,)]|[(\s]\$\s*=>`)

// the tests reached, the changed code no test reaches, and whether the change reaches every test (a manifest, a tsconfig or a
// file the host loads before any test runs). changed holds paths relative to the mod; overlay is the mod's copy holding the change
func testsReached(overlay string, changed []string) (reached, unreached []string, all bool) {
	importers, imports := map[string][]string{}, map[string][]string{}
	var tests, hostTests []string
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
		if isTestFile(rel) && hostCallback.Match(body) {
			hostTests = append(hostTests, rel)
		}
		for _, m := range importSpec.FindAllStringSubmatch(string(body), -1) {
			if target := resolveImport(overlay, rel, m[1]); target != "" {
				importers[target] = append(importers[target], rel)
				imports[rel] = append(imports[rel], target)
			}
		}
		return nil
	})
	engineReach := map[string]bool{}
	var load func(string)
	load = func(f string) {
		if engineReach[f] {
			return
		}
		engineReach[f] = true
		for _, dep := range imports[f] {
			load(dep)
		}
	}
	for _, entry := range hooksEntries(overlay) {
		load(entry)
	}
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
			if engineReach[file] {
				for _, test := range hostTests {
					own[test] = true
				}
			}
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

// the files the engine loads at a mod's start: the modules `hooks/hooks.json` names, relative to the mod
func hooksEntries(overlay string) []string {
	raw, err := os.ReadFile(filepath.Join(overlay, "hooks", "hooks.json"))
	if err != nil {
		return nil
	}
	var manifest struct {
		Modules []string `json:"modules"`
	}
	if json.Unmarshal(raw, &manifest) != nil {
		return nil
	}
	var entries []string
	for _, spec := range manifest.Modules {
		if target := resolveImport(overlay, "hooks/hooks.json", spec); target != "" {
			entries = append(entries, target)
		}
	}
	return entries
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
