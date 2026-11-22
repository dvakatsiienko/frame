---
description: load when dima types /clio:boot or «clio:boot», «clio:init», «boot»; «mini» for a one-ask night, «board» / «full» for the tracker picture, any other argument names the handoff to ingest.
argument-hint: "[mini | board | <handoff slug>]"
---

# /clio:boot

light boot by default. an argument that loosely means the full picture — «board», «full», or
similar — adds tracker orientation; any other argument is a handoff topic, ingested at step 4
(`/clio:boot <slug>` is the whole opener).
run silently, report as ONE opening message, after the two reviews (step 8); a harness «say what you're doing» nudge before it gets «booting, board next» and nothing more.

🎯 **the boot ORIENTS, it never resolves.** steps 1–8 are pure parse-and-assemble: no answers
written, no tickets touched, no inbox item worked. the opening board ends with a proposed
processing order and STOPS for dima's word. resolution then runs as labeled sub-batches with a
siesta after each (`habit-dima-comms`); heavy queries fire at the step that needs them.

📱 dima on mobile (his boot prompt says so) → read `x:mobile-mode` and run the session in it; it is user-only, so this line is its one automatic trigger.

🚦 **a spawn in the boot never ends its turn**: the board is the one stop (dima, 2026-10-29; guard: FRM-426). **no wing opens by default, pending flyways included** (PK-351:W80): a full boot opens one by `clio:wing` only on his word at the boot or a `summon wings: <which>` first-act in the CST, at the first possible point; fresh unless he says fork, a fork before the boot reads anything, and the boot runs on.

## 1. healthcheck — the digest, not a ritual
the SessionStart hook printed `=== clio boot digest · <time> ===` at the top of this context (its sections are the script's). **one shell round at most:**
- no `clio boot digest` and no clio memory in context → the tab's cwd is not `~/frame/_clio`: stop and tell dima to reopen it there, before any write (a boot from crow's dir fed her harvester)
- digest older than 30 min or absent → re-run `BOOT_STRICT=1 ~/frame/_clio/.claude/hooks/boot-prefetch.sh`; fresh → zero shell rounds before the board.
- a `🚨 FAIL ·` line → report it first, before any work; a check that could not run prints FAIL, and `=== all checks green ===` is the only green.
- the barrel probe (`method-silent-failures`), silently: the board says «barrel probe ok»; a miss → the move `method-silent-failures` holds.
- a new always-wanted check lands in the script, never in this file.
- 🎭 the output style `output-glados`: set by the surface leaf's door when the surface ignores the project `outputStyle`

## 2. the roadmap block 🧭
the prefetch prints the linear initiative «roadmap»: its status and nine-line body, the attached
projects by start date (the step in progress), the dependency edges, and every open milestone
with its tickets in `sortOrder`. **that block is the answer to «what's next»** — name the step
and the next ticket from it; never re-query what it already printed.

## 3. inbox sweep 📬
- the boot prompt itself, past its slash line, carries his wishes: `node script/prompt-groom.ts <its HH:MM>` rides helga's first chore, so the board plans from groomed lines
- non-empty → helga preps it first: start or revive **🎀 helga** right after the digest (the start
  command: `_helga/AGENTS.md` § how she starts and stops; a sidecar needs no `x:crew-lead`), send it an
  `inbox-prep` brief (blocking) that names the coordinator as `🦉 clio`, exactly as ListAgents prints it (a session id or the desktop title bounced its receipt, 2026-10-18), and do steps 4–5 while it runs; its receipt lands → read `inbox-helga.md`
  first, then `inbox.md` for the parse. step 8's wishkeeper brief adds the prep: every ask and idea of
  the raw inbox kept in meaning, not only present (the check proves presence alone); wishkeeper is the one meaning check, clio scores nothing
- the digest says clean or «N content lines». non-empty → read `inbox.md` (`/Users/dima/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian Dima's Vault/_hq/`, beside its sibling `inbox-helga.md` and the template `inbox-template.md`, his and read-only; `habit-dima-comms` holds the creed): EVERY item —
  smallest aside included — gets an item in the pocket (`node script/pocket-add.ts`; the contract: `habit-shared-files`), its fold one point per numbered W-line headed `PK-N:W<n> (<date> inbox, dima)` (`craft-pm` § wishes)
  and its `ordinal`, the checked prep copied to `~/.local/state/clio/grooms/<date>-inbox.groomed.md` (the groom check reads it), and its inbox line a leading `✅ PK-N` (the halt reset reads it); resolution paced later. **deletion happens at the halt, never here.**
- empty → «inbox clean». marked FROZEN → do not touch, report frozen, move on.
- a raw drop goes into its pocket item as one `raw drop (<day> inbox, dima): …` note per quote line, never two lines joined (notes are append-only, and a joined one reds the groom check for good)
- 🍴 flyway cleaned; a `clio-wing-<N>` pocket item stays that wing's until handed back; the board prints each wing's open count, «🍴 wing 1: N» (`backlog task list --labels clio-wing-<N> -s open --plain`), and lists a closed wing's items for main, sorted like an inbox drop

