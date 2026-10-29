---
date: 2026-09-20
slug: the-chords-and-the-vet-day
tickets: [DOT-254, DOT-232, DOT-244, BYT-41]
posted: {health: yes}
---

# 🗞️ cclio's gazette · the chords and the vet day — a served app in one day, and the fleet learns to vet its own

## shipped

- **chords is live** ([DOT-254](https://linear.app/x-com/issue/DOT-254), closed): the hand-wired hotkey map became `hotkeys/chords/` — a vite app served by the launchd job on 7373, presses over sse, notes in a committed json with a filter, `/stats` showing every table of `hotkeys:top` untruncated with live counts, and the one-action move that writes `until` + `since` so press history follows the meaning. two coders, one verifier, three verifier rounds, 11 findings closed, 40 commits squashed into one
- **impeccable ran its first full refinement**: `PRODUCT.md` and `DESIGN.md` seeded with dima at the interview, then `layout → typeset → harden → audit → polish`, each judged in an A/B. the recipe is written (`docs/knowledge/impeccable-refine.md`); measured: the tool cost ≈ 4 % of the coder's context, the measuring cost the rest
- **the verifier loop v2**: findings go to the coder, the coordinator reads one line per round; both members scored the role 8–9/10 for one reason — it found the primary button shipped invisible after five passes and a detector at zero
- **the gazette left cw memory**; the renderer, the frontmatter and the cloud job are gone (dima's ask)
- **gmail is agent-reachable**: `gmailctl` filters as code (blocklist git-crypt encrypted in a public repo), an apps script keeps spam read for newton, `himalaya` reads the inbox through a 1password key, a raycast «gmail: block sender» command
- **evergreen gained the apps lane** ([DOT-232](https://linear.app/x-com/issue/DOT-232)): 15 self-updating apps read by per-app changelog markers, a monday-anchored due line at boot, a 💡 borrow answer on every card
- **jev has a vet**: every flow sits in a 14-day clean window before it is trusted, verdicts per lane, a fixture suite (`jev:test`), and a third flow, `flawlog-lanes`, laning the flawlog before the flush
- **trophy-sys survives a poisoned mac resolver** (bytes): a `resolve4` fallback under undici and a legible error naming the `dig` vs `ping` discriminator
- **history rewritten**: two personal files dropped from every past commit and re-added as ciphertext, force-pushed under a one-push protection flip

## tricks gained

- a green typecheck answers «did the configured files pass», never «are my files configured» — `hotkeys/*.ts` sat in no tsconfig for a week
- github creates no `pull_request` run while a pr is conflicting; «no checks reported» reads calm and is the opposite — merge main into an open pr within the hour
- a control is measured in its enabled state; a structural change invalidates every layout number banked before it
- `git-crypt unlock` inside a worktree dies on its own `git status` — copy the key into `.git/worktrees/<name>/git-crypt/keys/` and checkout
- a declarative tool's first `apply` on a live account imports what is there first — gmailctl deleted two old filters
- chrome ignores every `::-webkit-scrollbar` rule the moment a standard `scrollbar-*` property is also set
- a spawn note never overrides a contract: «report to me only» sent every verifier verdict through a hop the skill had already removed

## state

- phase 4 of chords (dima's steers) is open as freebies on main; the `PRODUCT.md` re-init waits for the next chords touch; the pre-rewrite bundle sits in `~` until the next boot proves the rewritten main
- DOT-232 stays In Progress: the apps lane's first live run is monday 09-21, the daily settings-key half is unbuilt
- the verifier's bytes trial (ci reviewer as the control) is the next pr-lane coder there

## trail

- shipped: chords v2 live and DOT-254 closed · impeccable's first full refinement with a written recipe · verifier loop v2 · gazette out of cw · gmail stack · evergreen apps lane · jev vet + suite · trophy-sys resolver · history rewrite
- open: chords phase 4 steers · PRODUCT.md re-init next chords touch · evergreen first live run 09-21 · verifier's bytes trial
- state: dotfiles + bytes pushed after the rewrite; no coders; two jev misses recorded and reworded
