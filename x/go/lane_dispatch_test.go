package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

const dispatchAbove = "lane: side\n\n## 🎯 done test\n\ngiven a ticket, when it runs, then it holds\n\n"

// a signed ticket as clio leaves it before a dispatch: the sign block, then the run stamp
var signedTicket = signedBody(dispatchAbove, "", dispatchAbove) + "\n⸻ 🪪 stamp — please keep 🙏"

// linear's state types, which the dispatch reads instead of a state's name
var stateTypes = map[string]string{"Todo": "unstarted", "In Progress": "started", "In Review": "started", "Done": "completed"}

type dispatchState struct {
	body, state, delegate string
	labels                []string
}

// dispatchServer answers the lookup with one ticket in the given state and records every mutation
func dispatchServer(t *testing.T, s dispatchState) *fakeLinear {
	t.Helper()
	return newFakeLinear(t, func(call gqlCall) string {
		if strings.Contains(call.Query, "mutation") {
			return `{"data":{"issueUpdate":{"success":true}}}`
		}
		var labels []string
		for _, name := range s.labels {
			labels = append(labels, `{"id":"l-`+name+`","name":"`+name+`"}`)
		}
		delegate := "null"
		if s.delegate != "" {
			delegate = `{"name":"` + s.delegate + `"}`
		}
		description, _ := json.Marshal(s.body)
		return `{"data":{"issue":{"id":"uuid-1","identifier":"FRM-1","description":` + string(description) + `,"state":{"name":"` + s.state + `","type":"` + stateTypes[s.state] + `"},"project":{"name":"cli"},"delegate":` + delegate +
			`,"labels":{"nodes":[` + strings.Join(labels, ",") + `]},"team":{"states":{"nodes":[{"id":"s-todo","name":"Todo"},{"id":"s-ip","name":"In Progress"}]}}},` +
			`"users":{"nodes":[{"id":"u-codie","name":"codie"}]}}}`
	})
}

// runDispatch runs against an empty frame root: the slices dir falls back to the lane, never a real ~/frame spec
func runDispatch(t *testing.T, server *fakeLinear, args ...string) (map[string]any, asRun) {
	t.Helper()
	return runDispatchIn(t, server, t.TempDir(), args...)
}

func runDispatchIn(t *testing.T, server *fakeLinear, frame string, args ...string) (map[string]any, asRun) {
	t.Helper()
	home := t.TempDir()
	write(t, filepath.Join(home, ".claude/shelf/cc-usage-window.json"), `{"rate_limits":{"five_hour":{"resets_at":1793389800,"used_percentage":20}}}`)
	return runLinear(t, server, []string{"HOME=" + home, "X_FRAME_ROOT=" + frame}, append([]string{"lane", "dispatch"}, args...)...)
}

func TestDispatchRefusesTicketsFromTwoLaneSpecs(t *testing.T) {
	t.Parallel()
	frame := repo(t)
	write(t, filepath.Join(frame, ".scratch/feat-a/spec.md"), "# feat a\n\n## FRM-1 — one\n")
	write(t, filepath.Join(frame, ".scratch/feat-b/spec.md"), "# feat b\n\n## FRM-2 — two\n")
	server := dispatchServer(t, dispatchState{body: signedTicket, state: "Todo", labels: []string{"agent", "signed"}})

	envelope, got := runDispatchIn(t, server, frame, "FRM-1", "FRM-2", "--session", "s1", "--lane", "cli-9")

	if got.code != 2 || !strings.Contains(jsonOf(envelope["error"]), "one dispatch is one lane") {
		t.Errorf("exit %d, want a usage refusal naming both specs:\n%s", got.code, got.stdout)
	}
}

func TestDispatchNamesTheSlicesDirAfterTheSpecsFeature(t *testing.T) {
	t.Parallel()
	frame := repo(t)
	write(t, filepath.Join(frame, ".scratch/feat-a/spec.md"), "# feat a\n\n## FRM-1 — the chunk\n")
	server := dispatchServer(t, dispatchState{body: signedTicket, state: "Todo", labels: []string{"agent", "signed"}})

	envelope, _ := runDispatchIn(t, server, frame, "FRM-1", "--session", "s1", "--lane", "cli-9")

	if out := jsonOf(envelope["plan"]); !strings.Contains(out, "lanes/feat-a/issues/") {
		t.Errorf("the slices dir must follow the spec's feature, as the lane plan does:\n%s", out)
	}
}

