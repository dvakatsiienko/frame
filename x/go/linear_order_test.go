package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
)

const unlinkVerb = "unlink"

type orderRow struct {
	id    string
	order float64
}

// a team's tickets as linear hands them in manual order, a page each; shapes copied from a real read (FRM, 2026-11-10)
func orderServer(t *testing.T, self orderRow, pages ...[]orderRow) *fakeLinear {
	t.Helper()
	known := map[string]float64{}
	for _, page := range pages {
		for _, row := range page {
			known[row.id] = row.order
		}
	}
	return newFakeLinear(t, orderAnswer(self, known, pages))
}

// known is every ticket linear can find by id, apart from the team's order: one may be missing from the pages
func orderAnswer(self orderRow, known map[string]float64, pages [][]orderRow) func(gqlCall) string {
	return func(call gqlCall) string {
		switch {
		case strings.Contains(call.Query, "mutation"):
			return `{"data":{"issueUpdate":{"success":true}}}`
		case strings.Contains(call.Query, "manual"):
			at := 0
			if after, _ := call.Variables["after"].(string); after != "" {
				_, _ = fmt.Sscanf(after, "page-%d", &at)
			}
			var nodes []string
			for _, row := range pages[at] {
				nodes = append(nodes, fmt.Sprintf(`{"id":"uuid-%s","identifier":%q,"sortOrder":%v}`, row.id, row.id, row.order))
			}
			return fmt.Sprintf(`{"data":{"issues":{"nodes":[%s],"pageInfo":{"hasNextPage":%v,"endCursor":"page-%d"}}}}`,
				strings.Join(nodes, ","), at+1 < len(pages), at+1)
		}
		place := "null"
		anchor, _ := call.Variables["place"].(string)
		if order, found := known[anchor]; found {
			team, _, _ := strings.Cut(strings.ToLower(anchor), "-")
			place = fmt.Sprintf(`{"id":"uuid-%s","identifier":%q,"sortOrder":%v,"team":{"id":"t-%s"}}`, anchor, anchor, order, team)
		}
		return fmt.Sprintf(`{"data":{"issue":{"id":"uuid-1","identifier":%q,"title":"the old title","sortOrder":%v,"priority":3,
			"state":{"name":"Todo"},"team":{"id":"t-frm","states":{"nodes":[]}},"labels":{"nodes":[]}},"place":%s}}`, self.id, self.order, place)
	}
}

func changesOf(envelope map[string]any) string {
	data, _ := envelope["data"].(map[string]any)
	raw, _ := json.Marshal(data["changes"])
	return string(raw)
}

func TestSetChangesATitle(t *testing.T) {
	t.Parallel()
	server := orderServer(t, orderRow{"FRM-1", -500})

	envelope, got := runLinear(t, server, nil, "linear", "set", "FRM-1", "--title", "the new title")

	if got.code != 0 || updateInput(t, server)["title"] != "the new title" {
		t.Fatalf("exit %d, the update did not carry the title:\n%s%s", got.code, got.stdout, got.stderr)
	}
	if said := changesOf(envelope); !strings.Contains(said, `"title: the old title → the new title"`) {
		t.Errorf("changes %s, want the title as old → new", said)
	}
}

