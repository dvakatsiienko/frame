package main

import (
	"bytes"
	"cmp"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/charmbracelet/x/term"
)

type row struct {
	Age      string  `json:"age"`
	Audience string  `json:"audience"`
	Author   string  `json:"author"`
	Bytes    int64   `json:"bytes"`
	Lane     string  `json:"lane"`
	Name     string  `json:"name"`
	RunID    *string `json:"runId"`
	Shared   bool    `json:"shared"`
	Slug     string  `json:"slug"`
	Stale    bool    `json:"stale"`
}

type listing struct {
	Entries []row  `json:"entries"`
	Others  []row  `json:"others"`
	Root    string `json:"root"`
}

func rowOf(e stored, now time.Time) row {
	age := ageOf(e.mtime, now)
	return row{age.label, e.Audience, e.Author, e.size, e.Lane, e.file, parseRunID(readMeta(e.path)), e.Shared, e.Slug, age.stale}
}

func readerOf(flags Flags) (string, error) {
	reader, _ := flags["for"].(string)
	if reader != "" && !slices.Contains(audiences, reader) {
		return "", usageFail("unknown audience "+reader+" — any, ccli, cclio, cw", "x handoff list --help")
	}
	return reader, nil
}

func list(reader string) listing {
	root := storeRoot()
	found := listing{Entries: []row{}, Others: []row{}, Root: root}
	now := time.Now()
	for _, e := range listStore(root) {
		if reader == "" || readableBy(e.Audience, reader) {
			found.Entries = append(found.Entries, rowOf(e, now))
		} else {
			found.Others = append(found.Others, rowOf(e, now))
		}
	}
	return found
}

func handoffList(r *Run, _ []string, flags Flags) (any, error) {
	reader, err := readerOf(flags)
	if err != nil {
		return nil, err
	}
	found := list(reader)
	if r.human {
		r.Board(listBoard(found, flags))
	}
	return found, nil
}

func listBoard(found listing, flags Flags) string {
	audience, _ := flags["for"].(string)
	right := fmt.Sprintf("%d pending, newest first", len(found.Entries))
	if audience != "" {
		right = fmt.Sprintf("%d pending for %s", len(found.Entries), audience)
	}
	b := frame{width: frameWidth(), titleLeft: titleOf("handoff list"), titleRight: ui.dim.Render(right),
		footLeft: ui.dim.Render("x handoff peek <slug>"), footRight: ui.dim.Render("nothing is deleted by age"), padRows: true}
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
		cells := []string{ui.verb("handoff", e.Slug), ui.fg.Render(e.Audience), ui.fg.Render(e.Author), age}
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

func handoffPeek(r *Run, args []string, _ Flags) (any, error) {
	picked, err := pickEntry(firstArg(args), listStore(storeRoot()))
	if err != nil {
		return nil, err
	}
	meta := readMeta(picked.path)
	age := ageOf(picked.mtime, time.Now()).label
	if r.human {
		shown := "_no META block in this CST — ingest would still take it whole._"
		if meta != nil {
			shown = *meta
		}
		b := frame{width: frameWidth(), titleLeft: titleOf("handoff peek"),
			titleRight: ui.dim.Render(fmt.Sprintf("%s, %s old, %s", picked.Slug, age, size(int(picked.size)))),
			footLeft:   ui.dim.Render("take it with") + " " + cmd("x handoff ingest "+picked.Slug), footRight: ui.dim.Render("the file is untouched"), padRows: true}
		b.rows = markdown(shown, b.inner())
		r.Page(b)
	}
	return ordered{{"age", age}, {"bytes", picked.size}, {"meta", meta}, {"name", picked.file}, {"slug", picked.Slug}}, nil
}

func handoffIngest(r *Run, args []string, flags Flags) (any, error) {
	reader, err := readerOf(flags)
	if err != nil {
		return nil, err
	}
	all := listStore(storeRoot())
	if len(all) == 0 {
		return nil, usageFail("handoff store is clean — nothing pending.", "x handoff list")
	}
	mine := all
	if reader != "" {
		mine = slices.DeleteFunc(slices.Clone(all), func(e stored) bool { return !readableBy(e.Audience, reader) })
	}
	slug := firstArg(args)
	// naming a slug forces a foreign file: the caller said so out loud
	candidates := mine
	if slug != "" {
		candidates = all
	}
	if len(candidates) == 0 {
		others := slices.DeleteFunc(slices.Clone(all), func(e stored) bool { return readableBy(e.Audience, reader) })
		return nil, usageFail(fmt.Sprintf("nothing pending for %s. %d handoff(s) are addressed to another agent and were left untouched:\n%s",
			reader, len(others), describe(others)), "x handoff list")
	}
	if slug == "" && len(candidates) > 1 && r.interactive {
		now := time.Now()
		items := make([]pickable, len(candidates))
		for i, e := range candidates {
			items[i] = pickable{e.file, fmt.Sprintf("%-14s %s", e.Slug, ui.dim.Render(fmt.Sprintf("for %s, %s lane, by %s, %s old", e.Audience, e.Lane, e.Author, ageOf(e.mtime, now).label)))}
		}
		if slug, err = pick("handoff", "which handoff continues here?", items); err != nil {
			return nil, err
		}
	}
	picked, err := pickEntry(slug, candidates)
	if err != nil {
		return nil, err
	}
	body, err := os.ReadFile(picked.path)
	if err != nil {
		return nil, &Fail{Msg: picked.file + " vanished before it was read — another thread pulled it", Next: "x handoff list"}
	}
	// a file that could not be trashed stays for the next puller, and the envelope says so
	kept := picked.Shared
	if !kept {
		if err := discard(picked.path); err != nil {
			fmt.Fprintln(os.Stderr, "x: "+err.Error()+" — the CST stays in the store")
			kept = true
		}
	}
	if r.human {
		foot := "the file was deleted on ingest"
		if kept {
			foot = "the file stays in the store"
		}
		b := frame{width: frameWidth(), titleLeft: titleOf("handoff ingest"), titleRight: ui.dim.Render(picked.Slug),
			footLeft: ui.dim.Render(foot), padRows: true}
		b.rows = markdown(string(body), b.inner())
		r.Page(b)
	}
	return ordered{{"body", string(body)}, {"kept", kept}, {"name", picked.file}, {"slug", picked.Slug}}, nil
}

func handoffWrite(r *Run, _ []string, flags Flags) (any, error) {
	audience := cmp.Or(flagString(flags, "audience"), "any")
	if !slices.Contains(audiences, audience) {
		return nil, usageFail("unknown audience "+audience+" — any, ccli, cclio, cw", "x handoff write --help")
	}
	if strings.TrimSpace(flagString(flags, "slug")) == "" {
		return nil, usageFail("write needs --slug <topic>", "x handoff write --help")
	}
	body := readStdin()
	if strings.TrimSpace(body) == "" {
		return nil, usageFail("write takes the CST on stdin, and stdin was empty", "x handoff write --help")
	}
	n := name{Audience: audience, Author: flagString(flags, "author"), Lane: flagString(flags, "lane"),
		Shared: flags["shared"] == true, Slug: flagString(flags, "slug"), TS: utcStamp(time.Now())}
	root := storeRoot()

	var replaced *stored
	if err := r.Step("read", "reading the store", func() (string, error) {
		replaces := flagString(flags, "replaces")
		if replaces == "" {
			return "a new thread", nil
		}
		target, err := pickEntry(replaces, listStore(root))
		if fail, ok := errors.AsType[*Fail](err); ok {
			return "", usageFail(fail.Msg+"\nnothing was replaced. drop --replaces to write this as a new handoff.", "x handoff list")
		}
		replaced = &target
		n.Shared = n.Shared || target.Shared
		return "replaces " + target.Slug, nil
	}); err != nil {
		return nil, err
	}

	file := buildName(n)
	path := filepath.Join(root, file)
	if err := r.Step("write", "writing "+file, func() (string, error) {
		if err := os.MkdirAll(root, 0o700); err != nil {
			return "", err
		}
		// remove first, write second: one live CST per thread, so the window this order risks is zero, never two
		if replaced != nil {
			if err := discardIfThere(replaced.path); err != nil {
				return "", &Fail{Msg: err.Error() + " — nothing was written, the old CST stays", Next: "x handoff list"}
			}
		}
		if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
			return "", err
		}
		return file, os.Chmod(path, 0o600)
	}); err != nil {
		return nil, err
	}

	var replacedName any
	if replaced != nil {
		replacedName = replaced.file
	}
	r.Done("written "+file, "x handoff list")
	return ordered{{"name", file}, {"path", path}, {"replaced", replacedName}, {"slug", sanitize(n.Slug)}}, nil
}

