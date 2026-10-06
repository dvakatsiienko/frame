package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"path/filepath"
	"slices"
	"strings"
)

type entry struct {
	Name     string  `json:"name"`
	Slug     string  `json:"slug"`
	Audience string  `json:"audience"`
	Lane     string  `json:"lane"`
	Author   string  `json:"author"`
	Shared   bool    `json:"shared"`
	Age      string  `json:"age"`
	Stale    bool    `json:"stale"`
	Bytes    int     `json:"bytes"`
	RunID    *string `json:"runId"`
	Meta     *string `json:"meta"`
	Kept     bool    `json:"kept"`
	Body     string  `json:"body"`
}

type listing struct {
	Root    string  `json:"root"`
	Entries []entry `json:"entries"`
	Others  []entry `json:"others"`
}

// one store, many doors: the rules live in script/lib/handoff-store.ts, reached through store.ts
func store(op string, args ...string) (json.RawMessage, error) {
	script := filepath.Join(sourceDir(), "store.ts")
	if !exists(script) {
		return nil, &Fail{Msg: "no store bridge at " + script + " — this binary was moved away from the frame tree it was built in",
			Next: "pnpm x-go:build"}
	}
	got, _ := run("", nil, "", "node", append([]string{script, op}, args...)...)
	var answer struct {
		Value json.RawMessage `json:"value"`
		Error string          `json:"error"`
		Usage bool            `json:"usage"`
	}
	if err := json.Unmarshal([]byte(got.out), &answer); err != nil {
		return nil, &Fail{Msg: "the handoff store bridge did not answer: " + firstOf(got.log), Next: "node " + script + " list"}
	}
	if answer.Error != "" {
		return nil, &Fail{Msg: answer.Error, Next: "x handoffs list", IsUsage: answer.Usage}
	}
	return answer.Value, nil
}

func forArgs(flags Flags) []string {
	if audience, _ := flags["for"].(string); audience != "" {
		return []string{"--for", audience}
	}
	return nil
}

func handoffsList(r *Run, _ []string, flags Flags) (any, error) {
	raw, err := store("list", forArgs(flags)...)
	if err != nil {
		return nil, err
	}
	if r.human {
		var found listing
		_ = json.Unmarshal(raw, &found)
		r.Board(listBoard(found, flags))
	}
	return raw, nil
}

func listBoard(found listing, flags Flags) string {
	audience, _ := flags["for"].(string)
	right := fmt.Sprintf("%d pending, newest first", len(found.Entries))
	if audience != "" {
		right = fmt.Sprintf("%d pending for %s", len(found.Entries), audience)
	}
	b := frame{width: frameWidth(), titleLeft: titleOf("handoffs list"), titleRight: ui.dim.Render(right),
		footLeft: ui.dim.Render("x handoffs peek <slug>"), footRight: ui.dim.Render("nothing is deleted by age"), padRows: true}
	narrow := isNarrow()
	widths := []int{16, 8, 8, 12, b.inner() - 44}
	head := []string{"slug", "for", "by", "age", "lane · run id"}
	if narrow {
		widths = []int{16, 8, 8, b.inner() - 32}
		head = head[:4]
	}
	for i := range head {
		head[i] = ui.label.Render(head[i])
	}
	b.rows = append(b.rows, columns(widths, head...)...)
	if len(found.Entries) == 0 {
		b.rows = append(b.rows, "", ui.dim.Render("the store is clean — nothing pending"))
	} else {
		b.rows = append(b.rows, "")
	}
	for _, e := range found.Entries {
		age := ui.fg.Render(e.Age)
		if e.Stale {
			age = ui.er.Render(e.Age + " stale")
		}
		cells := []string{ui.verb("handoffs", e.Slug), ui.fg.Render(e.Audience), ui.fg.Render(e.Author), age}
		if !narrow {
			lane := e.Lane
			if e.Shared {
				lane += ", shared"
			}
			if e.RunID != nil {
				lane += " · " + *e.RunID
			}
			cells = append(cells, ui.dim.Render(lane))
		}
		b.rows = append(b.rows, columns(widths, cells...)...)
	}
	if len(found.Others) > 0 {
		b.rows = append(b.rows, "", ui.dim.Render(fmt.Sprintf("%d addressed to another agent — leave them:", len(found.Others))))
		for _, e := range found.Others {
			b.rows = append(b.rows, ui.dim.Render(fmt.Sprintf("  %s → for %s, by %s", e.Slug, e.Audience, e.Author)))
		}
	}
	return b.String()
}

