---
status: dropped
until: 2026-11-07
dies-when: the verdict line below is written
---

# graphite — its ai review and its stacked prs, then github's native stacks beside it

Ticket: none

dima, 2026-10-14: «I feel that Graphite will not prove itself either as an adversarial code reviewer or even as a stacked PR tool; keeping it only for stacked PRs is probably not worth it, because GitHub has native stacked PRs and most likely they work better. Still, I want us to test drive Graphite to see how it works, get experience out of it and explore out of curiosity.»

**frozen** until a lane has room for it: no capacity on 10-14; re-checked 11-05, when the bigger plan starts. the parallel adversary reviews before it are measured and closed in `review-stack.md` (greptile dropped, coderabbit adopted).

**test card:** we believe graphite's review finds defects coderabbit and sixth sense miss, and its stacks make many-lane work easier to land · we test it by one real multi-lane stretch on bytes: its review on 2 codie prs beside coderabbit, and one stack of 3 prs, then the same stack as github native stacked prs · we measure unique true findings, noise, minutes and cost per review; dima's minutes to review and merge a stack, rebase pain, ci runs per stack · we're right if graphite's review finds ≥1 unique true defect per pr on a free quota, or its stack beats github's native one on dima's merge minutes

**kill rule:** no free quota for the review, and github's native stacks match graphite's in the first stack — drop it, keep the experience notes.

## stress list

- graphite ai review on a codie pr — beside coderabbit's on the same head — unique, true, noise, minutes
- a stack of 3 prs in graphite (`gt` cli) — dima's merge minutes, rebases, ci runs
- the same stack in github native stacked prs — the same numbers
- graphite's free quota — what it covers, where it stops

## rounds

## verdict

- 2026-10-20 · **dropped, never run** (dima): cursor acquired graphite and builds something else; no `gt` release since 2026-05-04, ~6 months; its ai reviewer trailed greptile and coderabbit in our earlier review runs, and greptile was itself dropped for low value. github's native stacks are closer to the platform and more reliable; the measurement moves to `docs/test-drive/stacked-prs.md`, github stacks only.
