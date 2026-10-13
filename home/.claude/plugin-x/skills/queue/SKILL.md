---
name: queue
description: Load when Dima types /queue, or says to do something after the current thing / later in THIS session. «plan it for next session» is a ticket line, not the queue.
argument-hint: "<thing to do later>"
---

# Queue

Exists so Dima never has to type "queue this after that" again.
`/queue <thing>` — push it. Confirm in one line with the new depth: `📋 queued (3): <thing>`.

## Where it lives — durable, hidden, one per place

A park that exists only in a chat message is a strand, so the queue is a file; the conversation
only mirrors it. **The file is `.claude/x-queue.md`** — named for this skill, kept inside
`.claude/` so a technical park file never clutters a project root.

Resolve once per session, in this order, and say which you picked:

1. walking **up** from cwd, the nearest directory already containing `.claude/` — the normal
   case, and what keeps each place its own queue (cclio, frame, bytes never mix).
2. none above, but inside a git repo → create `.claude/x-queue.md` at the repo root.
3. not in a repo, or read-only tree → the session scratch dir, **said plainly** — that park
   dies with the session.

Items under a `## queue` heading, one hyphen line each, in order.

📌 **The file holds the queue and nothing else** — never long-lived notes, never a shadow
tracker. Anything with a ticket belongs on the board; a copy here goes stale silently.

- **Write on push, same turn.** "I'll note it later" is the forgetting.
- **Remove on pop, same turn.** A done item left in the file is worse than no file.

## Surfacing — the half that rots

- At every **natural pause** — a task lands, a question is answered — offer the **top item**,
  one item only.
- **Before any wrap-up** — a wrap-up is not complete while the queue is non-empty; report what
  remains rather than closing over it.
- Whenever you show the queue, show all of it in order, one line each.
- Pop only when done or dropped by Dima. Never silently reorder — a later item that should go
  first is a proposal, his call.

📌 A queue is a park, not a tracker: a session ending with items still queued says so and
offers to fold them into a handoff, a ticket, or `/remind`. Surviving in a file is not the
same as being scheduled.
