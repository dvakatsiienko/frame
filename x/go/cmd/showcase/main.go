// showcase — FRM-284's look probe for arm c: the widest spread of what go + charm draws, on one
// screen, with fake data. `showcase` runs the bubbletea app; `showcase --static` prints it once.
package main

import (
	"fmt"
	"image/color"
	"os"
	"strings"
	"time"

	"charm.land/bubbles/v2/progress"
	"charm.land/bubbles/v2/spinner"
	tea "charm.land/bubbletea/v2"
	"charm.land/glamour/v2"
	"charm.land/glamour/v2/styles"
	"charm.land/huh/v2"
	"charm.land/lipgloss/v2"
	"charm.land/lipgloss/v2/list"
	"charm.land/lipgloss/v2/table"
)

var (
	bg     = lipgloss.Color("#17181C")
	fg     = lipgloss.Color("#D7D9DF")
	dim    = lipgloss.Color("#7C808C")
	blue   = lipgloss.Color("#6FA0EA")
	amber  = lipgloss.Color("#E0A458")
	pink   = lipgloss.Color("#E8A6D6")
	teal   = lipgloss.Color("#3FB8A4")
	green  = lipgloss.Color("#9AD59A")
	panel  = lipgloss.Color("#22242A")
	text   = lipgloss.NewStyle().Foreground(fg)
	faint  = lipgloss.NewStyle().Foreground(dim)
	left   = 56
	right  = 56
	gutter = "  "
)

func main() {
	if len(os.Args) > 1 && os.Args[1] == "--static" {
		m := newModel()
		m.static = true
		lipgloss.Println(m.render())
		return
	}
	final, err := tea.NewProgram(newModel()).Run()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if picked := final.(model).picked; len(picked) > 0 {
		fmt.Println("picked:", strings.Join(picked, ", "))
	}
}

type model struct {
	static  bool
	bar     progress.Model
	spin    spinner.Model
	form    *huh.Form
	picked  []string
	percent float64
}

type tick struct{}

func newModel() model {
	m := model{
		bar:     progress.New(progress.WithColors(blue, pink), progress.WithScaled(true), progress.WithWidth(left-14)),
		spin:    spinner.New(spinner.WithSpinner(spinner.Dot), spinner.WithStyle(lipgloss.NewStyle().Foreground(pink))),
		percent: 0.62,
	}
	m.form = huh.NewForm(huh.NewGroup(
		huh.NewMultiSelect[string]().Title("which families ship in v1?").
			Options(huh.NewOptions("lane", "handoffs", "schema", "completion", "hazards")...).
			Value(&m.picked),
	)).WithWidth(right).WithShowHelp(true).WithTheme(huh.ThemeFunc(huh.ThemeCharm))
	m.form.Init()
	return m
}

func (m model) Init() tea.Cmd {
	return tea.Batch(m.spin.Tick, m.form.Init(), m.bar.SetPercent(0.1), tea.Tick(time.Second, func(time.Time) tea.Msg { return tick{} }))
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyPressMsg:
		if msg.String() == "ctrl+c" || msg.String() == "esc" {
			return m, tea.Quit
		}
	case tick:
		m.percent += 0.17
		if m.percent > 1 {
			m.percent = 0.08
		}
		return m, tea.Batch(m.bar.SetPercent(m.percent), tea.Tick(time.Second, func(time.Time) tea.Msg { return tick{} }))
	case progress.FrameMsg:
		var cmd tea.Cmd
		m.bar, cmd = m.bar.Update(msg)
		return m, cmd
	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spin, cmd = m.spin.Update(msg)
		return m, cmd
	}
	form, cmd := m.form.Update(msg)
	m.form = form.(*huh.Form)
	if m.form.State == huh.StateCompleted {
		return m, tea.Quit
	}
	return m, cmd
}

func (m model) View() tea.View {
	v := tea.NewView(m.render())
	v.AltScreen = true
	v.BackgroundColor = bg
	return v
}

