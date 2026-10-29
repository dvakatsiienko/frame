---
name: system-checkup
description: >-
  load on «system checkup», «checkup», «health check», «is our system healthy», «checkup <check>»,
  or when the boot digest says the checkup is due — the one plate of every health check in the fleet,
  run whole or one check at a time.
---

# /clio:system-checkup — the unification plate

dima, 2026-10-19: «whenever we want to know if our system is in good health, we go to the system
checkup flow, and it should have everything. it's a unification plate.» a granular set of checks, never
a monolith: each check keeps its own home and is listed here by pointer, so a check that lives in a hook,
a script or another skill is never copied. the plate grows a check at a time, while we do real operational
work; `recipes/refresh-system-checkup/` sharpens it.

## the run

- **whole**: every check below, top to bottom, in one pass. **targeted**: `checkup <id>` runs one
- **a finding is fixed in place first** (dima, 2026-10-19: «prefer fix in place for checkup findings»): a
  freebie-sized fix lands in the same run, and the run line names it. what is too big, needs his word, or
  destroys something (a worktree, a process, a plugin, a permission) becomes one orbit ask with its fix
- a check that cannot run says so on its line — `could not run: <why>` — never a silent skip
- the log: one line per check per run in `~/frame/_clio/checkup/log.md`,
  `YYYY-MM-DD · <id> · 🟢 | 🔴 <what> · fixed: <what> | asked: <what> | —`. a check's «last red» is the
  newest 🔴 line for its id there, derived, never kept by hand; a check green for 90 days goes up for removal
- a postponed run is one line too, `YYYY-MM-DD · postponed · 🟡 <his word> · next due YYYY-MM-DD`; the boot reads it and holds the DUE line until that date
- the reply is one board: 🔴 first with what was fixed, then 🟡, then one count line of greens

## the checks

own — the checks this plate runs itself (scripts sit in `scripts/` beside this file):
- **skill-shape** — skills that would gain from a split into a reference file, a step a script should do,
  logic duplicated across skills · judgment, a `helper` card with the method and last run of
  `docs/research/skill-split-scriptify-scan.md`; strength-3 items only, the rest stay in that doc
- **hook-health** — hook latency and errors per hook over the last days of the local OTel tap ·
  script, `scripts/hook-health.sh [days]` (🔴 p95 over 1 s or any error, 🟡 over 300 ms)
- **naming-entity-first** — verb-first names, FRM-219 · script, `node scripts/naming-entity-first.ts`
  (🔴 a breach; a rename is an ask)
- **agnix** — agent-config lint: frontmatter that strict YAML rejects, settings keys cc ignores, hook
  schemas · script, `npx -y agnix@<version> --target claude-code --format json .` from `~/frame`,
  read-only; on a test drive, `docs/test-drive/agnix.md` (its round goes there, and its known noise)

- **install-census** — what is installed and what is used, more often than a memory sweep (dima,
  2026-10-19: the system checkup runs more often than `recipes/nurture-memory`, which runs every 1–3
  months); judgment over counts, a `helper-lite` runs the counts (`duckdb` / `jq`):
  - **the census**: per skill, every scope (plugin, user `~/.agents/skills/`, project `.claude/skills/`, the marketplace plugins and the mods): fire count, last use, token cost, size, from the transcripts in two columns: real Skill calls (model and typed `<command-name>` loads) and reads by hand (a `Read` of a `SKILL.md`, or `cat`/`sed`/`head` on one in Bash; globs and greps excluded), so a skill run read-by-hand (matt's user-only ones, `advise-project-approach`) never shows as unused (dima, 2026-10-14); `/skill-doctor` is never the source, it overcounts ~10× (#92327)
  - **the install hunt**: everything installed, not only what fires as a skill (run #2 of the memory sweep missed the Context7 plugin: an MCP-only plugin fires no Skill call, so the census never saw it, while `rules/fleet-tooling.md` names `ctx7` as the docs door; dima, 2026-10-16: «next memory edit, we don't skip a hunt to delete not-used, stale, or stray marketplace-installed items»): `claude plugin list`, `claude plugin marketplace list`, `claude mcp list` and the folders under `~/.claude/plugins/cache/`, each with its `mcp__…` tool calls and Skill calls from the transcripts; a plugin or server whose job a door in `rules/fleet-tooling.md` or `rules/fleet-doors.md` already does, a disabled one, a marketplace with no installed plugin, and a cache folder with no install are 🔴
  - its ranked list goes to `~/frame/_clio/checkup/install-census.md`, rewritten each run, its log line pointing there
  - a 🔴 here is a removal, so it is always an orbit ask, one per item, never fixed in place; the memory sweep's prune step reads that list

- **recipe-candidates** — subjects that want a recipe, and stale recipes (dima, 2026-10-20, FRM-270) · a `helper`: research docs and trials that will be refreshed again, areas with a moving outside world, each recipe's last log date · list in `~/frame/.scratch/recipe-candidates.md`, each pick an orbit ask

colocated — checks that live elsewhere, run or read from here:
- **cli-purpose** — are the `x` verbs used, is a hand-typed command worth a verb · `pnpm x:cli-census`,
  judged through `cli-drift-check`; plus dima's side (FRM-41): his zsh aliases and functions, raycast
  scripts and pnpm scripts, each absorb / leave / delete with its invoker, use read from `~/.zsh_history`
  — his tools are `granular`, so a verdict here is always an ask
- **memory-lint** — budgets, dead pointers, cut quotes in memory files; warns on quote drift vs `HEAD`, dead
  paths, closed tickets beside pending words, 12-word repeats · runs at every commit
  (`recipes/nurture-memory/scripts/memory-lint.ts`); here its full run, `node <that path>`
- **pocket** — pocket drift · `node ~/frame/_clio/script/pocket-check.ts`
- **test-drives** — overdue or undated trials · `pnpm test-drive:check`
- **boot-digest** — settings symlink, repos vs origin, ci reds, sessions and worktrees, usage ·
  `BOOT_STRICT=1 ~/frame/_clio/.claude/hooks/boot-prefetch.sh`, its `🚨 FAIL` lines only
- **go-vulns** — `pnpm x-go:vuln`
- **evergreen** — renovate prs, brew and the apps lane · `clio:evergreen`, its newest report read; a whole
  checkup runs its gather (`references/read.md` § 1) without the full read

not here, on purpose: the memory content groom, `doctor prompt-audit` and `/skill-doctor` stay in
`recipes/nurture-memory` (dima, 2026-10-19: never duplicated).

## cadence — on trial

dima, 2026-10-19: «let's try a cadence and see if scheduled runs work with it. if it works, let's keep a
cadence; if not, I'll just switch it to a manual system checkup invocation».
every halt runs one check, the one longest since its last log line (`clio:halt` phase 3.3), so the
whole plate turns in ~2 weeks (dima's o59 tick). the fallback: the boot digest prints `DUE` once 7 days
pass with no log line at all, and a whole run is offered on the board, never run unasked. the trial:
`docs/test-drive/system-checkup-cadence.md`.

## completion criterion

every check in the list ran or printed `could not run`, each has its log line, every 🔴 is fixed or is
an orbit ask, and the board is the reply.
