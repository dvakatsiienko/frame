package main

import (
	"bytes"
	"cmp"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"
)

var (
	roleSkill   = regexp.MustCompile(`^/x:crew-(codie|sixth-sense|designer)\b`)
	wishLine    = regexp.MustCompile(`(?m)^wish:`)
	briefOfCat  = regexp.MustCompile(`^\$\((?:cat\s+|<\s*)['"]?([^)'"\s]+)['"]?\s*\)$`)
	ticketArg   = regexp.MustCompile(`^(?:FRM|BYT)-\d+$`)
	reviewedArg = regexp.MustCompile(`^(?:https://github\.com/\S+/pull/\d+|main:[0-9a-f]{7,40})$`)
	appOfBrief  = regexp.MustCompile(`\bapps/([\w-]+)/`)
	// a lane is named by its own spec's dir (the path after spec:), the name x lane dispatch and the lane plan share
	laneSpecDir  = regexp.MustCompile(`\bspec:\s*['"]?[^\s'"]*?\.scratch/([\w.-]+)/spec\.md\b`)
	laneKindLine = regexp.MustCompile(`(?m)^[-\s]*lane:\s*(side|quick|shift)\b`)
)

// summonCheck is one mechanical preflight step a summon command fails
type summonCheck struct{ step, why, next string }

// a summon check's answer: what a caller reads, and the record --apply writes (a check writes none)
type summonPlanned struct {
	ordered
	record  thread
	isFresh bool
}

func askSummon(plan any) string {
	return "record the thread " + plan.(summonPlanned).record.Display + "?"
}

// briefSummonApply writes the record a check planned; the session id in the argv it printed is the one recorded
func briefSummonApply(r *Run, _ []string, _ Flags, planned any) (any, error) {
	plan := planned.(summonPlanned)
	if err := writeThreadRecord(plan.record, time.Now(), plan.isFresh); err != nil {
		if fail, isFail := errors.AsType[*Fail](err); isFail {
			return nil, fail
		}
		return nil, &Fail{Msg: "the thread record was not written: " + err.Error(), Next: "x thread list"}
	}
	if r.human && plan.isFresh {
		for _, field := range plan.ordered {
			if field.key == "argv" {
				fmt.Println(field.value)
			}
		}
	}
	r.Done("ok: "+plan.record.SessionID+" is "+threadDisplay(plan.record), "")
	return plan.ordered, nil
}

