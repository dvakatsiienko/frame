package main

import (
	"encoding/json"
	"fmt"
	"testing"
)

// FRM-617 exit 1: a lane's record is derived from its members' thread records, never kept apart
func TestLaneShowDerivesALaneFromItsThreads(t *testing.T) {
	t.Parallel()
	env, store, _, _ := threadWorld(t)
	written, err := readThreadStore(store)
	if err != nil {
		t.Fatal(err)
	}
	written.Threads = append(written.Threads, thread{SessionID: "sid-plain", Role: "sixth-sense", Lane: "cli lane 8", Coordinator: "clio-main", At: written.Threads[0].At})
	raw, _ := json.Marshal(written)
	write(t, store, string(raw))

	for _, c := range []struct {
		lane, want string
		code       int
	}{
		{lane: "cli lane 8", want: "cli side FRM-570 clio-main map[codie:sid-codie sixth-sense:sid-plain]"},
		{lane: "mods 6", want: "mods quick FRM-574 <nil> map[sixth-sense:sid-launching]"},
		{lane: "no such lane", code: 1},
	} {
		got := xIn(t, t.TempDir(), env, "lane", "show", c.lane)
		if got.code != c.code {
			t.Errorf("%s: exit %d, want %d:\n%s", c.lane, got.code, c.code, got.stdout)
			continue
		}
		if c.code != 0 {
			continue
		}
		d := got.data
		shown := fmt.Sprint(d["scope"], " ", d["mode"], " ", d["ticket"], " ", d["coordinator"], " ", d["members"])
		if d["lane"] != c.lane || shown != c.want {
			t.Errorf("%s: lane %v, %q, want %q:\n%s", c.lane, d["lane"], shown, c.want, got.stdout)
		}
	}
}
