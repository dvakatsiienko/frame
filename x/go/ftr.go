package main

import (
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
)

// the rule is ftr-gate's (`home/.claude/plugin-x/bin/ftr-gate`, the commit-msg hook): staged code under
// an app's FTR.md lands with that FTR.md, or the body carries a bare «ftr: none». lane commit adds the
// line itself, so the gate never refuses a commit that changed no feature

var (
	ftrNone    = regexp.MustCompile(`(?m)^ftr: none[ \t]*$`)
	trailerRow = regexp.MustCompile(`^[\w-]+: \S`)
	ftrCode    = []string{".ts", ".tsx", ".js", ".jsx", ".mjs", ".css", ".swift", ".html"}
)

// ftrMissing names the FTR.md files whose app code is staged under paths while they are not
func ftrMissing(tree string, paths []string) []string {
	args := []string{"diff", "--cached", "--name-only", "--diff-filter=ACMRD"}
	// mid-merge the commit takes the whole index, and so does the gate
	if !isMerging() {
		args = append(append(args, "--"), paths...)
	}
	got, _ := gitIn(tree, args...)
	if !got.ok || got.out == "" {
		return nil
	}
	staged := strings.Split(got.out, "\n")
	claims := ftrClaims(tree)
	var missing []string
	for _, file := range staged {
		if !slices.Contains(ftrCode, filepath.Ext(file)) {
			continue
		}
		if strings.Contains("/"+file, "/.claude/") && !strings.Contains("/"+file, "/.claude/plugin-x/mods/") {
			continue
		}
		ftr := nearestFtr(tree, file)
		if ftr == "" {
			for _, c := range claims {
				if strings.HasPrefix(file, c.prefix) {
					ftr = c.ftr
				}
			}
		}
		if ftr != "" && !slices.Contains(staged, ftr) && !slices.Contains(missing, ftr) {
			missing = append(missing, ftr)
		}
	}
	return missing
}

func nearestFtr(tree, file string) string {
	for dir := filepath.Dir(file); dir != "." && dir != "/"; dir = filepath.Dir(dir) {
		if exists(filepath.Join(tree, dir, "FTR.md")) {
			return filepath.Join(dir, "FTR.md")
		}
	}
	return ""
}

type ftrClaim struct{ prefix, ftr string }

// a `claims:` line in an FTR.md's first 10 lines names the path prefixes it owns outside its own dir
func ftrClaims(tree string) []ftrClaim {
	got, _ := gitIn(tree, "ls-files", "--", "*FTR.md")
	if !got.ok || got.out == "" {
		return nil
	}
	var claims []ftrClaim
	for ftr := range strings.SplitSeq(got.out, "\n") {
		raw, err := os.ReadFile(filepath.Join(tree, ftr))
		if err != nil {
			continue
		}
		lines := strings.Split(string(raw), "\n")
		for _, line := range lines[:min(10, len(lines))] {
			rest, ok := strings.CutPrefix(line, "claims: ")
			if !ok {
				continue
			}
			for prefix := range strings.SplitSeq(rest, ",") {
				if prefix = strings.TrimSpace(strings.Trim(strings.TrimSpace(prefix), "`")); prefix != "" {
					claims = append(claims, ftrClaim{prefix, ftr})
				}
			}
		}
	}
	return claims
}

// withFtrNone puts «ftr: none» in its own paragraph, before the trailer paragraph so `Agent:` stays a trailer
func withFtrNone(message string) string {
	body := strings.TrimRight(message, "\n")
	cut := strings.LastIndex(body, "\n\n")
	if cut >= 0 {
		trailers := true
		for row := range strings.SplitSeq(body[cut+2:], "\n") {
			trailers = trailers && trailerRow.MatchString(row)
		}
		if trailers {
			return body[:cut] + "\n\nftr: none" + body[cut:] + "\n"
		}
	}
	return body + "\n\nftr: none\n"
}
