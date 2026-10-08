package main

import (
	"errors"
	"os/exec"
	"path/filepath"
	"strings"
)

// a check whose output is a finding (gofmt -l, go fix -diff) is red on any output, not only on exit
type gateCheck struct {
	name          string
	args          []string
	env           []string
	failsOnOutput bool
}

var gateChecks = []gateCheck{
	{"gofmt", []string{"gofmt", "-l", "."}, nil, true},
	{"vet", []string{"go", "vet", "./..."}, nil, false},
	{"staticcheck", []string{"staticcheck", "./..."}, nil, false},
	{"fix", []string{"go", "fix", "-diff", "./..."}, nil, true},
	{"test", []string{"go", "test", "./..."}, []string{"GIT_CONFIG_GLOBAL=/dev/null"}, false},
}

// goGate runs x's go gate in the module x was built from; the failure names its step first, so the
// GATE line alone tells which check went red
func goGate(r *Run, args []string, _ Flags) (any, error) {
	dir := sourceDir()
	if len(args) > 0 {
		abs, err := filepath.Abs(args[0])
		if err != nil || !exists(filepath.Join(abs, "go.mod")) {
			return nil, &Fail{IsUsage: true, Msg: "no go.mod in " + args[0], Next: "x go gate <module dir>"}
		}
		dir = abs
	}
	r.Open(dir)
	for _, c := range gateChecks {
		doing := strings.Join(c.args, " ")
		if err := r.Step(c.name, doing, func() (string, error) {
			got, err := run(dir, c.env, "", c.args[0], c.args[1:]...)
			if errors.Is(err, exec.ErrNotFound) {
				return "", &Fail{Msg: "GATE red: " + c.name + " is not installed", Next: "brew install " + c.args[0]}
			}
			if !got.ok || (c.failsOnOutput && got.out != "") {
				return "", &Fail{Msg: "GATE red: " + c.name, Next: doing, Log: nonBlank(got.log)}
			}
			return "clean", nil
		}); err != nil {
			return nil, err
		}
	}
	r.Done("GATE ok", "")
	return ordered{{"gate", "ok"}, {"dir", dir}}, nil
}
