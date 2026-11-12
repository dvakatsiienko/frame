---
dies-when: FRM-368 is built or canceled
---

Ticket: FRM-368

# FRM-368 — the want and the surfaces

working notes of the side channel, grill round 1. goes into the ticket once dima answers.

## the want, folded from dima's 2026-11-04 drop

- N1 the side channel works well: main clio is almost always busy, with the main lane or with side lanes' chores
- N2 active side lanes make a lot of noise; during yesterday's shift main clio was busy almost all the time
- N3 clio handling the side lane and the main lane at once is too much: it blurs the main lane and distracts both clio and me
- N4 her context gets cluttered the same way
- N5 her context grows too fast, so she compacts too often
- N6 rebalance: split today's clio in two. the main lane (planning, ticket creation, the other chores) stays with clio; side lane activity moves to another thread
- N7 it is a new crew member: a coordinator, a codie and a sixth sense per lane form a crew
- N8 a new lane: clio shapes the chunk and the spec and dispatches it, to a coordinator thread that loads crew-lead
- N9 the coordinator checks the spec clio prepped is valid, starts codie, guides it, watches progress, solves its blockers
- N10 once codie is ready, the coordinator spawns sixth sense and guides the lane until it is ready to merge
- N11 ready to merge → it pings main clio for a decision
- N12 the flow stays exactly as today; only coordination and lane comms move to a thread responsible purely for coordinating the crew
- N13 edge cases are all over the setup today; ideally every roadblock, ask to me or dispute is lifted through the coordinator to clio
- N14 open: who does ticket operations, and how; other changes, to be grilled
- N15 the main contract is sharpened in crew-lead
- N16 clio keeps the ability to coordinate herself: both modes work, clio as coordinator like today, or clio starts a cap thread and delegates; both bulletproof
- N17 ❓ how to have it, across more than a few surfaces, efficient and optimized

- N18 side lanes, shift lanes and quick lanes all get cap. i still see mods live; mods lanes are quick lanes and make lots of noise too; even with the slipstream fix they load the main lane with chores
- N19 cap mode is experimental and risky, habits drift everywhere: it must not ruin the current clio working model and must be easy to revert
- N20 ❓ what is cap allowed to do, and what not
- N21 ❓ which skills and memories does cap have
- N22 ❓ where is it summoned: always in the planned lane's dir, or in its own dir like clio, crow and helga; does it have its own `AGENTS.md`
- N23 ❓ who verifies cap's work, and how; does it need something like wishkeeper or wisphunter
- N24 ❓ how does cap's second wind work: same as clio's; is the lane parked meanwhile
- N25 clio and cap support a single side lane and multiple side lanes (multiple caps) at once
- N26 ❓ a shift assumes much management by clio: the 5h window, pausing and resuming everyone during a second wind, the hot switch and waker mods. who does all this with caps

- N27 cap-only lines live apart from what clio always reads; crew-lead changes only with cap in mind, until the shape shared by clio and cap settles ❓ a subfile, or a new crew-cap skill pointing at crew-lead
- N28 cap is parked in frame beside crow, helga and clio, its folder underscored and git tracked, not in local ❓ why a folder over the lane's dir
- N29 keep-cache-hot always on for coordinators, at least to catch a coordinator parked with no actions
- N30 ❓ cap second winds itself at about 60 % of context; maybe every fleet member watches its own second wind and does it itself, written in the global rules, which unloads the chore from clio and cap
- N31 multiple side lanes at once are rare, but possible
- N32 designer lanes are rare and stay tied to clio for now; cap is a capable mechanical coordinator
- N33 ❓ does a blueprint want to outline cap too
- N34 ❓ which other parts of the fleet need a refresher with cap: groom and rerun the coordinator recipe aimed at cap. it was sharpened against clio; both are supported until we measure whether cap works, and this run's research points at the cap model: how to make a pure coordinator work, since cap does nothing else
- N35 ❓ crew-lead was made for clio as shared pm, tech, cto and coordinator: what is redundant in it for a pure coordinator
- N36 cap is test driven for 2 weeks through shape-test-drive, by clio herself

- N37 ❓ coder and verifier are told to report to clio: how do both modes work, when clio coordinates a lane it reports to clio, and with a cap everyone reports to cap and cap reports to clio
- N38 ❓ does one cap folder support multiple caps at once, any clash risk
- N39 second wind notice: at about 55 % it tells the thread its context will soon be too high, it is not forced to wind at once; the thread parks and solves its tails first, then winds, and picks up gracefully with no data loss
- N40 cap needs its own linear app, to tell it apart
- N41 dima drew a mock on a board, to merge into cap's drawing

- N42 second wind: the thread hears at 55 % that 65 % is the upper allowed boundary; at 65 % a second wind is a must
- N43 the cap blueprint: clio just draws it herself
- N44 the linear app needs a new avatar for cap
- N45 cap is an mvp name: two top-7 sets of names and emojis, one a cool name matching the role like codie, one not tied to a real word

- N46 ❓ maybe one dedicated tilde handles all side lanes at once, instead of one tilde per crew; it just offloads coordination out of clio. a single --bg tilde stays in mind
- N47 split the plan in two: first apply the best practices from everything we planned to the current clio, where applicable; then implement tilde on top of what is already done
- N48 the role is opus 5.5, medium or high, dima votes medium. a weak coordinator is a no, a strong one a yes
- N49 ❓ tilde should reach wishkeeper: before sending a result to clio, before each chunk is ready to merge, tilde runs wishkeeper first. both clio and tilde have wishkeeper, is it doable
- N50 there is a window to test FRM-501; we are not forced to test tilde at once
- N51 a hierarchy costs turns, but spamming clio's thread costs too: tokens, dima's attention, clio's attention blur
- N52 tilde talks to clio only when needed
- N53 tilde relays without rewording. a tilde request to clio means clarification, maybe a re-sign ask, never a blind action: clio verifies her decision's precision, may check with the crew directly, may interfere and even take the lane over
- N54 a held-ping path for tilde too. ❓ a context meter for members: dima thought any thread can measure its own context; if the meter means an automated mod like 🔋 pace watch, have it
- N55 reading code: dima leans to allowing tilde to read anything; how else would a coordinator catch mistakes
- N56 context: the 🔋 pace watch mod now tells clio to park at +5 % over the 5h pace