var undispatched = dispatchState{body: signedTicket, state: "Todo", labels: []string{"agent", "signed"}}

func TestDispatchDryRunPrintsTheFourMarksAndWritesNothing(t *testing.T) {
	t.Parallel()
	server := dispatchServer(t, undispatched)

	envelope, got := runDispatch(t, server, "FRM-1", "--session", "s1", "--lane", "cli-3")

	plan, _ := json.Marshal(envelope["plan"])
	if got.code != 4 || strings.Count(string(plan), `"write"`) != 4 {
		t.Fatalf("exit %d, want 4 with four marks to write:\n%s", got.code, got.stdout)
	}
	if n := len(mutations(server)); n != 0 {
		t.Errorf("%d mutations on a dry run", n)
	}
}

const quickTicket = "lane: quick\nrepo: frame\n\n## 🎯 done test\n\ngiven it, then it holds\n\n⸻ 🪪 stamp — please keep 🙏"

func frameAtBase(t *testing.T) (frame, base string) {
	t.Helper()
	frame = repo(t)
	gitT(t, frame, "update-ref", "refs/remotes/origin/main", "HEAD")
	return frame, gitT(t, frame, "rev-parse", "--short=7", "HEAD")
}

func TestDispatchQuickWritesItsThreeMarksWithNoSign(t *testing.T) {
	t.Parallel()
	frame, base := frameAtBase(t)
	server := dispatchServer(t, dispatchState{body: quickTicket, state: "Todo", labels: []string{"agent"}})

	_, got := runDispatchIn(t, server, frame, "--quick", "FRM-1", "--session", "s1", "--lane", "q", "--sixth-sense", "s2", "--apply")

	if got.code != 0 {
		t.Fatalf("exit %d\n%s", got.code, got.stdout)
	}
	input := updateInput(t, server)
	body, _ := input["description"].(string)
	line := " — q, codie s1, main:" + base + ", sixth sense s2\n"
	if input["stateId"] != "s-ip" || input["delegateId"] != "u-codie" || input["removedLabelIds"] != nil {
		t.Errorf("input %v, want In Progress, the delegate, no label touched", input)
	}
	if !strings.Contains(body, "\n🚀 dispatched ") || !strings.Contains(body, line) || !strings.HasSuffix(body, "\n\n⸻ 🪪 stamp — please keep 🙏") {
		t.Errorf("the 🚀 line %q is not above the stamp:\n%s", line, body)
	}
}

func TestDispatchQuickRefusesARepoNotOnThisMac(t *testing.T) {
	t.Parallel()
	frame, _ := frameAtBase(t)
	body := strings.ReplaceAll(quickTicket, "repo: frame", "repo: nowhere-here")
	server := dispatchServer(t, dispatchState{body: body, state: "Todo"})

	_, got := runDispatchIn(t, server, frame, "--quick", "FRM-1", "--session", "s1", "--lane", "q", "--apply")

	if got.code == 0 || !strings.Contains(got.stdout, "nowhere-here") || len(mutations(server)) != 0 {
		t.Fatalf("exit %d, want a refusal naming the repo, no write:\n%s", got.code, got.stdout)
	}
}

func TestDispatchQuickDryRunPlansThreeMarks(t *testing.T) {
	t.Parallel()
	frame, _ := frameAtBase(t)
	server := dispatchServer(t, dispatchState{body: quickTicket, state: "Todo"})

	envelope, got := runDispatchIn(t, server, frame, "--quick", "FRM-1", "--session", "s1", "--lane", "q")

	if plan := jsonOf(envelope["plan"]); got.code != 4 || strings.Count(plan, `"write"`) != 3 {
		t.Fatalf("exit %d, want 4 with three marks:\n%s", got.code, got.stdout)
	}
}