func handoffsPeek(r *Run, args []string, _ Flags) (any, error) {
	raw, err := store("peek", args...)
	if err != nil {
		return nil, err
	}
	if r.human {
		var e entry
		_ = json.Unmarshal(raw, &e)
		meta := "_no META block in this CST — ingest would still take it whole._"
		if e.Meta != nil {
			meta = *e.Meta
		}
		b := frame{width: frameWidth(), titleLeft: titleOf("handoffs peek"),
			titleRight: ui.dim.Render(fmt.Sprintf("%s, %s old, %s", e.Slug, e.Age, size(e.Bytes))),
			footLeft:   ui.dim.Render("take it with") + " " + cmd("x handoffs ingest "+e.Slug), footRight: ui.dim.Render("the file is untouched"), padRows: true}
		b.rows = markdown(meta, b.inner())
		r.Board(b.String())
	}
	return raw, nil
}

func handoffsIngest(r *Run, args []string, flags Flags) (any, error) {
	if len(args) == 0 && r.interactive {
		raw, err := store("list", forArgs(flags)...)
		if err != nil {
			return nil, err
		}
		var found listing
		_ = json.Unmarshal(raw, &found)
		if len(found.Entries) > 1 {
			items := make([]pickable, len(found.Entries))
			for i, e := range found.Entries {
				items[i] = pickable{e.Name, fmt.Sprintf("%-14s %s", e.Slug, ui.dim.Render(fmt.Sprintf("for %s, %s lane, by %s, %s old", e.Audience, e.Lane, e.Author, e.Age)))}
			}
			chosen, err := pick("handoffs", "which handoff continues here?", items)
			if err != nil {
				return nil, err
			}
			args = []string{chosen}
		}
	}
	raw, err := store("ingest", append(args, forArgs(flags)...)...)
	if err != nil {
		return nil, err
	}
	if r.human {
		var e entry
		_ = json.Unmarshal(raw, &e)
		foot := "the file was deleted on ingest"
		if e.Kept {
			foot = "shared: the file stays for other pullers"
		}
		b := frame{width: frameWidth(), titleLeft: titleOf("handoffs ingest"), titleRight: ui.dim.Render(e.Slug),
			footLeft: ui.dim.Render(foot), padRows: true}
		b.rows = markdown(e.Body, b.inner())
		r.Board(b.String())
	}
	return raw, nil
}

func pendingSlugs() []string {
	raw, err := store("list")
	if err != nil {
		return nil
	}
	var found listing
	_ = json.Unmarshal(raw, &found)
	var slugs []string
	for _, e := range found.Entries {
		slugs = append(slugs, e.Slug)
	}
	return slugs
}

/* schema */
func schema(r *Run, args []string, flags Flags) (any, error) {
	prefix := strings.Join(args, " ")
	matched := verbsUnder(prefix)
	if len(matched) == 0 {
		return nil, usageFail("no verb or group named "+prefix, "x --help")
	}
	level, _ := flags["level"].(string)
	if level == "" {
		level = "full"
	}
	if !slices.Contains([]string{"short", "full"}, level) {
		return nil, usageFail("--level is short or full, not "+level, "x schema --help")
	}

	var list []any
	for _, verb := range matched {
		if level == "short" {
			list = append(list, ordered{{"name", verb.Name}, {"purpose", verb.Purpose}})
		} else {
			list = append(list, verb.Raw)
		}
	}
	if r.human {
		b := frame{width: frameWidth(), titleLeft: titleOf("schema"), titleRight: ui.dim.Render(or(prefix, "every verb") + ", " + level),
			footLeft: ui.dim.Render("json when piped, or with --json"), padRows: true}
		if level == "short" {
			for _, verb := range matched {
				b.rows = append(b.rows, columns([]int{20, b.inner() - 20}, ui.verb(verb.Family(), verb.Name), ui.fg.Render(verb.Purpose))...)
			}
		} else {
			var pretty bytes.Buffer
			_ = json.Indent(&pretty, []byte(marshal(list)), "", "  ")
			b.rows = markdown("```json\n"+pretty.String()+"\n```", b.inner())
		}
		r.Board(b.String())
	}
	return ordered{{"verbs", list}}, nil
}

/* completion */
func completion(r *Run, args []string, _ Flags) (any, error) {
	shell := args[0]
	var script bytes.Buffer
	var err error
	switch shell {
	case "zsh":
		err = rootCmd.GenZshCompletion(&script)
	case "bash":
		err = rootCmd.GenBashCompletionV2(&script, true)
	case "fish":
		err = rootCmd.GenFishCompletion(&script, true)
	default:
		return nil, usageFail("no completion for "+shell+" — zsh, bash or fish", "x completion zsh")
	}
	if err != nil {
		return nil, err
	}
	r.Board(strings.TrimRight(script.String(), "\n"))
	return ordered{{"script", script.String()}, {"shell", shell}}, nil
}

func size(n int) string {
	if n < 1024 {
		return fmt.Sprintf("%d B", n)
	}
	return fmt.Sprintf("%.1f kB", float64(n)/1024)
}

func firstOf(log string) string {
	line, _, _ := strings.Cut(strings.TrimSpace(log), "\n")
	return line
}
