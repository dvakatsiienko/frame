# icloud sync baseline — measured 2026-09-10, mac ↔ ipad, vault 80 notes / 4.2 MB

- t1 mac 15:33:26 → ipad: immediate (note already open)
- t2 mac 15:38:06 → ipad: ~15:40 (≤2 min)
- conflict: ipad edits line B offline (airplane), mac edits line A 15:41:31, ipad reconnects ~15:44
  - 15:47 both sides still hold their own version — no propagation either way
  - ~15:49 the ipad's file replaces the mac's (mtime 15:40): line A edit + two later mac lines LOST
  - no conflict copy, no merge, no warning. whole-file, last-writer-wins
- a file deleted on the ipad took the same ~6 min lag to disappear on the mac

what it means for the fleet: any agent write on the mac while a mobile device holds a stale copy
is lost on that device's next reconnect. `rules/fleet-hazards.md` vault section, now measured.

second half (obsidian sync, same protocol) pending dima's decision to trial it.
