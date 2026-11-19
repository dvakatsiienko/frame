---
name: evergreen
description: load when dima types /clio:evergreen, asks «updates?», «what's new in deps», «anything to merge?», says «approve evergreen», or when the boot digest prints a «🧬 evergreen turn» line.
---

# /clio:evergreen 🧬 — the news layer over renovate and brew

📌 **what evergreen is for, in dima's words, is [references/the-want.md](references/the-want.md)**: read it first, every run, and check the report against it before it prints.

renovate opens the PRs (`renovate.json` in `bytes` and `frame` holds the schedule and the automerge tiers). this skill is the half a bot cannot do: **read, judge,
tell dima only what he would want to know, keep brew fresh, act on his word.** 🌲 is her commit
prefix (renovate writes it), 🧬 her voice here. cadence: **wednesday, plus any renovate security PR** (dima
2026-09-09: «try daily first, refine, then loosen» — loosened to his wednesday, 2026-10-21).

## the day — four turns

the boot digest seeds «🧬 evergreen turn» first under the flyways (`boot-prefetch.sh`), so the board's order carries it as the first work item (dima's o77).

1. **upgrade, no ask** — first the before-snapshots into `~/.local/state/clio/evergreen/<today>/`: `pnpm outdated -g --json > pnpm-g-outdated.json`, `uv tool list --outdated > uv-outdated.txt`; then in the background: `timeout 2400 brew upgrade > brew-upgrade.log 2>&1` (pinned never), then `open -g -a 1Password` and `ssh-add -l` on its socket (an upgrade once left signing refused); `pnpm update -g --latest`, every uv tool but `mlx-audio` (`uv tool list | awk '/^[a-z]/{print $1}' | grep -vx mlx-audio | xargs -n1 uv tool upgrade`; kokoro's engine moves only on dima's word until FRM-669 lands); the merge round, [references/merge-round.md](references/merge-round.md): every green renovate pr, then one stray batch for the reds, the sweep and the no-break majors, both repos and the go modules; done = its finish line
2. **read the delta** — `node script/evergreen-delta.ts > <today's dir>/delta.md` writes the delta file (read.md § 1), before `--mark`; then `researcher` cards (Opus 5.5), one per area, each briefed with [references/read.md](references/read.md) and [references/the-want.md](references/the-want.md); `wishkeeper` reads the joined report for its picks
3. **the report** — whole in the chat in read.md § 4's shape, checked against the-want, the standing page republished, an action item only where it helps; then `pnpm skill:evergreen-apps --mark` and the 🧬 pocket item set done
4. **his feedback** — he steers line by line; each action he picks is done in place, a ticket or a lane rider, the page's chip at its landing

## the report — what clio does with the cards' replies

- 📖 the report's shape and every judge rule live in [references/read.md](references/read.md) §§ 3–4; clio reads it before printing or reworking a report, never prints from memory
- **every digest is also the artifact** (dima 2026-09-28: «let's have it as a habit part») —
  one standing page, [Evergreen](https://claude.ai/artifact/Vgx13BgNQyieSfcTNvsi4p), republished
  by `url` each run with that run's date in its header: 🌟 cards with a borrow line and a status
  chip per borrow (shipped · waiting · queued), the brew lines worth reading, the count line,
  and a chart where a perf claim has numbers. its source lives at
  `_clio/evergreen/page.html` — read it, swap the content, keep the design. the page mirrors the
  report; the `ask` borrows and the merge round go to orbit.
- his knob: «too much» / «missed X» → tighten or widen the rule in `references/read.md`.

## act on his word

the merge round runs on the evergreen turn itself, by clio, no ask (dima, 2026-11-18: «be more proactive … upgrade everything at once»); a steer of his subtracts from it: read [references/merge-round.md](references/merge-round.md) first — the merge, the sweep, the majors, the red fixes, the hold.

weekly with brew, the skills lane and the plugins lane join the digest: read [references/weekly-lanes.md](references/weekly-lanes.md).

## a green run with no prs

- first count prs by title (`gh pr list --search 'evergreen in:title'`): the bot is `app/x-renovate`, so an author filter misses them; none opened past a due window → `gh workflow run renovate.yml -f logLevel=debug`, then read `RENOVATE_FORCE` and the branch summary in `gh run view <id> --log`
- a preset in doubt: a renovate dry run on a committed scratch repo extending that ref

## completion criterion

every open renovate PR is a card or silent with a green ci; every card carries brings, breaks and, on a major, since;
the breaks answer names the peer-range check; every ➡️ is one of merge / codie /
hold; on a wednesday every app in the index was read and is a line or silent, and the markers
advanced after the digest; `brew upgrade` ran and its line is in the report; every merge ran, `pnpm outdated -r` is empty in both repos but for a major in orbit or a named hold, and the
reply names what landed, what waits on a rebase, and the new prod deploy count.
