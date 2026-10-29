package main

import "testing"

func TestTicketOfBranchReadsBothPrefixes(t *testing.T) {
	t.Parallel()
	cases := []struct{ branch, want string }{
		{"codie/FRM-1-a", "FRM-1"},
		{"coder/BYT-22-slug", "BYT-22"},
		{"codie/FRM-3", "FRM-3"},
		{"dima/FRM-1-a", ""},
		{"codie/frm-1-a", ""},
	}
	for _, c := range cases {
		t.Run(c.branch, func(t *testing.T) {
			t.Parallel()
			got := ""
			if m := ticketOfBranch.FindStringSubmatch(c.branch); m != nil {
				got = m[1]
			}
			if got != c.want {
				t.Errorf("ticket of %s = %q, want %q", c.branch, got, c.want)
			}
		})
	}
}
