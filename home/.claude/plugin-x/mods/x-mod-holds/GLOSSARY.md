# x-mod-holds

no two sessions write the same file at once: a mechanism, where the «shared working tree» rule was memory.

## Language

**Hold**:
A session's claim on one file, taken by its first edit of that file; other sessions' edits of it are refused.
_Avoid_: lock, lease, claim, reservation

**Holder**:
The session that owns a hold.
_Avoid_: owner, locker

**Release**:
The end of a hold: the file is clean in git, the holder is dead, or the holder sat idle 30 minutes since its last turn.
_Avoid_: unlock, expiry