func TestDispatchQuickReRunWritesNoSecondLine(t *testing.T) {
	t.Parallel()
	frame, _ := frameAtBase(t)
	body := "lane: quick\n\n🚀 dispatched 2026-11-05 — q, codie s1, main:abc1234\n"
	server := dispatchServer(t, dispatchState{body: body, state: "In Progress", delegate: "codie"})

	_, got := runDispatchIn(t, server, frame, "--quick", "FRM-1", "--session", "s1", "--lane", "q", "--apply")

	if n := len(mutations(server)); got.code != 0 || n != 0 {
		t.Fatalf("exit %d, %d mutations on a re-run:\n%s", got.code, n, got.stdout)
	}
}

func TestDispatchWithoutQuickStillRefusesNoSign(t *testing.T) {
	t.Parallel()
	server := dispatchServer(t, dispatchState{body: quickTicket, state: "Todo"})

	_, got := runDispatch(t, server, "FRM-1", "--session", "s1", "--lane", "q", "--apply")

	if got.code == 0 || !strings.Contains(got.stderr+got.stdout, "no ## signed block") {
		t.Fatalf("exit %d, want the sign refusal:\n%s", got.code, got.stdout)
	}
}

func TestDispatchNamesASixthSenseOnASignedTicket(t *testing.T) {
	t.Parallel()
	server := dispatchServer(t, undispatched)

	_, got := runDispatch(t, server, "FRM-1", "--session", "s1", "--lane", "cli-3", "--sixth-sense", "s2", "--apply")

	body, _ := updateInput(t, server)["description"].(string)
	if got.code != 0 || !strings.Contains(body, " — cli-3, codie s1, sixth sense s2\n") {
		t.Fatalf("exit %d, body:\n%s", got.code, body)
	}
}

func TestDispatchApplySetsEveryMarkInOneUpdate(t *testing.T) {
	t.Parallel()
	server := dispatchServer(t, undispatched)

	envelope, got := runDispatch(t, server, "FRM-1", "--session", "s1", "--lane", "cli-3", "--apply")

	if got.code != 0 {
		t.Fatalf("exit %d\n%s", got.code, got.stdout)
	}
	input := updateInput(t, server)
	if input["stateId"] != "s-ip" || input["delegateId"] != "u-codie" || !strings.Contains(jsonOf(input["removedLabelIds"]), "l-signed") {
		t.Errorf("input %v, want In Progress, the codie delegate and the signed label off", input)
	}
	body, _ := input["description"].(string)
	if !strings.Contains(body, "\n🚀 dispatched ") || !strings.Contains(body, " — cli-3, codie s1\n") || !strings.HasSuffix(body, "\n\n⸻ 🪪 stamp — please keep 🙏") {
		t.Errorf("the 🚀 line is not the sign block's last line:\n%s", body)
	}
	if state, _, _ := bodySign(body); state != signMatch {
		t.Errorf("sign %s after the dispatch, want match: the line sits below ## signed", state)
	}
	if data := jsonOf(envelope["data"]); !strings.Contains(data, "glide") || !strings.Contains(data, "20%") {
		t.Errorf("the glide link and the 5h line are not printed: %s", data)
	}
}

func TestDispatchAgainReportsEveryMarkSetAndSendsNothing(t *testing.T) {
	t.Parallel()
	done := signedBody(dispatchAbove, "🚀 dispatched 2026-10-30 — cli-3, codie s1\n", dispatchAbove) + "\n⸻ 🪪 stamp — please keep 🙏"
	server := dispatchServer(t, dispatchState{body: done, state: "In Progress", delegate: "codie", labels: []string{"agent"}})

	// a later re-run with no lane or session reports the line the ticket holds, not one built from today
	envelope, got := runDispatch(t, server, "FRM-1", "--apply")

	if got.code != 0 || strings.Count(jsonOf(envelope["data"]), `"set"`) != 4 {
		t.Fatalf("exit %d, want every mark already set:\n%s", got.code, got.stdout)
	}
	if !strings.Contains(jsonOf(envelope["data"]), "🚀 dispatched 2026-10-30 — cli-3, codie s1") {
		t.Errorf("the 🚀 mark does not quote the ticket's own line:\n%s", got.stdout)
	}
	if n := len(mutations(server)); n != 0 {
		t.Errorf("%d mutations on a dispatched ticket", n)
	}
}