// an explicit delete takes -shared files too: the suffix means the file survives a pull, not a delete
func handoffDelete(r *Run, args []string, flags Flags) (any, error) {
	all, slug := flags["all"] == true, firstArg(args)
	if all == (slug != "") {
		return nil, usageFail("delete takes a slug or --all", "x handoff delete --help")
	}
	var doomed []stored
	if err := r.Step("read", "reading the store", func() (string, error) {
		doomed = listStore(storeRoot())
		if all {
			return fmt.Sprintf("%d pending", len(doomed)), nil
		}
		picked, err := pickEntry(slug, doomed)
		if err != nil {
			return "", err
		}
		doomed = []stored{picked}
		return picked.Slug, nil
	}); err != nil {
		return nil, err
	}

	deleted := []ordered{}
	err := r.Step("delete", "moving to the trash", func() (string, error) {
		for _, e := range doomed {
			if err := discardIfThere(e.path); err != nil {
				return "", &Fail{Msg: err.Error(), Next: "x handoff list"}
			}
			deleted = append(deleted, ordered{{"name", e.file}, {"slug", e.Slug}})
		}
		return fmt.Sprintf("%d deleted", len(deleted)), nil
	})
	r.Done(fmt.Sprintf("%d deleted", len(deleted)), "x handoff list")
	return ordered{{"deleted", deleted}}, err
}

func flagString(flags Flags, key string) string {
	value, _ := flags[key].(string)
	return value
}

// a terminal on stdin carries no CST; reading it would wait for a ^D nobody knows to type
func readStdin() string {
	if term.IsTerminal(os.Stdin.Fd()) {
		return ""
	}
	body, _ := io.ReadAll(os.Stdin)
	return string(body)
}

func pendingSlugs() []string {
	var slugs []string
	for _, e := range listStore(storeRoot()) {
		slugs = append(slugs, e.Slug)
	}
	return slugs
}

func firstArg(args []string) string {
	if len(args) == 0 {
		return ""
	}
	return args[0]
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
			list = append(list, verb.Schema())
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
		r.Page(b)
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
