---
status: live
until: 2026-11-05
dies-when: the verdict line below is written
fits: codie
---

# stacked-prs — do stacked prs pay for a solo dev with an agent fleet, or add a burden

Ticket: [BYT-98](https://linear.app/x-com/issue/BYT-98)

dima, 2026-10-20: «i want a proper way to measure if stacked prs actually help or not. what are the pluses and the minuses? is it even worth it, or is it better to just use regular prs? is it a gain or an additional maintenance burden?» · «we can shape the test drive right away and measure it right away; maybe we spawn a mods lane with a coder today or tomorrow, so we will have a use case.»

**test card:** we believe a codie job with 2+ dependent parts lands faster and reviews cleaner as a stack of small prs than as one big pr · we test it by running real multi-part codie lanes as a stack — github stacks (`gh stack`) only, graphite dropped 2026-10-20 — tried by hand, never in an automated sweep (his 09-26 call) · we measure per lane, against a plain-pr lane of similar size: open → merge wall time, sixth sense rounds per layer and in total, restacks and the ci reruns they cost, clio's and codie's hand-steps that exist only because of the stack (rebase, retarget, re-review), and dima's look time · we're right if the stacked lanes merge at least as fast with fewer review rounds, and the stack-only steps cost under ~10 % of the lane's turns
**kill rule:** a restack breaks a guard or `x lane` verb so badly that codie needs clio's hands mid-lane twice in one stack, or the stack-only steps pass a third of the lane

## day 0

the refresh-pr-flow first run (2026-10-20, exa + parallel + an opus source lane over the docs, the users' reports and our own ci) is the day-0 pass; its distill is `docs/knowledge/pr-flow.md`. what it changes here: our medians are short (frame 22 min, bytes 87 min), so the gain to look for is smaller reviewable diffs, not speed; and four of our tools break on a stack before the first round can run.

## before round 1 — the blockers
- ~~`x lane pr-open` sets no base other than main~~ — `--base` and `x lane stack link|view` landed with FRM-404 · `x lane merge-main` merges where a stack wants a rebase · `x:crew-codie` forbids rebasing a pushed branch · `x lane push` does not force-push — the lane uses `gh stack link` over branches `x lane` made, and codie's brief lifts the rebase rule for this lane only
- bytes' `review:clean` re-arms on every restack — FRM-401 decides first, or each restack costs a review round per layer
- the setup chores, when FRM-404 lands (dima, 2026-10-20: «when we get closer to gh stacks, after the cli lane or along with it»): `gh extension install github/gh-stack`, its agent skill (`gh skill install github/gh-stack`), linear's «enable code reviews» setting checked; docs.github.com says stacks need «no setup or enablement», yet gh-stack exits 9 («Stacked PRs are not enabled for this repository») when the stacks api answers 404 — the first `gh stack` call in frame and bytes shows which holds

## stress list
- `gh stack link` over `x lane` branches — the next multi-part codie lane, cut into 2–3 layers — open → merge time, review rounds per layer, stack-only hand steps
- `x lane stack view` after `x lane stack link` — view reads github's stacks api, since gh-stack's own `view` reads a local file its `link` never writes — the first linked stack — the layers print bottom-up or not
- the clone-wide lock (#568) — a second codie in another worktree during the lane — blocked or not, minutes lost
- sixth sense on one layer vs the whole stack — `x:crew-sixth-sense` on layer 1, then the top — rounds, findings per layer
- renovate moving main under an open stack — whichever 2–3-day merge lands — restack time, ci reruns
- linear on a stack — the ticket id in every layer's branch — each layer linked, closed at the last merge; the settings checked first

## rounds

### round 1 — FRM-405, the x lane commit riders (2026-10-23, in progress)

- layers: [#99](https://github.com/dvakatsiienko/frame/pull/99) `coder/FRM-405-riders` onto main → [#100](https://github.com/dvakatsiienko/frame/pull/100) `-2` → [#101](https://github.com/dvakatsiienko/frame/pull/101) `-3`; each opened with `x lane pr-open --base <layer below>`, no hand step
- each layer is one rider, one exit line, one commit — the diffs read 1 concern each (+27, +91/−1, +67/−1 lines of go, tests included)
- gh-stack v0.2.1 installed for this round (`gh extension install github/gh-stack`)
- ⚠️ blocker: `x lane stack link --apply` failed inside gh-stack — «migrating stack state: worktree administration path "/Users/dima/frame/.git/worktrees/.DS_Store" is not a directory». a Finder file beside the worktree admin dirs; no upstream issue yet. dima trashed it (o64) and the issue is [gh-stack#587](https://github.com/github/gh-stack/issues/587) (o65)
- ⚠️ blocker 2: `gh stack link` pushes every branch it is named, and a frame worktree's push dies at the mirror gate → `x lane stack link` now names the layers' open prs by number, which gh-stack never pushes (fixed in layer 3)
- open → merge: 2h20, 2h12, 2h02 per layer (all merged 15:33, blockers included); the plain FRM-422 pr (+418) took 69 min
- FRM-423 (pr 0 + 2 layers, #105 → #106 → #107): 28, 68 and 43 min, one merge-auto call; the coder: worth it for dependent parts, ~28 min of stack-only hand steps, late scope adds misfit
- reading after 2 stacks (cclio, 2026-10-25, inference): no speed gain at our medians; the gain is one concern per layer for the verifier, so a stack fits only one chunk with dependent parts big enough to split (a guess: over ~400 lines); shape-lane would mark it «stack: N layers» at the sign

## verdict
