package main

import (
	"slices"
	"testing"
)

func TestTicketsOfPrReadOneShape(t *testing.T) {
	t.Parallel()
	const fence = "```\n- ticket: FRM-9\n```\n"
	cases := []struct {
		name, branch, body string
		want               []string
	}{
		{"a codie branch", "codie/FRM-1-a", "", []string{"FRM-1"}},
		{"the other team's id", "codie/BYT-22-slug", "", []string{"BYT-22"}},
		{"the prefix before the rename", "coder/BYT-22-slug", "", nil},
		{"a branch that is only the id", "codie/FRM-3", "", []string{"FRM-3"}},
		{"another owner's branch", "dima/FRM-1-a", "", nil},
		{"frame#132's branch alone", "codie/frm-521-gate-turn", "", []string{"FRM-521"}},
		{"frame#132's body alone", "dima/gate", "- ticket: FRM-521, slice 0 of its spec", []string{"FRM-521"}},
		{"a slug that only looks like an id", "codie/fix-2-thing", "", nil},
		{"a fenced id alone", "dima/gate", fence, nil},
		{"a fenced id beside a real line", "dima/gate", fence + "- ticket: FRM-2\n", []string{"FRM-2"}},
		{"an id running on", "dima/gate", "- ticket: FRM-1x", nil},
		{"a quoted line names nothing", "dima/gate", "> ticket: FRM-4", nil},
		{"a tilde fence", "dima/gate", "~~~\n- ticket: FRM-9\n~~~\n", nil},
		{"a fence nested in a list", "dima/gate", "- item\n    ```\n    - ticket: FRM-9\n    ```\n", nil},
		{"a tab-indented fence", "dima/gate", "\t```\n- ticket: FRM-9\n\t```\n", nil},
		{"an id across a blank line", "dima/gate", "ticket:\n\nFRM-7 words\n", nil},
		{"an unclosed fence", "dima/gate", "```\n- ticket: FRM-9\n", nil},
		{"backticks mid-line open no fence", "dima/gate", "use ``` here\n- ticket: FRM-2\n```x```\n", []string{"FRM-2"}},
		{"a word that is no ticket", "dima/gate", "- ticket: slice-2", nil},
		{"the branch reads first", "codie/FRM-1-a", "- ticket: BYT-2\n", []string{"FRM-1", "BYT-2"}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			if got := ticketsOfPr(c.branch, c.body); !slices.Equal(got, c.want) {
				t.Errorf("tickets of %q and %q = %q, want %q", c.branch, c.body, got, c.want)
			}
		})
	}
}
