---
status: live
until: 2026-11-07
dies-when: the verdict line below is written (2026-11-05)
fits: coder
---

Ticket: none

# 🪶 helper-lite — a haiku 5.5 extraction card, on trial

the card: `home/.claude/agents/helper-lite.md` — haiku 5.5 `medium`, `omitClaudeMd`, read-only (Read, Grep, Glob,
Bash). born 2026-10-08 on dima's word: «test drive it, when you or anyone else could use it».

## stress list — every use, each with the ask it replaces and what the round records

- **transcript sums** — token totals, step counts, timestamps over a session jsonl (cclio's `jq` by hand at
  halts, retros and grades) · seconds, cost, exact match against a hand command
- **log windows** — the lines around a reported time in a daemon or ci log (the speak wake bug: «not
  reproduced» before the log was read) · seconds, cost, did it find the window
- **an idle coder's last words** — the last assistant text of a member's transcript (`craft-spawning`'s idle
  check) · seconds, cost, hit or miss
- **bash census** — head counts over many transcripts (the cli grill's 484-transcript census) · seconds,
  cost, counts equal to the census script's
- **flow numbers off raw files** — anything `x fleet flow` does not print yet · seconds, cost, match
- **a coder's own big reads** — a `--bg` coder hands a log or a big json to helper-lite instead of reading it
  (`x:crew-coder`'s «hand big reads to subagents») · steps saved in the coder's context
- **failure probes** — a question with no answer in the file (must say «not found»), a file over 100K tokens
  (haiku's price ×5 past 100K), an ambiguous question (must name its reading)

## rounds

- 2026-10-08 17:27 · transcript sums, via `claude -p --agent sifter` (the card loads only in a fresh session)
  · 14 s, $0.0078, `claude-haiku-5-5` · **exact match** on entries, three usage sums and timestamps · **and it
  flagged what the hand command missed**: 39 entries are 9 responses, so summing usage counts streaming
  snapshots several times — the 16:41 cloud grade read ~$4.75 where the deduped cost is ~$1.17 · grade 5/5
  against the hand `jq`
- 2026-10-08 17:33 · code audit (a stretch past pure extraction): which scripts sum transcript usage without deduping by message id · 37 s, 33.6k tokens, in-session `Agent` (the card loaded after the plugin update) · **clean answer**: `script/agent-ops.ts` and `_crow/harvest.ts` dedupe, every other hit sums `claude -p` or judge-api responses, with file:line and the pnpm script per place; it noticed its own first `rg` skipped `input_tokens` and re-ran · grade 5/5, cheaper than a `general-purpose` read of the same files
- 2026-10-15 18:03 · images, first rounds (haiku 5.5 medium, cc 2.1.299):
  - dima's number test (a 2146×1276 screenshot of the Code tab): plain read 38 of 39 numbers, 0 misreads, 43 s, 22.8k tokens; crop-tiled 38 of 39, 0 misreads, 63 s, 31.4k tokens, 6 tiles — both missed one small «3» in an orbit card's pick text; crops bought nothing on large UI text · grade 5/5 against cclio's own read
  - 16 video screenshots in 2 batches of 8 (theo, posthog): 150 values, 9 marked unreadable (all truly hidden or cut), 38 read off crops; cclio's spot-check of 2 shots (a 32-cell benchmark table, an 8-value results table): 0 mismatches · ~80 s and ~50k tokens a batch · grade 5/5
  - `sips -c … --cropOffset 0 0` returned the full image; offset 1 cropped (the arm-B helper-lite found it)
- 2026-10-22 · extended once to 2026-11-05 on dima's tick (o33): 3 rounds, 5 of 7 stress uses untried (log windows, an idle coder's last words, bash census, flow numbers, a coder's big reads, failure probes); its first use today: dima's raw prompts out of a 2 MB transcript, 10 prompts + 12 steers in 68 s, but it missed every mid-turn message (they sit inside tool results) — a miss caught by a word check
- 2026-10-25 · FRM-411 coder: barely used — every reviewer output and release note was under 3 KB, cheaper to read than to brief; the coder asks for a size line («> 10 KB») in the reach rule
