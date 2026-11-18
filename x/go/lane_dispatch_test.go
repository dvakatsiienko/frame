package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"
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
		return `{"data":{"issue":{"id":"uuid-1","identifier":"FRM-1","title":"x-mod-stash: one ask counter, cards from the lane record","description":` + string(description) + `,"state":{"name":"` + s.state + `","type":"` + stateTypes[s.state] + `"},"project":{"name":"cli"},"delegate":` + delegate +
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

	envelope, got := runDispatchIn(t, server, frame, "FRM-1", "FRM-2", "--session", "s1", "--area", "cli", "--lane", "cli-9")

	if got.code != 2 || !strings.Contains(jsonOf(envelope["error"]), "one dispatch is one lane") {
		t.Errorf("exit %d, want a usage refusal naming both specs:\n%s", got.code, got.stdout)
	}
}

func TestDispatchNamesTheSlicesDirAfterTheSpecsFeature(t *testing.T) {
	t.Parallel()
	frame := repo(t)
	write(t, filepath.Join(frame, ".scratch/feat-a/spec.md"), "# feat a\n\n## FRM-1 — the chunk\n")
	server := dispatchServer(t, dispatchState{body: signedTicket, state: "Todo", labels: []string{"agent", "signed"}})

	envelope, _ := runDispatchIn(t, server, frame, "FRM-1", "--session", "s1", "--area", "cli", "--lane", "cli-9")

	if out := jsonOf(envelope["plan"]); !strings.Contains(out, "lanes/feat-a/issues/") {
		t.Errorf("the slices dir must follow the spec's feature, as the lane plan does:\n%s", out)
	}
}

var undispatched = dispatchState{body: signedTicket, state: "Todo", labels: []string{"agent", "signed"}}

func TestDispatchDryRunPrintsTheFourMarksAndWritesNothing(t *testing.T) {
	t.Parallel()
	server := dispatchServer(t, undispatched)

	envelope, got := runDispatch(t, server, "FRM-1", "--session", "s1", "--area", "cli", "--lane", "cli-3")

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

	_, got := runDispatchIn(t, server, frame, "--quick", "FRM-1", "--session", "s1", "--area", "cli", "--lane", "q", "--sixth-sense", "s2", "--apply")

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

	_, got := runDispatchIn(t, server, frame, "--quick", "FRM-1", "--session", "s1", "--area", "cli", "--lane", "q", "--apply")

	if got.code == 0 || !strings.Contains(got.stdout, "nowhere-here") || len(mutations(server)) != 0 {
		t.Fatalf("exit %d, want a refusal naming the repo, no write:\n%s", got.code, got.stdout)
	}
}

func TestDispatchQuickDryRunPlansThreeMarks(t *testing.T) {
	t.Parallel()
	frame, _ := frameAtBase(t)
	server := dispatchServer(t, dispatchState{body: quickTicket, state: "Todo"})

	envelope, got := runDispatchIn(t, server, frame, "--quick", "FRM-1", "--session", "s1", "--area", "cli", "--lane", "q")

	if plan := jsonOf(envelope["plan"]); got.code != 4 || strings.Count(plan, `"write"`) != 3 {
		t.Fatalf("exit %d, want 4 with three marks:\n%s", got.code, got.stdout)
	}
}

func TestDispatchQuickReRunWritesNoSecondLine(t *testing.T) {
	t.Parallel()
	frame, _ := frameAtBase(t)
	body := "lane: quick\n\n🚀 dispatched 2026-11-05 — q, codie s1, main:abc1234\n"
	server := dispatchServer(t, dispatchState{body: body, state: "In Progress", delegate: "codie"})

	_, got := runDispatchIn(t, server, frame, "--quick", "FRM-1", "--session", "s1", "--area", "cli", "--lane", "q", "--apply")

	if n := len(mutations(server)); got.code != 0 || n != 0 {
		t.Fatalf("exit %d, %d mutations on a re-run:\n%s", got.code, n, got.stdout)
	}
}

func TestDispatchWithoutQuickStillRefusesNoSign(t *testing.T) {
	t.Parallel()
	server := dispatchServer(t, dispatchState{body: quickTicket, state: "Todo"})

	_, got := runDispatch(t, server, "FRM-1", "--session", "s1", "--area", "cli", "--lane", "q", "--apply")

	if got.code == 0 || !strings.Contains(got.stderr+got.stdout, "no ## signed block") {
		t.Fatalf("exit %d, want the sign refusal:\n%s", got.code, got.stdout)
	}
}

