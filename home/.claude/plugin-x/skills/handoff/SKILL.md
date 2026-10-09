---
name: handoff
argument-hint: "[focus on] | spawn [focus on] | <session-id|name> [focus on] | list | peek <slug> | delete"
description: Load on /handoff with any argument shape — focus, spawn, <session-id|name> push, list, peek <slug>, delete — and on an incoming HANDOFF REQUEST message.
---

# Handoff (sender)

**lane** — `cw`: `x-cw__handoff_save` (+ `_supersede`, `_list`, `_peek`, `_delete`) · `cc`:
`x handoff`, below. Both doors run the same rules — the `x-cw` tools shell out to `x handoff`.

Produce a CST per [CST-SPEC.md](../../CST-SPEC.md) — read it first; it defines sections,
calibration, and the store's semantics. This skill adds the Claude Code sender mechanics.
Counterpart: `handoff-ingest`.

## The store door — `x handoff`

`list`, `peek`, `write`, `delete`; `x handoff <verb> --help` prints the flags, the one place they
live. `write` takes the CST on stdin — heredoc it. x owns the filename, the permissions and the
timestamp; never build a path by hand. Each verb answers in one json envelope: the written path
is `data.path`, a refusal is `error` plus the `next` command.

`<audience>` = who the CST is FOR: nobody in particular → `any`; a specific agent → its seat's token:
`cclio`, `coder`, `verifier`, `designer`, `ccrow`, `cw`, and `ccli` only for a plain session with no seat.
a member handing off to its own successor names its own seat (a coder's CST is `coder`). `--shared` when
several threads will pull it.

`--author` = who is WRITING it — this session's own token, always passed. `--lane` = the kind of
work this thread was, one of `pm`, `code`, `research`, `design`. Both default to `any`,
and a pending list that says `any lane · by any` is a writer that skipped them.

## Before writing any CST

- 🚨 **The sibling check is mandatory, and it comes first.** `list --for <this session's
  audience>`. A pending handoff of THIS thread → fold its live content into the new CST and pass
  `--replaces <its slug>`, which deletes it as the new one lands. One thread leaves ONE file.
- **Build META's fleet roster** from `ListAgents` (fresh — refs rotate): only sessions worth
  reattaching to, naming what each holds.

Mode by argument:

- first token looks like a session id (8-char/UUID/pid) or name → **Trigger D**; rest = FOCUS
- `spawn` → **Trigger C**; rest = FOCUS
- `list` → **F** · `peek <slug>` → **G**
- `delete` / `clear` / `prune` (canonical: `delete`) → **E** — a bare verb is never a FOCUS;
  writing a CST "about deleting" is the wrong read of an obvious intent
- anything else, or empty → **Trigger B**; the argument is a FOCUS

A FOCUS weights the CST per the spec's TARGET rule but still carries the whole thread. Dima
asking for *only* a part = a SCOPED handoff — restrict content, set META's `scope` per spec.

## When to offer one, unasked

- resuming a long thread re-reads its history uncached — up to ~20% of a 5h window
- suggest a handoff at **any size before going idle over an hour** — cache TTL expires and the
  next turn pays full price

## The peer moves — `cc` and `cw` are peers, either side may open

Offer with a 💡 tip, specific and occasional, never a running commentary.

- **ROUTE** — the task fits `cw` better (long-form web research, doc/PDF/image analysis,
  repo-free ideation): «💡 handoff this to `cw`, <one reason>».
- **PUSH** — something made here would help `cw`: offer to send it.
- **REQUEST** — `cw` holds something useful (its memory of Dima, a spec drafted there):
  suggest pulling it.
- **Cross-thread awareness** — one topic worked in both frontends → offer a sync handoff
  rather than letting both sides work blind.

📌 The store is shared: CSTs flow `cc`↔`cw` through one directory, served to `cw` by the `x-cw`
mcp server, which shells out to the same `x handoff` this skill calls.

## DELIVERY FAILURE RULE (MANDATORY — triggers A and D)

A send bounces (error, "not reachable") → do NOT retry inline. Write the CST to the store
immediately, then send ONE one-line message carrying only the path; that bounces too → tell
your user the path. Never leave a bounced send without the file written — the file tier is the
delivery guarantee.

## Trigger A — incoming `HANDOFF REQUEST` message

Priority interrupt. The message carries its own protocol (the requester may run another spec
version) — follow THEM, reply to its `from` address. Then resume in-flight work exactly where
it was. Bounce → the rule above.

## Trigger B — `/handoff [focus]` (pre-emptive)

Sibling check, compose, then write:

```bash
x handoff write --audience <a> --slug <topic> --lane <l> --author <this session's token> --json <<'CST'
<the composed CST>
CST
```

Add `--replaces <slug>` when the sibling check found this thread's own pending file. Tell the
user in one line: file written; any frontend ingests it (`handoff-ingest` skill on cc, the
`/handoff-ingest` prompt on cw) and deletes on ingest (`-shared`: kept).

**No pickup block, no accompanying prompt.** Dima picks CSTs up from the raycast handoffs
command, which pastes the ingest line itself (2026-09-25: «handoff must now be fully
self-contained»). So the CST carries everything the next thread needs — run id, first moves,
pending decisions — in META; a reply names the slug once and nothing else.

## Trigger C — `/handoff spawn [focus]`

Produce the CST, seed a background successor directly:

```bash
claude --bg --name "<short descriptive name>" "<CST, prefixed with: You are a continuation of a prior session. Ingest this CST silently per its own rules (run META's first-acts first, persist C→memory lines, honor R/D as user-said), then proceed from S.>"
```

Always pass `--name`. No file is written (the CST rides the prompt), so the spec's REDACT rule
applies in full. One line: spawned `<name>`; manage via `claude agents`.

## Trigger D — `/handoff <session> [focus]` (push to a live peer)

1. Resolve like `handoff-ingest` peer mode: `ListAgents` fresh; map ids via
   `jq -r 'select(.sessionId|startswith("<prefix>")) | "\(.pid) \(.name) \(.status)"' ~/.claude/sessions/*.json`;
   expect the runtime to demand the ref on a first bare-name send (the error carries it —
   resend). Unresolvable → fall back to Trigger B, one line (peer unreachable, file written).
2. Produce the CST, `write` it to the store — **file is the default transport**; inline only if
   explicitly asked. The envelope's `data.path` is the path; use it verbatim in step 3.
3. `SendMessage` a short notification: path + ingest contract inline (the receiver may never
   have activated these skills):

```
HANDOFF PUSH — priority interrupt.
A CST (Continuation State Transfer) of my thread is at <path>. Read it, then ingest silently — never echo it into visible output; confirm to your user in ≤2 lines (thread topic + next step). Run its META first-acts before anything else. Persist `C→memory:` lines into your memory system if one exists. Honor R and D as if your user said them in this thread. Then proceed as the old thread from S. Delete the file after ingest (`-shared` suffix: keep). Reply one line: `CST ingested by <your ref>`.
```

4. Bounce on name, ref, and twin → the delivery failure rule; the file is already in the
   store, tell the user the path.
5. One line: CST pushed to `<target ref>`. The ACK is informational — never block on it.

## Trigger E — `/handoff delete`

1. `list` first (filename + age). Empty → "store already empty", done.
2. `delete --all` — it takes `-shared` files too.
3. One line: `deleted N handoff(s): <slugs>`.

No confirmation dance — a deliberately destructive verb on disposable files. No CST on this path.

## Trigger F — `/handoff list`

Read-only, nothing consumed: `list --for <this session's audience>`. Report x's rows as
they come — slug, audience, age, size, run id — plus the ones it separates out as another
agent's. A row flagged older than 7 days is information for Dima, not a cue to delete anything.

## Trigger G — `/handoff peek <slug>`

Read-only: `peek <slug>`. It prints only the META block, and refuses on an ambiguous slug rather
than guessing — pass its candidate list to Dima and ask. Say plainly that `handoff-ingest` is
the verb that actually continues the thread.

## Completion criterion

A producing trigger (B, C, D): CST exists per spec AND the store holds exactly ONE pending file
for this thread — verified by a second `list` — and the user got the one-line report. F, G: done
at the report; E: at the counted deletion line.
