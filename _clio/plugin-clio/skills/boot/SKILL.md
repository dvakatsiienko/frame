---
description: load when dima types /cclio:boot or «cclio:boot», «cclio:init», «boot»; «mini» for a one-ask night, «board» / «full» for the tracker picture, any other argument names the handoff to ingest.
argument-hint: "[mini | board | <handoff slug>]"
---

# /cclio:boot

light boot by default. an argument that loosely means the full picture — «board», «full», or
similar — adds tracker orientation; any other argument is a handoff topic, ingested at step 4
(`/cclio:boot <slug>` is the whole opener — one skill per message is all the desktop box sends).
run silently, report as ONE opening message, after the two reviews (step 8); a harness «say what you're doing» nudge before it gets «booting, board next» and nothing more.

🎯 **the boot ORIENTS, it never resolves.** steps 1–8 are pure parse-and-assemble: no answers
written, no tickets touched, no inbox item worked. the opening board ends with a proposed
processing order and STOPS for dima's word. resolution then runs as labeled sub-batches with a
siesta after each (`habit-dima-comms`); heavy queries fire at the step that needs them.

📱 dima on mobile (his boot prompt says so) → read `x:mobile-mode` and run the session in it; it is user-only, so this line is its one automatic trigger.

🚦 **a spawn in the boot never ends its turn**: the board is the one stop (dima, 2026-10-29; guard: FRM-426). a side channel asked at the boot (a fresh thread usually, a fork when the job needs this thread) starts at the first possible point, a fork before the boot reads anything so it inherits the least, and the boot runs on.

## 1. healthcheck — the digest, not a ritual
the SessionStart hook printed `=== cclio boot digest · <time> ===` at the top of this context (its sections are the script's). **one shell round at most:**
- no `cclio boot digest` and no cclio memory in context → the tab's cwd is not `~/frame/_clio`: stop and tell dima to reopen it there, before any write (a boot from ccrow's dir fed her harvester)
- digest older than 30 min or absent → re-run `BOOT_STRICT=1 ~/frame/_clio/.claude/hooks/boot-prefetch.sh`; fresh → zero shell rounds before the board.
- a `🚨 FAIL ·` line → report it first, before any work; a check that could not run prints FAIL, and `=== all checks green ===` is the only green.
- the barrel probe (`method-silent-failures`), silently: the board says «barrel probe ok»; a miss → the move `method-silent-failures` holds.
- a new always-wanted check lands in the script, never in this file.
- 🎭 `set_session_output_style` (`self`, `output-glados`), then `get_session` reads it back: the desktop ignores the project `outputStyle`

## 2. the roadmap block 🧭
the prefetch prints the linear initiative «roadmap»: its status and nine-line body, the attached
projects by start date (the step in progress), the dependency edges, and every open milestone
with its tickets in `sortOrder`. **that block is the answer to «what's next»** — name the step
and the next ticket from it; never re-query what it already printed.

## 3. inbox sweep 📬
- non-empty → composer preps it first: start or revive **🎼 composer** right after the digest (the start
  command: `docs/test-drive/composer.md` § the start; a sidecar needs no `x:crew-lead`), send it an
  `inbox-prep` brief (blocking) that names the coordinator as `🦉 cclio`, exactly as ListAgents prints it (a session id or the desktop title bounced its receipt, 2026-10-18), and do steps 4–5 while it runs; its receipt lands → read `inbox-composer.md`
  first, then `inbox.md` for the parse. step 8's wishkeeper brief adds the prep: every ask and idea of
  the raw inbox kept in meaning, not only present (the check proves presence alone); wishkeeper is the one meaning check, cclio scores nothing
- the digest says clean or «N content lines». non-empty → read `inbox.md` (`/Users/dima/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian Dima's Vault/_hq/`, beside its sibling `inbox-composer.md` and the template `inbox-template.md`, his and read-only; `habit-dima-comms` holds the creed): EVERY item —
  smallest aside included — gets an item in the pocket (`node script/pocket-add.ts`; the contract: `habit-shared-files`), its fold one point per numbered W-line headed `W<n> (<date> inbox, dima)` (`craft-pm` § wishes)
  and its `ordinal`, the checked prep copied to `~/.local/state/clio/grooms/<date>-inbox.groomed.md` (the groom check reads it), and its inbox line a leading `✅ PK-N` (the halt reset reads it); resolution paced later. **deletion happens at the halt, never here.**
- empty → «inbox clean». marked FROZEN → do not touch, report frozen, move on.
- 🍴 a side channel's pocket items are taken over: `backlog task list --labels side --plain`, each `backlog task edit <id> --remove-label side`, sorted like an inbox drop

