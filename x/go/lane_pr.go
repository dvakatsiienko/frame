package main

import (
	"cmp"
	"fmt"
)

func prPlan(r *Run, args []string, flags Flags) (any, error) {
	title, bodyFile := args[0], args[1]
	if !exists(bodyFile) {
		return nil, usageFail("no body file at "+bodyFile, "x lane pr-open <title> <body-file>")
	}
	name, err := branch()
	if err != nil {
		return nil, err
	}
	r.Open(name)
	var argv []string
	base := "main"
	if err := r.Step("plan", "checking the branch is pushed", func() (string, error) {
		if laneAddOn.prBase != nil {
			onto, err := laneAddOn.prBase(flags)
			if err != nil {
				return "", err
			}
			base = cmp.Or(onto, base)
		}
		remote, err := remoteBranch(".", name)
		if err != nil {
			return "", err
		}
		sha, err := head()
		if err != nil {
			return "", err
		}
		if remote != sha {
			return "", &Fail{Refused: true, Msg: "origin/" + name + " is not at HEAD", Next: "x lane push --apply"}
		}
		argv = []string{"pr", "create", "--base", base, "--head", name, "--title", title, "--body-file", bodyFile}
		return fmt.Sprintf("%s → %s: %s", name, base, title), nil
	}); err != nil {
		return nil, err
	}
	return ordered{{"argv", argv}, {"branch", name}, {"base", base}}, nil
}

func askPR(plan any) string {
	fields := plan.(ordered)
	return fmt.Sprintf("open a pr from %s onto %s as x-codie-cc?", fields[1].value, fields[2].value)
}

func prOpen(r *Run, _ []string, _ Flags, plan any) (any, error) {
	fields := plan.(ordered)
	name, argv := fields[1].value.(string), fields[0].value.([]string)
	var url string
	if err := r.Step("open", "gh pr create as x-codie-cc", func() (string, error) {
		opened, err := ghRaw(argv...)
		if err != nil {
			return "", err
		}
		if !opened.ok {
			return "", &Fail{Msg: "gh pr create failed — its output is above", Next: "gh pr view", Log: nonBlank(opened.log)}
		}
		url = opened.out
		return url, nil
	}); err != nil {
		return nil, err
	}
	r.Done(url, "")
	return ordered{{"branch", name}, {"url", url}}, nil
}
