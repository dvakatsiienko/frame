# scout-tools — every tool we looked at once, and what we decided

read before any new scout: a tool already here is answered from its line. a **scout** is the one-shot look at a tool dima drops (a link plus his lens: for him, for the fleet, for cclio), before any test drive. the flow: this file → a miss goes to the `researcher` agent with the lens → a verdict → one line here. a «try» hands into `x:shape-test-drive`; a «skip» keeps its reason, so a research brief can carry «decided against: …» instead of proposing it again. later: `x scout <url> "<lens>"` (`x/PRODUCT.md`).

one line per tool: date · tool [link] · what it is · stars / last push · verdict · why · home

## 2026-10-07

- [duckdb](https://github.com/duckdb/duckdb) · SQL over jsonl, md and git where they lie · try → test drive to 10-21 · classified 30 days of `linear api` calls in 0.26 s · `docs/test-drive/duckdb.md`, `rules/fleet-tooling.md`
- [meteor](https://github.com/raystack/meteor) · metadata catalog ingestion · skip · reads no local jsonl, git or linear; cannot count events
- [ccusage](https://github.com/ccusage/ccusage) · Claude Code cost and tokens per day, session or 5-hour block, `--json` · 18.9k★, 2026-09-27 · candidate · overlaps `agent-ops:report`; pipe into duckdb if the cost half is needed
- [steampipe](https://github.com/turbot/steampipe) · SQL over apis, github plugin · candidate · its linear plugin last released 2025-10, a risk; `gh api` + duckdb may be enough
- [savvy-cli](https://github.com/getsavvyinc/savvy-cli) · records shell sessions into team runbooks · 465★, 2025-01 · skip · stale; transcripts + x traces + duckdb cover it
- [mergestat-lite](https://github.com/mergestat/mergestat-lite) · SQL over git · 3.5k★, 2024-03 · skip · stale; duckdb's `duck_tails` is current
- [ntcharts](https://github.com/NimbleMarkets/ntcharts) · bubbletea charts, v2-ready (our exact pins) · 804★, 2026-10-06 · try · api moved four times in a week, heavy deps; bake-off against hand-rolled lipgloss in `.scratch/x-stats-board/`
- [teatest](https://github.com/charmbracelet/x/tree/main/exp/teatest/v2) · golden-frame tests for bubbletea · try · v2-ready, no tags; goldens are raw escape streams · `x-stats-board` spec
- [sequin](https://github.com/charmbracelet/sequin) · decodes ansi into words · try · installed; for golden diffs and redraw bugs · `Brewfile`
- [harmonica](https://github.com/charmbracelet/harmonica) · spring animation · adopt · in the stack upfront (dima), already pulled in by bubbles' progress · `docs/knowledge/charm.md`
- [wish](https://github.com/charmbracelet/wish) · serves a bubbletea app over ssh · later · no use case yet · `x/PRODUCT.md`
- [glamour](https://github.com/charmbracelet/glamour) / [glow](https://github.com/charmbracelet/glow) · the markdown renderer library / the reader app built on it · both in use · glamour inside x's views, glow for dima at the terminal
- [gum](https://github.com/charmbracelet/gum) · charm widgets as a shell binary · skip for x · the go libs give the same widgets natively; fine for bash scripts
- [gh-dash](https://github.com/dlvhdr/gh-dash) · a bubbletea dashboard over github prs and issues · 12.6k★, 2026-09-22 · prior art + for dima · the x main view, pocket 05 · `gh extension install dlvhdr/gh-dash`
- [chezmoi](https://github.com/twpayne/chezmoi) · dotfiles across many machines · 21.9k★ · skip · our mirror keeps live symlinks and «the path under `home/` IS the path»; chezmoi renames sources and needs an apply; its templates pay off only with a second machine
- [signls](https://github.com/emprcl/signls) · a generative midi sequencer in the terminal · 265★ · skip for the fleet · sends midi, needs a synth; not scriptable, so no hook sounds
- [superfile](https://github.com/yorukot/superfile) · a terminal file manager · 23.7k★ · for dima only · agents use rg, fd, ls
- [glyphs](https://github.com/maaslalani/glyphs) · unicode symbol lookup · 131★, 2024-02 · skip · stale; raycast's symbol picker covers it
