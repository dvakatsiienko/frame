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
		{"both prefixes, codie", "codie/FRM-1-a", "", []string{"FRM-1"}},
		{"both prefixes, coder", "coder/BYT-22-slug", "", []string{"BYT-22"}},
		{"a branch that is only the id", "codie/FRM-3", "", []string{"FRM-3"}},
		{"another owner's branch", "dima/FRM-1-a", "", nil},
		{"frame#132's branch alone", "codie/frm-521-gate-turn", "", []string{"FRM-521"}},
		{"frame#132's body alone", "dima/gate", "- ticket: FRM-521, slice 0 of its spec", []string{"FRM-521"}},
		{"a slug that only looks like an id", "codie/fix-2-thing", "", nil},
		{"a fenced id alone", "dima/gate", fence, nil},
		{"a fenced id beside a real line", "dima/gate", fence + "- ticket: FRM-2\n", []string{"FRM-2"}},
		{"an id running on", "dima/gate", "- ticket: FRM-1x", nil},
		{"a quoted line", "dima/gate", "> ticket: frm-4", []string{"FRM-4"}},
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
