---
name: system-checkup
description: >-
  load on «system checkup», «checkup», «health check», «is our system healthy», «checkup <check>»,
  or when the boot digest says the checkup is due — the one plate of every health check in the fleet,
  run whole or one check at a time.
---

# /cclio:system-checkup — the unification plate

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
- the log: one line per check per run in `~/frame/cclio/checkup/log.md`,
  `YYYY-MM-DD · <id> · 🟢 | 🔴 <what> · fixed: <what> | asked: <what> | —`. a check's «last red» is the
  newest 🔴 line for its id there, derived, never kept by hand; a check green for 90 days goes up for removal
- the reply is one board: 🔴 first with what was fixed, then 🟡, then one count line of greens

## the checks

own — the checks this plate runs itself (scripts sit in `scripts/` beside this file):
- **skill-shape** — skills that would gain from a split into a reference file, a step a script should do,
  logic duplicated across skills · judgment, a `helper` card with the method and last run of
  `docs/research/skill-split-scriptify-scan.md`; strength-3 items only, the rest stay in that doc
- **hook-health** — hook latency and errors per hook over the last days of the local OTel tap ·
  script, `scripts/hook-health.sh [days]` (🔴 p95 over 1 s or any error, 🟡 over 300 ms)
- **agnix** — agent-config lint: frontmatter that strict YAML rejects, settings keys cc ignores, hook
  schemas · script, `npx -y agnix@<version> --target claude-code --format json .` from `~/frame`,
  read-only; on a test drive, `docs/test-drive/agnix.md` (its round goes there, and its known noise)

colocated — checks that live elsewhere, run or read from here:
- **cli-purpose** — are the `x` verbs used, is a hand-typed command worth a verb · `pnpm x:cli-census`,
  judged through `cli-drift-check`
- **memory-lint** — budgets, dead pointers, cut quotes in memory files · runs at every commit
  (`recipes/nurture-memory/scripts/memory-lint.ts`); here its full run, `node <that path>`
- **pocket** — pocket drift · `node ~/frame/cclio/script/pocket-check.ts`
- **test-drives** — overdue or undated trials · `pnpm test-drive:check`
- **boot-digest** — settings symlink, repos vs origin, ci reds, sessions and worktrees, usage ·
  `BOOT_STRICT=1 ~/frame/cclio/.claude/hooks/boot-prefetch.sh`, its `🚨 FAIL` lines only
- **go-vulns** — `pnpm x-go:vuln`

not here, on purpose: the memory content groom, `doctor prompt-audit` and the skill census stay in
`recipes/nurture-memory` (dima, 2026-10-19: never duplicated); the dependency news stays in `cclio:evergreen`.

## cadence — on trial

dima, 2026-10-19: «try a cadence and see if scheduled runs work. works → keep it; doesn't → manual».
the boot digest prints `checkup: last run <date>` and `DUE` once 7 days have passed since the log's
newest line; a due checkup is offered on the board, never run unasked. the trial:
`docs/test-drive/system-checkup-cadence.md`.

## completion criterion

every check in the list ran or printed `could not run`, each has its log line, every 🔴 is fixed or is
an orbit ask, and the board is the reply.
