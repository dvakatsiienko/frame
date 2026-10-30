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
		return `{"data":{"issue":{"id":"uuid-1","identifier":"FRM-1","description":` + string(description) + `,"state":{"name":"` + s.state + `"},"delegate":` + delegate +
			`,"labels":{"nodes":[` + strings.Join(labels, ",") + `]},"team":{"states":{"nodes":[{"id":"s-todo","name":"Todo"},{"id":"s-ip","name":"In Progress"}]}}},` +
			`"users":{"nodes":[{"id":"u-codie","name":"codie"}]}}}`
	})
}

func runDispatch(t *testing.T, server *fakeLinear, args ...string) (map[string]any, asRun) {
	t.Helper()
	home := t.TempDir()
	write(t, filepath.Join(home, ".claude/shelf/cc-usage-window.json"), `{"rate_limits":{"five_hour":{"resets_at":1793389800,"used_percentage":20}}}`)
	return runLinear(t, server, []string{"HOME=" + home}, append([]string{"lane", "dispatch"}, args...)...)
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

	envelope, got := runDispatch(t, server, "FRM-1", "--session", "s1", "--lane", "cli-3", "--apply")

	if got.code != 0 || strings.Count(jsonOf(envelope["data"]), `"set"`) != 4 {
		t.Fatalf("exit %d, want every mark already set:\n%s", got.code, got.stdout)
	}
	if n := len(mutations(server)); n != 0 {
		t.Errorf("%d mutations on a dispatched ticket", n)
	}
}

func TestDispatchRefusesATicketWithNoSign(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name string
		s    dispatchState
	}{
		{"no ## signed block", dispatchState{body: dispatchAbove, state: "Todo", labels: []string{"agent", "signed"}}},
		{"neither the label nor a 🚀 line", dispatchState{body: signedTicket, state: "Todo", labels: []string{"agent"}}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			server := dispatchServer(t, c.s)

			envelope, got := runDispatch(t, server, "FRM-1", "--session", "s1", "--lane", "cli-3", "--apply")

			if got.code == 0 || !strings.Contains(jsonOf(envelope["error"]), "sign") {
				t.Errorf("exit %d, want a refusal naming the sign:\n%s", got.code, got.stdout)
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