func (m model) render() string {
	rows := []string{
		tabs(),
		"",
		lipgloss.JoinHorizontal(lipgloss.Top, dialog(), gutter, lists()),
		"",
		lipgloss.JoinHorizontal(lipgloss.Top, grid(), gutter, columns()),
		"",
		lipgloss.JoinHorizontal(lipgloss.Top, m.progressRow(), gutter, palette()),
		"",
		lipgloss.JoinHorizontal(lipgloss.Top, markdown(), gutter, m.form.View()),
		"",
		statusBar(),
	}
	return lipgloss.NewStyle().Padding(1, 2).Render(lipgloss.JoinVertical(lipgloss.Left, rows...))
}

/* hand-rolled with lipgloss: a tab row whose active tab opens into the page below */
func tabs() string {
	names := []string{"overview", "lane", "handoffs", "schema", "settings"}
	active := lipgloss.Border{Top: "─", Bottom: " ", Left: "│", Right: "│", TopLeft: "╭", TopRight: "╮", BottomLeft: "┘", BottomRight: "└"}
	idle := lipgloss.Border{Top: "─", Bottom: "─", Left: "│", Right: "│", TopLeft: "╭", TopRight: "╮", BottomLeft: "┴", BottomRight: "┴"}
	var cells []string
	for i, name := range names {
		style := lipgloss.NewStyle().Border(idle).BorderForeground(dim).Foreground(dim).Padding(0, 2)
		if i == 1 {
			style = style.Border(active).BorderForeground(blue).Foreground(blue).Bold(true)
		}
		cells = append(cells, style.Render(name))
	}
	row := lipgloss.JoinHorizontal(lipgloss.Bottom, cells...)
	rest := left + right + len(gutter) - lipgloss.Width(row)
	return lipgloss.JoinHorizontal(lipgloss.Bottom, row, faint.Render(strings.Repeat("─", max(rest, 0))))
}

/* hand-rolled with lipgloss: a bordered dialog with two buttons */
func dialog() string {
	button := lipgloss.NewStyle().Padding(0, 3).MarginRight(2)
	yes := button.Background(pink).Foreground(bg).Bold(true).Underline(true).Render("push")
	no := button.Background(panel).Foreground(fg).Render("cancel")
	q := lipgloss.NewStyle().Width(left - 8).Align(lipgloss.Center).Foreground(fg).
		Render("push 3 commits to origin/coder/demo?\n" + faint.Render("the pre-push gate runs from the main checkout"))
	body := lipgloss.JoinVertical(lipgloss.Center, q, "", lipgloss.JoinHorizontal(lipgloss.Top, yes, no))
	return lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(pink).Padding(1, 2).Width(left).Render(body)
}

/* native: lipgloss/list with a custom enumerator — check marks and strikethrough */
func lists() string {
	done := lipgloss.NewStyle().Strikethrough(true).Foreground(dim)
	block := func(title string, color color.Color, items []string, finished int) string {
		l := list.New().Enumerator(func(_ list.Items, i int) string {
			if i < finished {
				return "✓"
			}
			return "•"
		}).EnumeratorStyleFunc(func(_ list.Items, i int) lipgloss.Style {
			if i < finished {
				return lipgloss.NewStyle().Foreground(green).MarginRight(1)
			}
			return lipgloss.NewStyle().Foreground(color).MarginRight(1)
		}).ItemStyleFunc(func(_ list.Items, i int) lipgloss.Style {
			if i < finished {
				return done
			}
			return text
		})
		for _, item := range items {
			l.Item(item)
		}
		head := lipgloss.NewStyle().Foreground(bg).Background(color).Bold(true).Padding(0, 1).Render(title)
		return lipgloss.NewStyle().Width(right/2 - 1).Render(head + "\n\n" + l.String())
	}
	return lipgloss.JoinHorizontal(lipgloss.Top,
		block("lane", blue, []string{"commit", "push", "pr-open", "merge-main", "unlock"}, 3),
		" ",
		block("handoffs", amber, []string{"list", "peek", "ingest", "write", "rename"}, 2))
}