func TestSetPlacesATicketBesideAnother(t *testing.T) {
	t.Parallel()
	team := []orderRow{{"FRM-7", -300}, {"FRM-2", -200}, {"FRM-8", -100}}
	cases := []struct {
		name, flag string
		self       orderRow
		pages      [][]orderRow
		want       float64
	}{
		{"after, between it and the next", "--after", orderRow{"FRM-1", -500}, [][]orderRow{team}, -150},
		{"before, between it and the one above", "--before", orderRow{"FRM-1", -500}, [][]orderRow{team}, -250},
		{"after the last ticket", "--after", orderRow{"FRM-1", -500}, [][]orderRow{{{"FRM-7", -300}, {"FRM-2", -200}}}, -199},
		{"before the first ticket", "--before", orderRow{"FRM-1", -50}, [][]orderRow{{{"FRM-2", -200}, {"FRM-8", -100}}}, -201},
		{"after, the ticket itself the next one", "--after", orderRow{"FRM-1", -150}, [][]orderRow{{{"FRM-2", -200}, {"FRM-1", -150}, {"FRM-8", -100}}}, -150},
		{"after, its neighbour on the next page", "--after", orderRow{"FRM-1", -500}, [][]orderRow{{{"FRM-7", -300}, {"FRM-2", -200}}, {{"FRM-8", -100}}}, -150},
		{"after, itself on the page before", "--after", orderRow{"FRM-1", -500}, [][]orderRow{{{"FRM-1", -500}, {"FRM-7", -300}}, {{"FRM-2", -200}, {"FRM-8", -100}}}, -150},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			server := orderServer(t, c.self, c.pages...)

			envelope, got := runLinear(t, server, nil, "linear", "set", "FRM-1", c.flag, "FRM-2")

			if got.code != 0 {
				t.Fatalf("exit %d\n%s%s", got.code, got.stdout, got.stderr)
			}
			if sent := updateInput(t, server)["sortOrder"]; sent != c.want {
				t.Errorf("sortOrder %v went out, want %v", sent, c.want)
			}
			want := fmt.Sprintf(`"order: %v → %v, %s FRM-2"`, c.self.order, c.want, strings.TrimPrefix(c.flag, "--"))
			if said := changesOf(envelope); !strings.Contains(said, want) {
				t.Errorf("changes %s, want %s", said, want)
			}
		})
	}
}

func TestSetRefusesAPlaceItCannotRead(t *testing.T) {
	t.Parallel()
	// the team's order holds FRM-2 only where a case says so; linear finds FRM-2 by id, never FRM-9
	listed, unlisted := []orderRow{{"FRM-7", -300}, {"FRM-2", -200}}, []orderRow{{"FRM-7", -300}}
	tied := []orderRow{{"FRM-7", -200}, {"FRM-2", -200}, {"FRM-8", -200}}
	cases := []struct {
		name string
		team []orderRow
		args []string
		code int
		says string
	}{
		{"both sides at once", listed, []string{"--after", "FRM-2", "--before", "FRM-2"}, 2, "give one"},
		{"beside itself", listed, []string{"--after", "FRM-1"}, 2, "itself"},
		{"free text for a ticket", listed, []string{"--after", "the top"}, 2, "the top"},
		{"a ticket linear does not know", listed, []string{"--before", "FRM-9"}, 1, "no ticket FRM-9"},
		{"another team's ticket", listed, []string{"--after", "BYT-5"}, 1, "another team"},
		{"a ticket the team's order never shows", unlisted, []string{"--after", "FRM-2"}, 1, "manual order"},
		{"after a ticket tied with its next one", tied, []string{"--after", "FRM-2"}, 1, "no number left between"},
		{"before a ticket tied with the one above", tied, []string{"--before", "FRM-2"}, 1, "no number left between"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			server := newFakeLinear(t, orderAnswer(orderRow{"FRM-1", -500}, map[string]float64{"FRM-2": -200, "BYT-5": -10}, [][]orderRow{c.team}))

			envelope, got := runLinear(t, server, nil, append([]string{"linear", "set", "FRM-1"}, c.args...)...)

			if got.code != c.code || len(mutations(server)) != 0 || !strings.Contains(fmt.Sprint(envelope["error"]), c.says) {
				t.Errorf("exit %d, %d mutations, want %d and none, saying %q:\n%s", got.code, len(mutations(server)), c.code, c.says, got.stdout)
			}
		})
	}
}

