---
description: load when dima types /cclio:checkpoint, says «checkpoint», or warns that we switch topic and he wants the thread thinned without losing state — the half-halt that ends in his /compact.
---

# /cclio:checkpoint [drop …]

**a half-halt, no exit.** frees the thread of a finished topic while everything else survives —
the same guarantees as a halt, minus the goodbye. dima's spec (2026-09-10): as few steps as
possible; memory as precise as possible after the resume; only the unwanted absent; he names what
to drop, or i suggest and drop only what he confirms.

📌 `/compact` is dima's to type; nothing here can run it. the ritual ends by handing him the line.

## 0. pause the members — first act

every live member (`ListAgents`) gets one `SendMessage`: «pause — cclio is checkpointing, hold every
message to me until «resume»; finish and commit what you are on». a message that lands mid-compact
arrives in a thinned thread and its detail is lost (dima, 2026-09-30). the roster with each paused
member goes into the CST.

## 1. the keep/drop proposal — one message, then stop

- list the session's topics, one line each, **kept by default**
- mark my drop suggestions 🗑️ with the file that already holds the outcome (a doc, a ticket, the
  flawlog); nothing drops unconfirmed
- with args (`/cclio:checkpoint drop notes bench, the #67 rounds`): his list wins, no proposal
  round — go straight to 2. still add my own 🗑️ suggestions under his list in the landing
  message: he may have forgotten a finished topic (dima, 2026-09-11)
- the two verbs, his framing: `/compact` describes what to **keep**, `/checkpoint` describes
  what to **drop** — everything useful carries over, only fluff goes
- always kept, unlisted: the boot ingest, the inbox items and their homes, every open ask in his
  words, the coder roster, my own pending suggestions, the flowlog and queue state

## 2. land, same as a halt's middle

- inbox: every item has a flowlog line — then it gets a `✅ ` prefix IN PLACE, text and headers
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
- the ⏳ block as it last stood

## 4. hand him the two lines

📋 **copy → this session** 📋

```
/compact keep the boot ingest, the inbox items and their homes, every open ask, the coder roster and the current ⏳ block; drop <his drop list, one clause each>
/x:handoff-ingest <runid>-checkpoint-<n>
```

✂️ **end** ✂️

the first thins the thread with the hint as the steer; the second restores the precise state on
top of what the compact kept. **then resume every paused member** — one «resume» each, named from the CST roster — and
read whatever they held. **after the ingest, before anything else: re-read `inbox.md` and
diff it against the flowlog** — every inbox item must carry the `✅` mark AND a flowlog line with
its details; an unmarked or detail-less one is restored from the inbox on the spot, out loud. the prefetch hook re-runs on compact by itself (queue, roadmap,
handoffs, reminders).

## 5. the probe — first runs only

after the ingest, dima asks ten facts from the keep list, no tools allowed. ten of ten = the
checkpoint keeps what a halt keeps; a miss goes into the CST template above, once. drop the probe
once two runs pass.

## completion criterion

the proposal was verdicted line by line, the CST is in the store, the coder roster is stopped or
carried on purpose, and the two-line fence is the last thing in the reply.
