package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const gateMap = "# context map\n\n" +
	"- **app** — `app/GLOSSARY.md` + `app/adr/` — an app\n" +
	"  - contract: `app/api.ts`, `app/schema/`\n" +
	"- **side** — `side/GLOSSARY.md` — a side context\n" +
	"  - contract: none yet\n" +
	"- **repo** — `GLOSSARY.md` — the repo itself\n"

// gateRepo commits a repo holding two contexts, a skill and an app with an ftr, then writes `files` and stages them
func gateRepo(t *testing.T, files map[string]string) string {
	t.Helper()
	dir := repo(t)
	for path, body := range map[string]string{
		"GLOSSARY-MAP.md":                           gateMap,
		"GLOSSARY.md":                               "- **repo** — this\n",
		"app/GLOSSARY.md":                           "- **api** — the door\n",
		"app/api.ts":                                "export const a = 1;\n",
		"app/schema/user.json":                      "{}\n",
		"app/adr/0001.md":                           "# one\n",
		"side/GLOSSARY.md":                          "- **side** — a word\n",
		"side/tool.sh":                              "echo side\n",
		"skills/crew-coder/SKILL.md":                "# coder\none\ntwo\nthree\n",
		"skills/notes/SKILL.md":                     "# notes\n",
		"web/FTR.md":                                "- ✅ a page\n",
		"web/page.tsx":                              "export const Page = 1;\n",
		"home/.claude/plugin-x/mods/m/FTR.md":       "- ✅ a mod\n",
		"home/.claude/plugin-x/skills/x/SKILL.md":   "# x\n",
		"home/.claude/plugin-x/skills/x/notes.html": "<p>x</p>\n",
	} {
		write(t, filepath.Join(dir, path), body)
	}
	gitT(t, dir, "add", ".")
	gitT(t, dir, "commit", "-q", "-m", "contexts")
	for path, body := range files {
		write(t, filepath.Join(dir, path), body)
	}
	gitT(t, dir, "add", "-A")
	return dir
}

func gate(t *testing.T, dir, msg string) ran {
	t.Helper()
	path := filepath.Join(t.TempDir(), "COMMIT_EDITMSG")
	write(t, path, msg)
	return xIn(t, dir, nil, "lane", "gate", path)
}

func TestGateRefusesAContractChangeWithoutItsGlossary(t *testing.T) {
	for _, file := range []string{"app/api.ts", "app/schema/user.json"} {
		t.Run(file, func(t *testing.T) {
			dir := gateRepo(t, map[string]string{file: "changed\n"})

			got := gate(t, dir, "change\n")

			if got.code != 1 || !strings.Contains(got.stdout, "app") || !strings.Contains(got.stdout, "app/GLOSSARY.md") {
				t.Errorf("exit %d, output %q; want 1 naming app and app/GLOSSARY.md", got.code, got.stdout)
			}
		})
	}
}

func TestGatePassesAContractChangeThatCarriesItsGlossaryOrAdr(t *testing.T) {
	cases := map[string]map[string]string{
		"glossary": {"app/api.ts": "changed\n", "app/GLOSSARY.md": "- **api** — the door, renamed\n"},
		"adr":      {"app/api.ts": "changed\n", "app/adr/0002.md": "# two\n"},
	}
	for name, files := range cases {
		t.Run(name, func(t *testing.T) {
			got := gate(t, gateRepo(t, files), "change\n")

			if got.code != 0 {
				t.Errorf("exit %d, output %q; want 0", got.code, got.stdout)
			}
		})
	}
}

func TestGatePassesAContractChangeTheMessageExplains(t *testing.T) {
	dir := gateRepo(t, map[string]string{"app/api.ts": "changed\n"})

	got := gate(t, dir, "change\n\nglossary: unchanged — a comment moved\n")

	if got.code != 0 {
		t.Errorf("exit %d, output %q; want 0", got.code, got.stdout)
	}
}

