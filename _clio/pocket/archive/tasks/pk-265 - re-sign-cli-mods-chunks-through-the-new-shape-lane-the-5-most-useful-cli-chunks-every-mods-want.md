---
id: PK-265
title: >-
  re-sign cli + mods chunks through the new shape-lane: the 5 most useful cli
  chunks, every mods want
status: done
assignee: []
created_date: '2026-10-23T15:17:00Z'
updated_date: '2026-10-25T11:44:00Z'
due_date: '2026-10-26'
labels:
  - m
dependencies: []
priority: next
type: task
ordinal: 99999
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the pm module revamp (PK-103) to settle — then one dedicated signing session.
after the pm module settles (PK-103), one dedicated session signs the lanes' chunks through the new cclio:shape-lane: the 5 most relevant cli chunks first, then every mods want, wish, wisp and rider chunked and signed so the mods lane resolves in one sequence. rebalancing chunks is allowed when it improves the execution order. inputs: the cli drift check + automation candidates and the stray hunt, copied whole into the notes. milestones: a lane = one milestone's signed chunks (dima o97), so the session also creates good milestones while it groups the chunks.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**waiting for:** the pm module revamp (PK-103) to settle — dima 18:16: «once we refine the pm module more … after we solve the pm module, we can re-sign chunks properly via a dedicated session».

2026-10-23 18:16 dima's drop, raw (prompts :547):
> ## 18:16
> 
> <pasted_content id="69eb">
> A good finding for processing old chunks into new signed chunks, but I think it isn't the right time to resign them via the new flow. Instead, let's proceed with the PM flow sharpening and do the resigning of chunks at a good point a little bit later. Postpone carefully because you currently found a lot of stuff. Carefully fold everything to be resigned, all chunks and all stray hunt findings, into a pocket item. Do not miss any info. Once we refine the PM module more, I don't know how much, because as you see, we found more issues and we may find more issues to fine-grain. After we solve the PM module, we can resign chunks properly via a dedicated session and fold this ticket about chunk resigning carefully and in proper order, as agreed before:
> 
> * First 5 most relevant chunks for CLI
> * All possible chunks for mods lane
> 
>  Mods lane should help all possible existing wants, contents, wishes, and wisps to be chunked and signed. Also, as for CLI, you can refold everything (e.g., rebalance chunks). Actually, for mods, it's the same. It's not mandatory, but only if it allows optimizing chunks' execution order. If you agree with my proposal about collocation with milestones in parentheses, or propose yourself another better option for collocation, then put a reminder into this chunks resigning ticket to create good milestones as well, if you collocate them properly.
> </pasted_content id="69eb">
> 
> --after you fold chunk signing ticket via new flow:

the plan, as agreed:
- the cli lane: the 5 most relevant chunks first, signed through the new shape-lane; the cli drift check below runs again right before that session if the code moved
- the mods lane: every existing want, wish, wisp and rider chunked and signed, so the lane runs as one sequence
- rebalancing (re-cutting, merging, splitting chunks) is allowed in both lanes, only when it improves the execution order
- milestones: a lane = one milestone's signed chunks, in its order, a joiner from the same milestone (dima o97) — create good milestones while grouping; the rule lands in craft-fleet-flow + craft-pm at the lane-init build
- the M-chunk trial (memory/_reminders.md): FRM-360 is sized M, a natural first test
- old prepped chunks (exit lines in the ticket) are invalid until re-signed: cli FRM-383, FRM-384, FRM-360, FRM-387; mods FRM-412, FRM-413, FRM-417; no exit lines yet: FRM-414, FRM-415, FRM-421
- linear fixes the hunt found: FRM-415 still Todo while its pocket twin PK-245 is done; FRM-409, FRM-410 are children of FRM-304 outside the mods milestone; PK-150 already built warn-only (x-mod-guard FTR.md:188)

=== the cli drift check + automation candidates, whole (researcher, 2026-10-23; from .scratch/cli-2/drift-and-automation-2026-10-23.md) ===
# cli drift check + automation candidates — 2026-10-23

Chunks under review: FRM-383 FRM-384 FRM-360 FRM-387 FRM-414 FRM-415. Inputs (all read 2026-10-23): `x/PRODUCT.md`, `pnpm --silent x:cli-census`, `x linear read <ids>`. Other evidence: `x stats --outside --days 7`, `~/.local/state/x/traces/*.jsonl`, `x/go/registry.json`, the flawlog files dated 10-16 to 10-23, the four cli-1 retros, `home/.claude/rules/fleet-hazards.md`. The step-3 helper read was done in this session, as the brief asked.

## census span

- verb runs: 2793 calls over 14 days of traces (2026-10-10 → 2026-10-23), dev calls left out. Callers: cc 1870, hook 804, other 115, dima 4. The span is under 30 days, so every 0-run verb below is **unproven**, not dead — census header, 2026-10-23
- raw heads: 14 days of cc transcripts, so those counts are firm. The 7-day cut (2026-10-18 → 23) is 7209 Bash calls, 520 of them x (7.2 %) — `x stats --outside --days 7`, 2026-10-23

