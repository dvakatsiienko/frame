---
status: live
until: 2026-12-21
kill-read: 2026-12-07
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
- the check: `script/lib/code-size.test.ts`, run at commit by lefthook's `code-size` gate whenever a `ts`, `tsx`, `js`, `go` or `sh` file is staged, a delete included
- the giants: one row each in that test, capped at their size on 2026-11-19; a cap goes down by hand as a file shrinks, a raise is dima's word, dated in its row
- the grade: `x:crew-sixth-sense` step 1, item 3 (the tests), «no touched file past the limit»

## the refusal log — one line per refusal, by the codie it stopped or by clio at land

- date · file · lines / cap · right or wrong · minutes lost · what the codie did (split, `size:` line, asked for a raise)
- 26 Nov · `script/lib/gate-queue.test.ts` · 1,220 / 1,200 · right: its cpu-log block and its kit were concerns of their own · 8 · split: `gate-queue-kit.ts` (the shared fixture), `gate-queue-cpu.test.ts` (the cpu log), the main file 1,021 (mods codie, FRM-689 queue rider)
- 26 Nov · `home/.config/herdr-app/mods/x-herdr-chat/quill-mini.test.ts` · 1,223 / 1,200 · right: the placing rows are a pure function's and need none of the box's world · 6 · split: `quill-mini-place.test.ts` (miniPlace's rows), a W68 row folded into its sibling, the main file 1,196 (herdr codie, FRM-585 fix round)

## rounds

## verdict
