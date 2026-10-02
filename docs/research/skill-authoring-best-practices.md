---
dies-when: the FRM-267 sweep has folded every line below into `docs/knowledge/authoring-skill.md`, `authoring-memory.md`, the skills and the recipes (each action line ends ✅ or ✗ with a reason)
---

Ticket: FRM-267

# skill authoring best practices — the sweep's input

The input for the memory + skills sweep: one video, two Anthropic pages, dima's notes on his
screenshots, our own numbers, and one action line per finding. The sweep reads this file first. The rules we adopt already live in `docs/knowledge/authoring-skill.md` § anthropic's structure rules; this file holds the evidence and the per-skill actions.

## contents

- sources
- dima's words
- the video's claims, checked
- the rules, one by one — doc · us today · sweep action
- the Fable 5 guide — what bites our skills
- dima's ❗: the self-correction loop
- the recipes: names, the cw bridge, skill nurture
- the sweep checklist, in order

## sources

- the video: «Everything You Know About Skills IS OUTDATED», Simon Scrapes, 12:49 —
  [youtube](https://www.youtube.com/watch?v=e7TY56-yIvM) · transcript kept at
  `~/.claude/shelf/yt-transcripts/simon-scrapes-everything-you-know-about-skills-is-outdated-e7TY56-yIvM/`
  (the caption repair wrote `SKILLS.md`; corrected to `SKILL.md` by hand)
- [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
  — snapshot 2026-10-02: [anthropic-skill-best-practices.snapshot.md](skill-authoring-best-practices/anthropic-skill-best-practices.snapshot.md)
- [Prompting Claude Fable 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5)
  — snapshot 2026-10-02: [anthropic-prompting-fable-5.snapshot.md](skill-authoring-best-practices/anthropic-prompting-fable-5.snapshot.md)
- dima's annotated screenshots, downscaled: [shots/](skill-authoring-best-practices/shots/)

## dima's words

- the ask: «i found very useful video about writing skills best practices. i want you granularly parse
  this info and propose best actions in current state. we plan to do a memory/skill sweep from root
  memory to project-lvl memory files. and all skills including your's own. plus your own memory (very
  important). e.g. vertical diff of all memories. move memories between local/global buckets, refresh
  dated ones, delete redundant ones. i feel the memory get cluttered too much. groom existing useful
  memory, make it compact and approachable.»
- «i want all that info to be folded and be used in ongoing sweep over memory/skills»
- on the screenshots, verbatim:
  - low freedom: «low freedom = less text, more scripts. almost always covered by a script or scripts» ([shot](skill-authoring-best-practices/shots/low-freedom-scripts.jpg))
  - test on all models: «note: this may over too much overcomplication, but still worth to know, fyi» ([shot](skill-authoring-best-practices/shots/test-all-models-overcomplication.jpg))
  - checklists: «Checklists are good for cases when order matters» ([shot](skill-authoring-best-practices/shots/checklists-when-order-matters.jpg))
  - the return-to-step line: «attention here, useful pattern» · «prevents you from skipping a step, self-verification» ([shot](skill-authoring-best-practices/shots/checklist-return-to-step-pattern.jpg))
  - feedback loops: «❗ important! this is related to your own self-correction feedback loop. how to properly fold it for yourself, so it always works?» ([shot](skill-authoring-best-practices/shots/feedback-loop-self-correction.jpg))
  - the Fable 5 line he pasted: «Refactor existing prompts and skills…» ([shot](skill-authoring-best-practices/shots/fable5-too-prescriptive-quote.jpg))

## the video's claims, checked

Every claim was read against the doc snapshot. The rules are real; two are overstated.

- ⚠️ «Claude runs `head -100` on a long reference file; rules after line 100 don't exist» — **overstated.**
  The doc says Claude *may* partially read a file referenced from another referenced file, «might
  use commands like `head -100`» (§ Avoid deeply nested references). The table of contents rule is
  separate: for files over 100 lines, so a partial read still shows the full scope. In cc the `Read`
  tool reads up to 2000 lines by default, so the real risk is a nested link or a `head` in Bash.
- ✅ degrees of freedom (high, medium, low) — verbatim from the doc, with the same examples
- ✅ test with Haiku, Sonnet and Opus, one question each — verbatim. ⚠️ «write the intended model in
  the frontmatter» is the video's own addition; the doc never says it
- ✅ SKILL.md under 500 lines, references one level deep, split by domain — verbatim
- ✅ checklists with «return to step 3», feedback loops (validator → fix → repeat) — verbatim
- ✅ «avoid assuming tools are installed» — verbatim. ⚠️ «an install line next to every script» is the
  video's stretch; the doc says list the packages and check they are available
- ✅ «skills for prior models are too prescriptive for Fable 5» — verbatim, Fable 5 guide line 174
- the doc has rules the video skipped, listed below with the rest

## the rules, one by one — doc · us today · sweep action

Scanned 2026-10-02: 38 skills in plugin-x + plugin-cclio.

1. **concise: Claude is already smart** — every line must beat its token cost
   - us: matt's `writing-for-agents` (no-ops, the two loads) already says this, stronger
   - action: the per-line no-op test runs on every skill and memfile; no new rule
2. **degrees of freedom** — the freedom matches how fragile a step is; one skill can mix levels; low
   freedom = an exact script (dima: «less text, more scripts»)
   - us: the scripts exist (`x lane`, `red-proof`, `edit-batch`, `linear-as`), but skills still hold
     fragile steps as prose (the commit body rules, the pr-merge steps)
   - action: tag each skill step high / medium / low; every low step that is still prose becomes a
     script or a verb, or is named in [FRM-239](https://linear.app/x-com/issue/FRM-239) (scriptify)
3. **test on the models that run it** — Haiku: enough guidance? Sonnet: clear? Opus: not over-explained?
   - dima: «may be too much overcomplication, but worth to know»
   - us: coders and verifiers are opus, the explore agent is sonnet, design is fable
   - action: no test matrix. A skill that a sonnet or haiku lane runs (explore, retrieval) gets one
     run on that model during the sweep; the rest are judged for opus/fable over-explaining
4. **SKILL.md under 500 lines** — us: 0 of 38 over 500 · action: none
5. **references one level deep** — us: 5 reference files are not linked from their SKILL.md as a
   markdown link (`browser-headless/essentials/essentials.md`, and 4 in `guide-conventions/conventions/`:
   `naming-entity-first.md`, `stack.md`, `routing-url-shape.md`, `package-json.md`; some may be named
   in backticks, which the scan did not count)
   - action: check each one; link it directly from SKILL.md, or confirm the backtick pointer works
6. **a contents list on a reference file over 100 lines** — us: 1 skill file (`pm/references/workspace.md`,
   133 lines). Read-on-demand docs: `docs/knowledge/authoring-skill.md` (265) and `authoring-memory.md`
   (393) have none. Resident memory (rules, cclio leaves) loads whole, so it needs no contents list,
   but its size is its own cost (`craft-pm` 216, `craft-spawning` 209, `fleet-output-format` 283)
   - action: ✅ contents lists on `authoring-skill.md` + `authoring-memory.md` (2026-10-02); `pm/references/workspace.md` left; the resident ones go through the size budget
7. **split by domain** — a question about one area never loads another (finance.md / sales.md)
   - action: the same test for `guide-conventions` and `craft-spawning` (spawn mechanics vs briefing vs stopping)
8. **checklists when order matters** — the checklist is copied into the reply and ticked; a failed
   step says «return to step N» (dima: «useful pattern … prevents you from skipping a step»)
   - us: `cclio:halt`, `cclio:checkpoint`, `x:shape-idea`, `x:crew-coder`'s done steps are ordered
     prose with no return line
   - action: each ordered skill gets a copyable checklist + a return-to line on its verify step;
     an unordered skill gets none (dima: «good for cases when order matters»)
9. **feedback loops** — validator → fix → repeat; the validator can be a style guide read by Claude
   - action: see «dima's ❗» below
10. **avoid time-sensitive information** — «old patterns» in a collapsed block, never «before August»
    - us: our memory is full of dated lines («2026-09-28: …»), as stories, not as conditions; the
      doc's rule targets conditional dates. Our own pre-write checklist already says a measurement
      belongs in its commit
    - action: the sweep's «refresh dated ones» pass: a date that is a story stays only if the lesson
      needs it; a condition date gets rewritten or deleted
11. **consistent terminology** — us: `fleet-voice` «one name per concept» · action: none
12. **description: third person, what + when** — ⚠️ conflicts with our rule «the description is ONLY
    the load trigger» (`authoring-memory-and-skills`). Local wins (fleet-identity #9), said out loud
    here. Third person is free to adopt; «what it does» stays out by our rule
    - action: check descriptions read in third person; no «I can help»
13. **naming: gerund form** (`processing-pdfs`) — ⚠️ conflicts with our entity-first naming; local wins
14. **build evaluations first** — 3 scenarios, a baseline without the skill, then minimal instructions
    - us: eval runs exist for `x:cmt` and `x:notes` (nurture-memory's eval run 3, ~$9)
    - action: the eval run stays in scope; a new skill starts from 3 written scenarios
15. **Claude A writes, Claude B tests; observe how Claude navigates** — files read in an unexpected
    order, links not followed, a file never opened
    - us: `crew:audit` reads coder transcripts for one file; the jev router logs loads
    - action: during the sweep, one fresh session per changed skill runs a real ask (Claude B); its
      transcript is read for unopened files and skipped links
16. **solve, don't defer; no voodoo constants** — scripts handle their errors; every constant says why
    - action: one pass over `plugin-x/bin/*` and our hooks for bare constants and errors left to Claude
17. **verifiable intermediate outputs** — plan file → validate → execute (batch, destructive, high stakes)
    - us: `x lane`'s plan + `--apply` is this pattern already
    - action: ✅ named in `authoring-skill.md` § anthropic's structure rules (2026-10-02)
18. **execute vs read** — say «run X» or «see X for the algorithm» · action: grep skills for script
    mentions with no verb
19. **MCP tools fully qualified** (`Server:tool`) — us: cli over mcp; few mcp mentions · action: grep only
20. **avoid too many options** — one default plus an escape hatch · us: «two options max» · action: none
21. **avoid assuming tools are installed** — us: one mac, brew-managed; cloud and cw sessions lack our
    tools · action: skills that `x:crew-cloud` or cw run name their install line

## the Fable 5 guide — what bites our skills

- «skills developed for prior models are often too prescriptive … consider removing older
  instructions if default performance is better» → the sweep's main cut: every CAPS, every «ALWAYS»,
  every enumerated case that a short instruction covers. **test by deleting**: run the skill's real
  ask without the line; keep it only if the run gets worse
- «steer most behaviors with a brief instruction rather than enumerating each behavior» — our
  `fleet-output-format` (283 lines) enumerates; the sweep tries the short form beside it
- «don't instruct Claude to reproduce its reasoning in the response» — may trigger the
  `reasoning_extraction` refusal on Fable 5. action: grep skills and rules for «explain your
  reasoning», «show your thinking», «think out loud»
- «separate, fresh-context verifier subagents outperform self-critique» — our verifier lane is this;
  keep it, and prefer it over in-turn self-review in any new loop
- «store one lesson per file with a one-line summary at the top … update rather than duplicate;
  delete notes that turn out to be wrong» — this is cclio's leaf model; the sweep holds every leaf to it
- the sample prompts in the guide (act when you have enough, lead with the outcome, ground progress
  claims, pause only when needed) — compare each to our rule that says the same, keep the shorter

## dima's ❗: the self-correction loop

His question: «how to properly fold it for yourself, so it always works?»

- today the loop runs on attention: the flawlog (fix now, log what survives, one flush at the halt),
  and the «mechanical scan» lines in `fleet-output-format`. The doc's pattern is a **validator**:
  something that runs, finds the issue, and the model fixes and runs it again. Attention runs out;
  a validator does not (`method-silent-failures`: «the fix is always a different invocation, never a
  firmer intention»).
- the proposal for the sweep: a **reply validator as a `Stop` hook** (none exists; the `Stop` slot
  holds only `notification-host-reply.sh`). It reads the last reply and blocks the stop with a reason
  when it finds:
  - a ticket id outside a link (`FRM-`, `BYT-`, `DOT-` not inside `](https://linear.app/`)
  - a markdown table
  - a `·` inside a sentence, a ①②③ run
  - a commit hash
  - an open ⏳ ask from an earlier reply missing from the bucket
  The model fixes and stops again: validator → fix → repeat, and it holds on a tired night as well
  as a fresh morning. The rules it checks then shrink in `fleet-output-format` to one line each.
- the second half is the doc's «suggest a new rule at the end of the run»: our flawlog flush already
  is that. The sweep keeps it and adds one rule: a flaw that repeats twice becomes a validator check
  or a script, never a third prose line.

## the recipes: names, the cw bridge, skill nurture

- ✅ renamed 2026-10-02 (dima's yes) into a `nurture-*` family beside `refresh-*`: `refresh-*` looks
  outward (research), `nurture-*` grooms what we have — `nurture-memory.md` (+ `.checklist.md`) and
  `nurture-skills-hillclimb.md`; the kind leads, the same exception `refresh-*` already makes
- **skill nurture is already inside nurture-memory**: its inventory covers «every memfile, every
  rule, every skill». `nurture-skills-hillclimb` is a different job (does a skill fire and get
  followed, measured) and stays parked until a real run
- ✅ `memory-bridge-refresh-cw.md` retired 2026-10-02: cw now gets memory only through dima's manual
  paste (`pnpm memory-sync:map` → `pnpm memory-sync:copy` → settings › profile › instructions), which
  both scripts' headers describe. dima: «it is manual now and no longer automated, i feel that this
  recipe is no longer needed». its want and the paste step moved into `nurture-memory.md` § the cw field

## the sweep checklist, in order

Copy this into the sweep's first reply and tick it. A failed check returns to the step named.

```
Sweep progress:
- [ ] 1. read this file + the nurture-memory checklist (dima's plan lives there)
- [x] 2. rename the recipes to nurture-* (done 2026-10-02)
- [ ] 3. vertical diff, root → rules → ~/projects/AGENTS.md → project AGENTS.md → cclio memory → skills:
         one meaning in one place; move by audience (the vertical map); delete the copies
- [ ] 4. dated lines: stories keep only what the lesson needs; condition dates rewritten or cut
- [ ] 5. the Fable 5 cut: delete-test every CAPS/ALWAYS/enumerated rule; keep only what a run proves
- [ ] 6. skills: rules 2, 5, 6, 8, 12, 18 above; the reasoning-extraction grep
- [ ] 7. scripts: rules 16, 21 above
- [ ] 8. the reply validator (Stop hook), then shrink fleet-output-format to what it does not check
- [ ] 9. Claude B: a fresh session per changed skill runs one real ask; read its transcript
         (if it skipped a file or a step, return to step 6)
- [ ] 10. size budget per memory file written down; fleet-hazards split (FRM-267 scope)
- [ ] 11. this file's dies-when: every action line above ends ✅ or ✗ with a reason
```
