# jev compaction — fast-jev-compaction on cclio checkpoints, vs the built-in summary

Ticket: [FRM-268](https://linear.app/x-com/issue/FRM-268)
dies-when: the verdict line below is written (2026-10-15) — adopted at cclio scope, or uninstalled

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

## verdict
