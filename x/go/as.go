package main

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
)

// as runs one command with a member's token in that child's env only; the child's output and exit
// code are the call's, so an agent reads `x as coder -- linear api …` exactly as it read `linear api …`
func as(r *Run, args []string, _ Flags) (any, error) {
	member, command := args[0], args[1:]
	if !slices.Contains(members, member) {
		return nil, usageFail("no member "+member+" — x as takes "+strings.Join(members, ", "), "x as --help")
	}
	if len(command) == 0 {
		return nil, usageFail("no command after the member — x as "+member+" -- <command…>", "x as --help")
	}
	tool := filepath.Base(command[0])
	envName, ok := tokenEnv[tool]
	if !ok {
		return nil, usageFail("x as holds tokens for linear and gh, not "+tool, "x as --help")
	}
	path, err := exec.LookPath(command[0])
	if err != nil {
		return nil, usageFail("no "+command[0]+" on PATH", "x as --help")
	}
	traced.Actor = member
	token, err := tokenFor(member, tool)
	if err != nil {
		return nil, &Fail{Msg: "no " + tool + " token for " + member + ": " + err.Error(), Next: "x schema as"}
	}
	child := exec.Command(path, command[1:]...)
	child.Stdin, child.Stdout, child.Stderr = os.Stdin, os.Stdout, os.Stderr
	// an inherited token never reaches the child: dima on gh runs on his own login, with no app token
	child.Env = slices.DeleteFunc(os.Environ(), func(pair string) bool { return strings.HasPrefix(pair, envName+"=") })
	if token != "" {
		child.Env = append(child.Env, envName+"="+token)
	}
	r.passthrough = true
	if err := child.Run(); err != nil {
		var exit *exec.ExitError
		if !errors.As(err, &exit) {
			return nil, err
		}
		r.code = max(exit.ExitCode(), 1)
		traced.Kind = "external"
	}
	return nil, nil
}
