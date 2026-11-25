package main

import (
	"fmt"
	"os"
	"strings"
)

func firstLine(path string) string {
	body, _ := os.ReadFile(path)
	line, _, _ := strings.Cut(strings.TrimSpace(string(body)), "\n")
	return line
}

func nonBlank(log string) []string {
	var lines []string
	for line := range strings.SplitSeq(log, "\n") {
		if strings.TrimSpace(line) != "" {
			lines = append(lines, line)
		}
	}
	return lines
}

func short(sha string) string { return sha[:min(7, len(sha))] }

func home(path string) string {
	if dir, err := os.UserHomeDir(); err == nil && strings.HasPrefix(path, dir) {
		return "~" + strings.TrimPrefix(path, dir)
	}
	return path
}

func plural(n int, word string) string {
	if n == 1 {
		return "1 " + word
	}
	return fmt.Sprintf("%d %ss", n, word)
}

func or(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
