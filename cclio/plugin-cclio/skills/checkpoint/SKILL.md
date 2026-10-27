---
description: load when dima types /cclio:checkpoint, says «checkpoint», or warns that we switch topic and he wants the thread thinned without losing state.
argument-hint: "[what to drop, comma-separated]"
---

# /cclio:checkpoint [drop …]

**the trigger is his: his word, or a 🐦‍🔥 second wind press on my sessions row**, its note slipstreamed into my next turn — he watches the context himself (dima, 2026-10-21); during a shift the trigger is mine, `cclio:shift` § surviving a compaction. **a half-halt, no exit.** frees the thread of a finished topic while everything else survives —
the same guarantees as a halt, minus the goodbye. dima's spec: as few steps as possible; memory as precise as possible after the resume; only the unwanted absent. the drop list is mine to decide, no approval round: «when you run checkpoint, just print me a compact prompt upfront, saving a turn».

📌 who runs the compact: on his word, `/compact` is his to type and the ritual ends by handing him the line; on a 🐦‍🔥 press, it ends with the stash tool's `second-wind` op naming the CST slug, and the mod runs the compact + ingest at that turn's end.

## 0. finish the topic, then stop taking new work and tell the fleet

- **in a shift** (`cclio:shift` § surviving a compaction): the topic is the current step, members are paused and carried, the flawlog flush and the after-pickup move go into the plan's `## log` for the report, and the compact door is the `second-wind` op with the CST slug
- **a 🐦‍🔥 second wind is graceful, never urgent** (dima, 2026-10-14: «a request, not an ask to do it as soon as possible … gracefully prepare yourself: resolve all subagents and park all stuff before compacting, to avoid data loss») — the same for a coder's second wind
- **the topic in flight finishes whole first** (dima, 2026-10-15: «fully resolve composer and leave no tails, because splitting the composer part into two parts between compaction is not a good idea»): every lane and agent it started lands, its findings fold, its distill, print, log and commit run — however long that takes. the checkpoint starts only at the end of a topic, never in its middle
- **only a topic not yet started waits**: it goes to the CST as a first-act; the small open tails close first (an ask whose answer is known, an uncommitted fix, a reply a member waits on), and the wishkeeper of the batch being closed is always waited for, never carried

- **the after-pickup move goes to orbit at once**, mid-turn too: «right after the pickup i'd do X» as an ask he can tick before the reset
- **tell the fleet**: every live member (`ListAgents`) gets one `SendMessage`: «pause — cclio is checkpointing, hold every
message to me until «resume»; finish and commit what you are on». a message that lands mid-compact
arrives in a thinned thread and its detail is lost. the roster with each paused
member goes into the CST. ccrow pauses by file, not by message: `touch ~/.local/state/ccrow/paused`
— its wake skips while the file exists.

## 1. the keep/drop list — decided, never asked

- every session topic is **kept by default**; a topic drops only when a file already holds its
  outcome (a doc, a ticket, a commit, the flawlog), and its CST line names that file
- with args (`/cclio:checkpoint drop notes bench, the #67 rounds`): his list wins, mine adds to it
- the list rides the final message as the `/compact` line itself — printed with the landing, no
  separate proposal turn; he edits the line before pasting if a drop is wrong
- the two verbs, his framing: `/compact` describes what to **keep**, `/checkpoint` describes
  what to **drop** — everything useful carries over, only fluff goes
- always kept, unlisted: everything the §4 `/compact` line names, plus my own pending suggestions and the pocket state (a done ask stays so a sent thing never comes back as «never sent»)

## 2. land, same as a halt's middle

- inbox: every item has a pocket item — then it gets a `✅ ` prefix IN PLACE, text and headers
  intact, nothing deleted (the inbox survives a checkpoint so he can diff it; the halt resets it from `inbox-template.md`). the mark tells him what is handled; the resume diff below
  tells me what is missing
- flawlog flush: one batched proposal, his one approve, execute (halt phase 3a); stories appended
- milestones refreshed (halt phase 3.5)
- gazette: `/cclio:gazette` writes the ⸻ upd block; **no wire** unless he says so
- **the coder roster**: retro received? still needed? a coder that is done is stopped now
  (`claude stop <id>`), never carried through a compact

## 3. the CST — fuller than a halt's

`/x:handoff` to the store, slug `<runid>-checkpoint-<n>`. on top of the halt CST:

- **the keep list verbatim**: each inbox item and where it went, each open ask in dima's words
  — the details that matter and his stylistic asks kept, typos and sleepy slips fixed, fluff
  dropped (probe 1 scored 6.7: facts kept, details trimmed),
  each hot topic with its current state and next move
- **the drop list as pointers**: one line per dropped topic naming the file that holds it — a
  dropped topic is reachable, never remembered
- the coder roster with ids and status
- the orbit asks as they last stood (orbit itself survives the compact in the mod's state)
- **his chat lines since the last report**, each with its answer or «open»: `node ~/frame/cclio/script/chat-lines.ts --since-stamp` prints his typed lines and orbit steers since the last `📄 last report` stamp; an «open» line becomes a first-act, and the pickup answers each
- **a running recipe** (a memory sweep above all): META first-act 1 is its re-entry rule, «read `recipes/<name>/recipe.md` whole and follow its re-entry»; it also names the brief the recipe was born from, and a step that needs its own session names that session

## 3.5 the CST check — before the two lines

`wishkeeper` 🐬 reads the CST draft against the live state: every open orbit ask, every chat line of his since the last report, every open pocket item, every unfinished groom-list line and each member's queue is present; nothing done is carried as open; a step that needs a fresh session says so as a first-act. each finding is folded into the CST before it is saved.

## 4. hand him the two lines — or the second-wind op

on a 🐦‍🔥 press: no fence; the `second-wind` op with the CST slug, and the reply says the reset runs at this turn's end. on his word:

📋 **copy → this session** 📋

```
/compact keep the boot ingest, the inbox items and their homes, every open ask, the coder roster, the open orbit asks, the day's done asks and the flawlog habit (a #dima-caught catch gets its line the same turn); drop <his drop list, one clause each>
/x:handoff-ingest <runid>-checkpoint-<n>
```

✂️ **end** ✂️

the first thins the thread with the hint as the steer; the second restores the precise state on
top of what the compact kept. **then resume every paused member** — one «resume» each with `notify_when_idle: true` (a compact drops every idle subscription, silently), named from the CST roster, and
`trash ~/.local/state/ccrow/paused` for ccrow — and read whatever they held. **after the ingest, before anything else: re-read `inbox.md` and
diff it against the pocket** — every inbox item must carry the `✅` mark AND a pocket item with
its details; an unmarked or detail-less one is restored from the inbox on the spot, out loud. the prefetch hook re-runs on compact by itself (queue, roadmap,
handoffs, reminders).

## completion criterion

the `/compact` line names every drop with its file, the CST is in the store, the coder roster is stopped or
carried on purpose, the after-pickup ask is in orbit, and the two-line fence (his word) or the `second-wind` op (a 🐦‍🔥 press) is the last act.