/* native: lipgloss/table with a StyleFunc highlighting one row */
func grid() string {
	rows := [][]string{
		{"lane commit", "lane", "11 ms", "ok"},
		{"lane push", "lane", "83 ms", "needs --apply"},
		{"handoffs list", "handoffs", "72 ms", "ok"},
		{"schema", "schema", "12 ms", "ok"},
	}
	t := table.New().Border(lipgloss.RoundedBorder()).BorderStyle(faint).
		Headers("verb", "family", "start", "state").Rows(rows...).Width(left).
		StyleFunc(func(row, col int) lipgloss.Style {
			s := lipgloss.NewStyle().Padding(0, 1).Foreground(fg)
			switch {
			case row == table.HeaderRow:
				return s.Foreground(pink).Bold(true)
			case row == 1:
				return s.Background(lipgloss.Color("#2B3A55")).Foreground(lipgloss.Color("#FFFFFF")).Bold(true)
			case col == 3 && rows[row][3] != "ok":
				return s.Foreground(amber)
			case col == 3:
				return s.Foreground(green)
			}
			return s
		})
	return t.String()
}

/* native: three lipgloss blocks joined side by side */
func columns() string {
	col := func(c color.Color, title, body string) string {
		return lipgloss.NewStyle().Width(right/3 - 1).Foreground(c).
			Render(lipgloss.NewStyle().Bold(true).Underline(true).Render(title) + "\n" + body)
	}
	return lipgloss.JoinHorizontal(lipgloss.Top,
		col(blue, "lane", "git through the worktree gate; nothing lands unseen"), " ",
		col(amber, "handoffs", "one store, two doors — cc and cw read the same CSTs"), " ",
		col(teal, "schema", "the registry as json, for agents that never guess"))
}

/* native: bubbles/progress (gradient, harmonica spring) + bubbles/spinner */
func (m model) progressRow() string {
	bar := m.bar.View()
	spin := m.spin.View()
	if m.static {
		bar = m.bar.ViewAs(m.percent)
	}
	label := lipgloss.NewStyle().Foreground(pink).Bold(true).Render("shooting")
	return lipgloss.NewStyle().Width(left).Render(
		spin + " " + label + faint.Render("  20 calls, 3 arms") + "\n\n" + bar + "\n\n" +
			faint.Render("vhs → freeze → vtreplay, one theme for every arm"))
}

/* native blend (lipgloss.Blend2D), hand-rolled grid: a truecolor palette */
func palette() string {
	const w, h = 28, 4
	colors := lipgloss.Blend2D(w, h, 45, blue, pink, amber, teal)
	var b strings.Builder
	for y := range h {
		for x := range w {
			b.WriteString(lipgloss.NewStyle().Background(colors[y*w+x]).Render("  "))
		}
		if y < h-1 {
			b.WriteString("\n")
		}
	}
	return lipgloss.NewStyle().Width(right).Render(faint.Render("truecolor, Blend2D at 45°") + "\n" + b.String())
}

/* native: glamour */
func markdown() string {
	md := "## handoff: cli arms\n\n- **first act** — read `calls.json`\n- run the world into a scratch dir\n\n```go\nfmt.Println(\"one store, two doors\")\n```\n"
	style := styles.DarkStyleConfig
	zero := uint(0)
	style.Document.Margin = &zero
	r, _ := glamour.NewTermRenderer(glamour.WithStyles(style), glamour.WithWordWrap(left-4))
	out, _ := r.Render(md)
	return lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(dim).Width(left).
		Render(strings.Trim(out, "\n"))
}

/* hand-rolled with lipgloss: a status bar */
func statusBar() string {
	seg := func(c color.Color, s string) string {
		return lipgloss.NewStyle().Background(c).Foreground(bg).Bold(true).Padding(0, 1).Render(s)
	}
	head := seg(pink, "x") + seg(blue, "FRM-284") + lipgloss.NewStyle().Background(panel).Foreground(fg).Padding(0, 1).Render("arm c · go + charm")
	tail := lipgloss.NewStyle().Background(panel).Foreground(dim).Padding(0, 1).Render("10.9 ms") + seg(teal, "go 1.27") + seg(amber, "☕ ready")
	fill := left + right + len(gutter) - lipgloss.Width(head) - lipgloss.Width(tail)
	return head + lipgloss.NewStyle().Background(panel).Render(strings.Repeat(" ", max(fill, 0))) + tail
}