func TestDispatchReRunLeavesATicketPastInProgress(t *testing.T) {
	t.Parallel()
	cases := []struct{ name, body, state string }{
		{"a dispatched ticket now In Review", signedBody(dispatchAbove, "🚀 dispatched 2026-10-30 — cli-3, codie s1\n", dispatchAbove), "In Review"},
		// the body moved after the dispatch: the 🚀 stands, the re-run writes nothing
		{"a dispatched ticket whose body drifted since", signedBody(dispatchAbove+"an edit after the dispatch\n", "🚀 dispatched 2026-10-30 — cli-3, codie s1\n", dispatchAbove), "In Progress"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			server := dispatchServer(t, dispatchState{body: c.body, state: c.state, delegate: "codie", labels: []string{"agent"}})

			_, got := runDispatch(t, server, "FRM-1", "--apply")

			if n := len(mutations(server)); got.code != 0 || n != 0 {
				t.Errorf("exit %d with %d mutations, want 0 and nothing moved:\n%s", got.code, n, got.stdout)
			}
		})
	}
}

func TestDispatchWritesAgainAfterADispatchWasTakenBack(t *testing.T) {
	t.Parallel()
	back := signedBody(dispatchAbove, "🚀 dispatched 2026-10-29 — cli-2, codie s0\n↩️ back to Todo 2026-10-29\n", dispatchAbove) + "\n⸻ 🪪 stamp — please keep 🙏"
	server := dispatchServer(t, dispatchState{body: back, state: "Todo", labels: []string{"agent", "signed"}})

	envelope, got := runDispatch(t, server, "FRM-1", "--session", "s1", "--lane", "cli-3")

	if out := jsonOf(envelope["plan"]); got.code != 4 || strings.Count(out, `"write"`) != 4 {
		t.Errorf("exit %d, want all four marks to write again after the ↩️ line:\n%s", got.code, out)
	}
	if out := jsonOf(envelope["plan"]); !strings.Contains(out, "lanes/cli-3/issues/") {
		t.Errorf("the plan does not name the lane's slices dir outside the worktree:\n%s", out)
	}
}

func TestDispatchAgainWritesItsOwnLineWhenItNamesSomethingNew(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name, held string
		args       []string
		want       string
	}{
		{"a sixth sense added", "cli-3, codie s1", []string{"--lane", "cli-3", "--session", "s1", "--sixth-sense", "s2"}, " — cli-3, codie s1, sixth sense s2\n"},
		{"a sixth sense alone", "cli-3, codie s1", []string{"--sixth-sense", "s2"}, " — cli-3, codie s1, sixth sense s2\n"},
		{"another lane starts fresh", "mods-3, codie s0, sixth sense s9", []string{"--lane", "cli-3", "--session", "s1"}, " — cli-3, codie s1\n"},
		{"the same lane's successor keeps its sixth sense and base", "cli-3, codie s1, main:abc1234, sixth sense s2", []string{"--lane", "cli-3", "--session", "s5"}, " — cli-3, codie s5, main:abc1234, sixth sense s2\n"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			done := signedBody(dispatchAbove, "🚀 dispatched 2026-10-30 — "+c.held+"\n", dispatchAbove) + "\n⸻ 🪪 stamp — please keep 🙏"
			server := dispatchServer(t, dispatchState{body: done, state: "In Progress", delegate: "codie", labels: []string{"agent"}})

			_, got := runDispatch(t, server, append([]string{"FRM-1", "--apply"}, c.args...)...)

			body, _ := updateInput(t, server)["description"].(string)
			if got.code != 0 || !strings.Contains(body, c.want) {
				t.Fatalf("exit %d, want %q in:\n%s\n%s", got.code, c.want, body, got.stdout)
			}
			if !strings.Contains(body, "🚀 dispatched 2026-10-30 — "+c.held+"\n") {
				t.Errorf("the held line went, a dispatch's history stays:\n%s", body)
			}
			if last := body[strings.LastIndex(body, "🚀"):]; !strings.Contains(last, c.want) {
				t.Errorf("the new line must be the last 🚀, landed reads that one:\n%s", body)
			}
		})
	}
}

