package main

import (
	"errors"
	"fmt"
	"os"
	"strings"

	tea "charm.land/bubbletea/v2"
	"charm.land/huh/v2"
	"charm.land/lipgloss/v2"
)

// a huh theme in the T2 tokens: the family colour on the focused field, the still ● as the cursor
func formTheme(family string) huh.Theme {
	return huh.ThemeFunc(func(isDark bool) *huh.Styles {
		t := huh.ThemeBase(isDark)
		accent := ui.familyColor(family)
		button := lipgloss.NewStyle().Padding(0, 2).MarginRight(1)

		t.Form.Base = lipgloss.NewStyle().MarginLeft(inset)
		t.Focused.Base = t.Focused.Base.BorderForeground(accent)
		t.Focused.Title = lipgloss.NewStyle().Foreground(accent).Bold(true)
		t.Focused.Description = ui.dim
		t.Focused.SelectSelector = lipgloss.NewStyle().Foreground(accent).SetString("● ")
		t.Focused.Option = ui.fg
		t.Focused.SelectedOption = ui.bold
		t.Focused.FocusedButton = button.Foreground(ui.p.bg).Background(accent).Bold(true)
		t.Focused.BlurredButton = button.Foreground(ui.p.dim)
		t.Focused.TextInput.Prompt = lipgloss.NewStyle().Foreground(accent)
		t.Focused.TextInput.Cursor = lipgloss.NewStyle().Foreground(accent)
		t.Focused.TextInput.Placeholder = ui.dim
		t.Focused.ErrorMessage = ui.er.SetString(" *")
		t.Focused.ErrorIndicator = ui.er.SetString(" *")

		t.Blurred = t.Focused
		t.Blurred.Base = t.Blurred.Base.BorderStyle(lipgloss.HiddenBorder())
		t.Blurred.Title = ui.dim
		t.Blurred.SelectSelector = lipgloss.NewStyle().SetString("  ")
		return t
	})
}

func formFor(family string, groups ...*huh.Group) *huh.Form {
	return huh.NewForm(groups...).WithTheme(formTheme(family)).WithWidth(frameWidth() - 2*inset).WithShowHelp(false)
}

// bubbletea v2's inline renderer erases only the last line when a view shrinks to nothing on
// quit, so a finished form would leave its upper lines inside the board; they are wiped here
// only a form of fixed height (a confirm, a picker) runs inline: one whose height moves while it
// runs (inputs, validation errors) leaves rows the renderer lost track of, so it takes the alt screen
func runForm(form *huh.Form) error {
	form.Init()
	height := lipgloss.Height(form.View())
	err := form.Run()
	if height > 1 {
		fmt.Printf("\x1b[%dA\x1b[J", height-1)
	}
	return err
}

func runFullScreen(form *huh.Form) error {
	return form.WithViewHook(func(view tea.View) tea.View {
		view.AltScreen = true
		return view
	}).Run()
}

// on a terminal a missing required arg becomes a form field, never a usage error
func askArgs(verb Verb, args []string) ([]string, error) {
	var missing []ArgSpec
	for i, arg := range verb.Args {
		if i >= len(args) && !arg.IsOptional && !arg.IsVariadic {
			missing = append(missing, arg)
		}
	}
	if len(missing) == 0 {
		return args, nil
	}
	values := make([]string, len(missing))
	var fields []huh.Field
	for i, arg := range missing {
		input := huh.NewInput().Title(arg.Name).Description(arg.Description).Value(&values[i]).
			Validate(func(value string) error {
				if strings.TrimSpace(value) == "" {
					return errors.New("needs a value")
				}
				if strings.HasSuffix(arg.Name, "file") {
					if _, err := os.Stat(value); err != nil {
						return fmt.Errorf("no file at %s", value)
					}
				}
				return nil
			})
		fields = append(fields, input)
	}
	if err := runFullScreen(formFor(verb.Family(), huh.NewGroup(fields...))); err != nil {
		return nil, usageFail("the form was closed with no answer", "x "+verb.Name+" --help")
	}
	return append(args, values...), nil
}

// the approve-an-ask form; the answer stays on the board as a still step line
func confirm(r *Run, question string) (bool, error) {
	approved := false
	field := huh.NewConfirm().Title(question).Affirmative("yes, do it").Negative("no").Value(&approved)
	if err := runForm(formFor(r.verb.Family(), huh.NewGroup(field))); err != nil && !errors.Is(err, huh.ErrUserAborted) {
		return false, err
	}
	if approved {
		fmt.Println(r.stepLine(ui.ok.Render("✓"), ui.fg.Render("approve"), ui.dim.Render("yes, on this terminal"), ""))
	} else {
		fmt.Println(r.stepLine(ui.dim.Render("○"), ui.fg.Render("approve"), ui.dim.Render("no"), ""))
	}
	return approved, nil
}

type pickable struct{ name, label string }

// a picker over pending handoffs, newest first
func pick(family, title string, items []pickable) (string, error) {
	var chosen string
	options := make([]huh.Option[string], len(items))
	for i, item := range items {
		options[i] = huh.NewOption(item.label, item.name)
	}
	field := huh.NewSelect[string]().Title(title).Options(options...).Value(&chosen)
	if err := runForm(formFor(family, huh.NewGroup(field))); err != nil {
		return "", usageFail("nothing was picked", "x handoffs list")
	}
	return chosen, nil
}
