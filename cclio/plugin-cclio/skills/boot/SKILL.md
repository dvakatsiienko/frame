---
description: load when dima types /cclio:boot or «cclio:boot», «cclio:init», «boot» — the coordinator's session-opening ritual; «mini» for a one-ask night, «board» / «full» for the tracker picture, any other argument names the handoff to ingest.
argument-hint: "[mini | board | <handoff slug>]"
---

# /cclio:boot

light boot by default. an argument that loosely means the full picture — «board», «full», or
similar — adds tracker orientation; any other argument is a handoff topic, ingested at step 4
(`/cclio:boot <slug>` is the whole opener — one skill per message is all the desktop box sends).
run silently, report as ONE opening message.

🎯 **the boot ORIENTS, it never resolves.** steps 1–8 are pure parse-and-assemble: no answers
written, no tickets touched, no inbox item worked. the opening board ends with a proposed
processing order and STOPS for dima's word. resolution then runs as labeled sub-batches with a
pit stop after each (`habit-dima-comms-pacing`); heavy queries fire at the step that needs them, never
up front. a query too fat for its pit stop → say so to dima instead of absorbing it.

## 1. healthcheck — the digest, not a ritual
the SessionStart hook printed `=== cclio boot digest · <time> ===` at the top of this context: handoffs,
inbox, x-queue head, the roadmap block, stuck reminders, live sessions · worktrees · coder prs, renovate
counts, repos vs origin, the settings symlink, the flawlog tail. **one shell round at most:**
- digest older than 30 min (its header time vs now — a `/clear` in the evening prints a digest that is
  stale by midday) or absent → re-run it: `BOOT_STRICT=1 ~/frame/cclio/.claude/hooks/boot-prefetch.sh`.
  fresh → zero shell rounds before the board.
- a `🚨 FAIL ·` line → report it FIRST, before any work. a check that could not run prints FAIL, never
  nothing — `=== all checks green ===` is the only green.
- barrel probe, no shell: name one fact that lives ONLY in a leaf body (the commit hash `d03f3da` in
  `sys-settings-drift` — it appears in no barrel line), silently: the board says «barrel probe ok»,
  never the hash, which the output rules ban in a reply. cannot name it → 🚨 the import chain broke;
  say so and read `memory/_MEMORY.md` by hand for this session.
- a new always-wanted check lands in the script, never in this file.

## 2. the roadmap block 🧭
the prefetch prints the linear initiative «roadmap»: its status and nine-line body, the attached
projects by start date (the step in progress), the dependency edges, and every open milestone
with its tickets in `sortOrder`. **that block is the answer to «what's next»** — name the step
and the next ticket from it; never re-query what it already printed.

## 3. inbox sweep 📬
_hq folder: `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian Dima's Vault/_hq`
- the digest says clean or «N content lines». non-empty → read `inbox.md` — cclio's personal email, **a plan source, never a work order.** EVERY item —
  smallest aside included — gets an item in the pocket (`~/frame/cclio/pocket.md`, its head says the format)
  and a place in its «order». the checklist line is the completeness
  guarantee; resolution is paced later. **deletion happens at the halt, never here.**
- empty → «inbox clean». marked FROZEN → do not touch, report frozen, move on.

