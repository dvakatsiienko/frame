package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
)

var (
	roleSkill   = regexp.MustCompile(`^/x:crew-(codie|sixth-sense|designer)\b`)
	wishLine    = regexp.MustCompile(`(?m)^wish:`)
	briefOfCat  = regexp.MustCompile(`^\$\((?:cat\s+|<\s*)['"]?([^)'"\s]+)['"]?\s*\)$`)
	ticketArg   = regexp.MustCompile(`^(?:FRM|BYT)-\d+$`)
	reviewedArg = regexp.MustCompile(`^(?:https://github\.com/\S+/pull/\d+|main:[0-9a-f]{7,40})$`)
	appOfBrief  = regexp.MustCompile(`\bapps/([\w-]+)/`)
)

// summonCheck is one mechanical preflight step a summon command fails
type summonCheck struct{ step, why string }

// briefSummon checks a summon command the way x:crew-lead § preflight would by hand, and never launches it:
// the judgment steps (reuse or summon, the model pick) stay the coordinator's
func briefSummon(r *Run, args []string, _ Flags) (any, error) {
	command := args[0]
	words := shellWords(command)
	r.Open("summon")

	home, claude := "", -1
	for i, word := range words {
		if word == "cd" && i+1 < len(words) && home == "" {
			home = filepath.Clean(expandHome(words[i+1]))
		}
		if word == "claude" && claude < 0 {
			claude = i
		}
	}
	if claude < 0 {
		return nil, usageFail("no claude call in the summon command", `x brief summon "cd <home> && claude --bg -n '<name>' … \"$(cat <brief>)\" --remote-control"`)
	}
	argv := words[claude:]
	prompt := slices.IndexFunc(argv, func(w string) bool { return briefOfCat.MatchString(w) || roleSkill.MatchString(w) })

	var failed []summonCheck
	fail := func(step, why string) { failed = append(failed, summonCheck{step, why}) }
	step := func(name, detail string, check func()) {
		before := len(failed)
		_ = r.Step(name, detail, func() (string, error) {
			check()
			if len(failed) > before {
				return plural(len(failed)-before, "finding"), nil
			}
			return "ok", nil
		})
	}

	step("argv", "-n before the prompt, the prompt before --remote-control", func() {
		name, rc := slices.Index(argv, "-n"), slices.Index(argv, "--remote-control")
		switch {
		case prompt < 0:
			fail("argv", `no prompt: pass the brief as "$(cat <file>)" or the role skill line in quotes`)
		case name < 0 || name > prompt:
			fail("argv", "-n <registry name> comes before the prompt")
		case rc >= 0 && rc < prompt:
			fail("argv", "the prompt comes before --remote-control, or the flag eats it as its label")
		}
	})
	if prompt < 0 {
		return nil, summonRefused(failed, command)
	}

	text, brief := argv[prompt], ""
	if m := briefOfCat.FindStringSubmatch(argv[prompt]); m != nil {
		brief = filepath.Clean(expandHome(m[1]))
		if !filepath.IsAbs(brief) && home != "" {
			brief = filepath.Join(home, brief)
		}
		raw, err := os.ReadFile(brief)
		if err != nil {
			return nil, usageFail("no brief at "+brief, "x brief summon <the summon command>")
		}
		text = string(raw)
	}
	first, _, _ := strings.Cut(text, "\n")
	role := ""
	if m := roleSkill.FindStringSubmatch(first); m != nil {
		role = m[1]
	}

	step("role", "the first line names the role skill", func() {
		if role == "" {
			fail("role", "the first line opens with the role skill, /x:crew-codie <id> …")
		}
	})
	if brief != "" {
		step("wish", "a wish: line in the first 10 lines", func() {
			lines := strings.SplitN(text, "\n", 11)
			if !wishLine.MatchString(strings.Join(lines[:min(10, len(lines))], "\n")) {
				fail("wish", "a wish: line (or wish: none) sits in the first 10 lines")
			}
		})
		step("stamp", "x brief check passed these bytes", func() {
			sum := fmt.Sprintf("%x", sha256.Sum256([]byte(text)))
			if !exists(filepath.Join(stateDir(), "briefs", sum+".json")) {
				fail("stamp", "no x brief check stamp for these bytes: x brief check "+quote(brief))
			}
		})
	}
	step("trials", "every live trial that fits is named or skipped", func() {
		if why := trialGate(command); why != "" {
			fail("trials", why)
		}
	})
	if home != "" {
		step("trust", "the summon home's trust key", func() {
			if !trusted(home) {
				fail("trust", home+" has no hasTrustDialogAccepted in ~/.claude.json: a --bg summon there stalls on the dialog")
			}
		})
	}
	step("spare", "no pre-warmed spare older than a day", func() {
		if staleSpare() {
			fail("spare", "a claude bg-spare is older than a day and once booted a member without AGENTS.md: claude daemon stop --keep-workers")
		}
	})
	if filepath.Base(home) == "bytes" {
		if m := appOfBrief.FindStringSubmatch(text); m != nil {
			step("essentials", "the app essentials of "+m[1], func() {
				if _, err := runCmd(cmdIn(home, "node", "script/apps-essentials.ts", "--app", m[1])); err != nil {
					fail("essentials", m[1]+" fails its essentials: node script/apps-essentials.ts --app "+m[1])
				}
			})
		}
	}
	if role == "sixth-sense" {
		step("sixth sense", "the four arguments, then spec:", func() {
			if why := sixthSenseArgs(text); why != "" {
				fail("sixth sense", why)
			}
		})
	}

	if len(failed) > 0 {
		return nil, summonRefused(failed, command)
	}
	if r.human {
		fmt.Println(command)
	}
	r.Done("ok: every mechanical step holds, the argv is the summon", "")
	return ordered{{"argv", command}, {"brief", brief}, {"home", home}, {"role", role}}, nil
}

