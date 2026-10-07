package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
)

func archiveServer(t *testing.T, more string) *fakeLinear {
	return newFakeLinear(t, func(call gqlCall) string {
		if strings.Contains(call.Query, "mutation") {
			return okAnswer(call)
		}
		return `{"data":{"issues":{"nodes":[{"id":"u1","identifier":"FRM-1"},{"id":"u2","identifier":"FRM-2"}],"pageInfo":{"hasNextPage":` + more + `}}}}`
	})
}

func TestArchivePlansWithoutApplyAndWritesNothing(t *testing.T) {
	server := archiveServer(t, "false")
	envelope, got := runLinear(t, server, nil, "linear", "archive", "--days", "30")
	if got.code != 4 || envelope["status"] != "confirm" {
		t.Fatalf("exit %d, want 4 and a plan: %s", got.code, got.stdout)
	}
	if plan, _ := json.Marshal(envelope["plan"]); !strings.Contains(string(plan), `"FRM-1","FRM-2"`) {
		t.Errorf("the plan does not list the tickets: %s", plan)
	}
	filter, _ := json.Marshal(server.requests()[0].Variables["filter"])
	if !strings.Contains(string(filter), `"lt":"-P30D"`) || !strings.Contains(string(filter), `["completed","canceled"]`) {
		t.Errorf("the lookup asked for %s", filter)
	}
	if n := len(mutations(server)); n != 0 {
		t.Errorf("%d archives went out without --apply", n)
	}
}

func TestArchiveDrawsItsRunBoardOnATerminal(t *testing.T) {
	server := archiveServer(t, "false")
	out, code := runTTY(t, xbin, world(t), call{ID: "linear-archive-tty", Mode: "tty", Cols: 100, Stdin: "none",
		Argv: []string{"linear", "archive"},
		Env:  map[string]string{"X_KEYS": linearKeys(t), "X_LINEAR_URL": server.URL, "X_TEST": "1"}})
	plain := ansiCode.ReplaceAllString(out, "")
	if code != 4 || !strings.Contains(plain, "╭") || !strings.Contains(plain, "find") || !strings.Contains(plain, "dry run") {
		t.Errorf("exit %d, want the run board with its find step and the dry run:\n%s", code, plain)
	}
}

func TestArchiveWithApplyArchivesEveryPlannedTicketInOneRequest(t *testing.T) {
	server := archiveServer(t, "true")
	envelope, got := runLinear(t, server, nil, "linear", "archive", "--apply")
	if got.code != 0 {
		t.Fatalf("exit %d\n%s%s", got.code, got.stdout, got.stderr)
	}
	sent := mutations(server)
	if len(sent) != 1 || strings.Count(sent[0].Query, "issueArchive(") != 2 {
		t.Fatalf("want one request archiving both, got %v", sent)
	}
	data, _ := envelope["data"].(map[string]any)
	if fmt.Sprint(data["archived"]) != "[FRM-1 FRM-2]" || data["more"] != true {
		t.Errorf("archived %v more %v, want both and a capped page marked", data["archived"], data["more"])
	}
	if filter, _ := json.Marshal(server.requests()[0].Variables["filter"]); !strings.Contains(string(filter), `"lt":"-P14D"`) {
		t.Errorf("the default window is not 14 days: %s", filter)
	}
}