func TestDispatchNamesASixthSenseOnASignedTicket(t *testing.T) {
	t.Parallel()
	server := dispatchServer(t, undispatched)

	_, got := runDispatch(t, server, "FRM-1", "--session", "s1", "--area", "cli", "--lane", "cli-3", "--sixth-sense", "s2", "--apply")

	body, _ := updateInput(t, server)["description"].(string)
	if got.code != 0 || !strings.Contains(body, " — cli-3, codie s1, sixth sense s2\n") {
		t.Fatalf("exit %d, body:\n%s", got.code, body)
	}
}

func TestDispatchApplySetsEveryMarkInOneUpdate(t *testing.T) {
	t.Parallel()
	server := dispatchServer(t, undispatched)

	envelope, got := runDispatch(t, server, "FRM-1", "--session", "s1", "--area", "cli", "--lane", "cli-3", "--apply")

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
	if data := jsonOf(envelope["data"]); !strings.Contains(data, "x-mod-stash opens the glide card from ") || !strings.Contains(data, "lanes/cli-3/lane-plan.md") || !strings.Contains(data, "20%") {
		t.Errorf("the glide line and the 5h line are not printed: %s", data)
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

	envelope, got := runDispatch(t, server, "FRM-1", "--session", "s1", "--area", "cli", "--lane", "cli-3")

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
		{"a sixth sense added", "cli-3, codie s1", []string{"--lane", "cli-3", "--session", "s1", "--area", "cli", "--sixth-sense", "s2"}, " — cli-3, codie s1, sixth sense s2\n"},
		{"a sixth sense alone", "cli-3, codie s1", []string{"--sixth-sense", "s2"}, " — cli-3, codie s1, sixth sense s2\n"},
		{"another lane starts fresh", "mods-3, codie s0, sixth sense s9", []string{"--lane", "cli-3", "--session", "s1"}, " — cli-3, codie s1\n"},
		{"the same lane's successor keeps its sixth sense and base", "cli-3, codie s1, main:abc1234, sixth sense s2", []string{"--lane", "cli-3", "--session", "s5"}, " — cli-3, codie s5, main:abc1234, sixth sense s2\n"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			done := signedBody(dispatchAbove, "🚀 dispatched 2026-10-30 — "+c.held+"\n", dispatchAbove) + "\n⸻ 🪪 stamp — please keep 🙏"
			server := dispatchServer(t, dispatchState{body: done, state: "In Progress", delegate: "codie", labels: []string{"agent"}})

			_, got := runDispatch(t, server, append([]string{"FRM-1", "--apply", "--area", "cli"}, c.args...)...)

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

	_, got := runLinear(t, server, []string{"HOME=" + home, "X_FRAME_ROOT=" + frame}, "lane", "dispatch", "--quick", "BYT-1", "--session", "s1", "--area", "cli", "--lane", "q", "--apply")

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

	_, got := runDispatch(t, server, "FRM-1", "--session", "s1", "--area", "cli", "--lane", "cli-3")

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

			envelope, got := runDispatch(t, server, "FRM-1", "--session", "s1", "--area", "cli", "--lane", "cli-3", "--apply")

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
		"lane", "dispatch", "FRM-1", "--session", "s1", "--area", "cli", "--sixth-sense", "s2", "--lane", "thread-records", "--apply")

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

// FRM-649 step 118: the lane's sixth sense, summoned before the chunk and not named on its dispatch, takes the
// chunk's ticket in its name too; a sixth sense on another lane keeps its own
func TestDispatchNamesTheLanesSixthSenseWithItsTicket(t *testing.T) {
	t.Parallel()
	server := dispatchServer(t, undispatched)
	store := filepath.Join(t.TempDir(), "threads.json")
	write(t, store, `{"v":1,"threads":[{"sessionId":"s1","role":"codie","lane":"cli-9"},{"sessionId":"s2","role":"sixth-sense","lane":"cli-9","laneKind":"side","area":"cli"},{"sessionId":"s3","role":"sixth-sense","lane":"cli-8","ticket":"FRM-7"}]}`)
	_, got := runLinear(t, server, []string{"HOME=" + t.TempDir(), "X_THREADS=" + store},
		"lane", "dispatch", "FRM-1", "--session", "s1", "--area", "cli", "--lane", "cli-9", "--apply")
	written, err := readThreadStore(store)
	if err != nil || got.code != 0 {
		t.Fatalf("exit %d, %v:\n%s", got.code, err, got.stdout)
	}
	tickets := map[string]string{}
	for _, th := range written.Threads {
		tickets[th.SessionID] = th.Display + " · " + th.Ticket
	}
	if tickets["s2"] != "🌗 🔎 cli | FRM-1 · FRM-1" || tickets["s3"] != " · FRM-7" {
		t.Errorf("records %v, want s2 named for FRM-1 and s3 left on FRM-7", tickets)
	}
}

// FRM-649 exit 2 (FRM-616:W36): a dispatch keeps the ticket's title, its scope prefix cut, on every member it moves, and
// x lane show prints it as the lane's what, so the glide card titles «<scope> — <what>» with no hand edit
func TestDispatchKeepsTheTicketsWhatForTheLaneCard(t *testing.T) {
	t.Parallel()
	server := dispatchServer(t, undispatched)
	store := filepath.Join(t.TempDir(), "threads.json")
	write(t, store, `{"v":1,"threads":[{"sessionId":"s1","role":"codie"},{"sessionId":"s2","role":"sixth-sense"}]}`)
	_, got := runLinear(t, server, []string{"HOME=" + t.TempDir(), "X_THREADS=" + store},
		"lane", "dispatch", "FRM-1", "--session", "s1", "--area", "cli", "--sixth-sense", "s2", "--lane", "cli-9", "--apply")
	written, err := readThreadStore(store)
	if err != nil || got.code != 0 {
		t.Fatalf("exit %d, %v:\n%s", got.code, err, got.stdout)
	}
	whats := map[string]string{}
	for _, th := range written.Threads {
		whats[th.SessionID] = th.What
	}
	record, _ := laneOf("cli-9", written.Threads)
	if whats["s1"] != "one ask counter, cards from the lane record" || whats["s2"] != whats["s1"] || record.What != whats["s1"] {
		t.Errorf("whats %v, lane what %q, want the title past «x-mod-stash: » on both and on the lane", whats, record.What)
	}
}

// FRM-649 step 117 (FRM-617 exit 7): a title that is only an earlier role name of this member («⚡ 🔧 mods | FRM-617»
// from a hand rename) never pins its name past the next dispatch; a title dima typed stays
func TestDispatchDropsATitleThatIsOnlyAnOldRoleName(t *testing.T) {
	t.Parallel()
	for _, c := range []struct{ title, want string }{
		// the fixture ticket's lane: line says side
		{"⚡ 🔧 mods | FRM-617", "🌗 🔧 mods | FRM-1"},
		{"🌗 🔧 mods | FRM-555", "🌗 🔧 mods | FRM-1"},
		{"mods codie, his name", "mods codie, his name"},
	} {
		server := dispatchServer(t, undispatched)
		store := filepath.Join(t.TempDir(), "threads.json")
		write(t, store, `{"v":1,"threads":[{"sessionId":"s1","role":"codie","area":"mods","ticket":"FRM-617","laneKind":"quick","title":"`+c.title+`"}]}`)
		_, got := runLinear(t, server, []string{"HOME=" + t.TempDir(), "X_THREADS=" + store},
			"lane", "dispatch", "FRM-1", "--session", "s1", "--area", "mods", "--lane", "mods-9", "--apply")
		written, err := readThreadStore(store)
		if err != nil || got.code != 0 || len(written.Threads) != 1 {
			t.Fatalf("exit %d, %v:\n%s", got.code, err, got.stdout)
		}
		if d := written.Threads[0].Display; d != c.want {
			t.Errorf("title %q: display %q, want %q", c.title, d, c.want)
		}
	}
}

func TestTicketWhatCutsTheScopePrefix(t *testing.T) {
	t.Parallel()
	for _, c := range [][2]string{
		{"x-mod-stash: one ask counter", "one ask counter"},
		{"x + x-mod-stash: one lane record, one shown name", "one lane record, one shown name"},
		{"mods: test sessions stay sandboxed — settings untouched", "test sessions stay sandboxed — settings untouched"},
		{"a title with no scope", "a title with no scope"},
		{"herdr ux revamp — one record per lane: sidebar", "herdr ux revamp — one record per lane: sidebar"},
		{"", ""},
	} {
		if got := ticketWhat(c[0]); got != c[1] {
			t.Errorf("ticketWhat(%q) = %q, want %q", c[0], got, c[1])
		}
	}
}

// FRM-617 exit 2: a dispatch naming no --lane on a dispatched ticket writes the 🚀 line's lane on the member it moves,
// so a sixth sense joined later never sits laneless beside its codie
func TestDispatchWritesTheDispatchedLaneOnTheMemberItMoves(t *testing.T) {
	t.Parallel()
	done := signedBody(dispatchAbove, "🚀 dispatched 2026-10-30 — cli-3, codie s1\n", dispatchAbove) + "\n⸻ 🪪 stamp — please keep 🙏"
	server := dispatchServer(t, dispatchState{body: done, state: "In Progress", labels: []string{"agent", "signed"}, delegate: "codie"})
	store := filepath.Join(t.TempDir(), "threads.json")

	write(t, store, `{"v":1,"threads":[{"sessionId":"s1","role":"codie","lane":"cli-3"},{"sessionId":"s2","role":"sixth-sense"}]}`)
	_, got := runLinear(t, server, []string{"HOME=" + t.TempDir(), "X_THREADS=" + store},
		"lane", "dispatch", "FRM-1", "--area", "cli", "--sixth-sense", "s2", "--apply")

	written, err := readThreadStore(store)
	if err != nil || got.code != 0 {
		t.Fatalf("exit %d, %v:\n%s", got.code, err, got.stdout)
	}
	lanes := map[string]string{}
	for _, th := range written.Threads {
		lanes[th.SessionID] = th.Lane
	}
	if lanes["s1"] != "cli-3" || lanes["s2"] != "cli-3" {
		t.Errorf("lanes %v, want the sixth sense in the 🚀 line's cli-3 beside its codie", lanes)
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
			env := asCaller(t, []string{"HOME=" + t.TempDir(), "X_THREADS=" + store, "X_SESSIONS=" + sessions, "X_HC=" + filepath.Join(bin, "hc"), "HC_TERMINAL_ID=t3b", "X_RENAME_WAIT=0"}, "coordinator")

			envelope, got := runLinear(t, server, env, "lane", "dispatch", "FRM-1", "--session", "s1", "--area", "cli", "--lane", "cli-3", "--apply")

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

// FRM-649 step 118 (dima's o11 look): a member busy at its dispatch is renamed once it goes idle inside the wait, as
// x thread rename does, and its herdr tab takes the name too
func TestDispatchRenamesABusyThreadOnceItIdles(t *testing.T) {
	t.Parallel()
	const rule = "────────────────────────────────────────"
	server := dispatchServer(t, undispatched)
	sessions, store, bin := t.TempDir(), filepath.Join(t.TempDir(), "threads.json"), t.TempDir()
	log := filepath.Join(bin, "hc.log")
	write(t, filepath.Join(sessions, "s1.json"), fmt.Sprintf(`{"sessionId":"s1","pid":%d}`, os.Getpid()))
	screen := filepath.Join(bin, "screen.txt")
	write(t, screen, "❯ an old prompt\n\n● an answer\n\n"+rule+"\n❯ \n"+rule+"\n  the status line\n")
	// the first two reads find it working, every later one done
	write(t, filepath.Join(bin, "hc"), fmt.Sprintf(`#!/bin/sh
case "$1" in
ls) echo '{"terminals":[{"address":"t9","agent":"claude-code"}]}' ;;
get) n=$(cat %[1]s/n 2>/dev/null || echo 0); echo $((n+1)) > %[1]s/n
  if [ "$n" -lt 2 ]; then s=working; else s=done; fi
  echo '{"pid":%[2]d,"status":{"state":"'$s'"}}' ;;
read) cat %[3]s ;;
send) echo "send $2 $3" >> %[4]s ;;
esac
`, bin, os.Getpid(), screen, log))
	write(t, filepath.Join(bin, "herdr-app"), fmt.Sprintf(`#!/bin/sh
case "$1" in
ls) echo '{"spaces":[{"tabs":[{"id":"tab7","terminals":[{"terminal":"t9"}]}]}]}' ;;
do) echo "$2 $3" >> %s ;;
esac
`, log))
	for _, name := range []string{"hc", "herdr-app"} {
		if err := os.Chmod(filepath.Join(bin, name), 0o755); err != nil {
			t.Fatal(err)
		}
	}
	env := asCaller(t, []string{"HOME=" + t.TempDir(), "X_THREADS=" + store, "X_SESSIONS=" + sessions, "X_HC=" + filepath.Join(bin, "hc"), "X_HERDR_APP=" + filepath.Join(bin, "herdr-app"), "HC_TERMINAL_ID=t3b", "X_RENAME_WAIT=10", "X_RENAME_NUDGE=60"}, "coordinator")

	_, got := runLinear(t, server, env, "lane", "dispatch", "FRM-1", "--session", "s1", "--area", "cli", "--lane", "cli-3", "--apply")

	sent, _ := os.ReadFile(log)
	want := "tab.rename {\"id\":\"tab7\",\"name\":\"🌗 🔧 cli | FRM-1\"}\nsend t9 /rename 🌗 🔧 cli | FRM-1\n"
	if got.code != 0 || string(sent) != want {
		t.Errorf("exit %d, herdr got %q, want %q:\n%s", got.code, sent, want, got.stdout)
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

			_, got := runLinear(t, server, env, "lane", "dispatch", "FRM-1", "--session", "s1", "--area", "cli", "--sixth-sense", "s2", "--lane", "cli-3", "--apply")

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

// FRM-600 exit 1: the scopes table names the thread: the word, its emoji where it has one, its unit where it has one
func TestDispatchNamesTheThreadByItsScope(t *testing.T) {
	t.Parallel()
	for _, c := range []struct{ area, want string }{
		{"stray", "⚡ 🐕 stray | chores"},
		{"mods", "⚡ 🔧 mods | FRM-1"},
	} {
		t.Run(c.area, func(t *testing.T) {
			t.Parallel()
			frame, _ := frameAtBase(t)
			server := dispatchServer(t, dispatchState{body: quickTicket, state: "Todo", labels: []string{"agent"}})
			store := filepath.Join(t.TempDir(), "threads.json")
			write(t, store, `{"v":1,"threads":[{"sessionId":"s1","role":"codie"}]}`)

			_, got := runLinear(t, server, []string{"HOME=" + t.TempDir(), "X_FRAME_ROOT=" + frame, "X_THREADS=" + store},
				"lane", "dispatch", "--quick", "FRM-1", "--session", "s1", "--lane", "chores", "--area", c.area, "--apply")

			written, _ := readThreadStore(store)
			if got.code != 0 || len(written.Threads) != 1 || written.Threads[0].Display != c.want {
				t.Fatalf("exit %d, records %+v, want the display %q:\n%s", got.code, written.Threads, c.want, got.stdout)
			}
		})
	}
}

// no fallback to the ticket's project: no scope, or one the table lacks, is refused naming the table, before any write
func TestDispatchRefusesAThreadWithNoScopeFromTheTable(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name  string
		extra []string
	}{
		{"no area", nil},
		{"a word that is no scope", []string{"--area", "fleet"}},
		{"a word with shell in it", []string{"--area", "My Lane; ls"}},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			server := dispatchServer(t, undispatched)

			_, got := runDispatch(t, server, append([]string{"FRM-1", "--session", "s1", "--lane", "cli-3", "--apply"}, c.extra...)...)

			if got.code != 2 || !strings.Contains(got.stdout, "chords, cli, herdr, mods, speak, stray, trophy-sys") || len(mutations(server)) != 0 {
				t.Errorf("exit %d with %d linear writes, want a usage refusal naming the table before any write:\n%s", got.code, len(mutations(server)), got.stdout)
			}
		})
	}
}

// dispatchOntoRecord dispatches FRM-1 to s1 (dry run, then applied) over a stored thread record, with a fake hc
func dispatchOntoRecord(t *testing.T, body, record string) (plan, applied asRun, envelope map[string]any, written threadStore, sent []byte) {
	t.Helper()
	const rule = "────────────────────────────────────────"
	server := dispatchServer(t, dispatchState{body: body, state: "Todo", labels: []string{"agent", "signed"}})
	sessions, store, bin := t.TempDir(), filepath.Join(t.TempDir(), "threads.json"), t.TempDir()
	log := filepath.Join(bin, "hc.log")
	write(t, filepath.Join(sessions, "s1.json"), fmt.Sprintf(`{"sessionId":"s1","pid":%d}`, os.Getpid()))
	write(t, store, record)
	write(t, filepath.Join(bin, "screen.txt"), "❯ an old prompt\n\n● an answer\n\n"+rule+"\n❯ \n"+rule+"\n  the status line\n")
	write(t, filepath.Join(bin, "hc"), fmt.Sprintf(`#!/bin/sh
case "$1" in
ls) echo '{"terminals":[{"address":"t9","agent":"claude-code"}]}' ;;
get) echo '{"pid":%d,"status":{"state":"done"}}' ;;
read) cat %s ;;
send) echo "send $2 $3" >> %s ;;
esac
`, os.Getpid(), filepath.Join(bin, "screen.txt"), log))
	if err := os.Chmod(filepath.Join(bin, "hc"), 0o755); err != nil {
		t.Fatal(err)
	}
	env := asCaller(t, []string{"HOME=" + t.TempDir(), "X_THREADS=" + store, "X_SESSIONS=" + sessions, "X_HC=" + filepath.Join(bin, "hc")}, "coordinator")

	envelope, plan = runLinear(t, server, env, "lane", "dispatch", "FRM-1", "--session", "s1", "--lane", "chores", "--area", "stray")
	_, applied = runLinear(t, server, env, "lane", "dispatch", "FRM-1", "--session", "s1", "--lane", "chores", "--area", "stray", "--apply")

	written, _ = readThreadStore(store)
	sent, _ = os.ReadFile(log)
	return plan, applied, envelope, written, sent
}

// FRM-600: the thread's mode follows the ticket's own lane: line, whatever the record held before
func TestDispatchDrawsTheModeOfTheTicketsLaneLine(t *testing.T) {
	t.Parallel()
	above := strings.Replace(dispatchAbove, "lane: side", "lane: quick", 1)

	plan, got, envelope, written, sent := dispatchOntoRecord(t, signedBody(above, "", above)+"\n⸻ 🪪 stamp — please keep 🙏", `{"v":1,"threads":[{"sessionId":"s1","role":"codie","laneKind":"side","area":"stray"}]}`)

	if plan.code != 4 || !strings.Contains(jsonOf(envelope["plan"]), "s1 → ⚡ 🐕 stray | chores") {
		t.Errorf("a dry run: exit %d, want the plan to say «s1 → ⚡ 🐕 stray | chores»:\n%s", plan.code, plan.stdout)
	}
	if got.code != 0 || len(written.Threads) != 1 || written.Threads[0].Display != "⚡ 🐕 stray | chores" || written.Threads[0].LaneKind != "quick" || string(sent) != "send t9 /rename ⚡ 🐕 stray | chores\n" {
		t.Errorf("exit %d, records %+v, hc was told %q, want ⚡ in the record and the rename:\n%s", got.code, written.Threads, sent, got.stdout)
	}
}

// a ticket with no lane: line says nothing about the mode: a record's own stays, side only when it held none
func TestDispatchOfATicketWithNoLaneLineKeepsTheRecordsMode(t *testing.T) {
	t.Parallel()
	noLine := strings.Replace(dispatchAbove, "lane: side\n\n", "", 1)
	body := signedBody(noLine, "", noLine) + "\n⸻ 🪪 stamp — please keep 🙏"
	for _, c := range []struct{ name, record, kind, display string }{
		{"a quick record stays quick", `{"v":1,"threads":[{"sessionId":"s1","role":"codie","laneKind":"quick","area":"stray"}]}`, "quick", "⚡ 🐕 stray | chores"},
		{"a record with no mode starts side", `{"v":1,"threads":[{"sessionId":"s1","role":"codie","area":"stray"}]}`, "side", "🌗 🐕 stray | chores"},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			plan, got, envelope, written, _ := dispatchOntoRecord(t, body, c.record)

			if plan.code != 4 || !strings.Contains(jsonOf(envelope["plan"]), "s1 → "+c.display) {
				t.Errorf("a dry run: exit %d, want the plan to say «s1 → %s»:\n%s", plan.code, c.display, plan.stdout)
			}
			if got.code != 0 || len(written.Threads) != 1 || written.Threads[0].LaneKind != c.kind || written.Threads[0].Display != c.display {
				t.Errorf("exit %d, records %+v, want kind %q shown as %q:\n%s", got.code, written.Threads, c.kind, c.display, got.stdout)
			}
		})
	}
}

// a dispatch is one lane: tickets whose lane: lines name two modes are refused, the same mode or none passes
func TestDispatchRefusesTicketsWhoseLaneLinesDisagree(t *testing.T) {
	t.Parallel()
	signed := func(above string) string {
		return signedBody(above, "", above) + "\n⸻ 🪪 stamp — please keep 🙏"
	}
	quick := strings.Replace(dispatchAbove, "lane: side", "lane: quick", 1)
	none := strings.Replace(dispatchAbove, "lane: side\n\n", "", 1)
	for _, c := range []struct {
		name, first, second string
		isRefused           bool
	}{
		{"side and quick", dispatchAbove, quick, true},
		{"the same mode", quick, quick, false},
		{"one mode and none", quick, none, false},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			server := newFakeLinear(t, func(call gqlCall) string {
				if strings.Contains(call.Query, "mutation") {
					return `{"data":{"issueUpdate":{"success":true}}}`
				}
				body := signed(c.first)
				if call.Variables["id"] == "FRM-2" {
					body = signed(c.second)
				}
				description, _ := json.Marshal(body)
				return `{"data":{"issue":{"id":"uuid-1","identifier":"FRM-1","description":` + string(description) + `,"state":{"name":"Todo","type":"unstarted"},"delegate":null,` +
					`"labels":{"nodes":[{"id":"l-signed","name":"signed"}]},"team":{"states":{"nodes":[{"id":"s-ip","name":"In Progress"}]}}},"users":{"nodes":[{"id":"u-codie","name":"codie"}]}}}`
			})

			envelope, got := runDispatch(t, server, "FRM-1", "FRM-2", "--session", "s1", "--area", "stray", "--lane", "chores")

			said := jsonOf(envelope["error"])
			if c.isRefused != (got.code == 2) || (c.isRefused && !(strings.Contains(said, "FRM-1: side") && strings.Contains(said, "FRM-2: quick"))) {
				t.Errorf("exit %d, want a refusal %v naming «FRM-1: side» and «FRM-2: quick»:\n%s", got.code, c.isRefused, got.stdout)
			}
		})
	}
}

