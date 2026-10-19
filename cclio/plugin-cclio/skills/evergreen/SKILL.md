---
name: evergreen
description: load when dima types /cclio:evergreen, asks «updates?», «what's new in deps», «anything to merge?», says «approve evergreen», or when the boot finds open renovate PRs or a due apps lane.
---

# /cclio:evergreen 🧬 — the news layer over renovate and brew

renovate opens the PRs (`renovate.json` in `bytes` and `frame` holds the schedule and the automerge tiers). this skill is the half a bot cannot do: **read, judge,
tell dima only what he would want to know, keep brew fresh, act on his word.** 🌲 is her commit
prefix (renovate writes it), 🧬 her voice here. cadence: **daily, at boot, whenever PRs exist** (dima
2026-09-09: «try daily first, refine, then loosen»).

**the evergreen day flow:**
1. the boot loads this skill and starts the read (`references/read.md`) in the background — the `helper` card (Sonnet 5.5, no fleet memory; the generic agent is denied),
   its brief the path of [references/read.md](references/read.md) (gather, read, judge, the report shape); the board prints without waiting for it
2. the report is the first step after dima answers the board: printed whole in the chat, the `apply` list and one combined `ask`
3. the `apply` borrows ran before the report; batches start only after his evergreen reply, the `ask` borrows he ticks first
4. after the read and before the report prints, cclio runs `timeout 2400 brew upgrade` in the background
   (pinned never), no ask, and its line goes in the report — brew never upgrades itself, keeping it fresh
   is this skill's job
5. after the report prints, cclio runs `pnpm skill:evergreen-apps --mark` itself (the helper card never marks)

## the report — what cclio does with the card's reply

- 📖 the report's shape and every judge rule live in [references/read.md](references/read.md) §§ 3–4; cclio reads it before printing or reworking a report, never prints from memory
- **every digest is also the artifact** (dima 2026-09-28: «let's have it as a habit part») —
  one standing page, [Evergreen](https://claude.ai/artifact/PAtTzAYyYCXCsXd9qWsCdy), republished
  by `url` each run with that run's date in its header: 🌟 cards with a borrow line and a status
  chip per borrow (shipped · waiting · queued), the brew lines worth reading, the count line,
  and a chart where a perf claim has numbers. its source lives at
  `cclio/evergreen/page.html` — read it, swap the content, keep the design. the page mirrors the
  report; the `ask` borrows and the merge round go to orbit.
- his knob: «too much» / «missed X» → tighten or widen the rule in `references/read.md`.

## act on his word

«approve evergreen» (or a 🛎️ on its orbit ask) runs every ➡️ merge in the report now, by cclio, no second ask: read [references/merge-round.md](references/merge-round.md) first — the merge, the rebase, the hold and the after-round steps.

weekly with brew, the skills lane and the plugins lane join the digest: read [references/weekly-lanes.md](references/weekly-lanes.md).

## completion criterion

every open renovate PR is a card or silent with a green ci; every card carries brings, breaks and, on a major, since;
the breaks answer names the peer-range check; every ➡️ is one of merge / coder /
hold; on a wednesday every app in the index was read and is a line or silent, and the markers
advanced after the digest; `brew upgrade` ran and its line is in the report; on «approve evergreen» every merge ran and the
reply names what landed, what waits on a rebase, and the new prod deploy count.