## 4. continuity
- 📬 **pending handoff addressed to you → PULL IT NOW** via `/x:handoff-ingest`; a topic
  argument on the boot line (`/cclio:boot <slug>`) is that ingest's topic. never `ls` the
  store and read the file by hand — 🚨 **the skill DELETES on ingest, and that deletion is the
  point**; a CST read with `cat` stays pending and makes the store lie. one exception (the
  skill's): never ingest a CST addressed to another agent — report whose it is and leave it.
- active run id from the last CST META → continue it, never mint one mid-story. a CST marked
  FROZEN is not the active one.
- the digest lists live sessions and open `coder/*` prs; a coder alive with one → arm the merge monitor: a
  `Monitor` (`timeout_ms` at the 30-min max, re-armed on every expiry notice) polling `gh pr list --state merged --search 'head:coder/'` every 60 s and running
  `gprune -d` on each new merge — **only while the owning coder is idle** (`claude agents --json`
  status; busy → wait a tick, retry): a merge that races the coder's tail push removes its worktree under a live push. cclio merges and cleans; the monitor dies
  with the session.
- 📡 **the boot arms both watches, every time**: a project-scope plugin starts no monitors (cc docs, plugins/loading), so pr-watch and ci-watch run only when cclio arms them; ci-watch is the only thing that wakes a turn on a new red, n8n's 🔴 ci watch is the record the digest reads, an n8n → mod bridge is parked (dima, 2026-10-18). the digest's `watches: N of 2 running` line counts them; arm each missing one as a one-shot background watch: Bash `run_in_background`, `~/frame/_clio/.claude/hooks/watch-once.sh ~/frame/_clio/.claude/hooks/<pr|ci>-watch.sh # deadline: 6 h inside the wrapper` — it ends on the first event line, so only a real event wakes a turn; after handling it, re-arm once, silently, and a no-event end is never a reply to dima. say so on the board. without pr-watch a cloud report branch lands in silence, and silence reads as «still running».
- 🐦‍⬛ **ccrow lives one cclio session**, in either mode (`_crow/AGENTS.md` § how it runs): dima says he opened her desktop tab → `pnpm -C ~/frame ccrow:keep-cache-hot`; otherwise `pnpm -C ~/frame ccrow:start opus` — a `--bg` session on opus 5.5 medium that writes its own 🔥 key; it refuses when one already runs, which counts as up. the halt stops a `--bg` one. a pick-up of either sidecar after dima reinits it: ccrow boots from `_crow/AGENTS.md` + the `x:crew-adviser` charter, composer from `x:crew-composer`.
- 🐙 every upstream change the digest prints (a gh watch line, a changedetector watch changed since last viewed) is read during the boot — the new comments or the release notes — and the board carries one line each: what moved and whether it touches us, or «nothing that touches us», plus a proposed borrow for each that touches us, an orbit ask when it costs work (dima, 2026-10-23; 2026-10-16: «did you read them during the boot?»); a watch closed upstream, or whose fix ships in every cc we run (the desktop's bundled one included), dies here with `pnpm -C ~/frame x-changedetector:watch-remove <url>`, named on the board (dima, 2026-10-20)
- 🧬 a «🧬 evergreen turn» line in the digest → load `cclio:evergreen` now and run its § the day: its read starts beside the boot, and the board's item 1 is the evergreen turn. any other day, open renovate PRs get one board line (count, oldest, a red one named).
- 🧹 **a Wednesday boot: the weekly memory pass, right after evergreen** (dima, 2026-10-16), ~20 min:
  - `pnpm -C ~/frame --silent memory:pass --out <scratch>/pass.md` (duckdb, ~7 s): the week's added lines narrowed to candidates — dupes with both homes, guard-enforced lines, lines over 350 chars, files ≥90 % of budget, dead pointers
  - one `helper` card judges only those candidates through `recipe.md` step 7's lenses, placement first; it cuts only redundancy (a dupe, a blob, an enforced clause), never a step of an essential flow (dima, 2026-10-28: «prefer cuts in memory, but it doesn't mean that essential flows should die»)
  - edits follow `habit-memory-edits` § the line; the proposals print in the thread, one orbit ask for the batch; the savings (bytes before → after) go in the reply

## 5. reminders ⏰📌
the digest prints every `⏰📌` and every `⏰` whose `due:` has come; each gets its own board line (the `cclio:remind` contract: a stuck one is raised at every boot, unprompted, and dies only when dima says drop it). none → say nothing.

## 6. self-grill 🥊
print the 🥊 pair from the ingested CST's META — the halt wrote it while the flawlog flush had the
day's log open, so the boot reads no flawlog (a boot starts unloaded from
settled lines). no CST, or no pair in it → skip the step. **two lines, last lines of the board:**

