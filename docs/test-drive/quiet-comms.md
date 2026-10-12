---
status: live
until: 2026-10-19
dies-when: the verdict line below is written (adopted → the switch stays on; dropped → the mod part and the tag line leave)
---

Ticket: none · pocket PK-93

# quiet comms — member pings off dima's thread, an A/B MVP

dima, 2026-10-12 (o17): «let's try, but shape it as an A/B test and MVP, to explore and measure if it works and truly
helps, makes comms more efficient, and does not break our comms. make it easy to revert if it is clunky.»

## the mvp

- members open every ping to cclio with a class tag: `[done]` `[blocked]` `[ask]` `[progress]` (crew-dna line)
- in cclio's session only, a mod holds a `[progress]` ping (no turn); every other tag, and an untagged ping, passes
- held pings ride cclio's next turn as one hidden block; idle > 10 min → a hidden append, still no turn
- mobile mode on → nothing is held (his phone draws no board)
- **the revert is one switch**: `/quiet off` passes everything; the tag line is harmless with the switch off

## the a/b

- ~~arms by day~~ — dropped (dima, 2026-10-12 16:53: «stress-test it every day, we collect more data»): on every day, `/quiet off` is the revert; the baseline is the pre-10-12 transcripts, peer-started cclio turns per lane-hour counted with duckdb
- each delivery logs one line: time, sender, tag, held or passed, and whether it started a turn
- the numbers per arm: peer-started cclio turns per lane-hour (the cost), held pings that later mattered (a held
  ping cclio answered late, or dima asked about), and dima's «where is X?» re-asks about member status (the harm)
- adopt when peer-started turns drop by a third or more and the harm count stays at 0

## rounds

- round 0 (2026-10-12, the mods coder): built in x-mod-stash, live in cclio's thread only. the a/b reads
  `quiet-log:<day>` in the store file: `jq '[to_entries[] | select(.key|startswith("quiet-log:")) | .value[]] | group_by(.arm)'
  ~/.claude/plugins/store/x-mod-stash_*.json`; held pings show as `🤫 n` on cclio's sessions row. proven: 14 harness
  tests, each branch red by mutation; the desktop hold itself at 15:48 (no turn). not yet: a real lane day per arm
- round 1 (2026-10-12 16:53, dima's word, brief 5): the day arm is gone — quiet is on every day by default, `/quiet off` or the 🎛️ switch is the revert, and the log's `arm` reads that switch. the a/b now compares the on and off stretches dima chooses