## plan fit (want lines, x/PRODUCT.md:7–28)

- PRODUCT.md:7 «pnpm scripts … part of cli» (FRM-14): **partly** — the census is still `pnpm x:cli-census`, `x-cli-go:loc` still lives in pnpm (FRM-387 exit 3), and `pnpm mods:live` (65) and `pnpm ccrow:note-vet` (91) show up as raw heads over 14 days
- PRODUCT.md:9 «~60 methods … 90 % of the time any thread would refer to fleet CLI»: **partly** — 45 verbs in 14 families; x is 7.2 % of Bash calls over 7 days
- PRODUCT.md:11 «always-up-to-date CLI schema»: **met** — `x schema` 28 runs; the registry dispatches every verb (`x/go/registry.json`)
- PRODUCT.md:13 «automating repeatable operations»: **partly** — `lane commit` 297 and `linear read` 1038 are absorbed; `backlog` 546, `red-proof` 128 and `watch-once.sh` 80 are still raw (14 days)
- PRODUCT.md:15 «mindful what we fold»: **partly** — 9 verbs at 0 runs and 3 at 1 run (probe ×2, mods edit ×4, fleet audit, handoff delete, knowledge list = 0; knowledge read, lane rebase-main, lane review = 1), all unproven at 14 days
- PRODUCT.md:17 charm look «judged on my own terminal»: **partly** — dima drove x 4 times in 14 days; the board (FRM-387) and the frame (FRM-360) are both still Todo
- PRODUCT.md:19 «rethink, don't migrate one-to-one»: **met** — the families are entity-first, and red-proof plus the mutate rounds fold into one `x verify red` (FRM-383 decided, 2026-10-11)
- PRODUCT.md:21 «top-notch, perform, streamline»: **partly** — 11 plain `lane push` calls stopped at exit 4 «needs --apply», against 141 `--apply` runs (traces 10-16 → 10-23; `x/go/boards.go:198`)
- PRODUCT.md:23 «telemetry … dead weight … infographics in hq»: **partly** — traces and `x stats` exist (14 runs); the infographics board is not built (FRM-387); whether hq reads the traces was not checked «?»
- PRODUCT.md:25 who, «the fleet first, dima second»: **met** for the fleet (cc 1870); dima's share is 4 runs
- PRODUCT.md:26 job, «a fleet procedure becomes one verb»: **partly** — red-proof (128), the pr and ci watch (`watch-once.sh` 80) and the pocket (`backlog` 546) have no verb yet
- PRODUCT.md:27 job, «done by hand twice → a verb the third time»: **partly** — `x lane mutate` was asked for twice on 2026-10-23 (FRM-404 verifier retro:11, FRM-405 verifier retro:11), while FRM-383, which covers it, has sat in Todo since 2026-10-10
- PRODUCT.md:28 feel, «json contract … view dima enjoys»: **partly** — every verb prints the json envelope; the pretty view is unbuilt (FRM-387, FRM-360)

## families

- `lane`: **keep** — 12 verbs, 470 runs. Gap: `red-proof` 128 raw, which goes to the new `verify` family (FRM-383). The one-screen overview is full at 31 lines on 30 rows, so the next `lane` verb hits that wall (FRM-404 coder retro:7). Low runs, unproven: rebase-main 1, merge-main 1, review 1
- `handoff`: **keep** — 5 verbs, 96 runs; `delete` 0, unproven
- `brief`: **keep** — 2 verbs, 120 runs
- `linear`: **keep** — 9 verbs, 1631 runs. `linear api` 206 is the raw door working as designed. The `curl` heads (227) are not linear: in a 6-day transcript sample they went to wiki and docs hosts
- `fleet`: **keep** (unproven) — 3 verbs, 8 runs; `audit` 0
- `as`: **keep** — 1 verb, 37 runs
- `gh`: **keep** — 1 verb, 35 runs. Gap: `watch-once.sh` 80 raw (14 days), the pr and ci watch. The old door is still in use: raw `gh pr` ran 29 times over 7 days beside `x gh pr`. `gh api` 254 is mostly reads of third-party upstream repos (gh-stack, claude-code, TypeScript; 6-day sample), so it is no gap
- `probe`: **keep until day 30** — 2 verbs, 0 runs, unproven; the cut call is due ≥ 2026-11-09
- `knowledge`: **keep until day 30** — 2 verbs, 1 run, unproven; FRM-360 already moved its screen off `knowledge read` because of that count (FRM-360 decided, 2026-10-09)
- `schema`, `completion`, `stats`: **merge into `x`** — 3 one-verb families (28, 2, 14 runs); PRODUCT.md:81 drafts them as one `x` family (schema, stats, completion)
- `plugin`: **keep** — 1 verb, 79 runs. Gap: `claude plugin` 75 raw (14 days); which subcommands is not known «?» (the 6-day sample shows only `list` ×6)
- `mods`: **keep** (unproven) — 4 verbs, 0 runs. Gaps: `pnpm mods:live` 65 raw and `the old scratch editor (the `mods edit pull` replaced door)` 105 raw (14 days). `the old scratch editor (the `mods edit pull` replaced door)` is the old door that `mods edit pull` replaces (registry `replaces:`); `bin/the old scratch editor (the `mods edit pull` replaced door)` is gone from `plugin-x/bin` as of 2026-10-23, so those heads may be older calls or come from another path «?»
- no family: `backlog` 546 (14 days), 266 (7 days). This is the largest raw head with no family, and the gap behind candidate 3 below