// briefSummonPlan checks a summon command the way x:crew-lead § preflight would by hand, and never launches it:
// the judgment steps (reuse or summon, the model pick) stay the coordinator's; --apply writes the thread's record
func briefSummonPlan(r *Run, args []string, flags Flags) (any, error) {
	standing, err := standingRoleFlag(flags)
	if err != nil {
		return nil, err
	}
	if sid := flagString(flags, "session"); sid != "" {
		if len(args) > 0 || standing.Role == "" {
			return nil, usageFail("--session records a running thread: --role and no command", "x brief summon --role <role> --session "+sid)
		}
		return recordRunningPlan(r, standing, sid)
	}
	if len(args) == 0 {
		return nil, usageFail("no summon command", "x brief summon <the summon command>")
	}
	command := args[0]
	words := shellWords(command)
	r.Open("summon")

	// a summon without a cd starts in the cwd, so the cwd is the home whose trust key counts
	home, claude := "", -1
	for i, word := range words {
		// an `hc run --cwd <dir>` starts its terminal there, as a cd does
		if (word == "cd" || word == "--cwd") && i+1 < len(words) && home == "" && claude < 0 {
			home = filepath.Clean(expandHome(words[i+1]))
		}
		if word == "claude" && claude < 0 {
			claude = i
		}
	}
	if claude < 0 {
		return nil, usageFail("no claude call in the summon command", `x brief summon "hc run --bg --no-parent --no-notify --name <short> --cwd <home> -- claude -n '<name>' … \"$(cat <brief>)\" --remote-control"`)
	}
	if home == "" {
		home, _ = os.Getwd()
	}
	if standing.Role != "" {
		if flagString(flags, "lane-kind") != "" || flagString(flags, "area") != "" {
			return nil, usageFail("--lane-kind and --area name a lane member's thread; a standing role draws its whole display from roles.json", "x brief summon --role "+flagString(flags, "role")+" …")
		}
		return summonStandingPlan(r, command, words[claude:], home, standing)
	}
	argv := words[claude:]
	prompt := slices.IndexFunc(argv, func(w string) bool { return briefOfCat.MatchString(w) || roleSkill.MatchString(w) })

	var failed []summonCheck
	// next is the command that fixes the step; a step fixed in the command itself reruns the check
	fail := func(step, why string, next ...string) {
		failed = append(failed, summonCheck{step, why, strings.Join(next, "")})
	}
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

	// a herdr thread summons into a herdr terminal, dima's native way (FRM-574 decided 5); `hc run` before the claude call
	if os.Getenv("HC_TERMINAL_ID") != "" {
		step("herdr", "from a herdr thread the summon runs through hc run", func() {
			if !slices.Contains(words[:claude], "hc") || !slices.Contains(words[:claude], "run") {
				fail("herdr", "this thread runs in herdr, so its summon starts in a herdr terminal: hc run … -- claude …",
					"x brief summon "+quote("hc run --bg --no-parent --no-notify --name <short> --cwd "+home+" -- "+herdrClaude(command)))
			}
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
			fail("role", "the first line opens with the role skill, /x:crew-codie <id> …", restamp(brief))
		}
	})
	// sixth sense's argv is inline by design; any other role's brief is a file x brief check stamped
	if brief == "" && role != "" && role != "sixth-sense" {
		step("stamp", "x brief check passed the brief", func() {
			fail("stamp", "an inline "+role+" prompt skips x brief check: write the brief to a file, check it, pass it as \"$(cat <file>)\"", "x brief check <brief file>")
		})
	}
	if brief != "" {
		step("wish", "a wish: line in the first 10 lines", func() {
			lines := strings.SplitN(text, "\n", 11)
			if !wishLine.MatchString(strings.Join(lines[:min(10, len(lines))], "\n")) {
				fail("wish", "a wish: line (or wish: none) sits in the first 10 lines", restamp(brief))
			}
		})
		step("stamp", "x brief check passed these bytes", func() {
			if _, stamp := briefStamp([]byte(text)); !exists(stamp) {
				fail("stamp", "no x brief check stamp for these bytes", restamp(brief))
			}
		})
	}
	step("trials", "every live trial that fits is named or skipped", func() {
		if why := trialGate(command); why != "" {
			fail("trials", why, restamp(brief))
		}
	})
	{
		step("trust", "the summon home's trust key", func() {
			if !trusted(home) {
				fail("trust", home+" has no hasTrustDialogAccepted in ~/.claude.json: a --bg summon there stalls on the dialog",
					"jq '.projects[\""+home+"\"].hasTrustDialogAccepted = true' ~/.claude.json > /tmp/claude.json && mv /tmp/claude.json ~/.claude.json")
			}
		})
	}
	step("spare", "no pre-warmed spare older than a day", func() {
		if staleSpare() {
			fail("spare", "a claude bg-spare is older than a day and once booted a member without AGENTS.md", "claude daemon stop --keep-workers")
		}
	})
	// a bytes checkout or worktree is known by its essentials script
	if exists(filepath.Join(home, "script/apps-essentials.ts")) {
		if m := appOfBrief.FindStringSubmatch(text); m != nil {
			step("essentials", "the app essentials of "+m[1], func() {
				if _, err := runCmd(cmdIn(home, "node", "script/apps-essentials.ts", "--app", m[1])); err != nil {
					fail("essentials", m[1]+" fails its essentials", "node script/apps-essentials.ts --app "+m[1])
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
	if err := coordinatorOnly("x brief summon"); err != nil {
		return nil, err
	}
	// the thread's identity is its session id, minted here so the record exists before the thread runs
	area, err := areaRequired(flags, "brief summon")
	if err != nil {
		return nil, err
	}
	kind, err := laneKindFlag(flags)
	if err != nil {
		return nil, err
	}
	record := thread{Role: role, Area: area}
	if words := strings.Fields(first); len(words) > 1 && ticketArg.MatchString(words[1]) {
		record.Ticket = words[1]
	}
	if m := laneSpecDir.FindStringSubmatch(text); m != nil {
		record.Lane = m[1]
	}
	if m := laneKindLine.FindStringSubmatch(text); m != nil {
		record.LaneKind = m[1]
	}
	// the flag outranks the brief's lane: line, so the name is right from birth when the brief names none
	record.LaneKind = cmp.Or(kind, record.LaneKind)
	// a sixth sense's inline argv names no lane kind: it takes its lane's, from the codie record of the same lane
	if record.LaneKind == "" && record.Lane != "" {
		if store, err := readThreadStore(threadStorePath()); err == nil {
			for _, t := range store.Threads {
				if t.Lane == record.Lane && t.LaneKind != "" {
					record.LaneKind = t.LaneKind
				}
			}
		}
	}
	// a lane member works from its brief: cc's grey prompt suggestion in its box would only block a rename (x thread rename)
	command, err = withoutPromptSuggestions(command)
	if err != nil {
		return nil, err
	}
	out, record, err := summonArgv(command, record)
	if err != nil {
		return nil, err
	}
	return summonPlanned{ordered{{"argv", out}, {"brief", brief}, {"home", home}, {"role", role}, {"sessionId", record.SessionID}, {"display", threadDisplay(record)}}, record, true}, nil
}

// the four standing roles start by a door of their own, never a lane brief, so their summon checks only what a start
// needs: a claude call and the trusted home; a --bg start records after cc prints its job, through --session
func summonStandingPlan(r *Run, command string, words []string, home string, record thread) (any, error) {
	var failed []summonCheck
	step := func(name, detail string, check func() string) {
		_ = r.Step(name, detail, func() (string, error) {
			if why := check(); why != "" {
				failed = append(failed, summonCheck{name, why, ""})
				return "1 finding", nil
			}
			return "ok", nil
		})
	}
	step("argv", "a pane start, whose session id x picks", func() string {
		if slices.Contains(words, "--bg") {
			return "claude --bg ignores --session-id: start it, then record its session: x brief summon --role " + standingRoleWord(record) + " --session <sid>"
		}
		return ""
	})
	step("trust", "the summon home's trust key", func() string {
		if !trusted(home) {
			return home + " has no hasTrustDialogAccepted in ~/.claude.json"
		}
		return ""
	})
	if len(failed) > 0 {
		return nil, summonRefused(failed, command)
	}
	if err := standingGate("x brief summon", record); err != nil {
		return nil, err
	}
	// crow and helga work unprompted, so a grey suggestion would only block a rename; clio and her wings keep theirs
	if record.Role == "adviser" || record.Role == "copyist" {
		var err error
		if command, err = withoutPromptSuggestions(command); err != nil {
			return nil, err
		}
	}
	out, record, err := summonArgv(command, record)
	if err != nil {
		return nil, err
	}
	return summonPlanned{ordered{{"argv", out}, {"home", home}, {"role", record.Role}, {"sessionId", record.SessionID}, {"display", threadDisplay(record)}}, record, true}, nil
}

// a thread already running gets its standing role: a --bg start once cc printed its job, or the cutover's backfill;
// the session must be live and hold no other role (threadRoleRefusal)
func recordRunningPlan(r *Run, record thread, sid string) (any, error) {
	r.Open("summon")
	if err := standingGate("x brief summon --session", record); err != nil {
		return nil, err
	}
	record.SessionID = sid
	return summonPlanned{ordered{{"sessionId", sid}, {"role", record.Role}, {"display", threadDisplay(record)}}, record, false}, nil
}

// the caller gate, plus round 2's pane rule: a coordinator or wing record is never written for a caller in a herdr
// terminal with no registered claude above it, since a member's `hc run` pane looks like dima's own; dima's herdr
// layout starts clio with HC_TERMINAL_ID unset (a known gap: `env -u` strips it as easily, FTR)
func standingGate(verb string, record thread) error {
	if err := coordinatorOnly(verb); err != nil {
		return err
	}
	if !roleOf(record.Role).IsCoordinator || os.Getenv("HC_TERMINAL_ID") == "" {
		return nil
	}
	if table, err := readProcessTable(); err == nil && len(callerChain(table, powerSessionsDir())) > 0 {
		return nil
	}
	// dima, 15:47: while no coordinator record is live, his herdr layout still starts clio, warned; a dead clio's
	// record a halt left behind is none, or the next morning's start is refused
	if store, err := readThreadStore(powerThreadStorePath()); err == nil && !slices.ContainsFunc(joinThreads(time.Now(), store.Threads), func(t thread) bool {
		return t.Role == "coordinator" && !t.Fallback
	}) {
		fmt.Fprintln(os.Stderr, "x: a herdr terminal gets a coordinator's record while no live thread holds one (the pane fallback)")
		return nil
	}
	return &Fail{Refused: true, Msg: verb + " gives a coordinator's role, never to a herdr terminal with no claude above it", Next: roleRefusalNext}
}

// --role's word: coordinator, wing:<n>, adviser or copyist, the ids roles.json gives a display of their own
func standingRoleFlag(flags Flags) (thread, error) {
	word := flagString(flags, "role")
	if word == "" {
		return thread{}, nil
	}
	id, number, hasNumber := strings.Cut(word, ":")
	r := roleOf(id)
	if r.Display == "" {
		return thread{}, usageFail("no standing role "+word, "x brief summon --role coordinator|wing:<n>|adviser|copyist …")
	}
	n, err := strconv.Atoi(number)
	needsNumber := strings.Contains(r.Display, "{n}")
	if needsNumber != hasNumber || (needsNumber && (err != nil || n < 1)) {
		return thread{}, usageFail(word+": a wing takes its number, wing:<n>, and no other role takes one", "x brief summon --role wing:<n> …")
	}
	return thread{Role: id, Wing: n}, nil
}

func standingRoleWord(t thread) string {
	if t.Wing > 0 {
		return t.Role + ":" + strconv.Itoa(t.Wing)
	}
	return t.Role
}

// the argv a summon prints: the name the record draws, which the command's own -n must already be, and the session id
// after the claude call, the one the command carries or one derived from its text, so a check and its --apply agree
func summonArgv(command string, record thread) (string, thread, error) {
	at := claudeCallAt(command)
	if at == nil {
		return "", record, usageFail("the claude call is quoted, so x cannot add its --session-id", "x brief summon "+quote(herdrClaude(command)))
	}
	if from, to := nameValueAt(command, at[1]); from >= 0 {
		typed, display := unquoted(command[from:to]), threadDisplay(record)
		if typed != display {
			fixed := command[:from] + quote(display) + command[to:]
			return "", record, &Fail{Refused: true, Msg: "-n names «" + typed + "», and x draws «" + display + "» for this thread: one thread, one name on every surface. another area word is --area <word>", Next: "x brief summon " + quote(fixed)}
		}
	}
	record.SessionID = summonSessionID(command)
	if !sessionIDFlag.MatchString(command) {
		command = command[:at[1]] + "--session-id " + record.SessionID + " " + command[at[1]:]
	}
	return command, record, nil
}

var sessionIDFlag = regexp.MustCompile(`--session-id\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})`)

// the id a command's thread runs under: the one it carries, else a uuid derived from its text, the next free one when
// a record, a live session file or a transcript already holds it, so a check and the --apply that follows it print the
// same id and a repeated summon, an identical morning line included, gets its own
func summonSessionID(command string) string {
	if m := sessionIDFlag.FindStringSubmatch(command); m != nil {
		return m[1]
	}
	held := map[string]bool{}
	if path := threadStorePath(); path != "" {
		if store, err := readThreadStore(path); err == nil {
			for _, t := range store.Threads {
				held[t.SessionID] = true
			}
		}
	}
	for n := 0; ; n++ {
		sum := sha256.Sum256([]byte(command + "\x00" + strconv.Itoa(n)))
		b := sum[:16]
		b[6] = b[6]&0x0f | 0x40
		b[8] = b[8]&0x3f | 0x80
		if id := fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:]); !held[id] && !hasSessionTrace(id) {
			return id
		}
	}
}

// a session id cc already ran under leaves a registry file or a transcript, though its record is long gone
func hasSessionTrace(id string) bool {
	if transcripts, _ := filepath.Glob(filepath.Join(projectsDir(), "*", id+".jsonl")); len(transcripts) > 0 {
		return true
	}
	files, _ := filepath.Glob(filepath.Join(sessionsDir(), "*.json"))
	for _, file := range files {
		if raw, err := os.ReadFile(file); err == nil && bytes.Contains(raw, []byte(id)) {
			return true
		}
	}
	return false
}

// a shell word without the quotes that held it
func unquoted(word string) string {
	if len(word) >= 2 && (word[0] == '\'' || word[0] == '"') && word[len(word)-1] == word[0] {
		return word[1 : len(word)-1]
	}
	return word
}

// nameValueAt is the byte span of the word after the claude call's first -n, quotes included; -1 when it has none
func nameValueAt(command string, from int) (int, int) {
	// from sits right after `claude `, so a space before it makes the first flag findable like any other
	i := strings.Index(" "+command[from:], " -n ")
	if i < 0 || from+i+3 >= len(command) {
		return -1, -1
	}
	start := from + i + 3
	if q := command[start]; q == '\'' || q == '"' {
		end := strings.IndexByte(command[start+1:], q)
		if end < 0 {
			return -1, -1
		}
		return start, start + end + 2
	}
	end := strings.IndexAny(command[start:], " \t\n")
	if end < 0 {
		return start, len(command)
	}
	return start, start + end
}

func summonRefused(failed []summonCheck, command string) error {
	msg := []string{plural(len(failed), "step") + " the summon skips"}
	for _, f := range failed {
		msg = append(msg, "step "+f.step+": "+f.why)
	}
	next := cmp.Or(failed[0].next, "x brief summon "+quote(command))
	return &Fail{Refused: true, Msg: strings.Join(msg, "\n"), Next: next}
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

// a brief edit changes its bytes, so the fix ends in a fresh stamp; no brief file means the fix is in the command
func restamp(brief string) string {
	if brief == "" {
		return ""
	}
	return "x brief check " + quote(brief)
}

// the claude call as typed, quotes kept, as a herdr terminal runs it: in a pane of its own, so no --bg
func herdrClaude(command string) string {
	at := claudeCallAt(command)
	if at == nil {
		return "claude -n '<name>' … \"$(cat <brief>)\" --remote-control"
	}
	return strings.TrimSpace(bgFlag.ReplaceAllString(command[at[0]:], " "))
}

// the claude the command runs: the first claude word outside quotes and $( ), so a quoted name holding the word
// never takes the --session-id; its start and the index past its space
func claudeCallAt(command string) []int {
	var quoted byte
	depth := 0
	for i := 0; i < len(command); i++ {
		c := command[i]
		switch {
		case quoted != 0:
			if c == quoted {
				quoted = 0
			}
		case c == '\'' || c == '"' || c == '`':
			quoted = c
		case c == '$' && strings.HasPrefix(command[i:], "$("):
			depth++
			i++
		case c == ')' && depth > 0:
			depth--
		case depth == 0 && strings.HasPrefix(command[i:], "claude") && len(command) > i+6 && strings.IndexByte(" \t\n", command[i+6]) >= 0 &&
			(i == 0 || strings.IndexByte(" \t\n;&|(", command[i-1]) >= 0):
			return []int{i, i + 7}
		}
	}
	return nil
}

var bgFlag = regexp.MustCompile(`\s--bg(?:\s|$)`)

// --lane-kind: the mode the summoned member's name opens with, side (🌗), quick (⚡) or shift (🌘)
func laneKindFlag(flags Flags) (string, error) {
	kind := flagString(flags, "lane-kind")
	if _, isKnown := laneKindMark[kind]; kind != "" && !isKnown {
		return "", usageFail(kind+" is no lane kind: side, quick or shift", "x brief summon … --lane-kind quick")
	}
	return kind, nil
}

// withoutPromptSuggestions puts promptSuggestionEnabled: false into the claude call's --settings json: the one flag the
// command carries, merged into when it has one (a quick lane's worktree setting), added when it has none; a value the
// command already gave the key stays
func withoutPromptSuggestions(command string) (string, error) {
	at := claudeCallAt(command)
	if at == nil {
		return command, nil
	}
	const key = "promptSuggestionEnabled"
	flagAt := strings.Index(" "+command[at[1]:], " --settings ")
	if flagAt < 0 {
		return command[:at[1]] + `--settings '{"` + key + `":false}' ` + command[at[1]:], nil
	}
	start := at[1] + flagAt + len(" --settings ") - 1
	from, to := start, start
	if start < len(command) && (command[start] == '\'' || command[start] == '"') {
		end := strings.IndexByte(command[start+1:], command[start])
		if end < 0 {
			return "", usageFail("the --settings json is not closed", "x brief summon … --settings '{…}'")
		}
		to = start + end + 2
	} else if end := strings.IndexAny(command[start:], " \t\n"); end >= 0 {
		to = start + end
	} else {
		to = len(command)
	}
	var settings map[string]any
	if err := json.Unmarshal([]byte(unquoted(command[from:to])), &settings); err != nil {
		return "", usageFail("the --settings json does not parse: "+err.Error(), "x brief summon … --settings '{…}'")
	}
	if _, isSet := settings[key]; isSet {
		return command, nil
	}
	settings[key] = false
	merged, _ := json.Marshal(settings)
	return command[:from] + quote(string(merged)) + command[to:], nil
}
