package main

import (
	"fmt"
	"image/color"
	"os"
	"slices"
	"strings"

	"charm.land/lipgloss/v2"
	"github.com/charmbracelet/x/term"
)

// the T2 dense-family tokens (studio jobs/cli, spread v6): dark and light truecolor
type palette struct {
	bg, fg, dim, line, ok, er color.Color
	family                    []color.Color
}

var dark = palette{
	bg: lipgloss.Color("#17181C"), fg: lipgloss.Color("#D7D9DF"), dim: lipgloss.Color("#9A9DA8"),
	line: lipgloss.Color("#7C808C"), ok: lipgloss.Color("#9AD59A"), er: lipgloss.Color("#E8696B"),
	family: []color.Color{lipgloss.Color("#6FA0EA"), lipgloss.Color("#E0A458"), lipgloss.Color("#E8A6D6"), lipgloss.Color("#3FB8A4")},
}

var light = palette{
	bg: lipgloss.Color("#FBFBFC"), fg: lipgloss.Color("#24262B"), dim: lipgloss.Color("#5E626C"),
	line: lipgloss.Color("#7A7E88"), ok: lipgloss.Color("#2A7A3B"), er: lipgloss.Color("#9E1F1F"),
	family: []color.Color{lipgloss.Color("#1F4A94"), lipgloss.Color("#8A5300"), lipgloss.Color("#7A4FBF"), lipgloss.Color("#006B5B")},
}

type theme struct {
	p                                  palette
	fg, dim, line, ok, er, bold, label lipgloss.Style
}

// set by execute for the human view only: asking the terminal for its background is a round trip
// an agent call never needs
var ui theme

func newTheme() theme {
	p := dark
	if !hasDarkBackground() {
		p = light
	}
	base := lipgloss.NewStyle()
	return theme{
		p:     p,
		fg:    base.Foreground(p.fg),
		dim:   base.Foreground(p.dim),
		line:  base.Foreground(p.line),
		ok:    base.Foreground(p.ok),
		er:    base.Foreground(p.er),
		bold:  base.Foreground(p.fg).Bold(true),
		label: base.Foreground(p.dim),
	}
}

// asking the terminal costs a round trip and needs a tty on both ends; a pipe never draws colour
func hasDarkBackground() bool {
	if os.Getenv("X_THEME") == "light" {
		return false
	}
	if os.Getenv("X_THEME") == "dark" || !term.IsTerminal(os.Stdin.Fd()) || !term.IsTerminal(os.Stdout.Fd()) {
		return true
	}
	return lipgloss.HasDarkBackground(os.Stdin, os.Stdout)
}

// colour holds for four families; a fifth takes the neutral chip
func (t theme) familyColor(name string) color.Color {
	for i, family := range families() {
		if family == name && i < len(t.p.family) {
			return t.p.family[i]
		}
	}
	return t.p.fg
}

func (t theme) chip(family string) string {
	return lipgloss.NewStyle().Background(t.familyColor(family)).Foreground(t.p.bg).Bold(true).
		Padding(0, 1).Render(family)
}

func (t theme) verb(family, text string) string {
	return lipgloss.NewStyle().Foreground(t.familyColor(family)).Bold(true).Render(text)
}

func hex(c color.Color) string {
	r, g, b, _ := c.RGBA()
	return fmt.Sprintf("#%02X%02X%02X", r>>8, g>>8, b>>8)
}

func termCols() int {
	if cols, _, err := term.GetSize(os.Stdout.Fd()); err == nil && cols > 0 {
		return cols
	}
	return 120
}

// the frame never grows past 112 cells, the width the comp was drawn at
func frameWidth() int { return min(termCols(), 112) }

// a framed board: a titled top rule, body rows inside side rules, a titled bottom rule
type frame struct {
	width                 int
	titleLeft, titleRight string
	footLeft, footRight   string
	rows                  []string
	splitAt               []int
	padRows               bool
	divider               int
}

const inset = 2

