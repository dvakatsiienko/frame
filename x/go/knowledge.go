package main

import (
	"cmp"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

// the shelf is docs/knowledge of the frame tree this binary was built from; a read is logged, so a
// file nobody opens shows up when the shelf is groomed
func knowledgeRoot() string {
	return cmp.Or(os.Getenv("X_KNOWLEDGE_ROOT"), filepath.Join(sourceDir(), "../../docs/knowledge"))
}

func stateDir() string {
	if dir := os.Getenv("X_STATE"); dir != "" {
		return dir
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".local/state/x")
}

type shelfFile struct {
	Name        string  `json:"name"`
	Purpose     string  `json:"purpose"`
	Verified    *string `json:"verified"`
	RefreshWhen *string `json:"refreshWhen"`
	Bytes       int     `json:"bytes"`
	path        string
	body        string
}

var (
	isoDate = regexp.MustCompile(`\d{4}-\d{2}-\d{2}`)
	h1      = regexp.MustCompile(`(?m)^# (.+)$`)
)

// the stamp is the date a file was last checked against the world: `verified-against` says so outright,
// `researched` is the next best; a file with neither is unstamped, and the board says that
func readShelfFile(path string) (shelfFile, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return shelfFile{}, err
	}
	body := string(raw)
	front := map[string]string{}
	if rest, ok := strings.CutPrefix(body, "---\n"); ok {
		if head, _, ok := strings.Cut(rest, "\n---"); ok {
			for _, line := range strings.Split(head, "\n") {
				if key, value, ok := strings.Cut(line, ":"); ok {
					front[strings.TrimSpace(key)] = strings.TrimSpace(value)
				}
			}
		}
	}
	f := shelfFile{Name: strings.TrimSuffix(filepath.Base(path), ".md"), Bytes: len(raw), path: path, body: body}
	// the H1 is the line a reader picks a file by
	if match := h1.FindStringSubmatch(body); match != nil {
		f.Purpose = strings.ReplaceAll(strings.TrimSpace(match[1]), "`", "")
	}
	for _, key := range []string{"verified-against", "verified", "researched"} {
		if date := isoDate.FindString(front[key]); date != "" {
			f.Verified = &date
			break
		}
	}
	if when, ok := front["refresh-when"]; ok {
		f.RefreshWhen = &when
	}
	return f, nil
}

func shelf() ([]shelfFile, error) {
	paths, err := filepath.Glob(filepath.Join(knowledgeRoot(), "*.md"))
	if err != nil || len(paths) == 0 {
		return nil, &Fail{Msg: "no knowledge shelf at " + knowledgeRoot(), Next: "x knowledge list --help"}
	}
	files := make([]shelfFile, 0, len(paths))
	for _, path := range paths {
		f, err := readShelfFile(path)
		if err != nil {
			return nil, err
		}
		files = append(files, f)
	}
	return files, nil
}

func knowledgeList(r *Run, _ []string, _ Flags) (any, error) {
	files, err := shelf()
	if err != nil {
		return nil, err
	}
	if r.human {
		r.Board(shelfBoard(files))
	}
	return ordered{{"files", files}, {"root", knowledgeRoot()}}, nil
}

func shelfBoard(files []shelfFile) string {
	unstamped := 0
	for _, f := range files {
		if f.Verified == nil {
			unstamped++
		}
	}
	right := fmt.Sprintf("%d files", len(files))
	if unstamped > 0 {
		right += fmt.Sprintf(", %d unstamped", unstamped)
	}
	b := frame{width: frameWidth(), titleLeft: titleOf("knowledge list"), titleRight: ui.dim.Render(right),
		footLeft: ui.dim.Render("x knowledge read <name>"), footRight: ui.dim.Render(home(knowledgeRoot())), padRows: true}
	widths := []int{26, 12, b.inner() - 38}
	if isNarrow() {
		widths = []int{26, b.inner() - 26}
	}
	head := []string{ui.label.Render("name"), ui.label.Render("verified"), ui.label.Render("what it holds")}
	if isNarrow() {
		head = []string{head[0], head[2]}
	}
	b.rows = append(columns(widths, head...), "")
	for _, f := range files {
		stamp := ui.er.Render("unstamped")
		if f.Verified != nil {
			stamp = ui.fg.Render(*f.Verified)
		}
		cells := []string{ui.verb("knowledge", f.Name), stamp, ui.fg.Render(f.Purpose)}
		if isNarrow() {
			cells = []string{cells[0], ui.fg.Render(f.Purpose) + "  " + stamp}
		}
		b.rows = append(b.rows, columns(widths, cells...)...)
	}
	return b.String()
}

func knowledgeRead(r *Run, args []string, _ Flags) (any, error) {
	files, err := shelf()
	if err != nil {
		return nil, err
	}
	var matches []shelfFile
	for _, f := range files {
		if f.Name == args[0] {
			matches = []shelfFile{f}
			break
		}
		if strings.Contains(f.Name, strings.ToLower(args[0])) {
			matches = append(matches, f)
		}
	}
	if len(matches) != 1 {
		reason, listed := "no shelf file matches "+args[0]+" — the shelf holds ", files
		if len(matches) > 1 {
			reason, listed = "several shelf files match "+args[0]+": ", matches
		}
		names := make([]string, len(listed))
		for i, f := range listed {
			names[i] = f.Name
		}
		return nil, usageFail(reason+strings.Join(names, ", "), "x knowledge list")
	}
	f := matches[0]
	logRead(f.Name)
	if r.human {
		stamp := "unstamped"
		if f.Verified != nil {
			stamp = "verified " + *f.Verified
		}
		b := frame{width: frameWidth(), titleLeft: titleOf("knowledge read"), titleRight: ui.dim.Render(f.Name + ", " + stamp),
			footLeft: ui.dim.Render(home(f.path)), padRows: true}
		if f.RefreshWhen != nil {
			b.footRight = ui.dim.Render("refresh when: " + clip(*f.RefreshWhen, 40))
		}
		b.rows = markdown(stripFront(f.body), b.inner())
		r.Page(b)
	}
	return ordered{{"body", f.body}, {"name", f.Name}, {"path", f.path}, {"verified", f.Verified}}, nil
}

func stripFront(body string) string {
	if rest, ok := strings.CutPrefix(body, "---\n"); ok {
		if _, after, ok := strings.Cut(rest, "\n---\n"); ok {
			return after
		}
	}
	return body
}

// one json line per read; a lost line costs a count, never the read itself
func logRead(name string) {
	dir := stateDir()
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return
	}
	log, err := os.OpenFile(filepath.Join(dir, "knowledge-reads.jsonl"), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
	if err != nil {
		return
	}
	defer log.Close()
	cwd, _ := os.Getwd()
	line, _ := json.Marshal(ordered{{"at", time.Now().UTC().Format(time.RFC3339)}, {"cwd", cwd}, {"name", name}})
	_, _ = log.Write(append(line, '\n'))
}

func shelfNames() []string {
	files, _ := shelf()
	names := make([]string, len(files))
	for i, f := range files {
		names[i] = f.Name
	}
	return names
}
