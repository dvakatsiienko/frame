---
dies-when: the next refresh-crew-coordinator run distills it (the scheme already landed in x:pm, 2026-10-10)
---
Ticket: none (pocket pk-46)

# estimates and priorities that mean something — source-reading lane

brief: `scratchpad/brief-estimates.md` (pk-46). this is the primary-source lane: vendor docs, source code, and our own linear, transcripts and pocket, read-only.

## headline

- today's linear estimates **do track effort at the median, loosely**. rank correlation of estimate vs actual over 34 tickets that had a coder session is about 0.53 (wall span), 0.61 (assistant turns) and 0.64 (output tokens). the buckets overlap heavily, though: an estimate 2 ran 10–296 turns and an estimate 3 ran 36–980. only estimate 1 is tight (27–84 turns, 3–9 min)
- priority carries almost nothing. 0 of the last 50 done FRM tickets are p1 or p4: 21 are p2 and 29 are p3. no estimate or priority was ever changed after creation on 76 FRM tickets numbered ≥300
- the pocket's fields are set but nobody reads them. siesta says «estimates are not a filter (pk-46)» (`cclio/plugin-cclio/skills/siesta/SKILL.md:19`), and the size label `xs` has never been used

## our data (read-only, 2026-10-10)

### linear fields as set
- FRM's estimate scale is `"issueEstimationType":"linear","issueEstimationAllowZero":true,"issueEstimationExtended":true,"defaultIssueEstimate":1`, and BYT's is linear, not extended (`x linear api '{ teams { nodes { key issueEstimationType … } } }'`)
- the 50 most recent done FRM tickets (`x linear list --team FRM --state Done`, capped at 50):
  - estimates: 11 are 1, 22 are 2, 12 are 3, 1 is 4, 3 are 5, 1 is null
  - priorities: 21 are p2, 29 are p3, none are p1 or p4
- todo, 50 shown, capped (`x linear list --team FRM --state Todo`):
  - priorities: 19 are p2, 23 are p3, 8 are p4, none are p1
  - estimates: 13 have none; the rest are 5 at 1, 16 at 2, 10 at 3, 2 at 4 and 4 at 5
- set once, never touched again: the issue history of 76 FRM tickets numbered ≥300 shows no `fromEstimate/toEstimate` and no `fromPriority≠toPriority` entry (`x linear api` on `issues{history{fromEstimate toEstimate fromPriority toPriority}}`)
  - caveat: history was read 50 entries deep per issue, and a field set at creation leaves no history line. so this proves «never re-estimated», not «never set»
- the rule that sets them:
  - «estimate 1–5 = complexity and uncertainty, not wall-clock. 5 = design-heavy, 1 = mechanical.» (`frame/home/.claude/plugin-x/skills/pm/references/workspace.md:105`)
  - «p1 is rare — priority says how much a ticket matters. must-land-before-another is a `blocks` relation, never a priority bump.» (`workspace.md:103-104`)
  - «Role, priority and estimate are always filled and current — monitoring them is your job» (`plugin-x/skills/pm/SKILL.md:94`)
  - the data shows «filled», not «current»

### who reads the fields today
- the estimate has two readers:
  - «an item estimated 1 is solved now, unless dima says park» (`cclio/memory/craft-pm.md:20`)
  - the build stage: «wait: the ticket's estimate, then a ping» (`cclio/memory/craft-fleet-flow.md:14`). this maps points to no time, so the wait is undefined «?»
- the siesta pick reads neither field: «exhaust the pocket first … pick 1–2 🍀 freebies … estimates are not a filter (pk-46)» (`siesta/SKILL.md:19`)
- a third size signal already exists: «the lane is the ticket's first body line, `lane: <name>`», with freebie · quick · prototype · feature · app (`craft-fleet-flow.md:20-26`)

