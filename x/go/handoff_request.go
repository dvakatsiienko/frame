package main

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var (
	requestFence = regexp.MustCompile("(?s)```\n(HANDOFF REQUEST.*?)\n```")
	targetLine   = regexp.MustCompile(`(?m)^TARGET: .*\n`)
)

const specMark = "<INLINE THE SPEC: full text of CST-SPEC.md>"

// handoffRequest prints the peer message the handoff-ingest skill sends, CST-SPEC.md inlined whole:
// a request pasted by hand once shipped a cut spec, and the receiver may never have seen the skill
func handoffRequest(r *Run, args []string, flags Flags) (any, error) {
	target := args[0]
	plugin := filepath.Join(filepath.Dir(filepath.Dir(sourceDir())), "home/.claude/plugin-x")
	skill, err := os.ReadFile(filepath.Join(plugin, "skills/handoff-ingest/SKILL.md"))
	if err != nil {
		return nil, &Fail{Msg: "no handoff-ingest skill at " + home(plugin), Next: "x schema handoff request"}
	}
	spec, err := os.ReadFile(filepath.Join(plugin, "CST-SPEC.md"))
	if err != nil {
		return nil, &Fail{Msg: "no CST-SPEC.md at " + home(plugin), Next: "x schema handoff request"}
	}
	m := requestFence.FindSubmatch(skill)
	if m == nil || !strings.Contains(string(m[1]), specMark) {
		return nil, &Fail{Msg: "the handoff-ingest skill holds no request template with the spec mark", Next: "read " + home(filepath.Join(plugin, "skills/handoff-ingest/SKILL.md"))}
	}
	message := targetLine.ReplaceAllString(string(m[1]), "")
	if focus := strings.TrimSpace(flagString(flags, "target-line")); focus != "" {
		if strings.ContainsAny(focus, "\r\n") {
			return nil, usageFail("--target-line is one line", "x handoff request "+quote(target)+" --target-line '<focus>'")
		}
		head, rest, _ := strings.Cut(message, "\n")
		message = head + "\nTARGET: " + focus + "\n" + rest
	}
	message = strings.Replace(message, specMark, strings.TrimSuffix(string(spec), "\n"), 1) + "\n"
	if r.human {
		fmt.Print(message)
	}
	return ordered{{"target", target}, {"bytes", len(message)}, {"message", message}}, nil
}