func summonRefused(failed []summonCheck, command string) error {
	msg := []string{plural(len(failed), "step") + " the summon skips"}
	for _, f := range failed {
		msg = append(msg, "step "+f.step+": "+f.why)
	}
	return &Fail{Refused: true, Msg: strings.Join(msg, "\n"), Next: "x brief summon " + quote(command)}
}

// the frame tree x runs from; a test points it at a fixture tree
func frameRoot() string {
	if root := os.Getenv("X_FRAME_ROOT"); root != "" && os.Getenv("X_TEST") != "" {
		return root
	}
	return filepath.Dir(filepath.Dir(sourceDir()))
}

// trialGate asks the trial list's own spawn hook, the one source of which trials fit a member
func trialGate(command string) string {
	input, _ := json.Marshal(map[string]any{"tool_input": map[string]string{"command": command}})
	c := exec.Command("node", filepath.Join(frameRoot(), "script/test-drive-list.ts"), "--spawn-hook")
	c.Stdin = bytes.NewReader(input)
	out, err := c.Output()
	if err != nil {
		return "the trial list did not answer (node script/test-drive-list.ts --spawn-hook): " + err.Error()
	}
	var verdict struct {
		Hook struct {
			Decision string `json:"permissionDecision"`
			Reason   string `json:"permissionDecisionReason"`
		} `json:"hookSpecificOutput"`
	}
	if json.Unmarshal(out, &verdict) == nil && verdict.Hook.Decision == "deny" {
		return verdict.Hook.Reason
	}
	return ""
}

func trusted(home string) bool {
	userHome, _ := os.UserHomeDir()
	raw, err := os.ReadFile(filepath.Join(userHome, ".claude.json"))
	if err != nil {
		return false
	}
	var config struct {
		Projects map[string]struct {
			Trusted bool `json:"hasTrustDialogAccepted"`
		} `json:"projects"`
	}
	return json.Unmarshal(raw, &config) == nil && config.Projects[home].Trusted
}

// a spare's elapsed time reads [[dd-]hh:]mm:ss, so a day or more holds a dash; a test stands in X_SPARES for ps
func staleSpare() bool {
	listing := os.Getenv("X_SPARES")
	if os.Getenv("X_TEST") == "" {
		out, _ := runCmd(exec.Command("ps", "-o", "etime=,command=", "-ax"))
		listing = out.out
	}
	for line := range strings.Lines(listing) {
		if elapsed, rest, _ := strings.Cut(strings.TrimSpace(line), " "); strings.Contains(rest, "bg-spare") && strings.Contains(elapsed, "-") {
			return true
		}
	}
	return false
}

// /x:crew-sixth-sense <ticket> <pr url | main:sha> <codie> <clio> … spec: <path>
func sixthSenseArgs(prompt string) string {
	words := strings.Fields(prompt)
	at := slices.Index(words, "spec:")
	switch {
	case len(words) < 5 || !ticketArg.MatchString(words[1]) || !reviewedArg.MatchString(words[2]):
		return "the argv names the ticket, then the pr url or main:<sha>, then codie and clio by registry name"
	case at < 0 || at+1 >= len(words):
		return "spec: <the lane spec path> follows the four arguments, so sixth sense grades the spec's exit lines"
	case at < 5:
		return "spec: comes after all four arguments"
	}
	return ""
}
