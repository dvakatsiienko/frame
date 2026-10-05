---
dies-when: adhd is adopted as a user-only skill or dropped after the test-drive week (2026-10-07)
---

# adhd — parallel divergent ideation, on a test drive

Ticket: none

**what:** [UditAkhourii/adhd](https://github.com/UditAkhourii/adhd) 0.1.4 — 5 isolated frame branches, then a critic that scores, flags traps and deepens the top 3. same author as `neuroarxiv`.
**installed:** plugin `adhd@adhd`, cclio project scope (`cclio/.claude/settings.json`). the user-only lock is open: `skillOverrides` never reaches a plugin skill.
**window:** 2026-09-28 → 2026-10-07. verdict on 10-07: adopt (keep, user-only) or drop (uninstall + marketplace remove).

## the protocol, every round

- **only real open asks** — naming, a design fork, a fuzzy bug with no known cause. never a lookup.
- **a baseline beside it:** the same ask, answered once by plain opus in the same session, before the adhd run.
- **blind pick:** dima gets both as A/B (order random), picks one, grades 0–10.
- **measure:** wall seconds · 5h window % before/after (`~/.claude/shelf/cc-usage-window.json`) · ideas surfaced · traps named · whether the pick shipped.
- **auto-fire watch:** any adhd load dima did not type is a miss, logged here.

## the lock — proven 2026-09-28

`permissions.deny: ["Skill(adhd:adhd)"]` in `cclio/.claude/settings.json`: cclio's own Skill call returns «blocked by permission rules», dima's typed `/adhd:adhd` expands. the description stays in the skill listing (~100 tokens resident); the deny only stops the call.

## the doors — measured 2026-09-28

- **cli** `adhd` 0.1.4 (`pnpm add -g adhd-agent`, not in brew): runs on the claude login (no `ANTHROPIC_API_KEY` in env, exit 0), **~18.5k tokens per call** — the agent-sdk session skips claude.md, rules and memory. a 1 × 3 × 1 probe took 22 s. 9 of its 12 session transcripts carry zero usage, unexplained. run it from a neutral dir: `cd <scratch> && adhd "<problem>" --frames N --ideas N --top N --json --quiet`
- **skill by hand** (`Agent` tool branches): **~94k per branch** — a subagent inherits the coordinator's loaded stack whatever its cwd
- 🚫 `claude -p --bare` skips all memory but takes api-key auth only, never the subscription login
- the default door is the cli; the skill only when a branch needs this session's context

## candidates — real asks only, from the reset on

- the `crew-designer` four phases, and the 10 atelier looks
- the shift model's «what's missing, what to harden» pass — a failure-mode hunt
- a fuzzy bug with no known cause — BYT-88 refetch, the barrel-probe false red
- **atelier art** (`x:art-kit` illustration branch):
  - **scene concept, before the brief** — frames give distinct concepts (paper-cut stage, cartographer's map, picture-book spread, game level, one colour $0); the critic kills literal icons, readme-width clutter, the already-done; 3 concepts deepened into the brief shape, 3 takes, dima picks
  - **technique hunt, the biggest lever** — frames as media (linocut, risograph, stained glass, isometric voxel, embroidery); each branch proposes one technique rule the way `trace()` is one; the critic keeps what can be written as seeded code → new atelier recipes
  - **stall critics, the pattern not the skill** — at a stall (the same verdict two rounds in a row), isolated critics read the screenshot under one lens each: silhouette at 16 px, value contrast, colour harmony, composition and leading line, edge craft; a merge pass ranks. the stock skill's branches get text only, so this is an `art-kit` loop variant, written only if the test drive holds
  - cost placement: once per scene or recipe; per render round is too expensive. the reference image is the critic's fence
- not bytes naming (dima: the frame rename settles first)

## rounds

<!-- date · ask · a/b winner · grade · wall s · 5h % delta · shipped? · note -->

- **r1 · 2026-09-28 · name `~/.claude/shelf/usage.json`** — the skill procedure run by hand (the deny blocks cclio's Skill call; dima's typed run put the body in context). calibration «name this»: 3 frames × 4 ideas (game design · 3am on-call · 10-year-old), fresh `general-purpose` agents, deepen skipped for a name. **cost: ~94k tokens per branch, 6–8 s each, 282k total — 5h +1 %, week +1 %**; the output was ~150 tokens per branch, the rest is substrate (claude.md + rules reloaded per branch). baseline: `rate-limits.json` (cclio), `cc-usage.json` / `cc-fuel.json` (dima). adhd shortlist: ★ `allowance-jar` · `sline-limits`; traps: `pace-ghost` (the file holds limits, not pace), `nap-clock`, `headroom-5h-7d` (bakes the window set into the name), `*-bar` (a bar is the render, not the data). a/b winner: pending dima · shipped: dima picked his own `cc-usage-window.json` (neither baseline nor adhd) · note: `sline-limits` is the angle the baseline missed (name the writer, so a frozen file points at sline); `allowance` is the word the baseline missed (a budget that refills on a set day)
- **r2 · 2026-10-01 · name the public speak app** — NOT a skill round: dima typed `/adhd:adhd` in a fresh frame session, but the plugin is enabled at cclio project scope only, so the session answered «`/adhd:adhd` isn't installed in this session» and named by a plain opus ask (blurt, earful, yap, spiel, earshot, earmark, hark, readout, lilt, audiate). verdict: miss on both plain lists, dima: «i did not liked neither suggested option. the closest are lilt and yap. but still meh» · wall s and 5h % not measured · shipped: no · note: a typed adhd round runs only in a session under `~/frame/cclio`; a naming round also needs the brief to carry what the product feels like, not only what it does
- **r3 · 2026-10-02 · name the design comms app (`design-*`)** — the cli door, 5 frames × 3 ideas × top 3, 55 s, 5h +1 % (4 → 5). baseline (plain opus, same session, written first): ballot · loupe · forge · pins, pick `design-loupe`. adhd shortlist: ★ `design-parley` · `design-ring` · `design-pin`; traps: `design-asks` (too literal), `mailbox` (misses the spatial part), `latch` (binary, not a queue). a/b winner: baseline, blind · grade: baseline 7–8.5 per name, adhd 6 flat · shipped: `design-loupe` (the baseline pick) · note: adhd found the literal ring angle the baseline missed, but no name above the baseline's best
- 2026-10-05 · naming the fleet cli (real ask) · cli door, 5 frames × 6 ideas, concurrency 2 (the default 4 died: «Claude Code process exited with code 1», a tiny probe passed) · 75 s · 5h window 21 → 22 % · 24 ideas, 13 traps · blind A/B: A = adhd (tap, nod, cil, via, kit), B = opus baseline (x, bosun, rig, tack, mate, crew) · dima liked from both: x, tap, nod, cil (+ his own xc, nd) — no single pick yet, no grade
- 2026-10-05 · naming the fleet's delivery flow (real ask, wayfinder) · skill door (dima typed `/adhd:adhd`), 5 sonnet frames × 6 ideas in parallel (game design · logistics · 10-year-old · biology · remove-the-assumption), each 7–18 s; scoring + clusters + the top-3 deepen done in-context (a naming ask; the deepen agents skipped — calibration) · 30 ideas, 5 traps (stage, dock, digest, myelin, pass) · baseline (plain opus, written first, seen by dima): runway · relay · loom · track · tempo · kiln · forge · groove · shipyard → pick loom or track · adhd top 3: porch · arc ★ · bench · not blind (dima saw the baseline before the run) · dima's pick: neither — «fleet flow» stays for now («did not liked neither»); arc ★ was adhd's, loom/track mine