func TestGateNudgesAContextWithAnEmptyContract(t *testing.T) {
	dir := gateRepo(t, map[string]string{"side/tool.sh": "echo changed\n"})

	got := gate(t, dir, "change\n")

	if got.code != 0 || !strings.Contains(got.stdout, "side") || strings.Count(strings.TrimSpace(got.stdout), "\n") != 0 {
		t.Errorf("exit %d, output %q; want 0 and one line naming side", got.code, got.stdout)
	}
}

func TestGateStaysQuietForAContextWithNoContractLine(t *testing.T) {
	dir := gateRepo(t, map[string]string{"readme.txt": "changed\n"})

	got := gate(t, dir, "change\n")

	if got.code != 0 || got.stdout != "" {
		t.Errorf("exit %d, output %q; want 0 and nothing", got.code, got.stdout)
	}
}

func TestGateRefusesAListedPathThatIsGone(t *testing.T) {
	dir := gateRepo(t, nil)
	gitT(t, dir, "rm", "-q", "app/api.ts")

	got := gate(t, dir, "change\n\nglossary: unchanged — gone on purpose\n")

	if got.code != 1 || !strings.Contains(got.stdout, "app/api.ts") || !strings.Contains(got.stdout, "GLOSSARY-MAP.md") {
		t.Errorf("exit %d, output %q; want 1 naming app/api.ts and the map", got.code, got.stdout)
	}
}

func TestGateRefusesASkillThatOnlyGrows(t *testing.T) {
	cases := map[string]struct {
		files map[string]string
		code  int
	}{
		"three lines added":           {map[string]string{"skills/crew-coder/SKILL.md": "# coder\none\ntwo\nthree\na\nb\nc\n"}, 1},
		"two lines added":             {map[string]string{"skills/crew-coder/SKILL.md": "# coder\none\ntwo\nthree\na\nb\n"}, 0},
		"blank lines never count":     {map[string]string{"skills/crew-coder/SKILL.md": "# coder\none\n\ntwo\n\nthree\n\na\nb\n"}, 0},
		"three added, one cut":        {map[string]string{"skills/crew-coder/SKILL.md": "# coder\none\ntwo\na\nb\nc\n"}, 0},
		"a new file in a skill dir":   {map[string]string{"skills/crew-coder/extra.md": "one\n"}, 1},
		"a new crew skill":            {map[string]string{"skills/crew-new/SKILL.md": "one\n"}, 1},
		"a skill outside crew, guide": {map[string]string{"skills/notes/SKILL.md": "# notes\na\nb\nc\nd\n"}, 0},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			got := gate(t, gateRepo(t, c.files), "change\n")

			if got.code != c.code {
				t.Errorf("exit %d, output %q; want %d", got.code, got.stdout, c.code)
			}
		})
	}
}

func TestGateReadsARenamedSkillFileByItsChange(t *testing.T) {
	cases := map[string]struct {
		from, to, body string
		code           int
	}{
		"moved as is":                 {"skills/crew-coder/SKILL.md", "skills/crew-coder/CODER.md", "# coder\none\ntwo\nthree\n", 0},
		"moved and grown by 3":        {"skills/crew-coder/SKILL.md", "skills/crew-coder/CODER.md", "# coder\none\ntwo\nthree\na\nb\nc\n", 1},
		"moved into another skill":    {"skills/crew-coder/SKILL.md", "skills/guide-go/stolen.md", "# coder\none\ntwo\nthree\n", 1},
		"moved in from outside crews": {"skills/notes/SKILL.md", "skills/crew-coder/notes.md", "# notes\n", 1},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			dir := gateRepo(t, nil)
			if err := os.MkdirAll(filepath.Join(dir, filepath.Dir(c.to)), 0o755); err != nil {
				t.Fatal(err)
			}
			gitT(t, dir, "mv", c.from, c.to)
			write(t, filepath.Join(dir, c.to), c.body)
			gitT(t, dir, "add", "-A")

			got := gate(t, dir, "change\n")

			if got.code != c.code {
				t.Errorf("exit %d, output %q; want %d", got.code, got.stdout, c.code)
			}
		})
	}
}

func TestGateTakesAnAsciiDashInAPassLine(t *testing.T) {
	dir := gateRepo(t, map[string]string{"app/api.ts": "changed\n"})

	got := gate(t, dir, "change\n\nglossary: unchanged - a comment moved\n")

	if got.code != 0 {
		t.Errorf("exit %d, output %q; want 0", got.code, got.stdout)
	}
}

