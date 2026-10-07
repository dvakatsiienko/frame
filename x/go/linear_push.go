package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"syscall"
	"time"

	"github.com/charmbracelet/x/term"
)

// linear push is the pre-push hook: it links a pushed commit to the ticket its `- ticket:` line names,
// and undoes the assignee and state writes linear's own integration makes for commits written with its
// magic words — the state move it asked for plus an assignee nobody asked for. no setting stops it:
// linear resolves the actor from the pusher, so no commit-author identity reaches it, and undoing it
// after left an assign → unassign pair in every history. its parser fires on a keyword only, so
// `- ticket: FRM-1` passes it untouched (measured on DOT-229, 2026-08-28). the hook half never fails a push: it reads the refs, detaches the
// run half and exits 0 whatever happened; the run half waits for the push to land before any write.

var (
	pushOwners    = []string{"dvakatsiienko"}
	pushHost      = "github.com"
	pushTeams     = `((?:FRM|DOT|BYT)-\d+)`
	zeroOid       = regexp.MustCompile(`^0+$`)
	remoteURL     = regexp.MustCompile(`^(?:git@|ssh://git@|https://)([^/:]+)[/:]([^/]+)/(.+?)(?:\.git)?$`)
	nonClosing    = `refs?|references|part of|contributes towards?|contributes to|towards?`
	closingWords  = `close[sd]?|fix(?:e[sd])?|resolve[sd]?|complete[sd]?|implement(?:s|ed)?`
	linkLine      = regexp.MustCompile(`(?i)^[\s>*+-]*ticket:\s*` + pushTeams + `\s*$`)
	landDelays    = []time.Duration{1500 * time.Millisecond, 3 * time.Second, 6 * time.Second, 10 * time.Second}
	revertDelays  = []time.Duration{12 * time.Second, 15 * time.Second, 15 * time.Second, 20 * time.Second}
	historyPage   = 20
	magicKeywords = map[bool]*regexp.Regexp{
		false: regexp.MustCompile(`(?i)\b(?:` + nonClosing + `)\s+` + pushTeams + `\b`),
		true:  regexp.MustCompile(`(?i)\b(?:` + closingWords + `)\s+` + pushTeams + `\b`),
	}
)

type pushedRef struct{ LocalRef, LocalOid, RemoteRef, RemoteOid string }
type pushRemote struct{ Host, Owner, Repo string }
type pushCommit struct{ Sha, Subject, Body, Branch string }
type magicRef struct {
	ID      string
	Closing bool
}
type linkTarget struct {
	ID      string
	Commits []pushCommit
}
type stateRef struct{ ID, Name, Type string }
type historyNode struct {
	CreatedAt  string    `json:"createdAt"`
	FromState  *stateRef `json:"fromState"`
	ToState    *stateRef `json:"toState"`
	ToAssignee *named    `json:"toAssignee"`
}
type revertStep struct{ Kind, StateID, StateName string }
type revertPlan struct {
	Reverts []revertStep
	Reasons []string
}

// parseRemote fails closed: an unknown url, a foreign host or owner all mean «not dima's repo»
func parseRemote(url string) (pushRemote, string) {
	m := remoteURL.FindStringSubmatch(strings.TrimSpace(url))
	switch {
	case m == nil:
		return pushRemote{}, "remote url not recognised: " + url
	case m[1] != pushHost:
		return pushRemote{}, "remote host " + m[1] + " is not " + pushHost
	case !slices.Contains(pushOwners, m[2]):
		return pushRemote{}, "remote owner " + m[2] + " is not one of ours"
	}
	return pushRemote{m[1], m[2], m[3]}, ""
}

func parsePushedRefs(stdin string) []pushedRef {
	var refs []pushedRef
	for line := range strings.SplitSeq(stdin, "\n") {
		parts := strings.Fields(line)
		if len(parts) == 4 && !zeroOid.MatchString(parts[1]) {
			refs = append(refs, pushedRef{parts[0], parts[1], parts[2], parts[3]})
		}
	}
	return refs
}

