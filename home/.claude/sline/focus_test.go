package main

import "testing"

func TestTicketLinkOpensTheWebUrl(t *testing.T) {
	cases := []struct {
		name, id, want string
	}{
		{"an id links its https issue page", "FRM-12", "\033]8;;https://linear.app/x-com/issue/FRM-12\033\\FRM-12\033]8;;\033\\"},
		{"no id draws nothing", "", ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := ticketLink(c.id); got != c.want {
				t.Errorf("ticketLink(%q) = %q, want %q", c.id, got, c.want)
			}
		})
	}
}
