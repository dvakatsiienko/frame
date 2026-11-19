---
status: live
until: 2026-12-19
dies-when: the verdict line below is written
fits: codie sixth-sense
---

# size cap — a refusing line on every code file, 1,200 lines, giants capped

Ticket: FRM-629 (dima's words: W30, W31, W39, W40)

born 2026-11-19 on dima's word (W40: «let's try the refuse and test drive it for a month and let's see how much the refusal will interfere with Codie's flows»); the numbers behind 1,200: `docs/research/agent-giant-files.md`.

**test card:** we believe a commit refusal at 1,200 lines (a `size:` line to 2,000, today's giants capped at their size) keeps agents from growing giant files, at a cost codie barely feels · we test it by every frame commit that touches a code file until 2026-12-19 · we measure each refusal: the file, its lines, whether it was right (a real new concern the file should not hold) or wrong (a split that made the code worse, a cap that blocked an urgent fix), and the minutes it cost the codie · we're right if no giant grows past its cap, a new file past 1,200 carries its `size:` line, and refusals cost under 15 min each on average

**kill rule:** two wrong refusals in one week, or one refusal that blocks dima → soften to a warning that logs the same count.

## the setup

- the rule: `x:guide-code` § file size, read by every coder
- the check: `script/lib/code-size.test.ts`, run at commit by lefthook's `code-size` gate on any staged `ts`, `tsx`, `js`, `go` or `sh` file
- the giants: one row each in that test, capped at their size on 2026-11-19; a cap goes down by hand as a file shrinks, a raise is dima's word, dated in its row
- the grade: `x:crew-sixth-sense` step 1, «no touched file past the limit»

## the refusal log — one line per refusal, by the codie it stopped or by clio at land

- date · file · lines / cap · right or wrong · minutes lost · what the codie did (split, `size:` line, asked for a raise)

## rounds

## verdict
