package main

import (
	"encoding/json"
	"path/filepath"
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
		return `{"data":{"issue":{"id":"uuid-1","identifier":"FRM-1","description":` + string(description) + `,"state":{"name":"` + s.state + `","type":"` + stateTypes[s.state] + `"},"delegate":` + delegate +
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

func TestDispatchNamesTheSlicesDirAfterTheSpecsFeature(t *testing.T) {
	t.Parallel()
	frame := repo(t)
	write(t, filepath.Join(frame, ".scratch/feat-a/spec.md"), "# feat a\n\n## FRM-1 — the chunk\n")
	server := dispatchServer(t, dispatchState{body: signedTicket, state: "Todo", labels: []string{"agent", "signed"}})

	envelope, _ := runDispatchIn(t, server, frame, "FRM-1", "--session", "s1", "--lane", "cli-9")

	if out := jsonOf(envelope["plan"]); !strings.Contains(out, "lanes/feat-a/issues/") {
		t.Errorf("the slices dir must follow the spec's feature, as the lane plan and the retros do:\n%s", out)
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