// a dispatch naming no --lane takes its lane from the tickets' 🚀 lines: two lanes between them are refused before any
// write, one lane is the record's and the plan's glide line
func TestDispatchWithNoLaneTakesTheOneLaneItsRocketLinesName(t *testing.T) {
	t.Parallel()
	rocket := func(line string) string {
		return signedBody(dispatchAbove, line, dispatchAbove) + "\n⸻ 🪪 stamp — please keep 🙏"
	}
	for _, c := range []struct {
		name, first, second, wantLane string
		isRefused                     bool
	}{
		{"two lanes", "🚀 dispatched 2026-10-30 — cli-3, codie s0\n", "🚀 dispatched 2026-10-30 — cli-4, codie s0\n", "", true},
		{"one lane twice", "🚀 dispatched 2026-10-30 — cli-3, codie s0\n", "🚀 dispatched 2026-10-30 — cli-3, codie s0\n", "cli-3", false},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			writes := 0
			server := newFakeLinear(t, func(call gqlCall) string {
				if strings.Contains(call.Query, "mutation") {
					writes++
					return `{"data":{"issueUpdate":{"success":true}}}`
				}
				body := rocket(c.first)
				if call.Variables["id"] == "FRM-2" {
					body = rocket(c.second)
				}
				description, _ := json.Marshal(body)
				return `{"data":{"issue":{"id":"uuid-1","identifier":"FRM-1","description":` + string(description) + `,"state":{"name":"Todo","type":"unstarted"},"delegate":null,` +
					`"labels":{"nodes":[{"id":"l-signed","name":"signed"}]},"team":{"states":{"nodes":[{"id":"s-ip","name":"In Progress"}]}}},"users":{"nodes":[{"id":"u-codie","name":"codie"}]}}}`
			})
			store := filepath.Join(t.TempDir(), "threads.json")
			write(t, store, `{"v":1,"threads":[{"sessionId":"s1","role":"codie"}]}`)
			env := []string{"HOME=" + t.TempDir(), "X_THREADS=" + store}

			plan, dry := runLinear(t, server, env, "lane", "dispatch", "FRM-1", "FRM-2", "--session", "s1", "--area", "cli")
			if c.isRefused {
				said := jsonOf(plan["error"])
				if dry.code != 2 || writes != 0 || !strings.Contains(said, "cli-3") || !strings.Contains(said, "cli-4") {
					t.Errorf("exit %d, %d writes, want a refusal naming cli-3 and cli-4 before any write:\n%s", dry.code, writes, dry.stdout)
				}
				return
			}
			if glide := jsonOf(plan["plan"]); dry.code != 4 || !strings.Contains(glide, "lanes/"+c.wantLane+"/lane-plan.md") {
				t.Errorf("exit %d, want the plan's glide line on %s's lane plan:\n%s", dry.code, c.wantLane, dry.stdout)
			}
			_, got := runLinear(t, server, env, "lane", "dispatch", "FRM-1", "FRM-2", "--session", "s1", "--area", "cli", "--apply")
			written, err := readThreadStore(store)
			if err != nil || got.code != 0 || len(written.Threads) != 1 || written.Threads[0].Lane != c.wantLane {
				t.Errorf("exit %d, %v, records %+v, want s1 in %s:\n%s", got.code, err, written.Threads, c.wantLane, got.stdout)
			}
		})
	}
}