```
🥊 <the issue, one line>
➡️ <the approach, one line>
```

no evidence paragraph, no options, no quotes. **grounded or silent — never invent one.**

## 7. flaw capture 📝
open the per-session log at `~/.claude/shelf/flawlog/<YYYY-MM-DD>-<topic-slug>.md` — naming rule
and habits live in `/cclio:flawlog`, which loads alongside this boot.

## 8. two reviews, then the opening board
**the board prints once, after both reviews are folded** (dima, 2026-10-12: «first gather all
reviews from wishkeeper and ccrow, only then print a plan»; the boot is the session's planning step):
- write the draft board to `~/frame/_clio/.scratch/boot-<YYYY-MM-DD>/board-proposal.md` — the write
  fires ccrow's `proposal` decision wake (`_crow/decision.ts`), the whole thread in her packet: she
  checks the parse, the plan, and how cclio read his prompt
- in the same step, `wishkeeper` 🐬 in boot mode at `effort: high`, with the raw inbox text, his
  boot prompt and each item's landing spot (pocket id, ticket, or answer): data loss of his drops is
  the worst outcome. its brief also asks three checks: every CST first-act sits in the board's plan; every question of his is
  answered on the board, never only routed to a pocket item; the board carries the stuck reminders and the
  roadmap line; a «🧬 evergreen turn» in the digest is the plan's item 1, with the Wednesday memory pass right after it
- both reviews run in the background (cc 2.1.302: a desktop main-thread subagent always does), so neither holds the turn:
  beside the wishkeeper call, a Bash `run_in_background` wait on ccrow's notes file —
  `for i in $(seq 1 60); do [ "$(wc -l < ~/.local/state/crow/notes.jsonl)" -gt <count before the write> ] && exit 0; sleep 5; done; echo silent # deadline: 300 s`
  — then end the turn with no text; the two completion notices wake it, ccrow's note drains in as a peer message, and «silent» puts «ccrow silent» on the board
- fix every finding of both, then print the board (dima, 2026-10-13: «gather everything, fix their findings, only then print the report») — the boot's first and only reply. nothing prints
  before it: no «waiting on» line, no partial board
- completion: one reply holds the whole board, both reviews folded in
the board, one message, short lines, **no queries here — pure assembly**:
- «hey <model> here» (the root claude.md rule)
- healthcheck verdict (one line if green)
- 📝 `flawlog: <path>` — the day's file from step 7, opened BEFORE the board is assembled; the line prints only once the file exists, so a skipped step 7 shows as a missing line
- ⏰📌 stuck and due ⏰ reminders, own line each (omit if none)
- inbox status · handoffs pending · pocket depth + top item
- 🧭 the prefetch's roadmap board, copied as it prints (dima's template, 2026-10-25), plus `🧾 status drift fixed: <from → to>` when this turn fixed one; a step named in plain words, never a bare number (dima, 2026-10-23)
- 📋 the proposed processing order — a numbered session plan, one line per item, with a
  `🌤️ siesta` line placed where a topic boundary earns one (only when it helps; dima,
  2026-09-11: «keep this habit») — the pocket's order (`backlog task list --plain --sort ordinal`), then the main lane's open linear tickets, top milestone first, lanes marked, sub-batches labeled;
  **the board ends here and waits for dima's word.** he corrects the parse before any work runs
- 🥊 self-grill, last line (omit if nothing real)
---

## mini mode — `/cclio:boot mini`

the late-night boot: dima has one or two surgical asks, not a session. same silence, one opening
message, **no cst ingest, no pocket parse** — the inbox stays his file.

1. healthcheck (step 1, unchanged)
2. inbox: read only, propose the order of what he names; an item done in this session gets a ✅
   in place. nothing copied into the pocket, nothing folded
3. merge monitor — only when a coder with an open `coder/*` pr is alive (step 4's monitor line)
4. open renovate count (step 4's last line; the digest waits for his word)
5. stuck reminders (step 5)
6. self-grill (step 6)
7. flawlog file for the day (step 7)

skipped on purpose: the roadmap block, handoff ingest, the run-id continuity (a pending cst stays
pending and is named in the board, never pulled). the board ends with his asks in his order and
stops.

---

## board mode — `/cclio:boot board`

adds tracker orientation: read [references/board.md](references/board.md) first — state is queried, never remembered. ⚠️ read both `pageInfo.hasNextPage` values before printing any number: a capped page looks complete.