// a new branch has no remote oid to subtract, so every other remote bounds it — never all of history
func pushRange(ref pushedRef) []string {
	if zeroOid.MatchString(ref.RemoteOid) {
		return []string{ref.LocalOid, "--not", "--remotes"}
	}
	return []string{ref.RemoteOid + ".." + ref.LocalOid}
}

func branchOf(ref pushedRef) string {
	if branch := strings.TrimPrefix(ref.RemoteRef, "refs/heads/"); branch != "" {
		return branch
	}
	return ref.RemoteRef
}

// closing wins: a ticket both referenced and closed is being closed
func magicRefsIn(messages []string) []magicRef {
	var found []magicRef
	for _, message := range messages {
		for _, closing := range []bool{false, true} {
			for _, m := range magicKeywords[closing].FindAllStringSubmatch(message, -1) {
				id := strings.ToUpper(m[1])
				if i := slices.IndexFunc(found, func(r magicRef) bool { return r.ID == id }); i >= 0 {
					found[i].Closing = found[i].Closing || closing
				} else {
					found = append(found, magicRef{id, closing})
				}
			}
		}
	}
	return found
}

// one target per ticket; a commit repeating its line is attached once
func linkTargetsIn(commits []pushCommit) []linkTarget {
	var targets []linkTarget
	for _, commit := range commits {
		var named []string
		for line := range strings.SplitSeq(commit.Body, "\n") {
			if m := linkLine.FindStringSubmatch(line); m != nil && !slices.Contains(named, strings.ToUpper(m[1])) {
				named = append(named, strings.ToUpper(m[1]))
			}
		}
		for _, id := range named {
			i := slices.IndexFunc(targets, func(t linkTarget) bool { return t.ID == id })
			if i < 0 {
				targets, i = append(targets, linkTarget{ID: id}), len(targets)
			}
			targets[i].Commits = append(targets[i].Commits, commit)
		}
	}
	return targets
}

// planRevert's whole guard is the window: the integration writes as dima, so only a write stamped
// after the push can be told from his own
func planRevert(closing bool, currentStateID string, history []historyNode, pushedAt time.Time) revertPlan {
	var plan revertPlan
	var fresh []historyNode
	for _, node := range history {
		if at, err := time.Parse(time.RFC3339Nano, node.CreatedAt); err == nil && !at.Before(pushedAt) {
			fresh = append(fresh, node)
		}
	}
	slices.SortStableFunc(fresh, func(a, b historyNode) int { return strings.Compare(a.CreatedAt, b.CreatedAt) })
	if len(fresh) == 0 {
		plan.Reasons = append(plan.Reasons, "no history entry after the push — the integration wrote nothing")
		return plan
	}
	if slices.ContainsFunc(fresh, func(n historyNode) bool { return n.ToAssignee != nil }) {
		plan.Reverts = append(plan.Reverts, revertStep{Kind: "unassign"})
		plan.Reasons = append(plan.Reasons, "assignee was set after the push — clearing it")
	}
	// the oldest post-push move holds the state the ticket had before the integration touched it
	i := slices.IndexFunc(fresh, func(n historyNode) bool { return n.ToState != nil })
	if i < 0 || fresh[i].FromState == nil {
		plan.Reasons = append(plan.Reasons, "no state move after the push — leaving state alone")
		return plan
	}
	from, to := fresh[i].FromState, fresh[i].ToState
	switch {
	case closing:
		plan.Reasons = append(plan.Reasons, from.Name+" → "+to.Name+" came from a closing keyword — wanted, keeping it")
	case to.Type == "completed":
		plan.Reasons = append(plan.Reasons, to.Name+" is a completed state — refusing to reopen it automatically")
	case currentStateID == from.ID:
		plan.Reasons = append(plan.Reasons, "state is already back at "+from.Name+" — nothing to undo")
	default:
		plan.Reverts = append(plan.Reverts, revertStep{"state", from.ID, from.Name})
	}
	return plan
}

/* the two halves */

type pushJob struct {
	Landing    []pushedRef  `json:"landing"`
	Links      []linkTarget `json:"links"`
	Magic      []magicRef   `json:"magic"`
	PushedAt   time.Time    `json:"pushedAt"`
	Remote     pushRemote   `json:"remote"`
	RemoteName string       `json:"remoteName"`
	Root       string       `json:"root"`
}

