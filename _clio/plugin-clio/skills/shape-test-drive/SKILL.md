---
description: load on «test drive», «try X», «trial», «let's try», a new tool dima drops for a look; when a tool, a member, a skill or a habit goes on trial, a round is logged, `pnpm test-drive:check` reds or names a trial due, and at the halt's trial board.
---

# /clio:shape-test-drive — a trial, born to verdict

dima, 2026-10-14: «a shape-test-drive skill that sets the test drive flow properly with the correct sequence, so you never forget anything related to test drives». a trial is a running measurement: it is used as often as it fits, measured every time, and closed by a verdict, never by silence.

**one home per trial**: `docs/test-drive/<subject>.md` (frame, so a member can append its own round; `_clio/` is closed to other sessions). its `status:` and `until:` live in its frontmatter and nowhere else (dima, 2026-10-11, o139: «keep the test drive list only in your single place, so it won't drift») — a rule, a skill, a recipe or a reminder points at the file, never copies the date. `pnpm test-drive:check` reds a copy.

## 1. birth — done when the file exists and the check is green

- the file from the template below, status `live`, `until:` a real date (14 days by default; no «standing», no «three runs» — a count becomes the date it will likely reach)
- **the test card**, four lines: we believe <the gain> · we test it by <the real asks it will meet> · we measure <seconds, cost, tokens, hit or miss, against the usual door> · we're right if <the threshold that means adopt>
- **a kill rule**: what drops it early
- no ⏰ line or pocket item for the trial; a member on trial points at the file from its own contract
- done: `pnpm test-drive:check` exits 0 and lists it

## 2. day 0 — before the first real use

two passes, both wide (dima, 2026-09-28: «encourage yourself to proactively use all vetted tools and ensure the widest exploration of vetted tools … explore strong and weak sides, upfront»):
- **the users**: use cases, strong and weak sides, gotchas — the tool's own blog and cookbooks, what its users report
- **the docs, whole**: walk the whole docs index (an `llms.txt` or the api spec when there is one), every product and feature, not the headline ones
- out: a **stress list** in the file, each feature paired with the real fleet ask it will be tried on and the numbers it will record. done: the list exists

## 3. every use — done when the round line is in the file

- each use is one round line: date · the ask · the numbers · a grade against the usual door. a round without numbers is an anecdote
- **widest, not deepest**: one real try per stress-list feature beats ten of the one that works; an untried feature at the verdict is named untried, never folded into «fine»
- **alone in its lane** (dima, 2026-10-02: «don't have any parallel activities … we can only parallelize tools that we have proven by usage»): no parallel spawn or side ask folded in mid-round; proven tools run beside it, and talk or planning in the thread is not a parallel activity
- a member appends its own round to the file; a member that cannot reach the file puts the numbers in its report and clio appends them

## 4. due — done when each due trial has its verdict ask in orbit

`pnpm test-drive:check` (the boot digest runs it) names what is due within 3 days and reds what is overdue or undated. for each:
- read the file's rounds against its «we're right if»
- one orbit ask per trial: **adopt** · **drop** · **extend once** with the reason and a new date; a second extension needs a new test card
- dima's tick decides; silence decides nothing

## 5. close — done when nothing still points at it as live

- `status:` flips (adopted · dropped · closed for a one-off measurement), a verdict line under the card with the date and the numbers that decided it
- adopted: the learnings fold into the skill or the memory that uses the tool, the same turn; dropped: uninstall, unwire, remove its lines
- every pointer to it (a contract line «on a test drive», a skill step) is reworded or cut; `rg --hidden '<subject>'` names them
- statuses: live · frozen (paused by an outside block, still dated) · parked (waiting on a named condition) · adopted · dropped · closed

## the template

```markdown
---
status: live
until: YYYY-MM-DD
dies-when: the verdict line below is written
---

# <subject> — <what it is, one line>

Ticket: none

**test card:** we believe … · we test it by … · we measure … · we're right if …
**kill rule:** …

## stress list
- <feature> — <the real ask> — <the numbers>

## rounds
- YYYY-MM-DD · <ask> · <numbers> · <grade vs the usual door>

## verdict
```
