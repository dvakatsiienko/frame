---
status: adopted
until: 2026-11-08
dies-when: the verdict line below is written (2026-11-05)
fits: codie
---

Ticket: none

# 🪶 helper-lite — a haiku 5.5 extraction card, on trial

**test card:** we believe a **Haiku 5.5** card reads counts and lines out of big files as exactly as a hand command, for a fraction of a **Sonnet 5.5** `helper` · we test it by every big read below, a member's own included · we measure seconds, cost and a match against the hand command per use, and misses on the failure probes · we're right if 5 of the 7 stress uses are tried with no wrong number, and the failure probes answer «not found» instead of guessing
**kill rule:** one wrong number that reached a report unflagged, or a member reading a big file itself because the brief costs more than the read

the card: `home/.claude/agents/helper-lite.md` — haiku 5.5 `medium`, `omitClaudeMd`, read-only (Read, Grep, Glob,
Bash). born 2026-10-08 on dima's word: «test drive it, when you or anyone else could use it».

## stress list — every use, each with the ask it replaces and what the round records

- **transcript sums** — token totals, step counts, timestamps over a session jsonl (clio's `jq` by hand at
  halts, retros and grades) · seconds, cost, exact match against a hand command
- **log windows** — the lines around a reported time in a daemon or ci log (the speak wake bug: «not
  reproduced» before the log was read) · seconds, cost, did it find the window
- **an idle codie's last words** — the last assistant text of a member's transcript (`craft-spawning`'s idle
  check) · seconds, cost, hit or miss
- **bash census** — head counts over many transcripts (the cli grill's 484-transcript census) · seconds,
  cost, counts equal to the census script's
- **flow numbers off raw files** — anything `x fleet flow` does not print yet · seconds, cost, match
- **a codie's own big reads** — a `--bg` codie hands a log or a big json to helper-lite instead of reading it
  (`x:crew-codie`'s «hand big reads to subagents») · steps saved in codie's context
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
- 2026-11-05 · five probes with held-back answers, one 5.4 MB transcript and two local files · 26 s, 35.7k tokens, 7 tool calls · log window exact; bash census 164, exact; not found answered «not found»; the ambiguous duration named all 3 readings; an idle coder's last words had the right text with one word off («the fixes» for «these fixes»)
- 2026-11-06 · frm-514 codie · not used for transcripts, a read-back script answered it for free; one card ran the subagent probe, good
- 2026-11-06 · mods lane 5 codie · unused this chunk; the codie should have used it for the logs

- 2026-11-06 · BYT-130 ci made boring codie and cli lane 6 codie · not used, the reads were small; no impression
## verdict

2026-11-05 adopted on dima's tick: 6 of 7 stress uses tried, no wrong number found, kill rule not hit. 103 runs since 10-08, median 13 s, 3 tool calls. 21 days of otel: 511 requests, 0.78 usd, 0.0015 usd a request at list price, against **Sonnet 5.5** agents' 0.0252. untried: flow numbers, a file over 100K tokens. the one rule it adds: a quote it returns is checked against its source (`x:crew-subagent`).
