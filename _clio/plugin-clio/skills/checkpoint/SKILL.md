---
description: load when dima types /clio:checkpoint, says «checkpoint», or warns that we switch topic and he wants the thread thinned without losing state.
argument-hint: "[what to drop, comma-separated]"
---

# /clio:checkpoint [drop …]

**the trigger is his: his word, or a 🐦‍🔥 second wind press on my sessions row**, its note slipstreamed into my next turn — he watches the context himself (dima, 2026-10-21); while he is afk, a shift or not, the trigger is mine at about 55 % context, never past 60 %, `clio:shift` § surviving a compaction. **a half-halt, no exit.** frees the thread of a finished topic while everything else survives —
the same guarantees as a halt, minus the goodbye. dima's spec: as few steps as possible; memory as precise as possible after the resume; only the unwanted absent. the drop list is mine to decide, no approval round: «when you run checkpoint, just print me a compact prompt upfront, saving a turn».

📌 who runs the compact: me, always — his plain word or a 🐦‍🔥 press ends with the stash tool's `second-wind` op naming the CST slug, and the mod runs the compact + ingest at that turn's end; he clicks nothing (dima, 2026-11-11).

## 0. finish the topic, then stop taking new work

- **in a shift** (`clio:shift` § surviving a compaction): the topic is the current step, members keep working and are carried, the flawlog flush and the after-pickup move go into the plan's `## log` for the report, and the compact door is the `second-wind` op with the CST slug
- **a 🐦‍🔥 second wind is graceful, never urgent** (dima, 2026-10-14: «a request, not an ask to do it as soon as possible … gracefully prepare yourself: resolve all subagents and park all stuff before compacting, to avoid data loss») — the same for codie's second wind
- **the topic in flight finishes whole first** (dima, 2026-10-15: «fully resolve composer and leave no tails, because splitting the composer part into two parts between compaction is not a good idea»): every lane and agent it started lands, its findings fold, its distill, print, log and commit run — however long that takes. the checkpoint starts only at the end of a topic, never in its middle
- **only a topic not yet started waits**: it goes to the CST as a first-act; the small open tails close first (an ask whose answer is known, an uncommitted fix, a reply a member waits on), and the wishkeeper of the batch being closed is always waited for, never carried

- **the after-pickup move goes to orbit at once**, mid-turn too: «right after the pickup i'd do X» as an ask he can tick before the reset
- **no notice goes out**: `x-mod-stash` holds every message sent to a compacting thread, any sender and any tag, and releases them whole and in order into the first turn after the compact (FTR.md § second wind, FRM-519 14j; his o141). the roster still goes into the CST
- **main only**, since the file pauses crow for every clio: `touch ~/.local/state/crow/paused`, every wake skips while it exists; a wing's compact wakes her on its own thread.

## 1. the keep/drop list — decided, never asked

- every session topic is **kept by default**; a topic drops only when a file already holds its
  outcome (a doc, a ticket, a commit, the flawlog), and its CST line names that file
- with args (`/clio:checkpoint drop notes bench, the #67 rounds`): his list wins, mine adds to it
- the list rides the CST's `# D` section, each drop with its file; no separate proposal turn
- always kept, unlisted: the boot ingest, every open ask, the codie roster, the day's done asks, the flawlog habit, plus my own pending suggestions and the pocket state (a done ask stays so a sent thing never comes back as «never sent»)

## 2. land, same as a halt's middle

- inbox: every item has a pocket item — then it gets a `✅ ` prefix IN PLACE, text and headers
  intact, nothing deleted (the inbox survives a checkpoint so he can diff it; the halt resets it from `inbox-template.md`). the mark tells him what is handled; the resume diff below
  tells me what is missing
- flawlog flush: one batched proposal, his one approve, execute (halt phase 3a)
- milestones refreshed (halt phase 3.5)
- gazette: `/clio:gazette` writes the ⸻ upd block; **no wire** unless he says so
- **the codie roster**: retro received? still needed? a codie that is done is parked and carried on the roster with its id; stopped only on his word

## 3. the CST — fuller than a halt's

`/x:handoff` to the store, slug `<runid>-checkpoint-<n>`. on top of the halt CST:

- **the keep list verbatim**: each inbox item and where it went, each open ask in dima's words
  — the details that matter and his stylistic asks kept, typos and sleepy slips fixed, fluff
  dropped (probe 1 scored 6.7: facts kept, details trimmed),
  each hot topic with its current state and next move
- **the drop list as pointers**: one line per dropped topic naming the file that holds it — a
  dropped topic is reachable, never remembered
- the codie roster with ids and status
- the orbit asks as they last stood (orbit itself survives the compact in the mod's state)
- **his chat lines since the last report**, each with its answer or «open»: `node ~/frame/_clio/script/chat-lines.ts --since-stamp` prints his typed lines and orbit steers since the last `📄 last report` stamp; an «open» line becomes a first-act, and the pickup answers each
- **a running recipe** (a memory sweep above all): META first-act 1 is its re-entry rule, «read `recipes/<name>/recipe.md` whole and follow its re-entry»; it also names the brief the recipe was born from, and a step that needs its own session names that session

## 3.5 the CST check — before the op

`wishkeeper` 🐬 reads the CST draft against the live state: every open orbit ask, every chat line of his since the last report, every open pocket item, every unfinished groom-list line and each member's queue is present; nothing done is carried as open; a step that needs a fresh session says so as a first-act. each finding is folded into the CST before it is saved.

## 4. the second-wind op

no fence: the `second-wind` op with the CST slug, and the reply says the reset runs at this turn's end; the mod compacts, then ingests the CST on top of what the compact kept. **then** a bare `SendMessage` with `notify_when_idle: true` and no message to each member i coordinate (a compact drops every idle subscription, silently), and on main `trash ~/.local/state/crow/paused` — then read what the hold released. **after the ingest, before anything else: re-read `inbox.md` and
diff it against the pocket** — every inbox item must carry the `✅` mark AND a pocket item with
its details; an unmarked or detail-less one is restored from the inbox on the spot, out loud; then `clio:flyway-sync`. the prefetch hook re-runs on compact by itself (queue, roadmap,
handoffs, reminders).

## completion criterion

the CST's `# D` names every drop with its file, the CST is in the store, the codie roster is stopped or
carried on purpose, the after-pickup ask is in orbit, and the `second-wind` op is the last act.
