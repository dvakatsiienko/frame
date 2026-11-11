package main

import (
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

// x-mod-stash's glide card draws these steps, so its own parse of the plan goes
func TestLanePlanStepsReadsTheStepsTheCardDraws(t *testing.T) {
	t.Parallel()
	plan := strings.Join([]string{
		"# lane plan: cli lane 8",
		"- [x] 01 · FRM-560 measure the mods pair: copy, validate, test",
		"- [ ] 05 · the reviewer reply verb, FRM-414 riding",
		"- [X] 07 · FRM-570: rule 5, the merge holds\r",
		"- [ ] 08 · UTF-8 output, no ticket   ",
		"  - [ ] 19 · FRM-570 a nested line moves nothing",
		"- [ ] FRM-570 an unnumbered line moves nothing",
		"* [ ] 09 · FRM-570 another list mark moves nothing",
	}, "\n")
	file := filepath.Join(t.TempDir(), "lane-plan.md")
	write(t, file, plan)

	got := xIn(t, t.TempDir(), nil, "lane", "plan-steps", file)

	want := []any{
		map[string]any{"done": true, "text": "measure the mods pair: copy, validate, test", "ticket": "FRM-560"},
		map[string]any{"done": false, "text": "the reviewer reply verb, FRM-414 riding", "ticket": "FRM-414"},
		map[string]any{"done": true, "text": "rule 5, the merge holds", "ticket": "FRM-570"},
		map[string]any{"done": false, "text": "UTF-8 output, no ticket"},
	}
	if got.code != 0 || !reflect.DeepEqual(got.data["steps"], want) {
		t.Fatalf("exit %d, steps %v\nwant %v\n%s", got.code, got.data["steps"], want, got.stdout)
	}
}

func TestLanePlanStepsNamesAPlanThatIsNotThere(t *testing.T) {
	t.Parallel()
	got := xIn(t, t.TempDir(), nil, "lane", "plan-steps", "/no/such/lane-plan.md")
	if got.code != 1 || !strings.Contains(got.stdout, "no lane plan at") {
		t.Fatalf("exit %d, want 1 naming the plan:\n%s", got.code, got.stdout)
	}
}
