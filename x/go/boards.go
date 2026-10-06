package main

import (
	"fmt"
	"strings"

	"charm.land/glamour/v2"
	"charm.land/glamour/v2/ansi"
	"charm.land/glamour/v2/styles"
	"charm.land/lipgloss/v2"
)

// the registry names verbs, never families; a family's one-line gist lives here until it does
var familyGists = map[string]string{
	"lane":       "git through the worktree gate",
	"handoffs":   "the shared CST store, one door for cc and cw",
	"schema":     "the registry as json",
	"completion": "shell completion from the registry",
}

func familyGist(family string) string { return familyGists[family] }

// under 100 cols the takes column folds away and help becomes one column
func isNarrow() bool { return termCols() < 100 }

func takes(verb Verb) string {
	var parts []string
	if verb.NeedsApply {
		parts = append(parts, "--apply")
	}
	for _, own := range verb.OwnFlags() {
		spec := verb.Flags[own]
		if spec.Type == "string" {
			parts = append(parts, fmt.Sprintf("--%s <%s>", own, spec.Value))
		} else {
			parts = append(parts, "--"+own)
		}
	}
	for _, arg := range verb.Args {
		name := "<" + arg.Name + ">"
		if arg.IsVariadic {
			name = "<" + arg.Name + "…>"
		}
		if arg.IsOptional {
			name = "[" + name + "]"
		}
		parts = append(parts, name)
	}
	return strings.Join(parts, "  ")
}

func overviewBoard() string {
	b := frame{width: frameWidth(), titleLeft: ui.bold.Render("x"),
		titleRight: ui.dim.Render(fmt.Sprintf("%d verbs, %d families", len(verbs), len(families()))),
		footLeft:   ui.dim.Render("x <family> --help"), footRight: ui.dim.Render("json when piped, or with --json"), padRows: true}
	narrow := isNarrow()
	widths := []int{13, 13, b.inner() - 26}
	if !narrow {
		widths = []int{13, 13, b.inner() - 26 - 30, 30}
	}
	head := []string{ui.label.Render("family"), ui.label.Render("verb"), ui.label.Render("what it does")}
	if !narrow {
		head = append(head, ui.label.Render("takes"))
	}
	b.rows = append(b.rows, columns(widths, head...)...)
	for _, family := range families() {
		b.rows = append(b.rows, "")
		for i, verb := range verbsUnder(family) {
			chip := ""
			if i == 0 {
				chip = ui.chip(family)
			}
			cells := []string{chip, ui.verb(family, verb.Short()), ui.fg.Render(gist(verb.Purpose))}
			if !narrow {
				cells = append(cells, ui.dim.Render(takes(verb)))
			}
			b.rows = append(b.rows, columns(widths, cells...)...)
		}
	}
	return b.String()
}

func familyBoard(family string, members []Verb) string {
	b := frame{width: frameWidth(), titleLeft: ui.bold.Render("x") + " " + ui.chip(family) + "  " + ui.dim.Render(familyGist(family)),
		footLeft: ui.dim.Render("x " + family + " <verb> --help"), padRows: true}
	label := func(text string) string { return ui.label.Render(text) }
	left := []string{}
	pane := b.inner()
	if !isNarrow() {
		pane = b.inner() - splitRight - 3
	}
	add := func(section string, rows [][2]string) {
		for i, row := range rows {
			name := ""
			if i == 0 {
				name = label(section)
			}
			if row[1] == "" {
				left = append(left, columns([]int{10, pane - 10}, name, row[0])...)
				continue
			}
			left = append(left, columns([]int{10, 18, pane - 28}, name, row[0], row[1])...)
		}
		left = append(left, "")
	}

	add("usage", [][2]string{{"x " + family + " " + ui.verb(family, "<verb>") + " [flags]", ""}})
	var verbRows, flagRows [][2]string
	seen := map[string]bool{}
	for _, verb := range members {
		verbRows = append(verbRows, [2]string{ui.verb(family, or(verb.Short(), verb.Name)), ui.fg.Render(gist(verb.Purpose))})
		for _, name := range append(verb.OwnFlags(), globalFlagNames...) {
			if seen[name] || name == "help" || (name == "apply" && !verb.NeedsApply) {
				continue
			}
			seen[name] = true
			flagRows = append(flagRows, [2]string{ui.verb(family, "--"+name), ui.fg.Render(gist(verb.Flags[name].Description))})
		}
	}
	add("verbs", verbRows)
	add("flags", flagRows)
	exitRows := exitLines()
	if isNarrow() {
		add("exits", exitRows)
	}
	example := examples[family]
	add("example", [][2]string{{example, ""}})
	left = left[:len(left)-1]

	if isNarrow() {
		b.rows = left
		return b.String()
	}
	right := []string{label("exit codes"), ""}
	for _, row := range exitRows {
		right = append(right, row[0]+"   "+row[1])
	}
	return splitBoard(b, left, right)
}

