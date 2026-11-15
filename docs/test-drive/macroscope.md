---
status: live
until: 2026-11-22
dies-when: the verdict line below is written
---

# macroscope — an outside ai code review, as a pr app and a local cli

Ticket: none

dima, 2026-11-15 23:11: «/clio:shape-test-drive yourself for macroscope, 1w … I'm actually mostly interested in the CLI code review because it's faster and there's no need to wait for CI». research: [macroscope.md](../research/macroscope.md); the probe was pocket PK-436.

**test card:** we believe a macroscope review catches real bugs sixth sense misses, cheaper and sooner than a pr round · we test it by the cli on every quick-lane chunk's commits (mods, herdr) and the github app on every side-lane pr in frame and bytes · we measure findings (real / noise), the ones sixth sense also found, seconds, $ per review, against sixth sense's round on the same diff · we're right if ≥1 real finding sixth sense missed per 5 reviews, ≤1 noise finding per review, and the week's spend stays under $25
**kill rule:** a week's spend past $50, a card charge, or 3 reviews in a row with only noise

📌 the setup (2026-11-15):
- workspace: frame + bytes linked, auto-refill off (dima), a monthly limit set, detection mode Budget
- ⚠️ **Status (commit summaries, $0.05 a commit) must be off on frame**: frame landed 1,736 commits on main in the last 7 days (`git rev-list --count --since='7 days ago' origin/main`), ≈ $87 a week, the whole credit
- bytes evergreen prs: excluded through Skip PRs by Author (renovate) or reviewed by hand mention only
- no brew formula or tap exists (`brew search macroscope`, 2026-11-15); the cli comes from `prassoai/macroscope-local`'s `install.sh --tools none --no-path` into `~/.local/bin/macroscope`, then an interactive sign-in by dima
- credit: $100 welcome credit (pr reviews), 1,000 agent credits a month, about $10, reset monthly (cli reviews)

## stress list
- github pr review, Budget — a side-lane pr (FRM-632 or FRM-633), a bytes pr — findings real / noise, $, minutes after push
- the same pr, Balanced via `@macroscope-app review using balanced mode` — one pr — findings delta vs Budget, $
- cli `macroscope codereview --base <sha> --mode budget --raw` — a quick-lane mods chunk at its end — findings vs sixth sense, seconds, agent credits
- cli on a herdr chunk — a quick-lane herdr chunk — same numbers
- pr summary written into the description — a side-lane pr — useful yes / no, does it clash with our pr body
- a reply to a finding on github — one disputed finding — does it concede or argue, a new charge or not
- spend read — Settings → Billing after each round — $ left, agent credits left

## rounds

## verdict