## chunks

- FRM-383 `x verify red` (+ `--pairs`): serves PRODUCT.md:26, :27 and :13
  - fleet procedure: yes, the verify round
  - >1 surface: yes, coders and verifiers both red-prove (FRM-404 coder retro:15, FRM-404 verifier retro:7, FRM-405 verifier retro:8). This is an inference: a new verb has no caller data
  - hides a hazard: yes — a compile error read as red (2 of 13 and 3 of 19 mutations, verifier retros :7 and :8), a paid lane spent, a `| tail` reading green
- FRM-384 `x lane new`: serves PRODUCT.md:26
  - fleet procedure: yes
  - >1 surface: coders and verifiers, an inference
  - hides a sequence: yes, worktree add + seed. But `lane seed` (3 runs) and `lane verify-tree` (10) already exist, and no hand-made worktree shows up in the 7-day sources «?»
- FRM-384 `x lane restore`: serves PRODUCT.md:26
  - fleet procedure: yes
  - >1 surface: an inference
  - hides a hazard: yes, invariant 8. No sighting in the 7-day sources
- FRM-384 `x lane gate -- <cmd>`: serves PRODUCT.md:13
  - fleet procedure: yes
  - >1 surface: yes, coders and cclio (`tail` refusals: FRM-404 coder retro:5, FRM-405 coder retro:7; the pipe-tail trap: flawlog 10-18 lines 8 and 9)
  - hides a hazard: yes, the pipe exit and the 8k tail cap
  - **drift**: `lane gate` already exists as the commit-msg door (`x/go/registry.json`, «lane gate — commit-msg door»). The name collides; this verb needs a new one
- FRM-384 `x retro write`: **drift** — exits 3 and 8 aim at `~/.claude/shelf/retros/`, but retros now go to `~/.local/state/x/lanes/<feature>/` (`home/.claude/plugin-x/skills/crew-dna/SKILL.md:43`), a path outside every checkout that a worktree can already write. All four cli-1 retros landed there on 2026-10-23, and `~/.claude/shelf/retros` holds nothing. Rule answers: fleet procedure yes; >1 surface yes (coder and verifier); hides a location — the hazard the verb was meant to hide is gone, so cut it
- FRM-384 `linear body --set` size guard (`--shrink`): a fix to a shipped verb, one line, no rule answers; `--shrink` is not in `x/go` (rg, 2026-10-23)
- FRM-384 `x gh pr --merge`: **drift** — `x lane merge-auto` shipped with the same job, merging once checks are green (registry; 8 runs). Cut exit 6
- FRM-384 `lane commit` `Agent:` trailer: a change to a shipped verb, one line; not in `x/go` yet
- FRM-384 rider, `lane commit` waits on `index.lock`: already shipped (`x/go/lane.go:244`, `:267`; fleet-hazards.md:24) — drop the rider
- FRM-384 `brief check` mods-path flag: a change to a shipped verb, one line
- FRM-360 frame + `linear read` picker: serves PRODUCT.md:17 and :28
  - fleet procedure: no, it is a view for dima
  - >1 surface: no, dima only (4 runs in 14 days)
  - hides a hazard: no
  - fails the rule. Its own park trigger («until `x stats` shows dima driving x», FRM-360 decided 2026-10-10) has not fired
- FRM-387 stats board + `x stats --size --json`: serves PRODUCT.md:17, :23 and :7 (`x-cli-go:loc` leaves pnpm)
  - the board fails tests 1 and 2: a view, used by dima only
  - `--size --json` passes test 1, a fleet measure; test 2 is an inference; test 3 yes, it hides the old script
- FRM-414 `x lane review-fix <sha>`: serves PRODUCT.md:27
  - fleet procedure: yes
  - >1 surface: an inference (coders; the ticket names FRM-401 and FRM-403 coder retros of 2026-10-22, which are not in the lanes glob «?»)
  - hides a sequence: yes, coderabbit `--base-commit` + the cards
- FRM-414 `x looks shoot <cmd>`: serves PRODUCT.md:17 and :27
  - fleet procedure: yes for coders
  - >1 surface: an inference
  - hides a sequence: yes, pty + vt replay + freeze. One hand copy is on record (ticket body, 2026-10-22)
- FRM-415 `linear set --add-label` repeat: a bug fix, one line, no rule answers — labels lost twice (flawlog 2026-10-21 line 8; FRM-415 body, 2026-10-22)

**rank** (solves the most issues → helps the most → automates the most):

