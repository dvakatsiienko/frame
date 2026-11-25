package main

import (
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
)

const archived = "_archive"

// the ticket ids a lane spec names as its chunks, in order, each once
// the spec's chunks, each the ids its heading names: a joint `## FRM-436 + FRM-424` heading is one chunk of two
func specChunks(spec string) [][]string {
	raw, _ := os.ReadFile(spec)
	var chunks [][]string
	for _, m := range chunkHeading.FindAllStringSubmatch(string(raw), -1) {
		ids := strings.Split(m[1], " + ")
		if !slices.ContainsFunc(chunks, func(c []string) bool { return slices.Equal(c, ids) }) {
			chunks = append(chunks, ids)
		}
	}
	return chunks
}

var chunkHeading = regexp.MustCompile(`(?m)^##? ((?:FRM|BYT|PK)-\d+(?: \+ (?:FRM|BYT|PK)-\d+)*)\b`)

// unmergedChunks names the spec's other chunks with no commit on origin/main; a squash merge carries the pr
// body's «- ticket:» lines, so a chunk merged in the same pr reads merged, and a joint chunk merged by any of its ids
func unmergedChunks(repo, spec, id string) []string {
	var waiting []string
	for _, chunk := range specChunks(spec) {
		if slices.Contains(chunk, id) || slices.ContainsFunc(chunk, func(other string) bool { return len(ticketCommits(repo, other)) > 0 }) {
			continue
		}
		waiting = append(waiting, strings.Join(chunk, " + "))
	}
	return waiting
}

// the archived spec that holds § id, beside the main checkout's other specs
func archivedSpec(main, id string) string {
	specs, _ := filepath.Glob(filepath.Join(main, ".scratch", archived, "*", "spec.md"))
	head := specHead(id)
	for _, spec := range specs {
		if raw, err := os.ReadFile(spec); err == nil && head.Match(raw) {
			return spec
		}
	}
	return ""
}