### actual effort per ticket (coder transcripts)
- method:
  - 38 jsonl files under `~/.claude/projects/*/` carry a `customTitle` matching `<TEAM>-N code`, e.g. «☕️ 🔧 FRM-373 code: lane shim + one parser». duckdb summed them per ticket: FRM-284 had 3 sessions, so 36 tickets; 34 of them have an estimate
  - span = last timestamp minus first. it includes waits on the verifier and ci, so it is the noisiest measure
  - turns = distinct assistant `message.id`
  - tokens = the sum of `usage.output_tokens` per message
  - not measured: verifier sessions, cclio's own time, dima's review time
- medians by estimate:
  - estimate 1 (n=4): 5 min, 42 turns, 24k output tokens. range 27–84 turns
  - estimate 2 (n=9): 33 min, 116 turns, 64k tokens. range 10–296 turns
  - estimate 3 (n=16): 39 min, 159 turns, 108k tokens. range 36–980 turns
  - estimate 4 (n=4): 127 min, 344 turns, 254k tokens. range 189–567 turns
  - estimate 5 (n=1, FRM-344): 126 min, 373 turns, 313k tokens
- rank correlation vs estimate (n=34): span 0.53, turns 0.61, output tokens 0.64. these are approximations: ties take the minimum rank, not the average «?»
- misses that matter:
  - BYT-106 at estimate 3 took 3 min and 36 turns
  - FRM-286 at estimate 2 took 2 min and 10 turns
  - FRM-284 at estimate 3 took 438 min and 980 turns over 3 sessions
  - FRM-341 at estimate 2 took 173 min and 277 turns
- `lane:` vs actuals:
  - quick (6 tickets): median 107 turns, range 27–277
  - feature (9 tickets): median 197 turns, range 108–373
  - the lane separates sizes about as well as estimates 2 vs 3 do
- priority vs actuals: p2 (n=23) had a median of 187 turns and 46 min, p3 (n=11) had 98 turns and 18 min. priority tracks size, not urgency
- one ceiling: only 4 tickets passed 400 turns (FRM-306 430, BYT-116 491, BYT-113 567, FRM-284 980). every other ticket finished in one session, under 400 turns

### the pocket
- config: `labels: ["xs", "s", "m", "l"]`, `priorities: ["now", "next", "later"]` (`cclio/backlog.config.yml:4,6`)
- 46 tasks:
  - size: 18 are `s`, 22 `m`, 6 `l`, 0 `xs`
  - priority: 6 `now`, 25 `next`, 15 `later`
  - the size shares the `labels` list with linear urls and parent ids. pk-25 carries `m`, `PK-38` and a linear url
- every task has an `ordinal`, but duplicates break the order: 2000, 10200, 10300, 10500, 20000 and 22000 appear twice each (`grep '^ordinal:'`)
- 33 of the tasks were created at the same minute, `'2026-10-09 10:38'`, in the migration. their size and priority were assigned in one batch and have no actuals behind them «?»

## vector 1 — what an estimate means when agents do the work

