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

## stress list
- `gh stack` — the next mods coder lane, cut into 2–3 layers — the measures above
- `gt` (graphite) — the lane after it — the same measures, the A/B
- verifier on one layer vs the whole stack — `x:crew-verifier` on layer 1, then the top — rounds, findings per layer
- renovate moving main under an open stack — whichever night it happens — restack time, ci reruns
- linear on a stack — the lane's ticket with the id in every layer's branch name — does it link each layer, does it close at the last merge

## rounds

## verdict