## 4. continuity
- 📬 **pending handoff addressed to you → PULL IT NOW** via `/x:handoff-ingest`; a topic
  argument on the boot line (`/clio:boot <slug>`) is that ingest's topic. never `ls` the
  store and read the file by hand — 🚨 **the skill DELETES on ingest, and that deletion is the
  point**; a CST read with `cat` stays pending and makes the store lie. one exception (the
  skill's): never ingest a CST addressed to another agent — report whose it is and leave it.
- active run id from the last CST META → continue it, never mint one mid-story. a CST marked
  FROZEN is not the active one.
- the digest lists live sessions and open `codie/*` or `coder/*` prs; codie alive with one → arm the merge monitor: a
  `Monitor` (`timeout_ms` at the 30-min max, re-armed on every expiry notice) polling `gh pr list --state merged --limit 200 --json headRefName --jq '.[] | select(.headRefName | test("^(codie|coder)/"))'` every 60 s and running
  `gprune -d` on each new merge — **only while the owning codie is idle** (`claude agents --json`
  status; busy → wait a tick, retry): a merge that races codie's tail push removes its worktree under a live push. clio merges and cleans; the monitor dies
  with the session.
- 🖥️ **the go-test vm starts with the boot digest hook**, its first line, in the background (FRM-551); `limactl list` shows it Running before the board; a down vm only sends go tests to the mac
- 📡 **the boot arms both watches, every time**: a project-scope plugin starts no monitors (cc docs, plugins/loading), so watch-pr and watch-ci run only when clio arms them; watch-ci is the only thing that wakes a turn on a new red, n8n's 🔴 ci watch is the record the digest reads, an n8n → mod bridge is parked (dima, 2026-10-18). the digest's `watches: N of 2 running` line counts them; arm each missing one as a one-shot background watch: Bash `run_in_background`, `~/frame/_clio/.claude/hooks/watch-once.sh ~/frame/_clio/.claude/hooks/watch-<pr|ci>.sh # deadline: 6 h inside the wrapper` — it ends on the first event line, so only a real event wakes a turn; after handling it, re-arm once, silently, and a no-event end is never a reply to dima. say so on the board. without watch-pr a cloud report branch lands in silence, and silence reads as «still running».
- 🦉 **crow and helga start by the surface leaf's door, from any thread; `--bg` is the fallback, said out loud** (dima, PK-363:W146–W148, W156; 2026-11-10: everyone the herdr way)
- 🐦‍⬛ **crow lives one clio session**, in either mode (`_crow/AGENTS.md` § how it runs): dima says he opened her desktop tab → `pnpm -C ~/frame crow:keep-cache-hot`; otherwise `pnpm -C ~/frame crow:start opus --pane`; without `--pane` it is the `--bg` fallback, a session on opus 5.5 medium that writes its own 🔥 key; it refuses when one already runs, which counts as up. the halt stops a `--bg` one. a pick-up of either sidecar after dima reinits it: crow boots from `_crow/AGENTS.md` + the `x:crew-adviser` charter, helga from `x:crew-helga`.
- 🐙 every upstream change the digest prints (a gh watch line, a changedetector watch changed since last viewed) is read during the boot — the new comments or the release notes — and the board carries one line each: what moved and whether it touches us, or «nothing that touches us», plus a proposed borrow for each that touches us, an orbit ask when it costs work (dima, 2026-10-23; 2026-10-16: «did you read them during the boot?»); a watch closed upstream, or whose fix ships in every cc we run (the desktop's bundled one included), dies here with `pnpm -C ~/frame x-changedetector:watch-remove <url>`, named on the board (dima, 2026-10-20)
- 🧬 a «🧬 evergreen turn» line in the digest → load `clio:evergreen` now and run its § the day: its read starts beside the boot, and the board's item 1 is the evergreen turn. any other day, open renovate PRs get one board line (count, oldest, a red one named).
- 📏 **a Monday boot: `weekly-wish-loss-audit` and `weekly-empty-wakes`, in the opening message, no ask** (PK-349:W1054–W1055): `node script/wish-cover.ts --audit-week`, `python3 -I script/empty-wakes-count.py <transcript> <monday ISO>`; numbers first, then for each poor number a proposed fix that makes the next count good
- 🐦‍⬛ **a Monday boot: `weekly-crow-grade`** (dima's o12, 2026-11-18): 5 of the week's sent crow notes from `~/.local/state/crow/notes.jsonl`, each with its catch's fix status and proof (fixed, partly, not, unknown: a `helper` card checks git and linear), one plain line each for his one-word grade, never orbit picks; the round lands in `docs/test-drive/crow-receipts.md` § the weekly grade
- 🦡 **a Tuesday boot: `weekly-retro`** (dima, PK-349:W1160, 2026-11-16 23:23, moved from Wednesday; 2026-11-07 replaced the per-lane ones): one `retro` card over the week's lane transcripts plus any filed `*-retro.md`, started at the boot; its interesting results print with the boot message, with action-item proposals as one orbit ask; at most 3 lines become work, picked by cost rank and the ≥3 gate, a ticket body line each, its diff in a comment, landed by that ticket's next lane, the rest die, and the filed files go to `trash`
- ⏸️ **the memory pass is not weekly for now** (dima, PK-349:W1160, 2026-11-16 23:23: «memory-pass is not weekly, I think, for now. I have too many chores.»): run on his ask, `pnpm -C ~/frame --silent memory:pass --out <scratch>/pass.md`, then one `helper` card judges its candidates through `recipes/nurture-memory/recipe.md` step 7's lenses, cutting only redundancy, never a step of an essential flow (dima, 2026-10-28: «prefer cuts in memory, but it doesn't mean that essential flows should die»); edits follow `habit-memory-edits` § the line, the proposals print in the thread with one orbit ask for the batch, and the savings (bytes before → after) go in the reply

## 5. reminders ⏰📌
the digest prints every `⏰📌` and every `⏰` whose `due:` has come; each gets its own board line (the `clio:remind` contract: a stuck one is raised at every boot, unprompted, and dies only when dima says drop it). none → say nothing.

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
and habits live in `/clio:flawlog`, which loads alongside this boot.

## 8. two reviews, then the opening board
**the board prints once, after both reviews are folded** (dima, 2026-10-12: «first gather all
reviews from wishkeeper and crow, only then print a plan»; the boot is the session's planning step):
- write the draft board to `~/frame/_clio/.scratch/boot-<YYYY-MM-DD>/board-proposal.md` — the write
  fires crow's `proposal` decision wake (`x:crew-adviser/scripts/decision.ts`), the whole thread in her packet: she
  checks the parse, the plan, and how clio read his prompt
- in the same step, `wishkeeper` 🐬 in boot mode at `effort: high`, with the raw inbox text, his
  boot prompt and each item's landing spot (pocket id, ticket, or answer): data loss of his drops is
  the worst outcome. its brief also asks three checks: every CST first-act sits in the board's plan; every question of his is
  answered on the board, never only routed to a pocket item; the board carries the stuck reminders and the
  roadmap line; a «🧬 evergreen turn» in the digest is the plan's item 1
- both reviews run in the background (cc 2.1.302: a desktop main-thread subagent always does), so neither holds the turn:
  beside the wishkeeper call, a Bash `run_in_background` wait on crow's notes file —
  `for i in $(seq 1 60); do [ "$(wc -l < ~/.local/state/crow/notes.jsonl)" -gt <count before the write> ] && exit 0; sleep 5; done; echo silent # deadline: 300 s`
  — then end the turn with no text; the two completion notices wake it, crow's note drains in as a peer message, and «silent» puts «crow silent» on the board
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
  **the board ends here and waits for dima's word.** he corrects the parse first; his word puts it in `flyway: main` (`flyway-done.ts --add`)
- 🥊 self-grill, last line (omit if nothing real)
---

## mini mode — `/clio:boot mini`

the light boot: no cst ingest, no lanes. same silence, one opening message; the inbox is parsed only on his ask (item 2).

**an eject from the main flow, and the economy boot** (dima, 2026-11-22; a weekly-near-cap day, or a few questions and a stop): solve what he raises; global plans hold.
- the handoffs are the next day's plan, never followed; grooming them is allowed (tweak, sort, plan, grill)
- a side question gets a plain cc answer
- it always ends in halt mini, even on a bare «halt»: the handoff is extended, never replaced
- **🎀 helga** starts on the first groom; **🐦‍⬛ crow** only on his ask (a full boot starts her as usual)
- no lane unless really needed; a **🐕 stray** only on a prepped batch, offered once enough chores pile up
- a no-work day pauses the clocks on his word: dated waits move by the lost days (`until:`, flyway `on:`, `⏰ due:`, dated trials); calendar-bound lines stay

1. healthcheck (step 1, unchanged)
2. inbox: optional. untouched by default: read only, his named items ordered, a done one ✅ in place, nothing copied or folded. his prompt asks to process it → step 3 runs whole (helga's prep, every item a pocket item) and step 8's wishkeeper reads the parse before the board (dima, 2026-11-15: «if asked to process inbox, full proper process, including wishkeeper»)
3. merge monitor — only when codie with an open `codie/*` or `coder/*` pr is alive (step 4's monitor line)
4. open renovate count (step 4's last line; the digest waits for his word)
5. stuck reminders (step 5)
6. self-grill (step 6)
7. flawlog file for the day (step 7)

skipped on purpose: the roadmap block, handoff ingest, the run-id continuity (a pending cst stays
pending and is named in the board, never pulled). the board ends with his asks in his order and
stops.

---

## board mode — `/clio:boot board`

adds tracker orientation: read [references/board.md](references/board.md) first — state is queried, never remembered. ⚠️ read both `pageInfo.hasNextPage` values before printing any number: a capped page looks complete.
