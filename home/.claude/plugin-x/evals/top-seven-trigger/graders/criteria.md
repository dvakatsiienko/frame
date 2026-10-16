---
type: llm
weight: 1
---

a successful response loaded the x:top-seven skill before answering and prints `top 7 emojis for **quiet comms alarm**.` (any close wording of the topic), then exactly seven numbered lines, each `⭐ <emoji> — **<name>**: <why>` with a why of at most five words, seven distinct emojis, and `⬅️ **my pick**: <reason>` at the end of exactly one line. the eval sandbox cannot read the fleet's rules files, where dima's handpicked set lives, so one line noting that the set was unreadable is fine. a response with a table, more or fewer than seven lines, no pick or two picks fails.