func TestDispatchAgainRefusesToDropAFlagOnALineItCannotRead(t *testing.T) {
	t.Parallel()
	done := signedBody(dispatchAbove, "🚀 dispatched 2026-10-30 — by hand, see the thread\n", dispatchAbove) + "\n⸻ 🪪 stamp — please keep 🙏"
	server := dispatchServer(t, dispatchState{body: done, state: "In Progress", delegate: "codie", labels: []string{"agent"}})

	_, got := runDispatch(t, server, "FRM-1", "--sixth-sense", "s2", "--apply")

	if got.code != 2 || len(mutations(server)) != 0 {
		t.Fatalf("exit %d, want a usage refusal and no write:\n%s", got.code, got.stdout)
	}
}

func TestDispatchQuickReadsABytesTicketsBaseFromBytes(t *testing.T) {
	t.Parallel()
	frame, frameBase := frameAtBase(t)
	home := t.TempDir()
	bytesRepo := filepath.Join(home, "projects/bytes")
	gitT(t, home, "init", "-q", "-b", "main", bytesRepo)
	write(t, filepath.Join(bytesRepo, "b.txt"), "bytes\n")
	gitT(t, bytesRepo, "add", "b.txt")
	gitT(t, bytesRepo, "commit", "-q", "-m", "bytes", "--date", "2020-01-01T00:00:00")
	gitT(t, bytesRepo, "update-ref", "refs/remotes/origin/main", "HEAD")
	base := gitT(t, bytesRepo, "rev-parse", "--short=7", "HEAD")
	if base == frameBase {
		t.Fatal("the two repos share a head, the row reads nothing")
	}
	server := dispatchServer(t, dispatchState{body: "lane: quick\n\n## 🎯 done test\n\ngiven it, then it holds\n", state: "Todo"})

	_, got := runLinear(t, server, []string{"HOME=" + home, "X_FRAME_ROOT=" + frame}, "lane", "dispatch", "--quick", "BYT-1", "--session", "s1", "--lane", "q", "--apply")

	body, _ := updateInput(t, server)["description"].(string)
	if got.code != 0 || !strings.Contains(body, "main:"+base) {
		t.Fatalf("exit %d, want bytes' base %s in:\n%s\n%s", got.code, base, body, got.stdout)
	}
}

func TestDispatchReadsAProseArrowAsNoTakeBack(t *testing.T) {
	t.Parallel()
	held := signedBody(dispatchAbove, "🚀 dispatched 2026-10-30 — cli-3, codie s1\n✏️ changed: the ↩️ line reworded\n", dispatchAbove) + "\n⸻ 🪪 stamp — please keep 🙏"
	server := dispatchServer(t, dispatchState{body: held, state: "In Progress", delegate: "codie", labels: []string{"agent"}})

	_, got := runDispatch(t, server, "FRM-1", "--apply")

	if n := len(mutations(server)); got.code != 0 || n != 0 {
		t.Fatalf("exit %d, %d mutations: a ↩️ inside a sentence takes nothing back:\n%s", got.code, n, got.stdout)
	}
}

// linear escapes markdown on save (`~` → `\~`, `[x]` → `\[x\]`, `_clio/` → `\_clio/`); ticket-sign.ts hashes the body
// with those escapes taken out, so a sign over a pull's escaped lines plus a fresh unescaped edit holds once linear re-escapes it
func TestDispatchHoldsASignWhoseOnlyDriftIsLinearsEscapes(t *testing.T) {
	t.Parallel()
	signedAs := dispatchAbove + "- [x] read ~/.config and _clio/ #1\n- [x] the new line in ~/frame\n\n"
	saved := dispatchAbove + "- \\[x\\] read \\~/.config and \\_clio/ \\#1\n- \\[x\\] the new line in \\~/frame\n\n"
	server := dispatchServer(t, dispatchState{body: signedBody(saved, "", signedAs), state: "Todo", labels: []string{"agent", "signed"}})

	_, got := runDispatch(t, server, "FRM-1", "--session", "s1", "--lane", "cli-3")

	if got.code != 4 || strings.Contains(got.stdout, "drifted") {
		t.Errorf("exit %d, want the dry run's confirm, a sign linear only escaped never drifted:\n%s", got.code, got.stdout)
	}
}