func (f frame) inner() int { return f.width - 2 - 2*inset }

func (f frame) rule(left, right string, corners [2]string) string {
	l := ui.line
	leftPart := l.Render(corners[0] + "─")
	if left != "" {
		leftPart += " " + left + " "
	}
	rightPart := l.Render("─" + corners[1])
	if right != "" {
		rightPart = " " + right + " " + rightPart
	}
	fill := f.width - lipgloss.Width(leftPart) - lipgloss.Width(rightPart)
	// a split board's divider meets the rule: ┬ on top, ┴ at the bottom
	at := 1 + inset + f.divider - lipgloss.Width(leftPart)
	if f.divider > 0 && at > 0 && at < fill {
		joint := "┬"
		if corners[0] == "╰" {
			joint = "┴"
		}
		return leftPart + l.Render(strings.Repeat("─", at)+joint+strings.Repeat("─", fill-at-1)) + rightPart
	}
	return leftPart + l.Render(strings.Repeat("─", max(fill, 1))) + rightPart
}

func (f frame) row(content string) string {
	pad := f.inner() - lipgloss.Width(content)
	side := ui.line.Render("│")
	return side + strings.Repeat(" ", inset) + content + strings.Repeat(" ", max(pad, 0)) + strings.Repeat(" ", inset) + side
}

func (f frame) separator() string {
	return ui.line.Render("├" + strings.Repeat("─", f.width-2) + "┤")
}

func (f frame) top() string    { return f.rule(f.titleLeft, f.titleRight, [2]string{"╭", "╮"}) }
func (f frame) bottom() string { return f.rule(f.footLeft, f.footRight, [2]string{"╰", "╯"}) }

func (f frame) String() string {
	lines := []string{f.top()}
	pad := f.row("")
	if f.divider > 0 {
		pad = f.row(strings.Repeat(" ", f.divider) + ui.line.Render("│"))
	}
	if f.padRows {
		lines = append(lines, pad)
	}
	for i, row := range f.rows {
		if slices.Contains(f.splitAt, i) {
			lines = append(lines, f.separator())
		}
		lines = append(lines, f.row(row))
	}
	if f.padRows {
		lines = append(lines, pad)
	}
	return strings.Join(append(lines, f.bottom()), "\n")
}

// cells left-aligned to fixed widths, a one-cell gutter between; a long cell wraps under itself
func columns(widths []int, cells ...string) []string {
	wrapped := make([][]string, len(cells))
	height := 1
	for i, cell := range cells {
		room := widths[i] - 1
		if i == len(cells)-1 {
			room = widths[i]
		}
		wrapped[i] = strings.Split(lipgloss.Wrap(cell, max(room, 1), " "), "\n")
		height = max(height, len(wrapped[i]))
	}
	out := make([]string, height)
	for row := range height {
		line := ""
		for i := range cells {
			text := ""
			if row < len(wrapped[i]) {
				text = strings.TrimRight(wrapped[i][row], " ")
			}
			if i < len(cells)-1 {
				text += strings.Repeat(" ", max(widths[i]-lipgloss.Width(text), 0))
			}
			line += text
		}
		out[row] = strings.TrimRight(line, " ")
	}
	return out
}

// the human view shows a purpose up to its first `;` — the clause a reader picks a verb by
func gist(purpose string) string {
	head, _, _ := strings.Cut(purpose, ";")
	return strings.TrimSpace(head)
}

func titleOf(name string) string {
	parts := strings.Fields(name)
	title := ui.bold.Render("x") + " " + ui.chip(parts[0])
	if len(parts) > 1 {
		title += " " + ui.bold.Render(strings.Join(parts[1:], " "))
	}
	return title
}

// a command takes its family's colour, so the footer points where the next step lives
func cmd(text string) string {
	if fields := strings.Fields(text); len(fields) > 1 && fields[0] == "x" {
		return ui.verb(fields[1], text)
	}
	return ui.bold.Render(text)
}