func linearPush(r *Run, args []string, flags Flags) (any, error) {
	r.passthrough = true
	if job, _ := flags["job"].(string); job != "" {
		runPushJob(job)
		return nil, nil
	}
	// a git hook: anything that throws here would fail the push, and nothing here is worth that
	defer func() { _ = recover() }()
	pushHook(args)
	return nil, nil
}

func say(text string) { fmt.Fprintln(os.Stderr, text) }

func gitOut(args ...string) (string, error) {
	out, err := exec.Command("git", args...).Output()
	return string(out), err
}

func pushHook(args []string) {
	pushedAt := time.Now()
	remoteName, url := "", ""
	if len(args) > 0 {
		remoteName = args[0]
	}
	if len(args) > 1 {
		url = args[1]
	}
	if url == "" && remoteName != "" {
		url, _ = gitOut("config", "--get", "remote."+remoteName+".url")
	}
	remote, reason := parseRemote(url)
	if reason != "" {
		say("linear: standing down — " + reason)
		return
	}
	// git hands the refs on a pipe; run by hand on a terminal there are none to wait for
	var stdin []byte
	if !term.IsTerminal(os.Stdin.Fd()) {
		stdin, _ = io.ReadAll(os.Stdin)
	}
	refs := parsePushedRefs(string(stdin))
	var commits []pushCommit
	for _, ref := range refs {
		out, err := gitOut(append([]string{"log", "--format=%H%x1f%s%x1f%B%x00"}, pushRange(ref)...)...)
		if err != nil {
			continue
		}
		for entry := range strings.SplitSeq(out, "\x00") {
			parts := strings.SplitN(strings.TrimPrefix(entry, "\n"), "\x1f", 3)
			if len(parts) == 3 && parts[0] != "" {
				commits = append(commits, pushCommit{parts[0], parts[1], parts[2], branchOf(ref)})
			}
		}
	}
	links := linkTargetsIn(commits)
	var bodies []string
	for _, c := range commits {
		bodies = append(bodies, c.Body)
	}
	magic := magicRefsIn(bodies)
	if len(links) == 0 && len(magic) == 0 {
		return
	}
	// --git-common-dir: one log per repo, shared by its worktrees
	gitDir, err1 := gitOut("rev-parse", "--path-format=absolute", "--git-common-dir")
	root, err2 := gitOut("rev-parse", "--show-toplevel")
	if err1 != nil || err2 != nil {
		say("linear: not inside a git repo — wrote nothing")
		return
	}
	gitDir, root = strings.TrimSpace(gitDir), strings.TrimSpace(root)
	jobPath := filepath.Join(gitDir, fmt.Sprintf("linear-push-job-%d.json", os.Getpid()))
	raw, _ := json.Marshal(pushJob{refs, links, magic, pushedAt, remote, remoteName, root})
	if os.WriteFile(jobPath, raw, 0o600) != nil {
		return
	}
	logPath := filepath.Join(gitDir, "linear-push.log")
	logFile, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	defer logFile.Close()
	self, _ := os.Executable()
	child := exec.Command(self, "linear", "push", "--job", jobPath)
	child.Stdout, child.Stderr = logFile, logFile
	child.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
	if child.Start() != nil {
		return
	}
	_ = child.Process.Release()

	var said []string
	if len(links) > 0 {
		var ids []string
		shas := map[string]bool{}
		for _, l := range links {
			ids = append(ids, l.ID)
			for _, c := range l.Commits {
				shas[c.Sha] = true
			}
		}
		said = append(said, "linking "+plural(len(shas), "commit")+" to "+strings.Join(ids, ", "))
	}
	if len(magic) > 0 {
		var ids []string
		for _, m := range magic {
			ids = append(ids, m.ID)
		}
		said = append(said, "undoing the auto-assign on "+strings.Join(ids, ", "))
	}
	say("linear: " + strings.Join(said, " + ") + " → " + logPath)
}

// tests run the waits at a millisecond each; the real ones give the push and linear's integration time
func wait(d time.Duration) {
	if os.Getenv("X_PUSH_FAST") != "" {
		d = time.Millisecond
	}
	time.Sleep(d)
}

