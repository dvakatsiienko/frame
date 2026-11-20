package main

import (
	"context"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

const wishCoverScript = "_clio/script/wish-cover.ts"

// the lane's spec read against the ticket's W-lines by `wish-cover.ts --all`: a line no slice cites and no `→ <home>` note settles is
// an ask the close would lose unseen (20 Nov: FRM-620 held 9). nil when there is nothing to read: no W-line in the body, no open spec
// (an archived or absent one was read or never existed), or a ticket linear did not send
func wishCoverLine(frame string, specs []string, id string, issue landedRead, issueErr error) *landedLine {
	if issueErr != nil || len(specs) == 0 || len(wishItem.FindAllString(issue.Description, -1)) == 0 {
		return nil
	}
	line := landedLine{name: "wish-cover", fix: "cite each line in a slice of the spec, or mark it «→ <home>» on the ticket's wish; then x lane landed " + id + " --apply"}
	script := filepath.Join(frame, wishCoverScript)
	node, err := exec.LookPath("node")
	if !exists(script) || err != nil {
		line.detail, line.fix = "cannot run "+wishCoverScript+" in "+home(frame)+" (the script or node is missing), so the W-lines are unread", "restore "+wishCoverScript+", then x lane landed "+id+" --apply"
		return &line
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	cmd := exec.CommandContext(ctx, node, append([]string{script, id, "--all"}, specs...)...)
	cmd.Dir = frame
	got, _ := runCmd(cmd)
	var named []string
	for out := range strings.SplitSeq(got.log, "\n") {
		if out = strings.TrimSpace(out); strings.HasPrefix(out, "✗") {
			named = append(named, strings.TrimSpace(strings.TrimPrefix(out, "✗")))
		}
	}
	switch {
	case got.ok:
		line.ok, line.detail = true, "every W-line of "+id+" is cited in the spec or settled elsewhere"
	case len(named) > 0:
		line.detail = strings.Join(named, "; ")
	default:
		// the script's own words: it could not read the ticket, or its block holds no numbered W-line
		last := strings.Split(got.log, "\n")
		line.detail = "wish-cover said: " + strings.TrimSpace(last[len(last)-1])
	}
	return &line
}
