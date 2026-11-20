package main

import (
	"encoding/json"
	"path/filepath"
	"testing"
	"time"
)

// 20 Nov: a stray briefed from the mods lane's ticket kept `lane: mods-lane-8, ticket: FRM-662`, so the siesta's pace read
// projected it against the mods plan; a stray's record names its own batch or no lane
func TestThreadRecordKeepsAStrayOffAnotherLane(t *testing.T) {
	// serial: X_THREADS is the store writeThreadRecord reads
	store := filepath.Join(t.TempDir(), "threads.json")
	t.Setenv("X_THREADS", store)
	now := time.UnixMilli(2_000_000)
	for _, c := range []struct {
		name         string
		lane, ticket string
		wantLane     string
		wantTicket   string
	}{
		{"a mods dispatch's lane and ticket", "mods-lane-8", "FRM-662", "", ""},
		{"its own batch", "stray-batch-9", "FRM-700", "stray-batch-9", "FRM-700"},
		{"its standing lane", "strays-lane", "FRM-701", "strays-lane", "FRM-701"},
		{"another lane again, after its batch", "mods-lane-8", "FRM-662", "", ""},
	} {
		if err := writeThreadRecord(thread{SessionID: "sid-stray", Role: "codie", Area: "stray", Lane: c.lane, Ticket: c.ticket}, now, true); err != nil {
			t.Fatalf("%s: %v", c.name, err)
		}
		written, _ := readThreadStore(store)
		if got := written.Threads[0]; got.Lane != c.wantLane || got.Ticket != c.wantTicket {
			t.Fatalf("%s: lane %q ticket %q, want %q and %q", c.name, got.Lane, got.Ticket, c.wantLane, c.wantTicket)
		}
	}
}

func TestThreadRecordKeepsAMembersLaneWhoseScopeDrawsNoUnit(t *testing.T) {
	// serial: X_THREADS is the store writeThreadRecord reads
	store := filepath.Join(t.TempDir(), "threads.json")
	t.Setenv("X_THREADS", store)
	if err := writeThreadRecord(thread{SessionID: "sid-mods", Role: "codie", Area: "mods", Lane: "mods-lane-8", Ticket: "FRM-662"}, time.UnixMilli(2_000_000), true); err != nil {
		t.Fatal(err)
	}
	written, _ := readThreadStore(store)
	if got := written.Threads[0]; got.Lane != "mods-lane-8" || got.Ticket != "FRM-662" {
		t.Fatalf("record %+v, want a mods codie to keep its lane and ticket", got)
	}
}

// the sync cleans a record written before the rule, so the live store reads right the next call
func TestThreadListDropsAStraysOtherLane(t *testing.T) {
	t.Parallel()
	env, store, _, _ := threadWorld(t)
	was, _ := readThreadStore(store)
	was.Threads = append(was.Threads, thread{SessionID: "sid-plain", Role: "codie", Area: "stray", Lane: "mods-lane-8", Ticket: "FRM-662", Coordinator: "clio-main", At: time.Now().UnixMilli()})
	raw, _ := json.Marshal(was)
	write(t, store, string(raw))
	if got := xIn(t, t.TempDir(), env, "thread", "list"); got.code != 0 {
		t.Fatalf("exit %d:\n%s", got.code, got.stdout)
	}
	written, _ := readThreadStore(store)
	for _, th := range written.Threads {
		if th.SessionID == "sid-plain" && (th.Lane != "" || th.Ticket != "" || th.Coordinator != "") {
			t.Fatalf("sid-plain %+v, want the stray's lane, ticket and coordinator dropped", th)
		}
		if th.SessionID == "sid-codie" && th.Lane != "cli lane 8" {
			t.Fatalf("sid-codie lane %q, want a cli codie's lane kept", th.Lane)
		}
	}
}