func TestGatePassesAGrownSkillTheMessageGroomed(t *testing.T) {
	dir := gateRepo(t, map[string]string{"skills/crew-coder/SKILL.md": "# coder\none\ntwo\nthree\na\nb\nc\n"})

	got := gate(t, dir, "change\n\ngroom: read whole — cut the old recipe\n")

	if got.code != 0 {
		t.Errorf("exit %d, output %q; want 0", got.code, got.stdout)
	}
}

func TestGateRefusesAppCodeWithoutItsFtr(t *testing.T) {
	cases := map[string]struct {
		files map[string]string
		msg   string
		names string
	}{
		"code alone":           {map[string]string{"web/page.tsx": "export const Page = 2;\n"}, "change\n", "web/FTR.md"},
		"code and its ftr":     {map[string]string{"web/page.tsx": "export const Page = 2;\n", "web/FTR.md": "- ✅ a page, now 2\n"}, "change\n", ""},
		"ftr: none":            {map[string]string{"web/page.tsx": "export const Page = 2;\n"}, "change\n\nftr: none\n", ""},
		"a bulleted marker":    {map[string]string{"web/page.tsx": "export const Page = 2;\n"}, "change\n\n- ftr: none\n", "web/FTR.md"},
		"a mod's code":         {map[string]string{"home/.claude/plugin-x/mods/m/hooks/a.ts": "export const a = 1;\n"}, "change\n", "home/.claude/plugin-x/mods/m/FTR.md"},
		"a skill's html":       {map[string]string{"home/.claude/plugin-x/skills/x/notes.html": "<p>y</p>\n"}, "change\n", ""},
		"a file in a worktree": {map[string]string{".claude/worktrees/w/web/a.ts": "export const a = 1;\n"}, "change\n", ""},
		"code with no app":     {map[string]string{"loose.ts": "export const l = 1;\n"}, "change\n", ""},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			got := gate(t, gateRepo(t, c.files), c.msg)

			want := 0
			if c.names != "" {
				want = 1
			}
			if got.code != want || !strings.Contains(got.stdout, c.names) {
				t.Errorf("exit %d, output %q; want %d naming %q", got.code, got.stdout, want, c.names)
			}
		})
	}
}

func TestGateReadsAMapThatLinksItsGlossaries(t *testing.T) {
	dir := gateRepo(t, nil)
	write(t, filepath.Join(dir, "GLOSSARY-MAP.md"), "# Context Map\n\n- [web](./web/GLOSSARY.md) — a site\n  - contract: none yet\n")
	write(t, filepath.Join(dir, "web/GLOSSARY.md"), "- **page** — a page\n")
	gitT(t, dir, "add", "-A")
	gitT(t, dir, "commit", "-q", "-m", "linked map")
	write(t, filepath.Join(dir, "web/page.tsx"), "export const Page = 3;\n")
	gitT(t, dir, "add", "-A")

	got := gate(t, dir, "change\n\nftr: none\n")

	if got.code != 0 || !strings.Contains(got.stdout, "web has no contract list yet") {
		t.Errorf("exit %d, output %q; want 0 and the web nudge", got.code, got.stdout)
	}
}

func TestGateSkipsAMergeCommit(t *testing.T) {
	dir := gateRepo(t, nil)
	gitT(t, dir, "checkout", "-q", "-b", "side")
	write(t, filepath.Join(dir, "app/api.ts"), "side\n")
	gitT(t, dir, "commit", "-q", "-am", "side")
	gitT(t, dir, "checkout", "-q", "main")
	write(t, filepath.Join(dir, "readme.txt"), "main\n")
	gitT(t, dir, "commit", "-q", "-am", "main")
	gitT(t, dir, "merge", "-q", "--no-commit", "--no-ff", "side")

	got := gate(t, dir, "Merge branch 'side'\n")

	if got.code != 0 {
		t.Errorf("exit %d, output %q; want 0 mid-merge", got.code, got.stdout)
	}
}