## 4. continuity
- 📬 **pending handoff addressed to you → PULL IT NOW** via `/x:handoff-ingest`; a topic
  argument on the boot line (`/cclio:boot <slug>`) is that ingest's topic. never `ls` the
  store and read the file by hand — 🚨 **the skill DELETES on ingest, and that deletion is the
  point**; a CST read with `cat` stays pending and makes the store lie. one exception (the
  skill's): never ingest a CST addressed to another agent — report whose it is and leave it.
- active run id from the last CST META → continue it, never mint one mid-story. a CST marked
  FROZEN is not the active one.
- the digest lists live sessions and open `coder/*` prs; a coder alive with one → arm the merge monitor: a
  `Monitor` (`timeout_ms` at the 30-min max, re-armed on every expiry notice — `persistent` is gone since 2.1.271) polling `gh pr list --state merged --search 'head:coder/'` every 60 s and running
  `gprune -d` on each new merge — **only while the owning coder is idle** (`claude agents --json`
  status; busy → wait a tick, retry): a merge that races the coder's tail push had its worktree
  removed under a live push twice on 2026-09-08. dima merges, cclio cleans; the monitor dies
  with the session.
- 🐦‍⬛ **ccrow lives one cclio session**: `pnpm -C ~/frame ccrow:ensure` — it starts ccrow (today's arm, stash-only, 🔥 on) when none is live and answers «ccrow live» otherwise, so a second cclio never starts a second one.
- the x-queue head is in the digest — offer the top item; it never surfaces on its own. long-lived
  items are tickets, not park lines.
- 🧬 renovate counts + oldest age are in the digest → one board line. **PRs open, or the apps lane
  says DUE → fire the `/cclio:evergreen` digest as a fork DURING the boot**, report-only, and say
  so on the board; the report lands as its own message and waits for his word. it never queues
  behind the session plan (2026-09-21: it sat behind a 40-min flush until dima asked). zero and
  not due → say nothing.

## 5. stuck reminders ⏰📌
cclio's `⏰📌` reminders live in `memory/_reminders.md` and the boot digest prints each one; **raise
every one at every boot, unprompted** — that is the whole difference from an ordinary `⏰`. an answered stuck
reminder still surfaces; it dies only when dima says drop it. none → say nothing.

## 6. self-grill 🥊
print the 🥊 pair from the ingested CST's META — the halt wrote it while the flawlog flush had the
day's log open, so the boot reads no flawlog (dima, 2026-09-26: a boot starts unloaded from
settled lines). no CST, or no pair in it → skip the step. **two lines, last lines of the board:**

```
🥊 <the issue, one line>
➡️ <the approach, one line>
```

no evidence paragraph, no options, no quotes. **grounded or silent — never invent one.** nothing
real in the logs → skip the step entirely.

## 7. opening board
one message, short lines, **no queries here — pure assembly**:
- «hey <model> here» (the root claude.md rule)
- healthcheck verdict (one line if green)
- 📝 `flawlog: <path>` — the day's file from step 8, opened BEFORE the board is assembled; the line prints only once the file exists, so a skipped step 8 shows as a missing line (the 2026-09-23 miss: the file never opened all day)
- ⏰📌 stuck reminders, own line each (omit if none)
- inbox status · handoffs pending · queue depth + top item
- 📋 the proposed processing order — a numbered session plan, one line per item, with a
  `⛽ pit stop` line placed where a topic boundary earns one (only when it helps; dima,
  2026-09-11: «keep this habit») — the pocket's «order», lanes marked, sub-batches labeled;
  **the board ends here and waits for dima's word.** he corrects the parse before any work runs;
  a skipped question means the recommendation is accepted
- 🥊 self-grill, last line (omit if nothing real)

## 8. flaw capture 📝
open the per-session log at `~/.claude/shelf/flawlog/<YYYY-MM-DD>-<topic-slug>.md` — naming rule
and habits live in `/cclio:flawlog`, which loads alongside this boot.

---

## mini mode — `/cclio:boot mini`

the late-night boot: dima has one or two surgical asks, not a session. same silence, one opening
message, **no cst ingest, no pocket parse** — the inbox stays his file.

1. healthcheck (step 1, unchanged)
2. inbox: read only, propose the order of what he names; an item done in this session gets a ✅
   in place. nothing copied into the pocket, nothing folded
3. merge monitor — only when a coder with an open `coder/*` pr is alive (step 4's monitor line)
4. x-queue head + open renovate count (step 4's last two lines; the digest waits for his word)
5. stuck reminders (step 5)
6. self-grill (step 6)
7. flawlog file for the day (step 8; `/cclio:flawlog` loads alongside, as in a full boot)

skipped on purpose: the roadmap block, handoff ingest, the run-id continuity (a pending cst stays
pending and is named in the board, never pulled). the board ends with his asks in his order and
stops.

---

## board mode — `/cclio:boot board`

adds tracker orientation to the boot. **state is queried, never remembered** — a stored board
goes stale silently and gets read with confidence.

**one query serves the skeleton** (per-project counts blow linear's complexity cap — derive
counts client-side):

```
linear api 'query { teams(first: 10) { nodes { key name } } projects(first: 50) { pageInfo { hasNextPage } nodes { name state description } } issues(filter: { state: { type: { nin: ["completed","canceled"] } } }, first: 250) { pageInfo { hasNextPage } nodes { identifier project { name } parent { identifier project { name } } } } }'
```

- **skeleton**: one bullet line per project — project, state, open count, what it is for (the
  `description` is the payload). count no-project issues too; an unprojected ticket is invisible on every board.
- **milestones** — the first source of truth for «what's next»:

```
linear api 'query { projectMilestones(first: 50) { pageInfo { hasNextPage } nodes { name project { name } issues(first: 50) { nodes { identifier state { type } } } } } }'
```

  one line per milestone: `project · milestone · done/total`. ⚠️ flag on sight: a milestone with
  0 issues, and one whose done-count disagrees with the board — both mean nobody maintains it.
  📌 milestones are project-scoped; `Initiative` is the cross-project layer.
- **placement drift**: flag every open sub-issue whose project differs from its parent's. clean →
  one line. non-zero → list ids, do NOT fix unasked.
- ⚠️ **read both `pageInfo.hasNextPage` values before printing any number** — a capped page looks
  complete, and this has already produced two wrong counts.
- 📌 the class this cannot catch: two stories cutting one domain on different dimensions (DOT-184
  by artifact vs DOT-28 by channel). before creating or splitting a story, name the dimension it
  cuts on and compare against the stories already covering that domain.

---

## rules
- nothing in the global `x:*` family may assume this home exists.
- dima on mobile → nothing that can throw a permission dialog.
