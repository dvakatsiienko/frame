# stash

dima's command center: one folded row above the prompt that every live cc session shares.

## Language

**Stash**:
The shared row and the one store behind it; every feature below lives in it.
_Avoid_: deck, band, dock

**Ask**:
An open question a session put to dima in its ⏳ block, live until he verdicts it.
_Avoid_: question, todo, pending

**Afk**:
Dima's away switch; while on, every session's prompt carries an away note.
_Avoid_: away mode, shift presence

**Hold**:
A session's claim on one file, taken by its first edit of that file; other sessions' edits of it are refused.
_Avoid_: lock, lease, claim, reservation

**Holder**:
The session that owns a hold.
_Avoid_: owner, locker

**Release**:
The end of a hold: the file is clean in git, the holder is dead, or the holder sat idle 30 minutes since its last turn.
_Avoid_: unlock, expiry

**Board**:
The `/board` pane: every live session, busy or idle, and when it last sent a message.
_Avoid_: dock, roster, dashboard