1. FRM-383 — 6 retro hits on 2026-10-23 (FRM-404 coder :15, verifier :7 and :11; FRM-405 coder :9, verifier :8 and :11) and 128 raw `red-proof` heads absorbed
2. FRM-384, after the re-cut — 4 tail/pipe hits (2 retros, 2 flawlog lines); `lane` has 470 runs
3. FRM-415 — 2 lost labels; `linear set` 62 runs; XS
4. FRM-414 — 2 hand-rolls (2026-10-22 retros, per the ticket); no hits in the 7-day sources
5. FRM-387 — 0 issues solved; the size view absorbs one pnpm script
6. FRM-360 — 0 issues solved; its park trigger has not fired

## three changes first (drift)

1. Re-cut FRM-384 before it is re-signed:
   - rename the gate runner (`lane gate` is taken)
   - cut `x retro write` (crew-dna SKILL.md:43 moved retros out of every checkout)
   - cut exit 6 (`lane merge-auto` shipped)
   - drop the `index.lock` rider (`lane.go:244`)
   — registry.json; crew-dna SKILL.md:43
2. Make FRM-383 cli lane 2's first chunk; the verifier retros already ask for its `--pairs` shape by name («x lane mutate», twice) — FRM-404 and FRM-405 verifier retros :11, 2026-10-23
3. Hold FRM-360 parked and seal FRM-387 only as the A/B shot + `--size --json`, since dima drove x 4 times in 14 days; merge `schema`/`completion`/`stats` into one `x` family on the way — census, 2026-10-23; PRODUCT.md:81

## automation candidates

