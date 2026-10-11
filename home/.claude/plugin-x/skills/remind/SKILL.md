---
name: remind
description: Load when Dima types /remind, or asks to be reminded of something / to drop or list a reminder.
argument-hint: "[stick|unstick|forget|list|clear]"
disable-model-invocation: true
---

# Remind

A reminder outlives the conversation — it lives in the memory system, never in a chat message
or scratch file. The inverse of `/queue`, which parks work for this session only.

Store: the auto-memory dir for the current project, as one `⏰` line in a memory file the index
points at. **Exception — cclio:** a session booted in `~/frame/cclio` stores in
`cclio/memory/_reminders.md` (barrel-imported, git-backed).
**Exception — desktop app threads (all kinds):** store as a global memory edit, prefixed `⏰` —
global memory reaches every thread including mobile; never route reminders through Desktop
Commander files.

**Two tiers.** `⏰` — raised at a natural moment. `⏰📌` **stuck** — raised at **every session
boot**, natural moment or not. Both die only when Dima drops them.

## Verbs

- **no argument** — store one entry: `⏰ <the thing, in his words where possible> — set
  <YYYY-MM-DD>`. Confirm one line: `⏰ reminded: <thing>`. Never two entries for one reminder.
  a reminder with a date ends ` · due: <YYYY-MM-DD>`: cclio's boot prints every `⏰` line whose `due:` has come.
- **`stick`** — store at the stuck tier, prefixed `⏰📌`. Already exists as `⏰` → **promote in
  place**, never file a second entry. Confirm: `⏰📌 stuck: <thing>`.
- **`yourself stick`** — the tracked thing is the agent's own behaviour or a watched system.
  Stuck tier, led by the agent's signature emoji plus optional flavour (`⏰📌 🦉👁️ …` —
  cclio signs 🦉; another agent picks its own and keeps it stable).
- **`unstick`** — demote to `⏰`; he describes which in plain words. Confirm: `⏰ unstuck:
  <thing>`. **Unstick is not forget** — only `forget` removes.
- **`forget`** — match his plain-words description, delete, confirm `⏰ dropped: <thing>`. Two
  plausible matches → name both, ask. No match → say so, never guess.
- **`list`** — one line each, **stuck first**, oldest-first within tier. The verb for «what am
  I on the hook for».
- **`clear`** — delete every entry, both tiers; confirm the count **split by tier** (wiping a
  stuck one is the expensive mistake).

## Raising

Entries load with memory every session, so they are always in front of you.

- **`⏰`** — re-raise at a natural moment: the work touches it, a related decision comes up, a
  session wraps. Once per moment, one line, never a recited list.
- **`⏰📌`** — raise **at boot, every session, unprompted**, own line in the opening report —
  then behave like an ordinary reminder for the rest of the session. Stuck outranks ordinary;
  boot reports list stuck first. This is the tier's whole point: the questions Dima accumulates
  away from the Mac are the ones a «natural moment» never arrives for.
- A reminder dies **only** when Dima drops it — not on being raised, not on looking handled,
  **not on being answered**. He confirms he read the answer; the agent never decides that.

## Timed pings — only if he named a time

A reminder is not a timer. He gives a time or cadence → also create a scheduled task and say
both exist; otherwise create nothing. `cw` has a scheduler. `cc`: `CronCreate` sits in
`permissions.deny` — memory entry only, say so plainly
([DOT-197](https://linear.app/x-com/issue/DOT-197) owns whether to lift it). A scheduled task
and a reminder are different objects; never assume one implies the other.
