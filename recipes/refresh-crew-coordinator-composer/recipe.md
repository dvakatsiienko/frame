---
kind: refresh
owner: coordinator
artifacts:
  - home/.claude/plugin-x/skills/crew-composer/SKILL.md
  - docs/test-drive/composer.md
script: none
---

# refresh-crew-coordinator-composer

keeps cclio's editing sidecar (today: composer, Haiku 5.5) true: what cclio actually wastes context on, which of it composer takes, which of composer's chores graduate into scripts, and whether the sidecar still earns its place.

📌 on a test drive to 2026-10-21: dropped → this recipe is deleted with it.

## the want

- «your context grows too quickly, but i still want you capable of doing everything. so an experiment: offload your mechanical work to a sidecar. … you complete turns faster and clearer, you make fewer mistakes because chores stop distracting you, your context grows slower — fewer compactions. … your context and the sidecar's together grow roughly like your single one did, but split between two places, so the overall pace is calmer.» (2026-10-14, the full drop folded in `.scratch/composer-shape/PRODUCT.md`)
- «haiku can't think well, it only works well in a narrow, defined scope. how to use it best is yours to think through. … you verify haiku's work, and make that optimal.» (2026-10-14)
- «before sharpening composer through sql, research and prior art, one of the first steps should be finding what to optimize: a subagent or several that hunt where your context actually goes — the sifter just found most of it is Bash output.» (2026-10-14)
- «a quick refresh recipe for the sidecar: adopted and useful → we already have it shaped; it doesn't land → you just delete the recipe.» (2026-10-14)
- his standing calls: Haiku 5.5 medium, Sonnet 5.5 only for writing use cases later; one working dir, no worktrees; composer slipstreams its messages, never pushes; it consults cclio up front on a tricky spot instead of waiting for corrections.

## the run

- run rules: the hunt comes first and is numbers, never impressions; every finding gets one home (a composer chore, a script, a settings knob or habit, a guard); the consult reaches composer only through the charter's message shape
- suggest a run when: the test-drive verdict (2026-10-21), a compaction day (2+ compactions), a new Haiku or a cc change to `--bg` sessions or cross-session messaging

1. **groom** (step 0 of `x:shape-recipe`), with composer's self-report folded in: ping it «read `x:crew-composer` and your receipt log in `docs/test-drive/composer.md`; which chores did you fail, which briefs were unclear, what would you take next?». done: dima's word. (template)
2. **the hunt**: `sifter` agents (never general-purpose: no fleet memory) over cclio's transcripts since the last run, answering the analysis vectors with counts and the command that produced them. done: one numbers file in `last/`, every vector answered or «no data». (template)
3. **route**: each finding gets its home — a composer chore class, a graduation to a script or `x` verb, a settings knob or habit, a guard; nothing stays a bare finding. done: the routing list, one line per finding. (open)
4. **lanes, from one brief**, only for the vectors the hunt left open: `researcher` + `pnpm research:lanes`; `neuroarxiv` reads go to `sifter`/`researcher` agents. done: every lane landed or failed out loud. (template)
5. **the critical review**: keep, revamp, or retire composer, against the kill rules in the test-drive file. done: one verdict line with its numbers, never skipped. (open)
6. **distill** into the charter and the test-drive file; the findings print. done: printed, each change verdicted by dima. (open)
7. **log** today's line. done: `log.md` has it.

## vectors

### research

- who runs a cheap executor beside a strong lead, and what moved since the last run: Devin Fusion, aider architect/editor, Anthropic's advisor pattern turned around, cc's own background-session and cross-session features
- edit reliability of small models: anchor formats, merge failures on long files, verify-by-command patterns
- graduation: work that keeps passing on a model, turned into deterministic scripts (progressive crystallization and its kin)

### analysis

- where cclio's context goes: share by tool and by command kind (read · x verb · test · write · backlog · git), and the trend against the last run
- dead weight: big outputs never referenced again in the thread
- re-reads: one file read 2+ times in a session
- retry loops: a command rerun after a gate, hook or guard red, by gate
- subagent cost against value: tokens per agent call, results judged loose or unused
- skill steps skipped (the step-walk lines against each loaded skill)
- the 8k Bash cap: outputs that overflowed, and re-reads they caused
- context per closed pocket item, compactions per day
- composer's receipt log: first-pass green and rework per chore class; a class clean 5 runs in a row is a graduation candidate, a regressed one goes back to review
- the net: cclio tokens saved minus tokens spent briefing and verifying — the number no paper measures

## artifacts

- `x:crew-composer` (`home/.claude/plugin-x/skills/crew-composer/SKILL.md`) — composer's contract: chore classes, the brief and receipt shapes, the consult, the forbid list; its boot prompt
- `docs/test-drive/composer.md` — the trial: kill rules, the per-class receipt log, the rounds

## findings

done = the run happened (the `x:shape-recipe` rule). the print always carries the keep / revamp / retire verdict and the hunt's top 3 context sinks with their numbers. its checklist: every chore class in the charter (taken, clean, graduated, regressed), and the 8k Bash output cap (kept, moved, or dropped).
