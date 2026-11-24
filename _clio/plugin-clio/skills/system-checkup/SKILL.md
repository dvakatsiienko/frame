---
name: system-checkup
description: >-
  load on «system checkup», «checkup», «health check», «is our system healthy», «checkup <check>»,
  «sitting one» to «sitting four» — the one plate of every health check in the fleet, run in four
  sittings or one check at a time.
---

# /clio:system-checkup — the unification plate

dima, 2026-10-19: «whenever we want to know if our system is in good health, we go to the system
checkup flow, and it should have everything. it's a unification plate.» each check keeps its own home and
is listed here by pointer, never copied. `recipes/refresh-system-checkup/` sharpens the plate.

dima, 2026-11-24: «if everything that the system checkup asks for will be run at once, I think it will blur
the result … it is worth making this system checkup gradual … it shouldn't be too granular so we don't run
it for 2 days … it should also propose action items, not just tell numbers».

## the run — four sittings, one question each

- a checkup starts only on his word; nothing schedules it and nothing reminds him (dima, 2026-11-24: «remove schedule for system checkup»)
- **a sitting** runs its checks, then stops for his steer; the four fit one day, in this order: a broken thing blocks reading the rest, and each next sitting is cheaper to act on once the one before is clean. `checkup <id>` runs one check
- **a finding is fixed in place first** (dima, 2026-10-19: «prefer fix in place for checkup findings»): a
  freebie-sized fix lands inside the sitting. what is too big, needs his word, or destroys something (a
  worktree, a process, a plugin, a permission) is an action
- **a sitting ends in at most three actions**, each told as «you get, you lose», each an orbit ask with its fix; what is left beyond three shows as one line with its count, never parked unseen; everything healthy stays in the log
- a check that cannot run says so on its line, `could not run: <why>`, never a silent skip
- the log: one line per check per run in `~/frame/_clio/checkup/log.md`,
  `YYYY-MM-DD · <id> · 🟢 | 🔴 <what> · fixed: <what> | asked: <what> | —`; a check green for 90 days goes up for removal
- **a new check joins by naming the sitting whose question it answers**; a sitting holds at most six checks

## sitting 1 · running right — is anything broken now

- **hook-health** — hook latency and errors per hook over the last days of the local OTel tap ·
  script, `scripts/hook-health.sh [days]` (🔴 p95 over 1 s or any error, 🟡 over 300 ms)

- **boot-digest** — settings symlink, repos vs origin, ci reds, sessions and worktrees, usage ·
  `BOOT_STRICT=1 ~/frame/_clio/.claude/hooks/boot-prefetch.sh`, its `🚨 FAIL` lines only

- **pocket** — pocket drift · `node ~/frame/_clio/script/pocket-check.ts`

- **go-vulns** — `pnpm x-go:vuln`

## sitting 2 · current — is anything out of date

- **evergreen** — renovate prs, brew and the apps lane · `clio:evergreen`, its newest report read; a whole
  checkup runs its gather (`evergreen/references/read.md` § 1) without the full read

- **test-drives** — overdue or undated trials · `pnpm test-drive:check`

## sitting 3 · shaped right — is anything built the wrong way

- **skill-shape** — skills that would gain from a split into a reference file, a step a script should do,
  logic duplicated across skills · judgment, a `helper` card with the method and last run of
  `docs/research/skill-split-scriptify-scan.md` (deleted 2026-11-04, `git log` holds it); strength-3 items only, the rest stay in that doc

- **naming-family-first** — a family's shared word gone last · script, `node scripts/naming-family-first.ts`
  (🔴 a breach; a rename is an ask)

- **memory-lint** — budgets, dead pointers, cut quotes in memory files; warns on quote drift vs `HEAD`, dead
  paths, closed tickets beside pending words, 12-word repeats · runs at every commit
  (`recipes/nurture-memory/scripts/memory-lint.ts`); here its full run, `node <that path>`

## sitting 4 · worth keeping — is anything dead weight

- **install-census** — what is installed and what is used, more often than a memory sweep (dima,
  2026-10-19: the system checkup runs more often than `recipes/nurture-memory`, which runs every 1–3
  months); judgment over counts, a `helper-lite` runs the counts (`duckdb` / `jq`):
  - **the census**: per skill, every scope (plugin, user `~/.agents/skills/`, project `.claude/skills/`, the marketplace plugins and the mods): fire count, last use, token cost, size, from the transcripts in two columns: real Skill calls (model and typed `<command-name>` loads) and reads by hand (a `Read` of a `SKILL.md`, or `cat`/`sed`/`head` on one in Bash; globs and greps excluded), so a skill run read-by-hand (matt's user-only ones, `advise-project-approach`) never shows as unused (dima, 2026-10-14); `/skill-doctor` is never the source, it overcounts ~10× (#92327)
  - **the install hunt**: everything installed, not only what fires as a skill (run #2 of the memory sweep missed the Context7 plugin: an MCP-only plugin fires no Skill call, so the census never saw it, while `rules/fleet-tooling.md` names `ctx7` as the docs door; dima, 2026-10-16: «next memory edit, we don't skip a hunt to delete not-used, stale, or stray marketplace-installed items»): `claude plugin list`, `claude plugin marketplace list`, `claude mcp list` and the folders under `~/.claude/plugins/cache/`, each with its `mcp__…` tool calls and Skill calls from the transcripts; a plugin or server whose job a door in `rules/fleet-tooling.md` or `rules/fleet-doors.md` already does, a disabled one, a marketplace with no installed plugin, and a cache folder with no install are 🔴
  - its ranked list goes to `~/frame/_clio/checkup/install-census.md`, rewritten each run, its log line pointing there
  - a 🔴 here is a removal, so it is always an orbit ask, one per item, never fixed in place; the memory sweep's prune step reads that list

- **cli-purpose** — are the `x` verbs used, is a hand-typed command worth a verb · `pnpm x:cli-census`,
  judged through `cli-drift-check`; a red line writes one pocket item per 0-call verb through `pocket-add`; plus dima's side (FRM-41): his zsh aliases and functions, raycast
  scripts and pnpm scripts, each absorb / leave / delete with its invoker, use read from `~/.zsh_history`
  — his tools are `granular`, so a verdict here is always an ask

## apart — by name only, never inside a sitting

- **fleet-weak-spots** — the fleet's top 5 bottlenecks · five reads, plus tickets born from his wish against clio's proposal, counted · one page, an action and a proof number each; his reading of a spot replaces the page's · last page: `.scratch/fleet-weak-spots/`
- **operator-comms** — can he read what the fleet writes · `recipes/refresh-fleet-operator-comms/recipe.md`

not here, on purpose: the memory content groom, `doctor prompt-audit` and `/skill-doctor` stay in
`recipes/nurture-memory` (dima, 2026-10-19: never duplicated).

## completion criterion

a sitting: each of its checks ran or printed `could not run`, each has its log line, every small find is fixed, and at most three actions reached him as orbit asks. the checkup: his word after sitting four.
