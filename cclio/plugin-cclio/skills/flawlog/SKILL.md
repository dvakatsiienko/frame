---
description: load on «flawlog», «flush the flawlog», «flaw», the moment a mistake just happened — dima says «you goofed», «that was wrong» — or you caught your own flaw. fix in place first, log only what survives the attempt.
---

# /cclio:flawlog

**a flaw just happened → try to fix it NOW. log only what survives the attempt.**

loads at boot alongside `/cclio:boot`, whenever a mistake/friction/retry just happened, or when
dima asks «do you keep an eye on flawlog». coordinator-only, on purpose — do not generalise it
into an `x:*` skill yet.

## 1. flag on the spot, same turn
two lines in the reply. non-blocking, informational — never a topic change, never a permission
request:

```
⚠️ flaw — <what broke, one clause>
💡 fix — <the suggestion>
```

then **fix it in place if it is fixable in place.** most process flaws are: a memfile corrected,
a habit adopted, a wrong assumption named, a command pattern learned. those cost one tool call
now and a rewind at wrap.

**fixed in place → do NOT write it to the log.** it is resolved. logging it manufactures work
that re-litigates a settled thing hours later.

**a line that still earns its place after a fix opens with `fixed:`** — the fix landed, the lesson
stays. jev's flawlog lanes read an unmarked line as an open rule candidate (two such lines were
laned «rule» on 2026-09-22); the marker is how the lane knows it is closed.

## 2. what actually reaches the log
only what could NOT be closed on the spot:
- needs dima's decision or approval
- needs code, a script, or a real build
- a pattern needing several occurrences before it is even diagnosable
- environment facts worth carrying but not actionable yet

file: `~/.claude/shelf/flawlog/<YYYY-MM-DD>-<topic-slug>.md`, created on first entry.

📌 **the slug is the session's main topic, in 2-4 plain words** — `spawn-measurements-and-plugin-cache`,
`invented-ids-and-tool-limits`, `cclio-first-boot`. a human scanning the dir should be able to
guess which log holds the thing they half-remember, which a run id can never do. the run id is
not lost: it stays in the file's H1, where provenance belongs and legibility does not.

📌 name it when the session's shape is clear, not at the first entry — a log opened as
`misc-flaws` never gets renamed. if the first flaw lands before the topic does, use a working
slug and fix it at the halt. one dir, all
history — the pre-migration archive was merged in. the shelf is a symlink into
`home/.claude/shelf/`, so the log is git-tracked; write the `~/.claude/...` path and let the
mirror rule do the rest.
line shape: `what broke · cost · lesson`. one line, no essay.
**stage tags**, appended when they apply — `x fleet flow` counts them (the FRM-309 done test): `#dima-caught` when dima spotted it before any agent did · `#brief` when a brief or an exit line caused it.

also log the GOOD finds — a transferable idea worth keeping. this is system-improvement data in
both directions.

## 3. at wrap
the log is short by construction; it holds only unresolved items. cluster them, produce ONE
batched proposal (memory / rules / tickets / drop), ONE approve from dima, then
execute and commit. never ticketify catches one at a time.
a hazard's home is the repo it bites: one repo → that repo's `AGENTS.md`; `rules/fleet-hazards.md`
takes only what bites 2+ repos or every session.
when a flaw class repeats, reference past logs — a repeat is stronger evidence than a first sighting.

## 4. the failure mode to watch
several turns of visible friction with zero flags is itself the flaw — sweep backwards, flag what
was missed, fix what is still fixable.
the opposite failure: flagging so eagerly every turn carries a ⚠️. if it cost nothing and changes
nothing, it is not a flaw. **silence is the correct output for a clean turn.**

📌 **the two logs are different things and the names now say so.** the pocket (`cclio/pocket.md`) is the
**work** pool — what we are doing, statuses, carry-over. `~/.claude/shelf/flawlog/` is the **flaw** journal — process defects caught mid-session.
one tracks the flow, one tracks the flaws. never write a flaw into the pocket or a task
into the flawlog.