func TestDispatchRefusesATicketWithNoSign(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name, want string
		s          dispatchState
	}{
		{"no ## signed block", "no ## signed block", dispatchState{body: dispatchAbove, state: "Todo", labels: []string{"agent", "signed"}}},
		{"neither the label nor a 🚀 line", "its sign is missing", dispatchState{body: signedTicket, state: "Todo", labels: []string{"agent"}}},
		{"a drifted sign", "sign reads drifted", dispatchState{body: signedBody(dispatchAbove, "", "the body dima signed\n"), state: "Todo", labels: []string{"agent", "signed"}}},
		{"a sign with no hash", "sign reads no hash", dispatchState{body: dispatchAbove + "## signed\n\n✍️ signed 2026-10-23\n", state: "Todo", labels: []string{"agent", "signed"}}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			server := dispatchServer(t, c.s)

			envelope, got := runDispatch(t, server, "FRM-1", "--session", "s1", "--lane", "cli-3", "--apply")

			if got.code == 0 || !strings.Contains(jsonOf(envelope["error"]), c.want) {
				t.Errorf("exit %d, want a refusal naming %q:\n%s", got.code, c.want, got.stdout)
			}
			if n := len(mutations(server)); n != 0 {
				t.Errorf("%d mutations on a refused ticket", n)
			}
		})
	}
}

func jsonOf(value any) string {
	raw, _ := json.Marshal(value)
	return string(raw)
}

// the threads a dispatch names get their record under the session ids it was given; the area word is the ticket's
// project (cli), never the lane name's first word (FRM-579's rider)
func TestDispatchWritesTheRecordOfEachThreadItNames(t *testing.T) {
	t.Parallel()
	server := dispatchServer(t, undispatched)
	store := filepath.Join(t.TempDir(), "threads.json")

	write(t, store, `{"v":1,"threads":[{"sessionId":"s1","role":"codie"},{"sessionId":"s2","role":"sixth-sense"}]}`)
	_, got := runLinear(t, server, []string{"HOME=" + t.TempDir(), "X_THREADS=" + store},
		"lane", "dispatch", "FRM-1", "--session", "s1", "--sixth-sense", "s2", "--lane", "thread-records", "--apply")

	var written threadStore
	raw, _ := os.ReadFile(store)
	if err := json.Unmarshal(raw, &written); err != nil || got.code != 0 {
		t.Fatalf("exit %d, store %s:\n%s", got.code, raw, got.stdout)
	}
	shown := map[string]string{}
	for _, th := range written.Threads {
		shown[th.SessionID] = th.Display
	}
	if shown["s1"] != "🌗 🔧 cli | FRM-1" || shown["s2"] != "🌗 🔎 cli | FRM-1" || len(shown) != 2 {
		t.Errorf("records %v, want s1 as codie and s2 as sixth sense on cli-3 | FRM-1", shown)
	}
}

// exit 28: a dispatch renames an idle thread to the display its record now draws, and hands a busy one the exact command;
// FRM-572 exit 5: an idle thread whose input box holds a draft, or whose box does not read, gets the command too
func TestDispatchRenamesAThreadByItsNewRecord(t *testing.T) {
	t.Parallel()
	const rule = "────────────────────────────────────────"
	for _, c := range []struct {
		name, state, box string
		isRenamed        bool
	}{
		{"idle", "done", "❯ ", true},
		{"busy", "working", "❯ ", false},
		{"idle with a draft", "done", "❯ half a prompt", false},
		{"idle with a draft on its second line", "done", "❯ \n  more of it", false},
		{"idle with no box on screen", "done", "", false},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			server := dispatchServer(t, undispatched)
			sessions, store, bin := t.TempDir(), filepath.Join(t.TempDir(), "threads.json"), t.TempDir()
			log := filepath.Join(bin, "hc.log")
			write(t, filepath.Join(sessions, "s1.json"), fmt.Sprintf(`{"sessionId":"s1","pid":%d}`, os.Getpid()))
			screen := filepath.Join(bin, "screen.txt")
			write(t, screen, "❯ an old prompt\n\n● an answer\n")
			if c.box != "" {
				write(t, screen, "❯ an old prompt\n\n● an answer\n\n"+rule+"\n"+c.box+"\n"+rule+"\n  the status line\n")
			}
			write(t, filepath.Join(bin, "hc"), fmt.Sprintf(`#!/bin/sh
case "$1" in
ls) echo '{"terminals":[{"address":"t1","agent":"zsh"},{"address":"t9","agent":"claude-code"}]}' ;;
get) echo '{"pid":%d,"status":{"state":"%s"}}' ;;
read) cat %s 2>/dev/null ;;
send) echo "send $2 $3 term=${HC_TERMINAL_ID:-unset}" >> %s ;;
esac
`, os.Getpid(), c.state, screen, log))
			if err := os.Chmod(filepath.Join(bin, "hc"), 0o755); err != nil {
				t.Fatal(err)
			}
			env := asCaller(t, []string{"HOME=" + t.TempDir(), "X_THREADS=" + store, "X_SESSIONS=" + sessions, "X_HC=" + filepath.Join(bin, "hc"), "HC_TERMINAL_ID=t3b"}, "coordinator")

			envelope, got := runLinear(t, server, env, "lane", "dispatch", "FRM-1", "--session", "s1", "--lane", "cli-3", "--apply")

			sent, _ := os.ReadFile(log)
			command := "env -u HC_TERMINAL_ID hc send t9 '/rename 🌗 🔧 cli | FRM-1'"
			data, _ := envelope["data"].(map[string]any)
			renames := jsonOf(data["renames"])
			if got.code != 0 || !strings.Contains(renames, jsonOf(command)) {
				t.Fatalf("exit %d, renames %s, want the command %q:\n%s", got.code, renames, command, got.stdout)
			}
			if want := "send t9 /rename 🌗 🔧 cli | FRM-1 term=unset\n"; c.isRenamed != (string(sent) == want) || (!c.isRenamed && len(sent) > 0) {
				t.Errorf("hc got %q; renamed want %v", sent, c.isRenamed)
			}
		})
	}
}

