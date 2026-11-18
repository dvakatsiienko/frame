package main

import (
	"cmp"
	"slices"
	"time"
)

// a lane as its members' thread records hold it: each shared field from the first record that has it, the codie's first
type laneRecord struct {
	Lane        string `json:"lane"`
	Scope       string `json:"scope,omitempty"`
	Mode        string `json:"mode,omitempty"`
	Ticket      string `json:"ticket,omitempty"`
	Coordinator string `json:"coordinator,omitempty"`
	// session id → role, so a replaced member still running beside its successor keeps its row
	Members map[string]string `json:"members"`
}

func laneShow(r *Run, args []string, _ Flags) (any, error) {
	threads, err := refreshThreads(time.Now())
	if err != nil {
		return nil, &Fail{Msg: "the thread store was not written: " + err.Error(), Next: "x thread list"}
	}
	record, ok := laneOf(args[0], threads)
	if !ok {
		return nil, &Fail{Msg: "no live thread in lane " + quote(args[0]), Next: "x thread list"}
	}
	r.Done(plural(len(record.Members), "member"), "")
	return record, nil
}

func laneOf(lane string, threads []thread) (laneRecord, bool) {
	record := laneRecord{Lane: lane, Members: map[string]string{}}
	var members []thread
	for _, t := range threads {
		if t.Lane == lane && t.Role != "" {
			members = append(members, t)
			record.Members[t.SessionID] = t.Role
		}
	}
	slices.SortStableFunc(members, func(a, b thread) int { return cmp.Compare(rank(a), rank(b)) })
	for _, t := range members {
		record.Scope = cmp.Or(record.Scope, t.Area)
		record.Mode = cmp.Or(record.Mode, t.LaneKind)
		record.Ticket = cmp.Or(record.Ticket, t.Ticket)
		record.Coordinator = cmp.Or(record.Coordinator, t.Coordinator)
	}
	return record, len(members) > 0
}

// a codie's record speaks first: a dispatch moves the codie, and a sixth sense left out of it keeps the chunk before
func rank(t thread) int {
	if t.Role == "codie" {
		return 0
	}
	return 1
}