// FRM-602: the codie's record names the clio that dispatched it, so the stash opens the lane's card in that clio's session
func TestDispatchRecordsTheDispatchingClioOnTheCodie(t *testing.T) {
	t.Parallel()
	for _, c := range []struct{ caller, want string }{
		{"coordinator", "clio-main"},
		{"wing", "clio-wing-1"},
	} {
		t.Run(c.caller, func(t *testing.T) {
			t.Parallel()
			server := dispatchServer(t, undispatched)
			sessions, store := filepath.Join(t.TempDir(), "caller-set"), filepath.Join(t.TempDir(), "threads.json")
			write(t, filepath.Join(sessions, "s1.json"), fmt.Sprintf(`{"sessionId":"s1","pid":%d}`, os.Getpid()))
			env := asCaller(t, []string{"HOME=" + t.TempDir(), "X_THREADS=" + store, "X_SESSIONS=" + sessions}, c.caller)

			_, got := runLinear(t, server, env, "lane", "dispatch", "FRM-1", "--session", "s1", "--area", "cli", "--lane", "cli-3", "--apply")

			written, _ := readThreadStore(store)
			i := slices.IndexFunc(written.Threads, func(th thread) bool { return th.SessionID == "s1" })
			if got.code != 0 || i < 0 || written.Threads[i].Coordinator != c.want {
				t.Fatalf("exit %d, records %+v, want s1's coordinator %q:\n%s", got.code, written.Threads, c.want, got.stdout)
			}
		})
	}
}

// a record write that names no lane (a summon of a dispatched thread) keeps the lane and the clio that dispatched it
func TestThreadRecordWithNoLaneKeepsItsDispatchingClio(t *testing.T) {
	// serial: t.Setenv names the store
	store := filepath.Join(t.TempDir(), "threads.json")
	t.Setenv("X_THREADS", store)
	now := time.Now()
	if err := writeThreadRecord(thread{SessionID: "s1", Role: "codie", Lane: "cli-3", Coordinator: "clio-wing-1"}, now, true); err != nil {
		t.Fatal(err)
	}

	if err := writeThreadRecord(thread{SessionID: "s1", Role: "codie", Ticket: "FRM-2"}, now, true); err != nil {
		t.Fatal(err)
	}

	written, _ := readThreadStore(store)
	if len(written.Threads) != 1 || written.Threads[0].Coordinator != "clio-wing-1" || written.Threads[0].Lane != "cli-3" {
		t.Fatalf("records %+v, want s1 kept in cli-3 by clio-wing-1", written.Threads)
	}
}
