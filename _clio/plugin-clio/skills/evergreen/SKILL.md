---
name: evergreen
description: load when dima types /cclio:evergreen, asks «updates?», «what's new in deps», «anything to merge?», says «approve evergreen», or when the boot digest prints a «🧬 evergreen turn» line.
---

# /cclio:evergreen 🧬 — the news layer over renovate and brew

renovate opens the PRs (`renovate.json` in `bytes` and `frame` holds the schedule and the automerge tiers). this skill is the half a bot cannot do: **read, judge,
tell dima only what he would want to know, keep brew fresh, act on his word.** 🌲 is her commit
prefix (renovate writes it), 🧬 her voice here. cadence: **wednesday, plus any renovate security PR** (dima
2026-09-09: «try daily first, refine, then loosen» — loosened to his wednesday, 2026-10-21).

## the day — four turns

the boot digest seeds «🧬 evergreen turn» on top of the pocket (`boot-prefetch.sh`), so the board's order carries it as item 1.

1. **boot turn** — beside the boot, the read starts in the background on the `helper` card (Sonnet 5.5, no fleet memory), its brief the path of [references/read.md](references/read.md); when it lands, `timeout 2400 brew upgrade` (pinned never) runs in the background and `wishkeeper` reads the report for its own picks — fixes it would make, borrows it would take
2. **evergreen turn** — the turn after the board, before anything else: the report whole in the chat with wishkeeper's picks folded in, the standing page republished, every borrow a line he can steer
3. **his feedback** — he steers line by line
4. **resolve** — each borrow done in place, or a ticket, or a lane rider; the page republished with each chip at its landing (ticket, rider, skipped and why); `pnpm skill:evergreen-apps --mark` (the helper card never marks); the 🧬 pocket item set done

## the report — what cclio does with the card's reply

- 📖 the report's shape and every judge rule live in [references/read.md](references/read.md) §§ 3–4; cclio reads it before printing or reworking a report, never prints from memory
- **every digest is also the artifact** (dima 2026-09-28: «let's have it as a habit part») —
  one standing page, [Evergreen](https://claude.ai/artifact/Vgx13BgNQyieSfcTNvsi4p), republished
  by `url` each run with that run's date in its header: 🌟 cards with a borrow line and a status
  chip per borrow (shipped · waiting · queued), the brew lines worth reading, the count line,
  and a chart where a perf claim has numbers. its source lives at
  `_clio/evergreen/page.html` — read it, swap the content, keep the design. the page mirrors the
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