func logLine(format string, a ...any) {
	fmt.Printf("[%s] %s\n", time.Now().UTC().Format(time.RFC3339), fmt.Sprintf(format, a...))
}

func runPushJob(path string) {
	raw, err := os.ReadFile(path)
	if err != nil {
		logLine("no job at %s", path)
		return
	}
	_ = os.Remove(path)
	var job pushJob
	if json.Unmarshal(raw, &job) != nil {
		logLine("an unreadable job at %s", path)
		return
	}
	logLine("push at %s → %s/%s", job.PushedAt.UTC().Format(time.RFC3339), job.Remote.Owner, job.Remote.Repo)
	// pre-push runs before the transfer, and the transfer can still be refused
	if !landed(job) {
		logLine("the push never reached the remote — wrote nothing")
		return
	}
	actor, _ := actorOf(Flags{})
	for _, target := range job.Links {
		for _, c := range target.Commits {
			url := fmt.Sprintf("https://%s/%s/%s/commit/%s", job.Remote.Host, job.Remote.Owner, job.Remote.Repo, c.Sha)
			// the same url on the same issue answers the existing attachment, so a re-push is free
			_, errs, err := gql(actor, `mutation($input: AttachmentCreateInput!) { attachmentCreate(input: $input) { success } }`,
				map[string]any{"input": map[string]any{"issueId": target.ID, "url": url, "title": c.Subject, "subtitle": c.Sha[:min(7, len(c.Sha))] + " · " + c.Branch}})
			if err != nil || len(errs) > 0 {
				logLine("%s: linking %s FAILED", target.ID, c.Sha[:min(7, len(c.Sha))])
			} else {
				logLine("%s: linked %s", target.ID, c.Sha[:min(7, len(c.Sha))])
			}
		}
	}
	if len(job.Magic) > 0 {
		revertJob(actor, job)
	}
}

func landed(job pushJob) bool {
	for _, delay := range landDelays {
		wait(delay)
		all := true
		for _, ref := range job.Landing {
			out, _ := exec.Command("git", "-C", job.Root, "ls-remote", job.RemoteName, ref.RemoteRef).Output()
			all = all && strings.HasPrefix(string(out), ref.LocalOid)
		}
		if all {
			return true
		}
	}
	return false
}

// nothing yet is not nothing ever: an id stays outstanding until the window closes
func revertJob(actor string, job pushJob) {
	outstanding := slices.Clone(job.Magic)
	for _, delay := range revertDelays {
		if len(outstanding) == 0 {
			break
		}
		wait(delay)
		var still []magicRef
		for _, ref := range outstanding {
			data, _, err := gql(actor, fmt.Sprintf(`query($id: String!) { issue(id: $id) { state { id } history(first: %d) {
				nodes { createdAt fromState { id name type } toState { id name type } toAssignee { name } } } } }`, historyPage), map[string]any{"id": ref.ID})
			var issue struct {
				State   *struct{ ID string } `json:"state"`
				History connection[historyNode]
			}
			if err != nil || json.Unmarshal(data["issue"], &issue) != nil {
				still = append(still, ref)
				continue
			}
			current := ""
			if issue.State != nil {
				current = issue.State.ID
			}
			plan := planRevert(ref.Closing, current, issue.History.Nodes, job.PushedAt)
			if len(plan.Reverts) == 0 {
				still = append(still, ref)
				continue
			}
			for _, reason := range plan.Reasons {
				logLine("%s: %s", ref.ID, reason)
			}
			for _, step := range plan.Reverts {
				input := map[string]any{"assigneeId": nil}
				if step.Kind == "state" {
					input = map[string]any{"stateId": step.StateID}
				}
				_, errs, err := gql(actor, `mutation($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success } }`,
					map[string]any{"id": ref.ID, "input": input})
				if err != nil || len(errs) > 0 {
					logLine("%s: %s FAILED", ref.ID, step.Kind)
				} else {
					logLine("%s: applied %s", ref.ID, step.Kind)
				}
			}
		}
		outstanding = still
	}
	for _, ref := range outstanding {
		logLine("%s: nothing to undo inside the window", ref.ID)
	}
}
