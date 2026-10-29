---
fed-by: recipe refresh-pr-flow
when:
  - { kind: command, value: gh pr }
  - { kind: command, value: gh stack }
  - { kind: command, value: x lane pr-open }
  - { kind: skill, value: x:crew-codie }
---

# pr-flow — how a change travels from a coder's branch to main

## core

**the gate** — a pr merges once the verifier is clean on its head, checks ran green for that head and no thread is open, a bytes head getting clio's approve on dima's account; a risky path (workflows, settings, guards, memory files, secrets, release) merges too, named in the look card; a pr editing the guards, the review workflows or merge-auto's own code waits for dima's word (2026-10-22), given live or ahead in the chunk's `## signed` block as `merge: pre-approved` (`craft-fleet-flow` § lane init, 2026-10-23); a revert of a merge-auto merge on main within 7 days puts on the brake, and every merge waits for his word until it lifts — unless he said, before going afk, that clio may merge alone (dima, 10-22, [FRM-401](https://linear.app/x-com/issue/FRM-401)). `x lane merge-auto <pr>` checks it and merges ([FRM-401](https://linear.app/x-com/issue/FRM-401)); the lists live in `x/go/risky.json`.

**plain prs are the default.** our waits are short (coder pr open → merge median, 2026-10-06..20: frame 22 min over 23 prs, bytes 87 min over 5), so a stack has little wait to hide. a stack earns its place only for one coder building 2–4 dependent parts of one feature, held under a day, in bytes. the measurement lives in `docs/test-drive/stacked-prs.md`.

**our tools assume one pr per branch** — a stack breaks each of these until it is taught otherwise:
- `x lane pr-open` opens onto main (`x/go/lane.go`); a stack layer needs its base set to the layer below
- `x lane merge-main` makes a merge commit; github stacks want a straight history — `x lane rebase-main` gives one ([FRM-403](https://linear.app/x-com/issue/FRM-403))
- `x:crew-codie` forbids rebasing a pushed branch — exactly how a stack is kept current
- `x lane push` does not force-push; `x lane rebase-main` is the one force-push door, `coder/*` only, leased on the sha it read
- bytes' `review:clean` is tied to one commit: every restack hands the upper layers a new head, so a new review round each, or past the one-round cap clio's approve on the verifier's clean
- bytes' path-filtered ci jobs see only one layer's diff, since a layer's base is the layer below; a restack reruns full ci on every layer
- renovate merges move main every 2–3 days (frame 6, bytes 3 in 14 days), each one a restack of any open stack

**github stacks (`gh stack`, ga 2026-10-06)** — the best agent tool today, and fragile:
- install: `gh extension install github/gh-stack`, its agent skill with `gh skill install github/gh-stack`; `gh stack view --json` reads state
- its lock covers the whole clone: a coder in another worktree is blocked, even on an unrelated stack (gh-stack #568, #570) — one agent changing stacks per clone
- some commands report success on failure (#472, #566); one submit wiped a branch (#557); auto-merge on a stack is not supported (#504)
- the cheap path: `gh stack link` turns branches made by any tool into a stack in one api call, so `x lane` can keep making the branches; it refuses a pr with auto-merge on
- merge from the bottom, or a contiguous range upward

**graphite (`gt`) — dropped 2026-10-20, never tried** (dima): cursor owns it, no `gt` release since 2026-05-04, its reviewer trailed greptile and coderabbit. not re-proposed without a new reason.

**linear** shows stack order and status in diffs (2026-10-08); it reads, never manages. it needs «enable code reviews» on, code access per repo and each user's personal github connection (not checked in x-com yet). put the ticket id in every layer's branch name; a ticket linked to several prs closes at the last merge.

## sources

- the 2026-10-20 run: `recipes/refresh-pr-flow/last/` (exa, parallel, an opus source lane); the day's research docs `docs/research/graphite-and-stacked-prs.md`, `docs/research/code-review-human-gate.md` — this file corrects two of their lines: `gh stack` is not shipping weekly (last release 10-09), and renovate moves main every 2–3 days, not nightly
