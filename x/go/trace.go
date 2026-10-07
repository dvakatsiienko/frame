package main

import (
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"
)

// span is the one trace line a call leaves; the keys follow OpenTelemetry's span and attribute names
type span struct {
	Start    time.Time `json:"start_time"`
	Name     string    `json:"name"`
	Duration int64     `json:"duration_ms"`
	Flags    []string  `json:"x.flags"`
	Exit     int       `json:"process.exit.code"`
	Kind     string    `json:"error.type"`
}

// the call's span; the endings fill its error kind, the steps their times
var traced = &span{}

// the verb, or its family, or bare x — an unknown word is free text and stays out
func traceName(words []string) string {
	if verb, _, ok := findVerb(words); ok {
		return verb.Name
	}
	if len(words) > 0 && slices.Contains(families(), words[0]) {
		return words[0]
	}
	return "x"
}

func traceOff() bool { return os.Getenv("X_TRACE") == "0" }

// a flag's name only: its value can be a path or free text
func flagNames(argv []string) []string {
	names := []string{}
	for _, arg := range optionsOf(argv) {
		if name, ok := strings.CutPrefix(arg, "-"); ok {
			name, _, _ = strings.Cut(strings.TrimLeft(name, "-"), "=")
			names = append(names, name)
		}
	}
	return names
}

// write appends the line to the local day's file; a trace that cannot be written never fails the call
func (s *span) write() {
	if traceOff() {
		return
	}
	s.Duration = time.Since(s.Start).Milliseconds()
	dir := filepath.Join(stateDir(), "traces")
	if os.MkdirAll(dir, 0o755) != nil {
		return
	}
	file, err := os.OpenFile(filepath.Join(dir, s.Start.Format(time.DateOnly)+".jsonl"), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	defer file.Close()
	_, _ = file.WriteString(marshal(s) + "\n")
}
