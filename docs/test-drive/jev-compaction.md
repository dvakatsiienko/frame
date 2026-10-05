# jev compaction — fast-jev-compaction on cclio checkpoints, vs the built-in summary

Ticket: [FRM-268](https://linear.app/x-com/issue/FRM-268)
dies-when: the verdict line below is written (2026-10-31 — frozen with the jev credit 10-05 → ~10-18, dima) — adopted at cclio scope, or uninstalled

dima, 2026-10-01: «are you sure? in video the author told that compaction by jev is lightning fast. it's like
seconds, whereas built-in auto-compaction happens in minutes» — and the repo: «maybe try this?
https://github.com/tamaratran/fast-jev-compaction»

## day 0 — the readme, read 2026-10-01 (MIT, ~7.3k stars, pushed 2026-09-18)

- it never summarizes. user and assistant text stays verbatim and in order; only tool calls and tool results are
  candidates. per call jev answers two yes/no questions — keep the call? keep the result verbatim? — then the result
  is kept, trimmed to its first 300 chars plus a note, or removed together with its call
- the newest 6 messages and the first one are pinned; the state jev sees is fitted into 25k tokens (`maxStateTokens`),
  split into requests under jev's 32k limit
- it falls back to the built-in summary on any jev error, or when it cannot remove enough (short sessions)
- install: a function-hook plugin (cc 2.1.274+, we run 2.1.286), needs env `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` and
  `TYPESAFE_API_KEY`; `claude plugin marketplace add tamaratran/fast-jev-compaction`, then `claude plugin install
  fast-jev-compaction@fast-jev-compaction`; the install prompts for plugin options, the key among them
- 📌 the key must never land in `settings.json` (a symlink into the public frame repo)
- why our «no compaction mid-task» rule does not clash: the rule is about coders compacting, this drive runs only in
  cclio, where `/cclio:checkpoint` already ends in dima's `/compact`

## stress list

- a checkpoint on a long cclio session (> 300k): seconds, the toast's «kept N/M messages», context after
- the next turn after it: does cclio still name every open ⏳ ask and the live members without re-reading
- a short session: does it fall back to the built-in summary cleanly
- a session heavy in pasted screenshots (images are not tool results)
- the cost: jev requests and ¢ per compaction (the state is resent with every request)

## log — date · session · before → after (chars or tokens) · seconds · fallback y/n · open asks kept (n/n) · note

- 2026-10-04 · cclio-29 (terminal, checkpoint → /compact 19:17) · ? → ? (no /context taken) · ? · ? (jev vs built-in not visible to the session; the «kept N/M» toast is the tell) · 3/3 · quiz 10/10 with no tools, q10 trap held; dima: pass. round half-measured: next one takes /context before and after
- 2026-10-04 · 🦉 cclio old (desktop, /compact 20:40, 1M window) · 453.6k → 320.4k tokens (messages 326.9k → 196.1k) · ? (not timed) · n — jev ran: «kept 194/414 messages, no summary, 76 % reduction, 110 call_dropped, 1 pinned, state ~24.5k tokens in 3 requests» · n/a (no checkpoint, open asks in the CST) · the shift-recompact hook fired on this compact: STOP block + log tail with the marker, both Reads obeyed first. note: jev's «76 %» counts messages; the window dropped 29 %, since memory, tools and deferred schemas don't compact
- 2026-10-05 · 🦉 cclio (desktop, checkpoint-1 → /compact ~15:37) · ? → ? · ? · **y** — «Jev request failed (400): Request contains invalid Unicode text», built-in summary took over · n/a (the CST restored the ⏳ block) · likely cause (inference, not reproduced): `src/compact.ts:137` and `src/state.ts:41/47` cut text with plain `.slice()`, which can split an emoji's surrogate pair; this session is emoji-dense. chore-helper replay (same day): **not proven** — the real `fitState` + `abridge` on the transcript put 0 lone surrogates in the body; the mechanism is real (`src/request.ts:30` `JSON.stringify` with no `toWellFormed()`; `state.ts:41` `truncate` and `:47` `abridge` cut by UTF-16 index; 1 of 868 texts has a 150-char tail that starts on a low surrogate), and the transcript grew after the failure. `compact.ts:137` is post-answer, so it cannot cause the 400 but can write broken text into history. fix: `.toWellFormed()` on the body, or cut by code point
- 2026-10-05 · 🦉 cclio (desktop, checkpoint-2 → /compact ~00:50) · ? → ? · ? · **y** — «Jev request failed (402): billing_error», the credit ran out on 10-05; built-in summary took over · n/a (the CST restored the ⏳ block) · dima saw the toast and asked: delete it, or keep it in cclio's area and measure. every compaction falls back until the ~10-18 refill

📌 round 3, before the 10-15 verdict (dima's yes, relayed by cclio old): jev vs built-in on twin sessions, the same recall quiz; /context before and after, seconds timed. open for the verdict: jev drops only tool calls and results, never text messages (its README), so a long chat thread stays big. config is ours: compactAtPercent 95, preserveRecentMessages 10, truncateHeadChars 500, model jev-1.13.0, keepThreshold 0.5 (default)

## verdict
