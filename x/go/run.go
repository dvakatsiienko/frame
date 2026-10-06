package main

import (
	"fmt"
	"os"
	"strings"
	"time"

	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"
)

// Fail carries the command that moves the caller forward; Log is tool output shown under the step
type Fail struct {
	Msg     string
	Next    string
	IsUsage bool
	Log     []string
}

func (f *Fail) Error() string { return f.Msg }

func usageFail(msg, next string) *Fail { return &Fail{Msg: msg, Next: next, IsUsage: true} }

// Run is one verb's session: in the human view it draws the run board step by step,
// in agent mode every call here is silent and only the returned data matters
type Run struct {
	verb        Verb
	human       bool
	interactive bool
	board       frame
	opened      bool
	steps       []string
	ran         int
	started     time.Time
	result      string
	next        string
	output      string
}

// Open starts the run board; its steps are the registry entry's, the same names every arm draws
func (r *Run) Open(right string) {
	r.steps = r.verb.Steps
	r.started = time.Now()
	if !r.human || r.opened {
		return
	}
	r.opened = true
	r.board = frame{width: frameWidth(), titleLeft: titleOf(r.verb.Name), titleRight: ui.dim.Render(right)}
	fmt.Println(r.board.top())
}

const nameCell = 12

// Step runs one unit of work; the human view shows it as a still ● until it ends, then ✓ or ✗
func (r *Run) Step(name, doing string, work func() (string, error)) error {
	if !r.human {
		_, err := work()
		r.ran++
		return err
	}
	if !r.opened {
		r.Open("")
	}
	color := ui.familyColor(r.verb.Family())
	running := r.stepLine(lipgloss.NewStyle().Foreground(color).Render("●"),
		lipgloss.NewStyle().Foreground(color).Bold(true).Render(name), ui.fg.Render(doing), "")

	model := stepModel{view: running, work: work}
	model.finish = func(detail string, err error, took time.Duration) string {
		if err == nil {
			return r.stepLine(ui.ok.Render("✓"), ui.fg.Render(name), ui.dim.Render(detail), elapsed(took))
		}
		lines := []string{r.stepLine(ui.er.Render("✗"), ui.er.Bold(true).Render(name), ui.fg.Render(err.Error()), elapsed(took))}
		if fail, ok := err.(*Fail); ok && len(fail.Log) > 0 {
			lines = append(lines, r.board.row(""))
			for _, log := range fail.Log {
				lines = append(lines, r.board.row(strings.Repeat(" ", nameCell+2)+ui.fg.Render(clip(log, r.board.inner()-nameCell-2))))
			}
			lines = append(lines, r.board.row(""))
		}
		return strings.Join(lines, "\n")
	}

	program := tea.NewProgram(model, tea.WithInput(nil), tea.WithOutput(os.Stdout))
	final, runErr := program.Run()
	r.ran++
	if runErr != nil {
		return runErr
	}
	// bubbletea v2's inline renderer erases its last frame on close, so the program ends on an
	// empty view and the still line is printed after it, once
	done := final.(stepModel)
	fmt.Println(done.line)
	return done.err
}

func (r *Run) stepLine(mark, name, detail, took string) string {
	left := mark + " " + name + strings.Repeat(" ", max(nameCell-lipgloss.Width(name), 1)) + detail
	room := r.board.inner() - lipgloss.Width(left) - lipgloss.Width(took)
	if room < 1 {
		left = clip(left, r.board.inner()-lipgloss.Width(took)-1)
		room = 1
	}
	return r.board.row(left + strings.Repeat(" ", room) + ui.dim.Render(took))
}

// an instant step shows no time
func elapsed(took time.Duration) string {
	if took < 50*time.Millisecond {
		return ""
	}
	return fmt.Sprintf("%.1fs", took.Seconds())
}

func clip(text string, width int) string {
	if lipgloss.Width(text) <= width {
		return text
	}
	return lipgloss.NewStyle().MaxWidth(width-1).Render(text) + "…"
}

func (r *Run) Done(result, next string) { r.result, r.next = result, next }

// Board sets a whole human view for a verb that draws no steps
func (r *Run) Board(text string) { r.output = text }

// close draws what is left of the run board: unrun steps, the result row, the footer
func (r *Run) close(word string, wordStyle lipgloss.Style, text, right, footer string) {
	for _, name := range r.steps[min(r.ran, len(r.steps)):] {
		fmt.Println(r.stepLine(ui.dim.Render("○"), ui.dim.Render(name), ui.dim.Render("not run"), ""))
	}
	b := r.board
	b.footLeft = footer
	fmt.Println(strings.Join([]string{
		b.row(""), b.separator(), b.row(""),
		b.row(resultRow(b.inner(), wordStyle.Bold(true).Render(word), text, right)),
		b.bottom(),
	}, "\n"))
}

func resultRow(width int, word, text, right string) string {
	left := word + strings.Repeat(" ", max(16-lipgloss.Width(word), 1)) + ui.fg.Render(text)
	return left + strings.Repeat(" ", max(width-lipgloss.Width(left)-lipgloss.Width(right), 1)) + ui.bold.Render(right)
}

type stepDone struct {
	detail string
	err    error
	took   time.Duration
}

type stepModel struct {
	view   string
	line   string
	work   func() (string, error)
	finish func(string, error, time.Duration) string
	err    error
}

func (m stepModel) Init() tea.Cmd {
	return func() tea.Msg {
		start := time.Now()
		detail, err := m.work()
		return stepDone{detail, err, time.Since(start)}
	}
}

func (m stepModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	if done, ok := msg.(stepDone); ok {
		m.line, m.err = m.finish(done.detail, done.err, done.took), done.err
		m.view = ""
		return m, tea.Quit
	}
	return m, nil
}

func (m stepModel) View() tea.View { return tea.NewView(m.view) }