var examples = map[string]string{
	"lane":       "x lane commit msg.txt -- notes.txt",
	"handoffs":   "x handoffs peek cli-arms",
	"schema":     "x schema lane --level short",
	"completion": "source <(x completion zsh)",
}

func exitLines() [][2]string {
	return [][2]string{
		{ui.bold.Render("0"), ui.fg.Render("done")},
		{ui.bold.Render("1"), ui.fg.Render("a step failed")},
		{ui.bold.Render("2"), ui.fg.Render("bad usage")},
		{ui.bold.Render("4"), ui.fg.Render("stopped, needs --apply")},
	}
}

// the wide help: the left pane carries usage and flags, the right pane the exit codes
const splitRight = 30

func splitBoard(b frame, left, right []string) string {
	leftWidth := b.inner() - splitRight - 3
	b.divider = leftWidth + 1
	b.rows = nil
	for i := range max(len(left), len(right)) {
		l, r := "", ""
		if i < len(left) {
			l = clip(left[i], leftWidth)
		}
		if i < len(right) {
			r = right[i]
		}
		b.rows = append(b.rows, l+strings.Repeat(" ", max(leftWidth-lipgloss.Width(l), 0))+" "+ui.line.Render("│")+"  "+r)
	}
	return b.String()
}

func verbBoard(verb Verb) string {
	family := verb.Family()
	b := frame{width: frameWidth(), titleLeft: titleOf(verb.Name), footLeft: ui.dim.Render("x schema " + verb.Name + " for json"), padRows: true}
	var rows []string
	add := func(section string, pairs [][2]string) {
		for i, pair := range pairs {
			name := ""
			if i == 0 {
				name = ui.label.Render(section)
			}
			rows = append(rows, columns([]int{10, 18, b.inner() - 28}, name, pair[0], pair[1])...)
		}
		rows = append(rows, "")
	}
	add("usage", [][2]string{{verb.Usage, ""}})
	rows = append(rows[:len(rows)-1], columns([]int{10, b.inner() - 10}, "", ui.fg.Render(verb.Purpose))...)
	rows = append(rows, "")
	var args [][2]string
	for _, arg := range verb.Args {
		args = append(args, [2]string{ui.verb(family, "<"+arg.Name+">"), ui.fg.Render(arg.Description)})
	}
	if len(args) > 0 {
		add("args", args)
	}
	var flags [][2]string
	for _, name := range append(verb.OwnFlags(), globalFlagNames...) {
		spec := verb.Flags[name]
		label := "--" + name
		if spec.Type == "string" {
			label += " <" + spec.Value + ">"
		}
		flags = append(flags, [2]string{ui.verb(family, label), ui.fg.Render(spec.Description)})
	}
	add("flags", flags)
	add("exits", exitLines())
	b.rows = rows[:len(rows)-1]
	return b.String()
}

// a json or markdown body rendered by glamour at the frame's inner width, margins off
func markdown(text string, width int) []string {
	style := styles.DarkStyleConfig
	if ui.p.bg == light.bg {
		style = styles.LightStyleConfig
	}
	zero := uint(0)
	style.Document.Margin = &zero
	style.CodeBlock.Margin = &zero
	// the stock style paints a purple h1 bar and red code on a grey band; T2 keeps its own tokens
	fg, accent, code := hex(ui.p.fg), hex(ui.familyColor("handoffs")), hex(ui.familyColor("lane"))
	style.Document.Color = &fg
	style.Heading.Color = &accent
	for _, heading := range []*ansi.StyleBlock{&style.H1, &style.H2, &style.H3} {
		heading.Prefix, heading.Suffix, heading.BackgroundColor = "", "", nil
		heading.Color = &accent
	}
	style.H1.Color = &fg
	style.Code.BackgroundColor, style.Code.Color = nil, &code
	style.Code.Prefix, style.Code.Suffix = "", ""
	renderer, err := glamour.NewTermRenderer(glamour.WithStyles(style), glamour.WithWordWrap(width))
	if err != nil {
		return strings.Split(text, "\n")
	}
	out, err := renderer.Render(text)
	if err != nil {
		return strings.Split(text, "\n")
	}
	lines := strings.Split(strings.Trim(out, "\n"), "\n")
	for i, line := range lines {
		lines[i] = strings.TrimRight(line, " ")
	}
	return lines
}