from the drawing: clio does the main lane, manages and talks to cap; cap does the side lane and reports lane progress to clio; codie and sixth sense act as before but talk to cap.

already in the ticket: W421–W425, the 2026-10-07 and 10-16 lines.

## surfaces, read from the code on 2026-11-04

### already mode-neutral

- `crew-lead/SKILL.md` opens «clio below means whoever coordinates»
- the codie brief opens `coordinator: <name>`
- sixth sense takes the coordinator's registry name as an argument

### lines naming clio or the coordinator, to reword

- `crew-lead`: SKILL 17, spawn-mechanics 10, watching 7, shared-tree 5, impeccable-refine 5, briefing 5, models 3
- `crew-codie`: SKILL 15, how-you-work 5, stacked-lane 1
- `crew-sixth-sense`: 12
- `crew-dna`: 11

### rules that live only where cap cannot load them

- `clio:*` skills do not resolve outside `_clio` (`clio:shape-idea` came back «Unknown skill» from this worktree, 2026-11-04)
- `_clio/memory/craft-fleet-flow.md` holds the lane stages; cap must not boot in `_clio`, its memory rebrands the session
- `node ~/frame/_clio/script/check-idle.ts`, named in `crew-lead/watching.md`, is a plain script and reachable

### code gates keyed to the exact name 🦉 clio

- `x-mod-stash/hooks/register.tsx:326,4018`: only 🦉 clio writes the 🛼 glide
- `x-mod-stash/hooks/register.tsx:1032`: only clio's thread holds `[progress]` pings for her next turn
- `x-mod-guard/hooks/register.ts:94,1314,1332`: raw linear calls and body writes refused for any other name
- `x/go/linear.go:27-48`: any other session name acts as `codie` in linear
- `x/go/brief_summon.go:234-240`: the sixth sense argv says «clio», wording only

### clio's half, a fork per mode

- `shape-lane-dispatch` § 5 and § 6
- `shift`, `siesta` (2.5 ends lanes, its triggers read member pings), `pm` `references/closing.md`
- `craft-fleet-flow` stages 5 to 8
- rules, on dima's word: `fleet-flow.md`, `fleet-identity.md` (cap reads «coming»), `fleet-mods.md`, `fleet-vibe.md`

### wakes that land on clio today

- `_clio/.claude/hooks/pr-watch.sh` and `ci-watch.sh`: wake clio when a pr opens, on a new commit, when green (`crew-lead/briefing.md` § the pr)
- `notify_when_idle` on members: dies on a compact, re-armed by `shift-recompact.sh` for clio only
- `home/.claude/shelf/hooks/crew-recompact.sh`: re-init by role, needs a cap row

### role lists beyond the skills, to check in the spec

- code naming sixth sense (30+, the grep was capped): `x/go/brief_summon.go`, `fleet_flow.go`, `fleet_ops.go`, `keys.go`, `registry.json`, `merge_auto.go`, `lane_landed.go`, `script/shift-checkup.ts`, `_clio/script/siesta-gate.ts`, `_clio/.claude/hooks/boot-prefetch.sh`, `script/lib/agent-trailer.ts`, `script/retired-names-check.ts`
- docs: `docs/knowledge/pr-flow.md`, `fleet-ops.md`, `fleet-operator-comms.md`; `clio:halt`; recipes `refresh-pr-flow`, `refresh-fleet-operator-comms`, `refresh-fleet-ops`
- blueprint: `_clio/blueprints/excalidraw/crew-pm-flow`

### crew-lead against a pure coordinator (estimate from a read, 2026-11-04)

- a summon reads 38.5k chars, about 10k tokens: `SKILL.md` 12k, `briefing.md` 8.1k, `models.md` 6.8k, `watching.md` 7.2k, `shared-tree.md` 4.4k
- pm and cto live in clio's memory (`craft-pm`, `habit-cto`), not here
- not cap's: `design.md`, `impeccable-refine.md`, `references/card-craft.md`, `spawn-mechanics.md` as a read; cloud, `/fork` and `/btw` doors; desktop thread start (ccd tools, inference: absent under `--bg`); design and fable lines in `models.md`; helga, research and comparison brief lines in `briefing.md`
- rough share: a quarter to a third of a summon's read

### homes, as they are

- `_crow/` and `_helga/` hold tracked files; both sessions boot in `~/.local/state/<name>/`, with `bgIsolation: none`
- `_clio/` is the only home a session boots inside
- token cost of a repo's `AGENTS.md` at boot: frame 9.4k chars, bytes 11.3k chars, about 2.5k tokens

### notes

- `op second-wind` needs only `pending: none` and a handoff in the store, no press (`x-mod-stash/hooks/register.tsx:2682-2711`)
- no member skill says how a member reads its own context %; the mod holds each session's fill for the board
- a keep-hot ping ends in a one-character reply today, so it detects nothing
- a `--bg` session draws no board (`rules/fleet-mods.md`); a member's asks still show on the glide card
- the crew preflight never reads the 5h pace (FRM-368 notes), and clio reads it at every summon today
- this side channel's own linear actor reads as `codie` for the same name-gate reason
