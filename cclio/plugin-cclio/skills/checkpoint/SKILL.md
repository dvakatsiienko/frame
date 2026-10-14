---
description: load when dima types /cclio:checkpoint, says «checkpoint», or warns that we switch topic and he wants the thread thinned without losing state — the half-halt that ends in his /compact.
argument-hint: "[what to drop, comma-separated]"
---

# /cclio:checkpoint [drop …]

**the trigger beside his word: context at 600–700k** (dima, 2026-10-07: «you reach 400k extremely fast … a good number for you to checkpoint is about 600k to 700k») — `get_usage` shows it at every siesta; past 600k the ➡️ offers a checkpoint; a 🐦‍🔥 second wind press on my sessions row is the same trigger, its note slipstreamed into my next turn. **a half-halt, no exit.** frees the thread of a finished topic while everything else survives —
the same guarantees as a halt, minus the goodbye. dima's spec (2026-09-10): as few steps as
possible; memory as precise as possible after the resume; only the unwanted absent. since
2026-10-01 the drop list is mine to decide, no approval round: «when you run checkpoint, just print
me a compact prompt upfront, saving a turn».

📌 who runs the compact: on his word, `/compact` is his to type and the ritual ends by handing him the line; on a 🐦‍🔥 press, it ends with the stash tool's `second-wind` op naming the CST slug, and the mod runs the compact + ingest at that turn's end.

## 0. stop taking new work, tell the fleet — first act

- **my own background work lands first**: every agent and job this session started is listed; each lands and its findings fold before the CST is written (deadline 5 min, then it rides the CST as an open first-act), and the wishkeeper of the batch being closed is always waited for, never carried
<!-- 10-14 16:28 #dima-caught: the second wind nearly compacted with wishkeeper batch C still running -->

- **no new todo starts** after the trigger: the small open tails close first (an ask whose answer is known, an uncommitted fix, a reply a member waits on); a bigger one goes to the CST as a first-act, never half-done (dima, 2026-10-13, the 9 steps)
- **the after-pickup move goes to orbit at once**, mid-turn too: «right after the pickup i'd do X» as an ask he can tick before the reset
- **tell the fleet**: every live member (`ListAgents`) gets one `SendMessage`: «pause — cclio is checkpointing, hold every
message to me until «resume»; finish and commit what you are on». a message that lands mid-compact
arrives in a thinned thread and its detail is lost (dima, 2026-09-30). the roster with each paused
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
- always kept, unlisted: the boot ingest, the inbox items and their homes, every open ask in his
  words, the coder roster, my own pending suggestions, the pocket and queue state, the day's done asks
  (so a sent thing never comes back as «never sent») and the flawlog habit (ccrow, 2026-10-10: three
  slips after one compact)

## 2. land, same as a halt's middle

- inbox: every item has a pocket item — then it gets a `✅ ` prefix IN PLACE, text and headers
  intact, nothing deleted (dima, 2026-09-11: the inbox survives a checkpoint so he can diff it;
  the halt clears only `✅` lines). the mark tells him what is handled; the resume diff below
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
- **a running recipe** (a memory sweep above all): META first-act 1 is its re-entry rule, «read `recipes/<name>/recipe.md` whole and follow its re-entry» — the 10-11 sweep lost its want and its lenses after checkpoint 3 because the CST named the groom list, never the recipe; it also names the brief the recipe was born from, and a step that needs its own session names that session (10-11: the 10-07 sweep brief and the pm review both slipped)

## 3.5 the CST check — before the two lines

`wishkeeper` 🐬 reads the CST draft against the live state: every open orbit ask, every open pocket item, every unfinished groom-list line and each member's queue is present; nothing done is carried as open; a step that needs a fresh session says so as a first-act. each finding is folded into the CST before it is saved (ccrow, 2026-10-11, o143: checkpoint 2's CST lost the pm review's «dedicated session», queued two landed asks and dropped a reseal).

## 4. hand him the two lines — or the second-wind op

on a 🐦‍🔥 press: no fence; the `second-wind` op with the CST slug, and the reply says the reset runs at this turn's end. on his word:

📋 **copy → this session** 📋

```
/compact keep the boot ingest, the inbox items and their homes, every open ask, the coder roster, the open orbit asks, the day's done asks and the flawlog habit (a #dima-caught catch gets its line the same turn); drop <his drop list, one clause each>
/x:handoff-ingest <runid>-checkpoint-<n>
```

✂️ **end** ✂️

the first thins the thread with the hint as the steer; the second restores the precise state on
top of what the compact kept. **then resume every paused member** — one «resume» each, named from the CST roster, and
`trash ~/.local/state/ccrow/paused` for ccrow — and read whatever they held. **after the ingest, before anything else: re-read `inbox.md` and
diff it against the pocket** — every inbox item must carry the `✅` mark AND a pocket item with
its details; an unmarked or detail-less one is restored from the inbox on the spot, out loud. the prefetch hook re-runs on compact by itself (queue, roadmap,
handoffs, reminders).

## completion criterion

the `/compact` line names every drop with its file, the CST is in the store, the coder roster is stopped or
carried on purpose, the after-pickup ask is in orbit, and the two-line fence (his word) or the `second-wind` op (a 🐦‍🔥 press) is the last act.
