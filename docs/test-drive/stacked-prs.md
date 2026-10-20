---
status: live
until: 2026-11-03
dies-when: the verdict line below is written
---

# stacked-prs — do stacked prs pay for a solo dev with an agent fleet, or add a burden

Ticket: [BYT-98](https://linear.app/x-com/issue/BYT-98)

dima, 2026-10-20: «i want a proper way to measure if stacked prs actually help or not. what are the pluses and the minuses? is it even worth it, or is it better to just use regular prs? is it a gain or an additional maintenance burden?» · «we can shape the test drive right away and measure it right away; maybe we spawn a mods lane with a coder today or tomorrow, so we will have a use case.»

**test card:** we believe a coder job with 2+ dependent parts lands faster and reviews cleaner as a stack of small prs than as one big pr · we test it by running real multi-part coder lanes as a stack — github stacks (`gh stack`) first, then graphite (`gt`) on the next one for the A/B — tried by hand, never in an automated sweep (his 09-26 call) · we measure per lane, against a plain-pr lane of similar size: open → merge wall time, verifier rounds per layer and in total, restacks and the ci reruns they cost, cclio's and the coder's hand-steps that exist only because of the stack (rebase, retarget, re-review), and dima's look time · we're right if the stacked lanes merge at least as fast with fewer review rounds, and the stack-only steps cost under ~10 % of the lane's turns
**kill rule:** a restack breaks a guard or `x lane` verb so badly that a coder needs cclio's hands mid-lane twice in one stack, or the stack-only steps pass a third of the lane

## day 0

the refresh-pr-flow first run (2026-10-20, exa + parallel + an opus source lane over the docs, the users' reports and our own ci) is the day-0 pass; its distill is `docs/knowledge/pr-flow.md`. what it changes here: our medians are short (frame 22 min, bytes 87 min), so the gain to look for is smaller reviewable diffs, not speed; and four of our tools break on a stack before the first round can run.

## before round 1 — the blockers
- `x lane pr-open` sets no base other than main · `x lane merge-main` merges where a stack wants a rebase · `x:crew-coder` forbids rebasing a pushed branch · `x lane push` does not force-push — the lane uses `gh stack link` over branches `x lane` made, and the coder's brief lifts the rebase rule for this lane only
- bytes' `review:clean` re-arms on every restack — FRM-401 decides first, or each restack costs a review round per layer

## stress list
- `gh stack link` over `x lane` branches — the next multi-part coder lane, cut into 2–3 layers — open → merge time, review rounds per layer, stack-only hand steps
- the clone-wide lock (#568) — a second coder in another worktree during the lane — blocked or not, minutes lost
- verifier on one layer vs the whole stack — `x:crew-verifier` on layer 1, then the top — rounds, findings per layer
- renovate moving main under an open stack — whichever 2–3-day merge lands — restack time, ci reruns
- `gt` (graphite) — the lane after, for the A/B, only while graphite is a target — the same measures, plus the delete-on-merge closing the layers above
- linear on a stack — the ticket id in every layer's branch — each layer linked, closed at the last merge; the settings checked first

## rounds

## verdict
