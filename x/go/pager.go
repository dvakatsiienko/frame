package main

import (
	"fmt"
	"os"

	"charm.land/bubbles/v2/viewport"
	tea "charm.land/bubbletea/v2"
	"github.com/charmbracelet/x/term"
)

// a board taller than the terminal opens in a pager on a terminal: the frame's rules stay put, the
// rows scroll in a viewport, and q leaves. a pipe or a short board prints as before
func (r *Run) Page(b frame) {
	r.output = b.String()
	if r.interactive && len(b.rows)+4 > termRows() {
		r.long = &b
	}
}

func termRows() int {
	if _, rows, err := term.GetSize(os.Stdout.Fd()); err == nil && rows > 0 {
		return rows
	}
	return 50
}

type pager struct {
	board frame
	view  viewport.Model
}

func page(b frame) error {
	view := viewport.New(viewport.WithWidth(b.width), viewport.WithHeight(termRows()-2))
	view.SetContentLines(boardRows(b))
	_, err := tea.NewProgram(pager{b, view}).Run()
	return err
}

// the rows inside the side rules; a row wider than a narrowed window is clipped, never wrapped
func boardRows(b frame) []string {
	rows := []string{b.row("")}
	for _, row := range b.rows {
		rows = append(rows, b.row(clip(row, b.inner())))
	}
	return append(rows, b.row(""))
}

func (p pager) Init() tea.Cmd { return nil }

func (p pager) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyPressMsg:
		switch msg.String() {
		case "q", "esc", "ctrl+c":
			return p, tea.Quit
		}
	case tea.WindowSizeMsg:
		p.view.SetHeight(msg.Height - 2)
		p.board.width = min(msg.Width, 112)
		p.view.SetWidth(p.board.width)
		p.view.SetContentLines(boardRows(p.board))
	}
	var cmd tea.Cmd
	p.view, cmd = p.view.Update(msg)
	return p, cmd
}

func (p pager) View() tea.View {
	b := p.board
	// the keys outrank the footer it had: a pager nobody can leave is the one failure here
	b.footLeft = ui.dim.Render(fmt.Sprintf("%3.0f%%", p.view.ScrollPercent()*100)) + "  " + ui.fg.Render("space b j k") + ui.dim.Render(" scroll  ") + ui.fg.Render("q") + ui.dim.Render(" quits")
	b.footRight = ""
	view := tea.NewView(b.top() + "\n" + p.view.View() + "\n" + b.bottom())
	view.AltScreen = true
	return view
}
