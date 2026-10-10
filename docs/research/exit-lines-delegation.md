---
dies-when: the next refresh-crew-coordinator run distills it (the habit landed in cclio:shape-lane, 2026-10-10)
---
Ticket: none

# exit lines, delegated: is it safe? (source + our record lane)

the source and record lane of the brief «can an agent coordinator write a ticket's acceptance criteria unreviewed?». two web lanes ran the same brief. read 2026-10-10.

## verdict

- **delegate with a check.** do not delegate fully, and do not go back to a full human read.
- the verifier loop catches build defects well. it cannot catch a line that passes as written while it misses the want, because the grader only has the line. that class is most of what our record shows (see «what the lint sees»)
- the check: one want-replay line per ticket, graded on its own; commands run at seal; a blind critic before seal. dima reads only the want line, and only on `feature` lanes (changes 1–7 below)

## our record: the counts

sample: the 10 tickets the brief named (`x linear read … --comments`, plus a read-only `x linear api` history query for edit times and actors). the delegation rule is «they are cclio's: dima never reviews them» (`cclio/plugin-cclio/skills/shape-lane/SKILL.md:33`), which landed in 76d05145 at 2026-10-09 17:30 +0300 (14:30Z).

### lines sealed

- 56 exit lines across 10 tickets: FRM-345 6, FRM-355 6, FRM-356 7, FRM-359 6, FRM-366 6, FRM-367 8, FRM-372 4, FRM-373 3, FRM-374 4, FRM-380 6
- **dima's edits in the bodies: 0 of 10.** in the Linear history his only actions are Triage→Todo on FRM-345 (2026-10-07) and FRM-359 (2026-10-08). whether he read lines in chat is unknown
- **sealed after the rule (14:30Z on 10-09): 25 lines.** FRM-366 6 (sealed «18:2x» local, body edit at 15:40Z), FRM-367 lines 7–8 (added 10-10, edit at 06:52Z), FRM-372 4 (created 18:35Z), FRM-373 3, FRM-374 4, FRM-380 6
- **sealed on 10-09 or the night before, but before the rule: 31 lines.** FRM-345, FRM-355, FRM-356 and FRM-359 (body edits 10-08 21–22Z and 10-09 13:2xZ), plus FRM-367 lines 1–6 (sealed 2026-10-09; the ticket was created 13:40Z; whether lines 1–6 were in the creation body is unknown?)
- caveat: dima picked which lines exist on FRM-345 (the census re-grill, 15:52) and FRM-380 («dima's yes on all five»), but not how they are worded

### lines later found wrong, vague, unprovable or missing a case (by a coder or verifier)

- **20 of 56 lines** (20 of the 50 that have been built; FRM-380 is unbuilt, so its 6 are unknown)
- FRM-345: 2. #2 fits its letter but not its want (`2026-10-09-FRM-345-coder.md:6`, `-verifier.md:3`). #3 names a command that cannot run (`-coder.md:7`, `-verifier.md:4`)
- FRM-355: 4. #1 passes without proving the want (`2026-10-09-FRM-355-verifier.md:5`). #3 is too broad read literally. #5 was already on main (`-coder.md:9`). #6 has two owners (`-verifier.md:4`)
- FRM-356: 3. #1 rested on a wrong premise: the refusals came from cc's worktree isolation, not the guard (`2026-10-09-FRM-356-coder.md:7`). #4 took 4 rounds of hostile variants (`-coder.md:5`, `-verifier.md:3`). #6 grew mid-review twice and still accepts one-character targets (`-verifier.md:3`, `:18`)
- FRM-359: 5. #2 passes for a file but fails for a dir. #3–4 are keyword proxies that prove little. #5–6 are split across owners outside the pr (`2026-10-09-FRM-359-verifier.md:3-5`)
- FRM-366: 1. #2 was wrong about settings precedence: a repo top's `settings.local.json` outranks every subfolder's, so «frame's 92 overrode cclio's 70» (commit 6515d19d, 10-10 11:30 +0300). the ticket went Done at 10-09 18:34Z, and the body was edited at 10-10 08:31Z: the line now reads «probed 10-10». its retro (`2026-10-09-FRM-366-coder.md`) does not name it
- FRM-367: 2. #3 «a new file under a skill dir» left out renames and moves, which became a bypass (`2026-10-10-FRM-367-verifier.md:3`, `-coder.md:5`). #6's merge order surfaced only in round 1 (`-coder.md:4`). also, no line covered secrets; matt's code-review caught plaintext git-crypt files bound for the Trash (`-coder.md:9`)
- FRM-372: 2. #1 read literally gave noise: 15 of the top 20 were shell basics (`2026-10-09-FRM-372-coder.md:4`). #4 «reaches dima through cclio» is a hand-off, not a check a coder can close (`:9`)
- FRM-373: 1. #3 and the brief pull opposite ways (`2026-10-10-FRM-373-coder.md:3`)
- FRM-374: 0. «the ticket body was a complete spec … zero questions needed» (`2026-10-10-FRM-374-coder.md:3`)
- FRM-380: unknown, no retro yet
- split by the rule: **16 of 31 pre-rule lines** and **4 of 19 built post-rule lines** (FRM-366 #2, FRM-372 #1 and #4, FRM-373 #3)
- the post-rule rate is not evidence that quality went up. FRM-366, 372, 373 and 374 have no verifier retro: they are quick lanes, graded by their own coder, so fewer graders were looking. the only post-rule verifier retro is FRM-367's. this is how I read it, not something the record measures?
- outside the list, same window: FRM-364 #3 left the boundary open (`2026-10-09-FRM-364-coder.md:6`, `-verifier.md:4`). FRM-357 #1 was wider than the safe set (`2026-10-09-FRM-357-coder.md:11`)

### misses dima caught after merge

- **exit-line misses tagged #dima-caught since 2026-10-09: 1, and it is outside the list.** FRM-354 closed on a coder's probe while «not checked» was dima's eye (`~/.claude/shelf/flawlog/2026-10-09-pocket-and-mods.md:11`, 16:22, before the rule). the other #dima-caught lines that day are about output format and stats (`:6-10`), not exit lines
- **after the rule: unknown, not zero.** the flawlog ends at 2026-10-09 16:22, and there is no 10-10 file
- FRM-366 #2 is a post-merge miss, but the catcher is not recorded. the 10-10 «dima» line in its `decided` hints it was him?
- FRM-380's want: #82 (FRM-367) merged at a head the verifier never saw. ccrow caught it, not dima (FRM-380 body)

### a measurement hazard

- a sealed line gets rewritten in place, so the current bodies hide misses. FRM-366 #2 was edited after Done. FRM-345 #3 carries «wording fixed 10-09». FRM-356 #6 grew twice mid-review. any count taken only from the bodies is low

## what the lint sees

- `x brief preflight` checks four things: a number, a surface (any backtick, url or port), two owners (the word «cclio» beside a non-cclio code span), and «already on main» (`x/go/preflight.go:61-104`, `x/go/brief.go:43`)
- of the 20 flagged lines it would catch 3 today: FRM-355 #5 (already on main), FRM-355 #6 and FRM-372 #4 (two owners: a bare «cclio» beside `cli-drift-check`). the two-owners rule reached main in 757fc86f (#81, 2026-10-09 20:05 +0300), before FRM-372 was created (18:35Z), yet 372 #4 was sealed; whether that seal ran with the rule is unknown?. FRM-359 #5–6 split owners without naming cclio, so `twoOwners` misses them (`preflight.go:168-179`)
- the classes it cannot see (17 of 20 lines; the main ones):
  - the letter, not the want: 345 #2, 355 #1, 372 #1
  - an unrunnable literal: 345 #3
  - a missing «for any» twin: 359 #2, 367 #3, 356 #4
  - a false premise or wrong fact: 356 #1, 366 #2
  - a proxy that proves little: 359 #3–4
  - two lines pulling apart: 373 #3
  - a split owner with no «cclio» word, a merge order, an over-literal line: 359 #5–6, 367 #6, 355 #3
- the written rules already name several of these: «covers every case it means», «checked against the real surface», «carries its one-command live count» (`cclio/plugin-cclio/skills/shape-lane/exit-lines.md:10,15,19`). they are prose a model reads, not a gate. 359 #2 and 367 #3 broke the «every case» rule after it was written
- a small contradiction: `exit-lines.md:8` says a line names «never a file path», while preflight's surface rule is satisfied by «a path, a port or a command in backticks» (`preflight.go:70`)

## primary sources

### github spec-kit (main at 04437605, 2026-10-10)

- a human gate on tests: «No implementation code shall be written before: 1. Unit tests are written 2. Tests are validated and approved by the user 3. Tests are confirmed to FAIL (Red phase)» (`spec-driven.md`, [repo](https://github.com/github/spec-kit/blob/main/spec-driven.md))
- the agent fills gaps without a review: «Make informed guesses based on context and industry standards … LIMIT: Maximum 3 [NEEDS CLARIFICATION] markers total» (`templates/commands/specify.md:123-128`)
- the agent self-checks against a rubric: «Requirements are testable and unambiguous» and «Success criteria are measurable». the doc frames this as «These checklists force the LLM to self-review its output systematically» (`spec-driven.md`, around its line 200)
- the quality checklist is the reviewer's, not the agent's: «reviewer-owned requirements-quality review artifacts … it MUST NOT mark generated items `[x]`. An agent may assist with evaluating items only when explicitly asked by the reviewer» (`templates/commands/checklist.md:32-36`)
- a «unit tests for English» rubric: «Scenario Coverage (Are all flows/cases addressed?)», «Edge Case Coverage (Are boundary conditions defined?)» (`checklist.md:160-165`)
- a separate read-only pass: `/analyze` is «STRICTLY READ-ONLY … user must explicitly approve before any follow-up editing» (`templates/commands/analyze.md:58`)
- the tension: the agent writes and self-checks the criteria, but the user approves the tests and the reviewer owns the checklist ticks. spec-kit never says acceptance criteria may skip a human

### kiro

- feature specs have a human gate per phase: «with edit and request-changes loops at each approval gate», and the flowchart runs `requirements.md → Happy? → no → Edit/Request changes` ([feature-specs](https://kiro.dev/docs/specs/feature-specs/), read with curl)
- dropping the gate is opt-in, and only on trust: «For well-understood features where you trust Kiro's output, Quick Spec runs all three phases automatically without approval gates between them» (same page)
- an automated critic before design: «analyze your requirements for logical inconsistencies, ambiguities, and gaps … Missing edge cases - failure modes, boundary conditions, and concurrent access scenarios not covered by the happy path» ([analyze-requirements](https://kiro.dev/docs/specs/analyze-requirements/)). the user resolves each finding, according to that page as read through WebFetch?
- our letter-not-want class, in their words: «A property that is too weak, or that states the wrong invariant, will pass while the real behavior is still wrong» ([correctness](https://kiro.dev/docs/specs/correctness/))

### papers

- self-correction needs an outside signal: «LLMs struggle to self-correct their responses without external feedback, and at times, their performance even degrades after self-correction» (Huang et al., [arXiv:2310.01798](https://arxiv.org/abs/2310.01798))
- a judge favours its own text: «an LLM evaluator scores its own outputs higher than others' while human annotators consider them of equal quality … a linear correlation between self-recognition capability and the strength of self-preference bias» (Panickssery et al., [arXiv:2404.13076](https://arxiv.org/abs/2404.13076)). our coordinator, coder and verifier all run Claude Opus 5.5 (the run stamps in 8 of the 10 bodies; FRM-366 and FRM-380 carry none), so this applies directly
- LLM-written oracles encode what is, not what is wanted: «LLM-based test generation approaches mainly capture the actual program behavior making bug detection difficult» (Konstantinou et al., [arXiv:2410.21136](https://arxiv.org/abs/2410.21136))
- where the papers do not fit: that study looks at tests written after the code, but exit lines are written before it. our analogue is a line that encodes a wrong belief about the world (356 #1, 366 #2), not one that mirrors the diff

## where sources and record disagree

- spec-kit and Kiro both keep a human approval on criteria by default. our record cannot test that: nothing shows dima read the pre-rule exit lines (0 body edits), only that he grilled the `decided` sections. 16 of 31 pre-rule vs 4 of 19 post-rule says more about how many graders looked (a verifier on every pre-rule ticket, one post-rule) than about either gate
- spec-kit leans on the agent self-checking against a rubric. Huang and Panickssery say a same-model self-check is weak. our record agrees: the lint missed 17 of 20

## changes to how the coordinator writes exit lines (≤7)

1. **a want line.** the last exit line replays the incident or want behind the ticket («given the 10-07 red commits, the gate refuses them»), and the verifier grades it apart from the rest. this is the only line dima reads, and only on feature lanes. ties to: 345 #2, 355 #1, 372 #1, FRM-364 (`-verifier.md:4`), Kiro's «too weak … will pass»
2. **run every literal at seal.** each backticked command in a line is run once (dry mode where it writes), and its exit code is noted beside the line; preflight could do this. ties to: 345 #3, `flawlog/2026-10-08-fable-coordinator-and-wishes.md:10`
3. **name the hostile shapes.** a line that says «new», «any», «a named path» or «a lint» lists its twins: file and dir, rename and move, quotes and «», one character. ties to: 359 #2, 367 #3, 356 #4 and #6, FRM-357 #1
4. **a premise carries its proof.** a line that rests on a fact about the world (who refuses, which file outranks which, a count) carries the command and its output from seal time. ties to: 356 #1, 366 #2, `exit-lines.md:19`
5. **no silent rewrite.** a changed sealed line keeps the old text struck through, with a date and a reason, and the change counts as a miss in that lane's retro. ties to: 366 #2 (edited after Done), 345 #3, 356 #6 (the measurement hazard above)
6. **one owner and one gradeable surface per line.** a hand-off goes to `out` or a cclio todo, never an exit line. preflight also flags a line naming a surface the pr does not touch, not only the word «cclio». ties to: 355 #6, 359 #5–6, 372 #4, `preflight.go:168-179`
7. **a blind critic before seal on every lane, quick ones too.** a fresh agent sees only the want plus the lines and answers «how does this pass while the want fails?». use a different model family where one is available. ties to: 17 of 20 misses outside the lint; quick lanes having no verifier (366, 372, 373, 374); Huang, Panickssery; spec-kit `/analyze`; Kiro analyze-requirements

## not verified

- the hour FRM-367 lines 1–6 were sealed, relative to the 14:30Z rule
- who caught FRM-366 #2 after merge
- any dima catch after 2026-10-09 16:22: there is no flawlog file for it
- whether dima read any exit line in chat before the rule
- FRM-380's lines: not built yet
- the user-resolution detail on Kiro's analyze-requirements page, read only through WebFetch