1. **gate output to a log file, tail printed** (the FRM-384 `lane gate -- <cmd>` job, under a new name such as `x lane run`) — absorbs the `| tail` refusals, the pipe exit trap and the 8k Bash cap that hides errors at the tail. Passes the rule (fleet procedure; coders and cclio; hides a hazard) — `tail` 97 raw over 7 days (`x stats --outside`, 2026-10-23); FRM-404 coder retro:5 («a pipe hiding a gate exit»); FRM-405 coder retro:7 («`tail` naming git»); flawlog 2026-10-18:8 and :9 (pipe-tail exit trap ×2); 8k cap per the brief, 2026-10-23, count not measured «?»
2. **`x verify red` with build-failed ≠ red** (FRM-383) — absorbs the verifiers' hand-rolled `x lane mutate`. Passes all three tests — FRM-404 verifier retro:7 and :11, FRM-405 verifier retro:8 and :11, FRM-404 coder retro:15 (a syntax-error plant reads RED); `red-proof` 50 raw over 7 days, 128 over 14
3. **an `x pocket` family (edit, add, move, note)** that writes the task md directly — absorbs the ~80 s foreground `backlog task edit`, the zsh `$A` alias that ran nothing 9 times, the missing re-prioritise and the typed stamps. Passes: a fleet procedure; cclio plus wishkeeper write pocket notes (flawlog 2026-10-20:9); hides a hazard (slow foreground, the 99999 ordinal ceiling) — `backlog` 266 raw over 7 days and 546 over 14 (census); `backlog task edit` is the top subcommand (796 hits in 6 days of transcripts, duplicate tool records included); `node pocket-add.ts` 30 over 7 days; flawlog 2026-10-20:3, :4, :9; the 80 s figure per the brief, 2026-10-23, not measured «?»
4. **`x lane restack`**: merge each lower layer up into the next, then push — absorbs the per-layer switch/merge/push loop. Passes (fleet procedure for stacked lanes; coder, with the verifier re-checking; hides a sequence) — FRM-405 coder retro:4 (done 3 times) and :11; FRM-405 verifier retro:5; the guard refused a `for` loop naming a push (FRM-405 coder retro:7)
5. **`lane push` with no `--apply` stop on the session's own `coder/*` branch** — a change to a shipped verb. Passes (it already holds a verb; removes a wasted turn) — 11 plain `lane push` calls stopped at exit 4 against 141 `--apply` runs (traces 2026-10-16 → 23; `x/go/boards.go:198`); the brief, 2026-10-23
6. **`linear set` keeps every `--add-label`** (FRM-415) — a fix. Harm: labels lost twice — flawlog 2026-10-21:8; FRM-415 body (BYT-128 2026-10-21, FRM-414 2026-10-22)
7. **an `x key` door: read, check the kind, set** — `op read` with no masking trap, a missing item failing loud, and a prefix check before a set. Passes test 1 and test 3 (fleet-hazards.md:42 has no guard); test 2 is an inference — `op-run.sh` 32 raw over 7 days, 8 of them hand `OP_RUN_NO_MASKING=true op read`; flawlog 2026-10-18:8 (missing item printed EXISTS) and 2026-10-22:7 (a `user:` key set where a `service:` key was needed)
8. **`x flawlog add <tags> <text>`** (the `jev` family's flawlog, PRODUCT.md:81) — x writes the clock stamp, the dated path and one line shape. Passes (cclio and ccrow both log; hides a location and a format) — composed stamps, flawlog 2026-10-20:6 and :9; three line shapes across files (2026-10-16:3 «- 13:50», :5 «- 15:47 ·», 2026-10-20:3 «- ~14:01»)
9. **`x brief check` and the guard share one path parser** that skips slash commands, agent names and branch names — a change to a shipped verb plus a mods rule. Passes as a change — false «no such path» refusals: flawlog 2026-10-18:4 (`Explore.md`), 2026-10-20:5 (`/clear`), FRM-404 coder retro:5 (branch names)
10. **the worktree git-text refusals** (`github` in a heredoc, `for`/`tail` loops naming git) — fails as an x verb; this is an `x-mod-guard` allowance (a mods item). Candidates 1 and 4 absorb part of it — FRM-404 coder retro:5 (5 refusals, 3 of them `github`) and :11; FRM-405 coder retro:7 (~9 refusals, «no hazard behind it»)
11. **`x gh pr <n> --watch` that wakes only on a verdict change** — absorbs `watch-once.sh` pr-watch and ci-watch. Fails test 2 on current evidence: the hooks live in `cclio/.claude/hooks`, so cclio is the only surface (an inference); keep it a script fix (PK-256) — `watch-once.sh` 52 raw over 7 days; flawlog 2026-10-22:13 (~14 wakes in one night, half «no change»)
12. **`x lane review-fix` and `x looks shoot`** (FRM-414) — hand-rolled once each. Passes tests 1 and 3; test 2 is an inference. No hit in the 7-day sources; the evidence is the 2026-10-22 retros the ticket cites «?»

Seen once with no real harm, dropped:
- `--help` running a script — flawlog 2026-10-19:3
- `halt-sweep.ts` maxBuffer — flawlog 2026-10-21:13
- the `pocket-add` re-prioritise as a verb of its own — folded into 3

The railway delete with no guard (flawlog 2026-10-22:6) is a guard item, not an x verb. The other guard-none or unnamed lines in fleet-hazards.md (:18, :32, :38, :39, :41, :48, :56, :62, :66) and the partial ones (:24, :36, :37) had no sighting in the 7-day sources.

## top 3 changes to the cli lane

- **FRM-384 (re-cut)**: rename the gate runner and make it the answer to the `| tail` pipe and the 8k cap. Cut `x retro write` (crew-dna SKILL.md:43 moved retros), exit 6 (`lane merge-auto` shipped) and the `index.lock` rider (`lane.go:244`). Add a rider: `lane push` on the session's own `coder/*` branch runs with no `--apply` stop (11 stops, traces 10-16 → 23)
- **FRM-383 (first chunk)**: no change to the spec. Sign it first and cite the 2026-10-23 verifier retros (`x lane mutate` asked for twice; 5 of 32 mutations died on a compile error)
- **new ticket — `x pocket` family**: edit, add, move and note, writing the task md directly with the stamp from the clock. It absorbs `backlog` (266 raw over 7 days; `task edit` ~80 s in the foreground per the brief) and `pocket-add.ts` (30), and closes flawlog 2026-10-20:3, :4 and :9

<!-- end -->

=== the stray hunt, whole (helper, 2026-10-23; from .scratch/lanes-stray-hunt-2026-10-23.md) ===
# lanes stray hunt, 2026-10-23

Read-only hunt for planned work that belongs to the cli lane or the mods lane. Counts at the end of each section.

## cli lane

tickets (project «cli», open):
- FRM-14 standing story «personal cli mini-project», children FRM-405, 387, 384, 383, 43
- FRM-405 x lane commit riders, In Progress, lane 1 chunk 04 plus unsealed 04b (dupe of lane-plan.md:11, :26)
- FRM-383 x verify: red-proof and mutation as one door (dupe of PK-228 wait line, PK-94 chunk 1)
- FRM-384 x lane gaps: new, restore, gate, retro write, body guard (dupe of PK-94 chunk 2, PK-228 wait line)
- FRM-387 x stats as a charm board in FRM-360's frame (dupe of PK-94 chunk 3 pointer)
- FRM-360 a frame around every interactive screen, the cli 4 chunk (dupe of PK-94 rider)
- FRM-414 x lane review-fix and x looks shoot, two hand-rolled verbs
- FRM-415 x linear set: several --add-label keep only the last (dupe of PK-245, which is done while the ticket is Todo)
- FRM-43 our own coding app, build it or not (project cli, not an x verb)

pocket items:
- PK-94 cli big picture: chunks 1 verify, 2 lane gaps, 3 stats; `x linear body --set` refuses an empty file (line 24)
- PK-185 x mods edit park-paths: set unowned scratch aside, reset to main; waits for the cli lane
- PK-189 x mods edit test prints «overlay N paths differ from HEAD» header; waits for the cli lane
- PK-199 x spawn preflight in one verb: trust key, spare age, session name (with PK-74)
- PK-200 x handoff request target builds the peer message with CST SPEC inline (with PK-74)
- PK-201 x evergreen rows: one row per renovate pr (with PK-74)
- PK-228 cli lane 2 riders: pocket-note, commit --bump, test-drive status, pocket cap
- PK-242 cli lane: spawn verb running preflight steps 2–5, 7–12 plus brief gate
- PK-255 x transcript jumps: back-jumps, duplicate uuid ranges; waits for cli lane 2
- PK-258 isolated coder has no x lane door past a rebase conflict; needs design, cli lane 2
- PK-260 x plugin bump names live sidecars needing a reload; rides cli lane 2

strays (file only, no pocket item, no ticket):
- x lane stack restack, one call instead of switch/merge/push per layer: stray, `/Users/dima/.local/state/x/lanes/cli-1/2026-10-23-FRM-405-coder-retro.md:11`
- x lane mutate <tree> <file> <from> <to> <regex>, red/green/build-failed: dupe of FRM-383, `…/2026-10-23-FRM-404-verifier-retro.md:11` and `…/2026-10-23-FRM-405-verifier-retro.md:11` (asked twice; FRM-383 names `x verify`, not `x lane mutate`)
- merge-auto merges a stack atomically, github 403 on layer merge: stray, `…/cli-1/lane-plan.md:26` (unsealed 04b, FRM-405 is its host)
- lane overview test (31 lines on 30 rows) needs a decision before cli lane 2: stray, `…/2026-10-23-FRM-404-coder-retro.md:7` item 5
- x/AGENTS.md ## verify line: a fake for an external cli gets one assertion traced to upstream source: stray, `…/2026-10-23-FRM-404-verifier-retro.md:12`
- x/AGENTS.md ## verify line: a staged-path gate is probed with git mv and a staged delete: stray, `…/2026-10-23-FRM-405-verifier-retro.md:12`
- a stack lane brief says whether riders (another ticket's fix) are allowed: stray, `…/2026-10-23-FRM-405-verifier-retro.md:6` item 4
- a leftover `-N` branch on origin joins a new stack (P2, a look call for dima): stray, `…/2026-10-23-FRM-404-verifier-retro.md:9` item 7
- line in x/go/AGENTS.md on debug.ReadBuildInfo if a second build tag appears: stray, conditional, `…/2026-10-23-FRM-404-coder-retro.md:10` item 7

counts: tickets 9, pocket items 11, strays 9 (of which 1 dupe of a ticket)

## mods lane

tickets (project «fleet», standing story FRM-304, milestone «🐋 safer, quieter mods»):
- FRM-304 mods, the standing story (empty body by rule; wants moved to PK-120 note 14:55)
- FRM-409 x-mod-guard: an orbit tick counts as dima's word when the ask quotes every target (child of FRM-304, not in the milestone)
- FRM-410 glide reads the lane plan from ~/.local/state/x/lanes (child of FRM-304, not in the milestone)
- FRM-412 quiet ledger: a calm card, asks never raise it (milestone)
- FRM-413 x-mod-guard: a railway delete is refused (milestone)
- FRM-417 x-mod-guard: linear create in a project with milestones needs --milestone (milestone; dupe of PK-120 rider 10-23)
- FRM-421 mods: «while you were away» digest, Triage (milestone; PK-120 note 14:55 says cclio dropped the idea; dupe of x-mod-stash FTR.md:98)

pocket items:
- PK-120 mods lane resume, parent: riders for second-wind probes, evergreen borrows (1)–(6), scout race, tdd trial, upstream-skew reads
- PK-52 mods engine gaps, 7 upstream gaps watched (gap 4 dupe of PK-198)
- PK-79 knowledge files become must-read: the x-primer mod build, 7-day test drive
- PK-96 catch refinements: dima's refine heard when the mods lane is free; FRM-386 open per note
- PK-147 band wisp: a finished background agent still shows as running
- PK-148 x-mod-guard nudge toward helper-lite at the 3rd image Read
- PK-150 x-mod-guard refuse `backlog task edit --notes` on a task with notes (x-mod-guard FTR.md:188 already lists a warn-only version, check the gap)
- PK-157 ccrow, composer, designer git-tracked beside cclio; waits for PK-158
- PK-158 fork-guard: a cclio fork without confusing monitors; rider for the next mods coder lane
- PK-160 x-mod-stash several 🔭 holders under one «waiting on»
- PK-164 band 🔭 strip prints member names bold
- PK-168 re-ask catcher: shape-idea first, before the next mods lane
- PK-188 x-mod-guard hint: a pipe ending in jq before &&, curl -s without -f
- PK-192 mods-skew always checks the desktop app's bundled cc version
- PK-198 mod panes first-click workaround from #99395, now investigate and clear workarounds (dupe of x-mod-stash FTR.md:460 🐞)
- PK-204 orbit resolve check: a closing word says «as ticked» or «changed: …»
- PK-207 orbit: drop ask expiry from x-mod-stash (dupe of x-mod-stash FTR.md:506)
- PK-208 x-mod-guard hint when <script>.ts --help targets a script with no help flag
- PK-224 mods rider: reply-check flags a door claim with no source (dupe of gazette 10-20 state line)
- PK-225 mods rider: reply-check flags a 📄 stamp whose time is not the hook's now (dupe of gazette 10-20 state line, x-mod-stash FTR.md:91)
- PK-226 mods rider: delete the «held the foreground» hint
- PK-227 mods rider: orbit takes a batch of ops, one plan surface, a Stop check on wrap_up
- PK-257 x-mod-guard lets `git push --mirror` through
- PK-259 reply check flags a turn whose long text was not its last message
- PK-262 a mods-lane investigation: orbit asks arrive «accepted» several times
- PK-264 x-mod-holds wisp: an Edit refused by another guard still holds the file 30 min (dupe of FRM-405 verifier retro:9 item 7)

borderline, title names a mod or a mod panel but waits on something else, not counted: PK-144 changedetector board as a mod panel (free window), PK-234 cclio dual-mode, does an attached bg draw mods (waits for PK-103).

strays (file only, no pocket item, no ticket):
- x-mod-guard allowance for `github` inside a heredoc or `gh api` path in a worktree session: stray, `/Users/dima/.local/state/x/lanes/cli-1/2026-10-23-FRM-404-coder-retro.md:11`; same noise, ~9 refusals, `…/2026-10-23-FRM-405-coder-retro.md:7` item 5
- memory hook injects cclio/AGENTS.md when a skill script path sits under cclio/ (owner unclear, a hook not a mod): stray, `…/2026-10-23-FRM-405-coder-retro.md:8` item 6
- guard for an unknown cli probed with `<cli> <verb> --help`: only obsidian covered, "any other unknown cli, none": stray, `/Users/dima/frame/home/.claude/rules/fleet-hazards.md:36`
- a Bash write takes no x-mod-holds hold and fires no format hook: stray, `…/fleet-hazards.md:37`
- quiet comms «held pings» feature (4 🧭 lines, unbuilt or superseded; near ticket FRM-412): stray, `/Users/dima/frame/home/.claude/plugin-x/mods/x-mod-stash/FTR.md:653,660,664,668`

from the scope file `/Users/dima/frame/.scratch/mods-lane/scope-2026-10-18.md` (PK-183, PK-167, PK-149 and FRM-398 there are done, skipped; PK-150, 147, 160, 164, 79, 148, 168 already above):
- session version skew: a hook on an unknown event refuses the whole module: dupe of PK-120 note 10-16 (1) and PK-192, `scope-2026-10-18.md:14`
- one bad pane node refuses the whole pane, sanitize trees: dupe of PK-120 note 10-16 (2), `scope-2026-10-18.md:15`
- second wind submits /reload-skills after every compaction: dupe of PK-120 rider, `scope-2026-10-18.md:21`
- ❄️ for a cold-cache thread, not ⚠️: dupe of PK-120 wisp 10-15, `scope-2026-10-18.md:28`
- watched upstream gaps (button label, $.command.run, $.clock, first click, 2048 cap): dupe of PK-52, `scope-2026-10-18.md:46` (the 2048 cap is not in PK-52)
- a renamed plugin.json name breaks $.state, never rename a loaded mod without a state move: stray, `scope-2026-10-18.md:16`
- coder `step` lines into x:crew-coder and x:crew-lead so glide's ➡️ moves: stray, `scope-2026-10-18.md:20` (todo 6)
- absorbMarks replaces an ask steer with a remote mark's: stray, `scope-2026-10-18.md:26`
- x-mod-guard brief rule false fire on a `claude-code-guide` brief naming Explore.md: stray, `scope-2026-10-18.md:27`
- n8n to session bridge via ci_reds (parked by dima): stray, `scope-2026-10-18.md:30`
- `pnpm mods:replay` doc line overclaims, counts hints only: stray, `scope-2026-10-18.md:33`
- mods/AGENTS.md: biome outside the repo needs `--stdin-file-path`: stray, `scope-2026-10-18.md:34`
- x-mod-stash GLOSSARY Lane/Step, FTR glide cap 7, FTR 28 scroll unproven: stray, `scope-2026-10-18.md:35`
- 🔎/✅ pass over x-mod-stash FTR's ⬜ lines after the look: stray, `scope-2026-10-18.md:36`
- stash badge map and FTR:34/75 still name `Explore`, card is `scout`: stray, `scope-2026-10-18.md:37`
- DX: `x mods edit push --add` prints the repo-path form in its refusal: stray, `scope-2026-10-18.md:38`

counts: tickets 7, pocket items 26, strays 16

## stores searched

- the pocket: all 66 files in `/Users/dima/frame/cclio/pocket/tasks/` (the 5 done ones skipped), by wait lines, riders, titles
- linear: `x linear list --team FRM --search` for mod, guard, x lane, x linear, verb, cli (open tickets only); `x linear list --project cli`, `--project fleet`, `--milestone "🐋 safer, quieter mods"`; `x linear read FRM-304 FRM-14 --relations`
- lane plans and retros: `/Users/dima/.local/state/x/lanes/` holds only `cli-1/` (lane-plan.md, four retros, gh-stack-issue.md, which is an upstream bug report, no planned work); no mods lane directory exists there
- `/Users/dima/frame/home/.claude/rules/fleet-hazards.md`: only 5 «guard:» lines, two name a missing guard (36, 37), line 24 names a missing bytes index copy (a script, neither lane)
- gazette: `/Users/dima/frame/cclio/gazette/2026-10-20` to `2026-10-23` «state», «open» and «trail» sections; only the 10-20 line on the two reply-check riders and the 10-23 FRM-405 .DS_Store wait mention lane work
- mod FTRs: `x-mod-guard`, `x-mod-holds`, `x-mod-redact`, `x-mod-stash` FTR.md
- the mods scope: `/Users/dima/frame/.scratch/mods-lane/scope-2026-10-18.md` (46 lines, P0–P6 and the upstream-watch section); PK-167 and PK-183 checked in `cclio/pocket/archive/tasks/`, both done

Caller, check these:
- the ⬜ in the FTR legend (line 3) means «built, not checked yet», not «not built». I did not list the 76 ⬜ lines (stash 63, guard 12, redact 1). «Asked, not built» is 🧭 and «built, failing» is 🐞; I searched those. Say so if you want the ⬜ lines anyway.
- `x linear list --milestone` also returned FRM-1 (trial /goal), which is not mods work; left out.
- FRM-409 and FRM-410 are children of FRM-304 but not in the milestone.

2026-10-23 18:28 cli rider: `x brief preflight` reads the ticket's `## exit` (x/go/preflight.go:69-80); it should read the lane's spec. until then shape-lane-dispatch copies the exit lines into the ticket (its § 4 bridge).

2026-10-23 18:40 cli rider: `x lane merge-auto` has no door for dima's word — a self-edit always waits, so FRM-405's stack (exit 9) landed through `gh stack merge` after merge-auto's own checks passed. it needs a door for his word, and for a sign's pre-approval (dima's o96), e.g. a `--dima-ok <orbit id>` flag or reading the chunk's `## signed` merge line.

2026-10-23 18:44 cli rider, first live catch of FRM-405's quote gate: it flagged craft-fleet-flow's old stage-5 line as «[his line]» though it holds no «» quote of dima's — it only names «dima's pick»; the line was written by cclio's build fork the same day. the gate should key on «» quotes (or a `dima, <date>:` attribution), not on the word «dima's». + verifier's 6 next-chunk asks are in ~/.local/state/x/lanes/cli-1/2026-10-23-FRM-405-verifier-retro.md § for the next cli chunk.

2026-10-23 18:50 cclio, the 5 cli chunk candidates for the signing session (from the cli lane 1 retros, the coder's x architecture review and the drift check):
1. x stats sees everything (S): `unused` skips dev-build lines (stats.go:110), so 4 `mods edit` verbs read dead while traces hold 1,281 calls — coder's review #1
2. a faster x gate (S): 1 of 328 tests is t.Parallel; `x-go:test` reruns the whole suite under -tags nostacks (package.json:94) where `go vet -tags nostacks` already proves the seam; ~6 min a run today — coder + verifier
3. merge-auto riders (S): a door for dima's word or a sign's `merge: pre-approved` on a self-edit (merge_auto.go:161,198); the `expected_head_sha` check after the async submit (verifier, gh-stack merge_async.go:88); the first live one-call stack merge (FRM-405 exit 9, unproven)
4. FRM-383 `x verify red` / `x lane mutate` first (S): both verifiers hand-rolled ~35 mutations, 5 of 32 failed to compile and counted red — drift top 2 + verifier
5. FRM-384 re-cut (S): the gate runner needs a new name (`lane gate` is taken), cut `x retro write` and the `x gh pr --merge` exit, drop the landed index.lock rider, add `lane push` without `--apply` on the coder's own branch — drift top 1
held back: the `x pocket` family (M, drift top 3), split exec.go out of lane.go (XS) + one github door and one fake hub (S+M), `x lane stack restack` and `verify-tree --stack` (only if the stacked-prs trial goes on), probe bare/session (0 calls ever: point the rule at them or cut), `lane push` p50 22 s (frame's pre-push runner-twin)
sources: ~/.local/state/x/lanes/cli-1/x-architecture-review-2026-10-23.md, the FRM-404/405 coder + verifier retros beside it (verifier § for the next cli chunk)
done already: the `merged-by-x` label exists in frame and bytes

2026-10-23 18:56 cclio: dima 18:37 pulled the 5 cli chunks forward — they are signed right after the 18:5x second wind (o115); only the mods lane and the rest of the cli wait for the pm module. cli rider (shape-lane § 4, dima o109): a guard in `x linear body --set` refuses a write to a ticket labelled `signed` unless the body gains a `## signed` line.

2026-10-23 19:11 dima: plain and stacked pr modes both first-class, declared visibly (AGENTS.md, PRODUCT.md, FTR, docs), both covered by tests, so the pr flow never breaks. today the docs frame stacks as an optional, deletable trial (pr-flow.md:16, x/AGENTS.md:81, BYT-98). grill round 2: ~/frame/.scratch/dima-intervenes/runs/cli-sign-2-proposal.md

close: moved — FRM-424 carries this item (its body lists «pocket PK-265») (pocket migration, dima's o45, 2026-10-25)
<!-- SECTION:NOTES:END -->
