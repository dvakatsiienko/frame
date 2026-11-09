package main

import (
	"strings"
	"testing"
)

// exit line 4: main moved between the read and the call, so github refuses a merge every check passed; the rerun is the door
func TestMergeAutoNamesGithubsRefusalAndTheRerun(t *testing.T) {
	t.Parallel()
	for _, refusal := range []string{"405 Base branch was modified. Review and try the merge again.", "409 Head branch was modified"} {
		t.Run(refusal, func(t *testing.T) {
			t.Parallel()
			w := newMergeWorld(t, "script/foo.ts")
			w.hub.refuseMerge = refusal

			got := w.run(t, "7", "--apply")

			_, words, _ := strings.Cut(refusal, " ")
			if got.code == 0 || !strings.Contains(got.stdout, words) || !strings.Contains(got.stdout, "x lane merge-auto 7, again") {
				t.Fatalf("exit %d, want github's words %q and the rerun door:\n%s", got.code, words, got.stdout)
			}
			if strings.Contains(got.stdout, "gh api") || strings.Contains(got.stdout, "HTTP ") {
				t.Errorf("the output carries a raw gh error:\n%s", got.stdout)
			}
		})
	}
}
