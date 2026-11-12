---
name: handoff-ingest
description: Load on /handoff-ingest or "grab/pull/ingest handoff" — bare, a topic keyword, or "cloud-chat" for the shared store.
---

# Handoff-ingest (requester)

**lane** — `cloud-chat`: `x-cloud-chat__handoff_ingest` (+ `_list`, `_peek` to look first) · `cc`:
`x handoff`, below.

Ingest a CST per [CST-SPEC.md](../../CST-SPEC.md) — read it first; its Ingest section is the
consumer contract (silent ingest, ≤2-line confirmation, META first-acts before anything else,
persist `C→memory:` lines, honor R/D, delete-on-ingest unless `-shared`). This skill adds the
Claude Code acquisition mechanics. Counterpart: `handoff`.

The argument is empty, `cloud-chat`, `file`, or a topic keyword ("bg2ee", "the sline one"); the
store is also the pickup path for `cloud-chat`-produced handoffs. A thread that stated what it is
for uses that only to pick the file (a written CST can't be re-weighted).

## the ingest

```bash
x handoff ingest [<topic>] --for <this session's audience> --json
```

🚫 **never silence an ingest.** it prints the CST once — the envelope's `data.body` — and deletes the file; piping it to `/dev/null` destroys the handoff. read the print in full; a peek is not an ingest.

`<audience>` is this session's own token — `clio` for a coordinator session, `cc` for a plain
one; an ingest without `--for` is refused. x does the mechanics and refuses rather than guessing:

- it keeps only handoffs for `any` or this token, and names the others without touching them —
  🚨 **a file addressed to another agent is never ingested by a bare pull.** Wrong context in
  this thread AND the other agent's file deleted, two failures from one mistake.
- naming a topic that matches one of those forces it — the user saying so out loud, which is the
  deliberate exception.
- several candidates and no topic → it lists them and stops. Pass that list to Dima and ask.
- on success it prints the CST and deletes the file (`-shared`: kept).

`list --for <audience>` and `peek <slug>` look without consuming, when the pick is unclear.

Then: ingest per spec. **Verify live-state claims before acting on them** (tickets by query,
sessions by pid). Confirm ≤2 lines, proceed as the old thread. Nothing pending → one line;
suggest the sender side (`/handoff` in the old thread). A slug the store no longer holds, when this
thread's context already carries that CST (a second wind's queued ingest arriving after it was taken):
end the turn with no reply.

## Completion criterion

Done when the CST's content steers this thread (META first-acts run, ≤2-line confirmation
sent) AND the store reflects the ingest — file gone (`-shared`: kept), verified by `list`. An
ingested-but-undeleted file is a failure to report, not a detail.
