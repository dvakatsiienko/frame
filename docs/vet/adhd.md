---
dies-when: adhd is adopted as a user-only skill or dropped after the vet week (2026-10-05)
---

# adhd — parallel divergent ideation, on vet

Ticket: none

**what:** [UditAkhourii/adhd](https://github.com/UditAkhourii/adhd) 0.1.4 — 5 isolated frame branches, then a critic that scores, flags traps and deepens the top 3. same author as `neuroarxiv`.
**installed:** plugin `adhd@adhd`, cclio project scope (`cclio/.claude/settings.json`). the user-only lock is open: `skillOverrides` never reaches a plugin skill.
**window:** 2026-09-28 → 2026-10-05. verdict on 10-05: adopt (keep, user-only) or drop (uninstall + marketplace remove).

## the protocol, every round

- **only real open asks** — naming, a design fork, a fuzzy bug with no known cause. never a lookup.
- **a baseline beside it:** the same ask, answered once by plain opus in the same session, before the adhd run.
- **blind pick:** dima gets both as A/B (order random), picks one, grades 0–10.
- **measure:** wall seconds · 5h window % before/after (`~/.claude/shelf/usage.json`) · ideas surfaced · traps named · whether the pick shipped.
- **auto-fire watch:** any adhd load dima did not type is a miss, logged here.

## the lock — proven 2026-09-28

`permissions.deny: ["Skill(adhd:adhd)"]` in `cclio/.claude/settings.json`: cclio's own Skill call returns «blocked by permission rules», dima's typed `/adhd:adhd` expands. the description stays in the skill listing (~100 tokens resident); the deny only stops the call.

## candidates — real asks only, from the reset on

- the `crew-designer` four phases, and the 10 atelier looks
- the shift model's «what's missing, what to harden» pass — a failure-mode hunt
- a fuzzy bug with no known cause — BYT-88 refetch, the barrel-probe false red
- **atelier art** (`x:art-kit` illustration branch):
  - **scene concept, before the brief** — frames give distinct concepts (paper-cut stage, cartographer's map, picture-book spread, game level, one colour $0); the critic kills literal icons, readme-width clutter, the already-done; 3 concepts deepened into the brief shape, 3 takes, dima picks
  - **technique hunt, the biggest lever** — frames as media (linocut, risograph, stained glass, isometric voxel, embroidery); each branch proposes one technique rule the way `trace()` is one; the critic keeps what can be written as seeded code → new atelier recipes
  - **stall critics, the pattern not the skill** — at a stall (the same verdict two rounds in a row), isolated critics read the screenshot under one lens each: silhouette at 16 px, value contrast, colour harmony, composition and leading line, edge craft; a merge pass ranks. the stock skill's branches get text only, so this is an `art-kit` loop variant, written only if the vet holds
  - cost placement: once per scene or recipe; per render round is too expensive. the reference image is the critic's fence
- not bytes naming (dima: the frame rename settles first)

## rounds

<!-- date · ask · a/b winner · grade · wall s · 5h % delta · shipped? · note -->

- **r1 · 2026-09-28 · name `~/.claude/shelf/usage.json`** — the skill procedure run by hand (the deny blocks cclio's Skill call; dima's typed run put the body in context). calibration «name this»: 3 frames × 4 ideas (game design · 3am on-call · 10-year-old), fresh `general-purpose` agents, deepen skipped for a name. **cost: ~94k tokens per branch, 6–8 s each, 282k total — 5h +1 %, week +1 %**; the output was ~150 tokens per branch, the rest is substrate (claude.md + rules reloaded per branch). baseline: `rate-limits.json` (cclio), `cc-usage.json` / `cc-fuel.json` (dima). adhd shortlist: ★ `allowance-jar` · `sline-limits`; traps: `pace-ghost` (the file holds limits, not pace), `nap-clock`, `headroom-5h-7d` (bakes the window set into the name), `*-bar` (a bar is the render, not the data). a/b winner: pending dima · shipped: pending · note: `sline-limits` is the angle the baseline missed (name the writer, so a frozen file points at sline); `allowance` is the word the baseline missed (a budget that refills on a set day)