// FRM-1 blocks FRM-2 and relates to FRM-3, which holds the relation from its own side
const unlinkLookup = `{"data":{"issue":{"id":"uuid-1","identifier":"FRM-1",
	"relations":{"nodes":[{"id":"rel-blocks","type":"blocks","relatedIssue":{"identifier":"FRM-2"}}]},
	"inverseRelations":{"nodes":[{"id":"rel-related","type":"related","issue":{"identifier":"FRM-3"}},{"id":"rel-blocked","type":"blocks","issue":{"identifier":"FRM-4"}}]}}}}`

func unlinkServer(t *testing.T, lookup string) *fakeLinear {
	return newFakeLinear(t, func(call gqlCall) string {
		if strings.Contains(call.Query, "mutation") {
			return `{"data":{"r0":{"success":true}}}`
		}
		return lookup
	})
}

func TestUnlinkRemovesTheRelationLinkMade(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name, kind, target, relation string
	}{
		{"a blocks link from this ticket", "blocks", "FRM-2", "rel-blocks"},
		{"a related link held by the other side", "related", "FRM-3", "rel-related"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			server := unlinkServer(t, unlinkLookup)

			envelope, got := runLinear(t, server, nil, "linear", unlinkVerb, "FRM-1", c.kind, c.target)

			sent := mutations(server)
			if got.code != 0 || len(sent) != 1 || sent[0].Variables["r0"] != c.relation || !strings.Contains(sent[0].Query, "issueRelationDelete") {
				t.Fatalf("exit %d, sent %+v, want one delete of %s:\n%s%s", got.code, sent, c.relation, got.stdout, got.stderr)
			}
			if said, want := changesOf(envelope), fmt.Sprintf(`"%s: %s → —"`, c.kind, c.target); !strings.Contains(said, want) {
				t.Errorf("changes %s, want %s", said, want)
			}
		})
	}
}

func TestUnlinkRemovesATargetNamedTwiceOnce(t *testing.T) {
	t.Parallel()
	server := unlinkServer(t, unlinkLookup)

	_, got := runLinear(t, server, nil, "linear", unlinkVerb, "FRM-1", "blocks", "FRM-2", "FRM-2")

	sent := mutations(server)
	if got.code != 0 || len(sent) != 1 || len(sent[0].Variables) != 1 || sent[0].Variables["r0"] != "rel-blocks" {
		t.Errorf("exit %d, sent %+v, want one delete of rel-blocks:\n%s%s", got.code, sent, got.stdout, got.stderr)
	}
}

func TestUnlinkWritesNothingWhenALinkIsMissing(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name, lookup string
		args         []string
		code         int
		says         string
	}{
		{"a link that is not there", unlinkLookup, []string{"FRM-1", "blocks", "FRM-9"}, 1, "FRM-9"},
		{"one of two is not there", unlinkLookup, []string{"FRM-1", "blocks", "FRM-2", "FRM-9"}, 1, "FRM-9"},
		{"a link that runs the other way", unlinkLookup, []string{"FRM-1", "blocks", "FRM-4"}, 1, "FRM-4"},
		{"a link of another kind", unlinkLookup, []string{"FRM-1", "duplicate", "FRM-2"}, 1, "FRM-2"},
		{"a ticket linear does not know", `{"data":{"issue":null}}`, []string{"FRM-404", "blocks", "FRM-2"}, 1, "FRM-404"},
		{"a relation x does not make", unlinkLookup, []string{"FRM-1", "likes", "FRM-2"}, 2, "likes"},
		{"no target", unlinkLookup, []string{"FRM-1", "blocks"}, 2, ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			server := unlinkServer(t, c.lookup)

			envelope, got := runLinear(t, server, nil, append([]string{"linear", unlinkVerb}, c.args...)...)

			if got.code != c.code || len(mutations(server)) != 0 || !strings.Contains(fmt.Sprint(envelope["error"]), c.says) {
				t.Errorf("exit %d, %d mutations, want %d and none, naming %q:\n%s", got.code, len(mutations(server)), c.code, c.says, got.stdout)
			}
		})
	}
}