- finding: the sources disagree on the unit (points vs tokens vs appetite). they agree that big items are the problem, and that small slicing beats precise sizing
- linear: «Use estimates to describe the complexity or size of an issue.» «Cycles and projects use estimates to calculate effort and related statistics.» «Larger estimates usually mean that there is uncertainty about the issue's complexity.» «We find that breaking up issues into smaller ones is the best approach.» ([linear docs, issue properties](https://linear.app/docs/issue-property); `/docs/estimates` and `/docs/priority` redirect there)
- linear also says «By default, unestimated issues count as 1 point». so our 13 unestimated todo tickets read as 1s in any graph (same page)
- ron jeffries: «I may have invented story points, and if I did, I'm sorry now.» he advises slicing stories «down until they just need a single acceptance test» ([ronjeffries.com](https://ronjeffries.com/articles/019-01ff/story-points/Index.html))
- shape up: «Estimates start with a design and end with a number. Appetites start with a number and end with a design.» and «fixed time, variable scope» ([basecamp shape up ch. 3](https://basecamp.com/shapeup/1.2-chapter-03))
- paircoder, 400+ agent tasks over 12 months:
  - their 0–100 complexity score failed: two tasks scored 40 used 8,000 and 80,000 tokens
  - «We estimate in tokens, not hours»
  - type multipliers: bugfix ~0.8x, feature ~1.2x, refactor ~1.5x
  - they plan at ~80% of capacity for the 15–20% of tasks that run long
  - one vendor's own data ([paircoder.ai](https://paircoder.ai/blog/estimation-reality/))
- anthropic: the coding agent «was then asked to work on only one feature at a time … critical to addressing the agent's tendency to do too much at once», which «led to the model running out of context in the middle of its implementation» ([anthropic engineering](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)). this backs «fits one session» as a unit
- metr: models reach «almost 100% success rate on tasks taking humans less than 4 minutes» but «<10% … on tasks taking more than around 4 hours», with a horizon doubling «around 7 months» ([metr, 2025-03](https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/)). size predicts *failure risk* for agents, not only cost
- where they disagree:
  - linear treats a large estimate as «uncertainty». x:pm's assumption gate forbids exactly that: «Do not average it away into a bigger estimate» (`pm/SKILL.md:137`). our rule is the stricter one
  - jeffries and #NoEstimates say drop estimates. linear needs them for cycle graphs. we run no cycles «?», so that reader does not exist here
- unread: the towards-ai essay «story points stopped working…» returned 403 and was dropped. woody zuill's #NoEstimates post returned 404 and was dropped. a nathanfox.net post on agent story-point estimation failed to load and was dropped

## vector 2 — a rubric an agent can apply the same way twice

- finding: anchor each value to reference tickets and to a measurable ceiling, not to adjectives. our data gives the anchors. «complexity and uncertainty» (`workspace.md:105`) is the adjective scale that produced 2s and 3s nobody can tell apart
- paircoder: their abstract score failed, and only measured tokens per task type held up ([paircoder.ai](https://paircoder.ai/blog/estimation-reality/))
- jeffries' alternative is a structural test (one acceptance test), not a number ([ronjeffries.com](https://ronjeffries.com/articles/019-01ff/story-points/Index.html))
- our proxy: a ticket's count of exit lines is already a structural count (`craft-fleet-flow.md:12`, «cclio writes and preflights the exit lines»). nothing yet tests whether exit-line count predicts turns «?»
- reference tickets by the proposed buckets (turns from the transcripts):
  - minutes: FRM-334 (27 turns), FRM-314 (37), FRM-294 (47), FRM-286 (10), BYT-106 (36)
  - one session: FRM-336 (65), FRM-372 (116), FRM-355 (168), FRM-343 (258), FRM-346 (296)
  - more than one session: FRM-284 (980 over 3 sessions), BYT-113 (567), BYT-116 (491), FRM-306 (430)

## vector 3 — priority for one human and an agent queue

- linear:
  - «Set issue priority to indicate which issues to complete first.»
  - «Adding too many options makes it harder to set priority and leads to diminishing returns.»
  - «On any view ordered by priority, simply drag & drop an issue … above other ones to indicate it is more important. The exact position will be saved globally across your workspace»
  - «When an issue is marked as Urgent, Linear notifies the assignee»
  - ([linear docs, issue properties](https://linear.app/docs/issue-property))
  - so linear's own model is a coarse class plus a manual order inside it. the api field name for that position is unverified (`prioritySortOrder`?) «?»
- linear method: «Prioritize things that help you move the needle this week or month.» and «ask yourself if this is important to be done now or can it be done later» ([linear method](https://linear.app/method/prioritize-enablers-and-blockers))
- cost of delay / cd3: rank by cost of delay ÷ duration. «CD3 works perfectly well enough with noisy inputs on the denominator» ([black swan farming](https://blackswanfarming.com/cost-of-delay-divided-by-duration/))
- wsjf: «the relative cost of delay divided by the relative job duration» ([scaled agile](https://framework.scaledagile.com/wsjf); the rest of the page is behind a login, unread)
- backlog.md:
  - priorities form an ordered list where «The first value sorts highest» ([ADVANCED-CONFIG.md](https://github.com/MrLesk/Backlog.md/blob/main/ADVANCED-CONFIG.md))
  - `task list` «groups by status unless `--sort priority` prints one flat list» ([CLI-INSTRUCTIONS.md](https://github.com/MrLesk/Backlog.md/blob/main/CLI-INSTRUCTIONS.md))
  - `sortByPriority` breaks ties by task id, not by ordinal ([src/utils/task-sorting.ts](https://github.com/MrLesk/Backlog.md/blob/main/src/utils/task-sorting.ts))
  - `ordinal` is a float reordered by midpoint with `DEFAULT_ORDINAL_STEP = 1000` ([src/core/reorder.ts](https://github.com/MrLesk/Backlog.md/blob/main/src/core/reorder.ts)). whether `--plain` without `--sort` honours ordinal is unverified «?»
- where they disagree:
  - cd3 and wsjf want a duration in the denominator. linear's model wants none, only drag order
  - with a solo human and agent-done work, duration varies 10–30x inside a bucket (our data). cd3's own text says a noisy denominator is fine, which argues for the bucket and against precision

## vector 4 — measuring actuals cheaply

- finding: the transcripts already hold everything, and one duckdb query per halt is enough
  - session titles carry the ticket («☕️ 🔧 FRM-N code: …»)
  - every assistant line carries `message.id` and `usage.output_tokens`
- best measure: turns or output tokens. they correlate with the estimate better than wall span (0.61 / 0.64 vs 0.53), and they exclude waits on the verifier and ci
- paircoder runs the same loop: «Every completed task feeds back into the model» ([paircoder.ai](https://paircoder.ai/blog/estimation-reality/))
- not cheap yet:
  - the human cost (dima's review). paircoder flags «a ratio above 10:1 of human time to agent time» as the warning sign (same page)
  - a proxy we have is the halt's done test, which reads «the `#dima-caught` lines, the `#brief` lines and the pr open → merge median» (`craft-fleet-flow.md:28`)
- gap: tickets done in place by cclio leave no coder session. of the last 50 done FRM, 16 have one (by the title match)

## vector 5 — failure modes, seen in our own data

- priority collapse: 100% of 50 done tickets are p2 or p3. p1 is «rare» by rule, and p4 is never used on done work
- priority is a size proxy: p2 work ran a median 187 turns, p3 work 98
- set once, never updated: zero estimate or priority edits in 76 tickets' history
- a field nobody reads: the siesta pick explicitly ignores estimates (`siesta/SKILL.md:19`). the build wait reads «the ticket's estimate» with no mapping to minutes (`craft-fleet-flow.md:14`)
- an unused bucket: pocket `xs` 0 of 46, linear estimate 4 on 1 of 50 done
- three sizes for one thing: linear estimate, pocket label, and `lane:`, with no stated mapping between them
- ordering broken in silence: 6 duplicate pocket ordinals
- unestimated counts as 1 in linear graphs ([linear docs](https://linear.app/docs/issue-property)), so 13 empty todo estimates read as small

## vector 6 — what to drop

- jeffries and shape up both lean on slicing or appetite over point estimates ([ronjeffries.com](https://ronjeffries.com/articles/019-01ff/story-points/Index.html), [shape up](https://basecamp.com/shapeup/1.2-chapter-03))
- linear needs an estimate only for cycle and project graphs ([linear docs](https://linear.app/docs/issue-property)); whether we read those graphs is «?»
- our data says the 5-point scale holds about 3 distinguishable levels:
  - minutes (est 1)
  - one session (est 2–4, which overlap)
  - more than one session (a handful past 400 turns, all labelled 3–4)
- drop: the 4 (1 use) and the 2-vs-3 distinction as a judgement call. keep a 3-bucket size and one ordered list

## proposed scheme

### size: one meaning in both places
- linear estimate uses only 1, 2, 3. pocket labels map `xs`→1, `s`→2, `m`→3, and `l`→«split first». in the config, rename the labels so the size stops sharing `labels` with urls «?» (backlog.md has no size field; only labels)
  - **1 · minutes**: mechanical, one place, no open question; one coder session under ~100 turns. anchors: FRM-334, FRM-314, FRM-294
  - **2 · one session**: one coder session, ≤ ~400 turns, verifier clean within its rounds. anchors: FRM-336, FRM-372, FRM-355, FRM-343
  - **3 · more than one session**: will not fit one session. it gets split or shaped before a coder spawns, per linear's «breaking up issues into smaller ones is the best approach» and anthropic's «one feature at a time». anchors: FRM-284, BYT-113, BYT-116
  - uncertainty is not a size: the x:pm assumption gate stays as it is (`pm/SKILL.md:123-140`). an unanswerable question blocks the estimate, it does not inflate it
- the rubric cclio applies: name the closest anchor ticket in one body line (`size: 2 ~ FRM-372`). that makes the estimate auditable. unverified that a named anchor improves agent consistency «?»
- the lane rides along. a bucket of 1 suggests freebie or quick, 2 quick or feature, and 3 «shape first». the lane stays the workflow choice (`craft-fleet-flow.md:20`)

### priority: a class plus one ordered list
- linear p1 means drop everything and notify (linear's urgent notification). p2 = this week. p3 = the default. p4 = someday
- pocket `now`/`next`/`later` = linear p2/p3/p4, so one vocabulary spans both
- what to do next comes from order, not from the class:
  - linear: the manual order inside a priority view ([linear docs](https://linear.app/docs/issue-property))
  - the pocket: `ordinal`, after a one-time de-duplication
- a guard against inflation: an open p2 count over a cap (dima picks the number) is reported at the halt. the cap value is a proposal, not sourced

### who reads them
- the siesta pick: pocket first, ordered by ordinal; freebies = size 1 / `xs`. this replaces «estimates are not a filter» (`siesta/SKILL.md:19`)
- craft-pm: «estimated 1 is solved now» stays, now with a defined 1
- the build wait: 1 → check at 15 min, 2 → check at the session's end. the times are proposals, chosen from the medians above (5 min and 33–39 min)
- x:pm: on any scope change it re-sizes (`pm/SKILL.md:118`, «re-eval both»). nothing enforces that today; the history shows zero re-estimates

### checked against actuals
- at the halt: one duckdb pass over the day's coder transcripts (title → ticket, distinct `message.id` → turns, `output_tokens` → tokens). it prints each ticket's bucket and actual turns, plus misses
  - a miss: a 1 over 100 turns, or a 2 over 400 turns or over 1 session
  - the thresholds come from the 34-ticket table above
- a miss gets a line in the fold. if misses run above ~1 in 5 over a week, the anchors in the rubric get swapped for newer ones. the threshold is a proposal
- unmeasured, on purpose for now: dima's review minutes. the halt's existing `#dima-caught` count stands in

## could not verify
- `/docs/estimates` and `/docs/priority` on linear.app redirect to `/docs/issue-property`, which was read. `.md` variants returned 404
- towards-ai essay: 403. woody zuill #NoEstimates: 404. nathanfox.net: failed to load. scaled agile wsjf: the body is behind a login. all dropped
- linear's api name for the manual priority position «?»
- whether `backlog task list --plain` honours ordinal «?»
- the rank correlations use min-rank ties, so they approximate spearman «?»
- turns and tokens cover coder sessions only. verifier and cclio time are excluded