// sixth sense round 1 P1 and round 3 (exits 17, 18): a role goes only from the coordinator, to a thread a summon recorded
// in that role or to a running thread with no role yet; never another role, never an id no thread holds, never from a
// codie; a refusal comes before any linear write
func TestDispatchGivesARoleOnlyFromTheCoordinatorToAKnownThread(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name, caller, records, want string
		isLive, isOk                bool
	}{
		{name: "an id no thread holds", caller: "coordinator", want: "names no thread"},
		{name: "a codie's record", caller: "coordinator", records: `{"v":1,"threads":[{"sessionId":"s2","role":"codie"}]}`, isLive: true, want: "is already a codie"},
		{name: "a codie dispatching itself", caller: "", isLive: true, want: "only the coordinator or dima"},
		{name: "the coordinator on a running thread with no role", caller: "coordinator", isLive: true, isOk: true},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			server := dispatchServer(t, undispatched)
			sessions, store := filepath.Join(t.TempDir(), "caller-set"), filepath.Join(t.TempDir(), "threads.json")
			write(t, filepath.Join(sessions, "s1.json"), fmt.Sprintf(`{"sessionId":"s1","pid":%d}`, os.Getpid()))
			if c.isLive {
				write(t, filepath.Join(sessions, "s2.json"), fmt.Sprintf(`{"sessionId":"s2","pid":%d}`, os.Getpid()))
			}
			if c.records != "" {
				write(t, store, c.records)
			}
			env := asCaller(t, []string{"HOME=" + t.TempDir(), "X_THREADS=" + store, "X_SESSIONS=" + sessions}, c.caller)

			_, got := runLinear(t, server, env, "lane", "dispatch", "FRM-1", "--session", "s1", "--sixth-sense", "s2", "--lane", "cli-3", "--apply")

			written, _ := readThreadStore(store)
			mutations := 0
			for _, call := range server.requests() {
				if strings.Contains(call.Query, "mutation") {
					mutations++
				}
			}
			isSixth := slices.ContainsFunc(written.Threads, func(th thread) bool { return th.SessionID == "s2" && th.Role == "sixth-sense" })
			if c.isOk && (got.code != 0 || !isSixth) {
				t.Fatalf("exit %d, records %+v, want s2 recorded as sixth sense:\n%s", got.code, written.Threads, got.stdout)
			}
			if !c.isOk && (got.code != 1 || !strings.Contains(got.stdout, c.want) || mutations != 0 || isSixth) {
				t.Fatalf("exit %d, %d linear writes, records %+v, want exit 1 naming %q before any write:\n%s", got.code, mutations, written.Threads, c.want, got.stdout)
			}
		})
	}
}
