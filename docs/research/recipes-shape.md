---
dies-when: the shared shape is folded into recipes/AGENTS.md and every recipe is reshaped to it
---
Ticket: none

# recipes: one shared shape

surveyed 2026-10-09: 15 recipe.md, 15 log.md, 1 card.md, 2 last/ dirs, `recipes/AGENTS.md`, `x:shape-recipe` (`home/.claude/plugin-x/skills/shape-recipe/SKILL.md`), the shape test (`script/lib/recipe-shape.test.ts`), commits 83e32905 and e6eca04d. line numbers are from that day. a claim i could not verify ends with «?».

headline: 11–12 of the 14 real recipes already share one skeleton: the want, the run, vectors, artifacts, cadence and a `log → log.md` stub. two of those (cadence, the log stub) only repeat things stored elsewhere, and findings is the section most recipes lack. the shared shape below keeps five sections, adds a strict log line with a size cap, and moves the shape contract out of the skill into `recipes/AGENTS.md`.

## 1. sections per recipe.md, and the common skeleton

every file opens with yaml frontmatter (`kind`, `cadence`, `artifacts`, `script`; some add `was`, `owner`, `groomed`, `draft`), then `# <name>`.

- **nurture-memory** (148 lines): purpose paragraph (l10, includes a run #2 lead: «run #2 (FRM-267) reads `docs/research/skill-authoring-best-practices.md` first») · contents (l12) · `## the want` (l19: dima's quotes, run #1 finding, his questions and verdicts) · `## standing rules` (l48: binding run rules, the per-item report format, decided calls) · `## the run` (l67: 15 steps, each with done-line and freedom tag) · `## vectors` (l128: «research (re-groomed with dima each run):» and «analysis (local evidence):» as plain labels) · `## findings` (l142: «beyond the shared shape:» 4 bullets)
- **nurture-skills** (45, `draft: true`): parked banner (l12 «⏸️ **parked, not a recipe yet.**») · `## the run — the proposed shape` (l19: unnumbered bullets) · `## prior art here` (l35: eval mechanics, measured results)
- **refresh-agent-ops** (64): 📌 test-drive banner · `## the want (dima's)` · `## the run` (5 steps, no done-lines) · `## vectors` › `### research vectors (dima's wording, regroomed with him each run)` · `### analysis vectors (local evidence)` · `## artifacts (pointed at, never housed)` · `## cadence` · `## last run` (l60: «none yet. the seed run was 2026-10-07…») · `## log → log.md` (empty)
- **refresh-art-kit** (99): purpose + «born from» paragraph · `## the want (dima's, 2026-09-30)` · `## the run` (5 steps) · `## vectors` › `### research vectors (re-groom each run)` (10, grouped by branch) · `### analysis vectors (local evidence)` · `## artifacts (pointed at, never housed)` · `## cadence` · `## log → log.md`
- **refresh-cc-mods** (79): purpose paragraph · `## the want (dima's)` (+ «his standing calls») · `## the run` (4 steps) · `## vectors` › `### research vectors (re-groom each run)` · `### analysis vectors (local evidence)` (9) · `## artifacts (pointed at, never housed here)` · `## cadence` · `## next run — the leads still open (written 2026-10-05, hot)` · `## log → log.md`
- **refresh-crew-classifier** (83): purpose paragraph · `## the want (dima's)` · `## the run` (5 steps) · `## vectors` › `### research vectors (re-groom each run)` · `### analysis vectors (local evidence)` (10) · `## artifacts (pointed at, never housed here)` · `## verify — what a jev change's verifier runs (the 10-05 retros)` · `## cadence` · `## log → log.md`
- **refresh-crew-coordinator-adviser** (75): purpose line · `## the want (dima's)` · `## the run` (steps 1, 2, 3, 3b, 4–8, done-lines and freedom tags) · `## done` (l39: the done rule and the print parts) · `## vectors (the owner's, re-groomed with dima each run)` (plain labels «research, the outside world:» / «analysis, our own evidence:» + a «cut (settled)» paragraph) · `## artifacts (pointed at, never housed)` · `## log → log.md`
- **refresh-crew-coordinator** (127, no contents): purpose + two halves paragraph · `## the want` (five dated blocks) · `## the run` (8 steps, done-lines, tags) · `## vectors` (plain labels: craft, classifier seat, tools, models, analysis) · `## findings` (l112: done-test, the four print parts, extra answers)
- **refresh-crew-designer** (94): purpose · `## the want (dima's, 2026-09-29)` · `## the run` (5 steps) · `## vectors` › `### research vectors (dima's asks from the thread — re-groom each run)` (11) · `### analysis vectors (local evidence)` · `## artifacts (pointed at, never housed)` · `## lanes (per habit-test-drive: …)` · `## cadence` · `## log → log.md`
- **refresh-guide-go** (66, no purpose line): `## the want (dima's, 2026-10-06)` · `## the run` (4 steps) · `## vectors` › `### research vectors (from the v1.1 coder's retro, 2026-10-06 — re-groom each run)` · `### analysis vectors (local)` · `## artifacts (pointed at, never housed)` · `## cadence` · `## last run` (l62: «none yet…», now stale: log.md has a 10-07 run) · `## log → log.md`
- **refresh-job-market** (65, git-crypt): 📌 git-crypt banner · `## the want (dima's)` · `## the run` (6 steps) · `## vectors` › `### research vectors (dima's wording, regroomed with him each run)` · `### analysis vectors (local evidence)` · `## artifacts (pointed at, never housed)` · `## cadence` · `## log → log.md`
- **refresh-monorepo** (63): purpose · `## the want (dima's)` (+ standing calls) · `## the run` (4) · `## vectors` › `### research vectors (re-groom each run)` · `### analysis vectors (local evidence)` · `## artifacts (pointed at, never housed here)` · `## cadence` · `## log → log.md`
- **refresh-speak** (84): purpose · `## the want (dima's, 2026-09-29)` · `## the run` (5) · `## vectors` › `### research vectors (re-groom each run)` · `### analysis vectors (local evidence)` · `## artifacts (pointed at, never housed)` · `## lanes` · `## cadence` · `## log → log.md`
- **refresh-writing-for-humans** (69): purpose · `## the want (dima's, confirmed 2026-08-27)` · `## the run` (5) · `## vectors` › `### research vectors (dima's wording — re-groom with him each run)` · `### analysis vectors (local evidence — the running agent is the instrument)` · `## artifacts (pointed at, never housed)` · `## cadence` · `## log → log.md`
- **run-diorama** (124, the exception: it makes art): a contents line *above* the heading (l11) · `# run-diorama` · draft-trace banner · `## the want — dima's words` · `## artifacts — where they live` · `## the run — the trace of the first run` › `### 2026-09-25 · FRM-263 …` · `### 2026-09-25 night …` · `### pitfalls met` · `## vectors` › `### analysis vectors …` · `## cadence` · `## log → log.md`

the skeleton:
- nearly all (14 of 14 real recipes): the want, the run; 13 of 14 have vectors (all but nurture-skills)
- most (11–12 of 14): `### research vectors` + `### analysis vectors` sub-headings (11); `## artifacts` (11; missing in nurture-memory, nurture-skills, refresh-crew-coordinator); `## cadence` (11); `## log → log.md`, an empty pointer heading (12)
- some: a purpose paragraph under the heading (12); a 📌/⏸️ status banner (3); `## findings` (2) or `## done` (1); `## last run` (2); `## lanes` (2); contents (1 of the 3 files past 100 lines)
- one-offs: `## standing rules` (nurture-memory), `## prior art here` (nurture-skills), `## next run — the leads still open` (cc-mods), `## verify` (classifier), `## done` (adviser), the dated `###` trace (diorama)
- heading drift: the want is titled 8 different ways (`## the want`, `(dima's)`, `(dima's, <date>)`, `(dima's, confirmed …)`, `— dima's words`); artifacts 3 ways; the research sub-heading 6 ways
- frontmatter drift: `owner:` is in 2 of 15 (adviser `owner: coordinator + adviser`, crew-coordinator `owner: coordinator`), though the skill says «**every recipe names its owner** in frontmatter» (SKILL.md l88). `groomed:` is in 1 (the adviser)

## 2. the shared recipe.md shape

frontmatter, in this order: `kind` · `owner` · `cadence` · `artifacts` · `script` · then only when set: `groomed`, `was`, `draft`.
- `cadence:` is the only home of the cadence, including its extra triggers (today those triggers also sit in a `## cadence` section that often repeats the value word for word)
- `owner:` uses one value from the skill's enum (`coordinator | coder | designer | fleet`, SKILL.md l88), or the enum gets widened on purpose (the adviser wrote «coordinator + adviser»)

body, in this order:
1. **`# <folder name>`**, then one purpose line saying what it keeps true, and at most one 📌 status line (test drive, git-crypt, parked). must not hold: history beyond «born <date> from <ticket>», next-run leads, or run results
2. **`## contents`**, only when the file passes 100 lines (SKILL.md l37). must not hold: anything except the h2 list
3. **`## the want`**: dima's words in «» or `>` blocks, each dated, plus his standing calls. must not hold: research results, run findings, steps, or paraphrase posing as a quote
4. **`## the run`**: numbered steps, each ending on a «done:» line with a freedom tag (`script` / `template` / `open`); the lanes this recipe uses go inside the research step; binding run rules go as a short list above step 1; the last step is «log today's line». must not hold: the steps the skill already runs for every recipe (groom, lanes, distill, print), restated in full (name them and add only what is local); a trace of a past run; rules for verifying the target
5. **`## vectors`**: `### research` (the outside world, in dima's or the owner's wording) and `### analysis` (our own evidence); an optional `### cut` for vectors he settled. must not hold: last run's answers or finds (those go into the artifact), long incident stories (one line plus a pointer)
6. **`## artifacts`**: one bullet per frontmatter artifact, saying what it holds and how the distill treats it. must not hold: the artifact's content (it lives where its readers look)
7. **`## findings`**: what this recipe's print adds beyond the skill's shared parts, and always **the checklist** it re-checks every run (SKILL.md l106). must not hold: past verdicts

dropped as sections, with their content moved: `## cadence` → frontmatter; `## log → log.md` → nothing (it is an empty pointer; the folder rule says log.md exists); `## last run` / `## next run` → log.md or `### research`/`### analysis` lines; `## lanes` → the research step of the run; `## done` / print text inside the run → `## findings`; `## verify` → the target guide.

run-diorama (`kind: run`): needs only the frontmatter, the heading, `## the want` and `## the run`. its trace and pitfalls stay as they are until dima calls it a recipe, and they don't bend the five sections above.

## 3. log.md: entry shape, size, and what belongs where

today (bytes from `wc -c`, line lengths from `awk length`, approximate for multibyte):
- nurture-memory: 254 B, no header, 1 entry, 5 fields, ~253 chars. it was 5,054 B as one line at 83e32905 (the bloat: the whole run #1 map, token counts, verdicts), then cut to 254 B at 872a85d4
- nurture-skills: 29 B, header only
- refresh-agent-ops: 32 B, header only (the seed run sits in recipe.md `## last run` instead)
- refresh-art-kit: 190 B, header + 1 entry, 5 fields, ~158 chars
- refresh-cc-mods: 363 B, header + 2 entries, 5 fields, ~218 / ~112 chars (it was 1,197 B at f9b63651)
- refresh-crew-classifier: 195 B, header + 1 entry, 5 fields
- refresh-crew-coordinator-adviser: 569 B, header + 2 entries, 5 fields; l4 is ~395 chars and lists every decision («adopted the timing hold with also-held, predicts lines, the overload remedy hunt…»), and those decisions already live in `x:crew-adviser`
- refresh-crew-coordinator: 1,169 B, **no header**, 6 entries, 5 fields, 143–248 chars; l5 carries a dima quote («refresh models.md specifically with information about fable 5.1 and opus 5.5») that is a want
- refresh-crew-designer: 169 B, header + 1 entry, 5 fields
- refresh-guide-go: 499 B, header + 2 lines with **2 fields each**; l3 is ~303 chars of narrative («found 10-09: 0 of 8 x coders read it…»); l4 is not a run at all but a todo («pk-44 (dima): the next run writes a nonce line…»)
- refresh-job-market: 65 B, header + «- 2026-10-06 · the first run.» (2 fields)
- refresh-monorepo 169 B, refresh-speak 191 B, refresh-writing-for-humans 208 B, run-diorama 144 B: header + 1 entry, 5 fields each

does the e6eca04d rule hold? the commit says «every run log trimmed to the one-line shape … date · outcome · minutes · cost · artifacts; the detail already lives in each artifact (grepped before the cut)».
- the rule is right and should stay: 17 of 21 entries follow it. the 5,054 B line shows what happens without it
- nothing enforces it, so it drifted back within two days: adviser l4 (10-08) restates its decisions, guide-go l3 and l4 (10-09) are narrative and a todo, and job-market and crew-coordinator lack fields or the header
- the skill's own line contradicts the headers: «`log.md` — one line per run; the run count is its line count» (SKILL.md l20), yet 13 logs open with `# <name> — run log` and a blank line

proposed entry shape (the e6eca04d five fields, made strict):
- the file is `# <name> — run log`, a blank line, then entries, oldest first
- entry: `- YYYY-MM-DD · <outcome> · <minutes | ?> · <lanes and cost | ?> · <artifacts changed | noop>`
- exactly five ` · ` fields; an unknown field is `?`, never dropped
- outcome is one clause: the verdict or the delta in headline form (for example «2 rows flipped», «noop», «keep, experimental»); its details live in the artifact
- cap: **≤ 280 chars per entry** (every current entry fits except adviser l4 and guide-go l3), **one entry per run** (a multi-round run is still one line: «run 2 (three rounds)»), **file ≤ 8 KB** (about 30 runs at the cap). past 8 KB the owner moves the oldest entries to `log-<year>.md` in the same folder; nothing is deleted

what goes where:
- log.md: that a run happened, when, what it cost, and which files it touched. nothing a reader needs in order to act
- the target (the artifacts): every finding, number, verdict and decision; the reason behind a rule
- recipe.md: dima's words about what the recipe should do (the want), next-run leads (as vector lines), corrections to the procedure
- last/: raw lane output and briefs for the current or most recent run only
- pocket / linear: todos («the next run writes a nonce line» is a pocket task, pk-44)

## 4. card.md and last/

card.md:
- it exists only in nurture-memory (29 lines). it holds «the groom card»: what makes a memory line redundant, how to trim, and the digest format; «read at every halt; it feeds the delete digest» (card.md l3)
- it is in that recipe's `artifacts:` (recipe.md l4), so the recipe stores its own artifact, which the skill bans: «❌ a recipe that houses its artifact» (SKILL.md l135)
- outside the recipe and an old test-drive line, nothing reads it: `rg` over `home/.claude`, `cclio/plugin-cclio`, `cclio/memory` found no reference, so «read at every halt» has no reader wired in «?» (a halt flow outside those dirs may still load it)
- it names a `retire-log.md` «in this folder» (card.md l27) that does not exist
- rule: **no recipe has card.md**. its content is upkeep rules for memory, which belong in `docs/knowledge/authoring-memory.md` (already an artifact of the same recipe), and the halt flow gets one pointer to that section. if dima wants it kept beside the recipe, the rule would be «card.md only when a named flow outside the run reads it, and the reader names the path»

last/:
- it exists in refresh-crew-coordinator (244 KB) and refresh-crew-coordinator-adviser (332 KB: brief, brief-2, brief-3, three `lanes*` dirs, research-opus ×3, cloud ×2, consults)
- it is gitignored (`.gitignore:153: recipes/*/last/`), so its content exists only on this mac
- `script/research-lanes.sh` l37–45 gates a brief under `recipes/*/last/` on today's `groomed:` stamp, so last/ is how a groom gets enforced
- the skill calls it «the last run's raw output, overwritten each run» (SKILL.md l22), and runs read it before new lanes (crew-coordinator step 3: «distill what the last run's `last/` still holds»; adviser step 2)
- one leak: crew-coordinator log l6 lists `last/distill.md` as the run's artifact, which means a distill landed in an ignored folder and not in the target
- rule: **every recipe that runs lanes keeps its brief and raw output in last/; a recipe that runs none has no last/**. last/ is never committed, is cleared when the next run's distill step finishes, and is never named in log.md or `artifacts:`. «raw lane output dies here» in older run steps then means «stays in last/ until the next run»

## 5. deviations per recipe, and where each part moves

nothing below is deleted; every item gets a destination.

shared to most (applies wherever the section exists):
- `## cadence` → its text goes into frontmatter `cadence:` (identical in cc-mods, classifier, monorepo, job-market; extra triggers merged in for agent-ops, art-kit, guide-go «no timer», writing-for-humans «held by the ⏰ reminder…»)
- `## log → log.md` → removed as a heading; it holds no text
- want heading variants → `## the want`, with the date moved into the body
- `### research vectors (…)` / `### analysis vectors (…)` → `### research` / `### analysis`; the parenthesis («re-groom each run», «dima's wording») goes into the skill once, and a recipe-specific note (guide-go «from the v1.1 coder's retro», writing «the running agent is the instrument») stays as the first line under the sub-heading
- the print step's text inside `## the run` («print dima the delta: …») → `## findings`, and the step says «findings print»
- run steps with no «done:» line or freedom tag (agent-ops, art-kit, cc-mods, classifier, designer, guide-go, job-market, monorepo, speak, writing) → each step gains them; the step text stays
- missing `owner:` (13 recipes) → added, a proposal for dima to confirm «?»

per recipe:
- **nurture-memory**: no `owner:` → add. the run #2 lead in the purpose paragraph (l10) → a `### analysis` line. `## standing rules` → the head of `## the run`, as a list above step 1. vectors' plain labels → `### research` / `### analysis`. no `## artifacts` → add, from frontmatter. card.md → `docs/knowledge/authoring-memory.md` § upkeep, plus a halt pointer. log.md has no header → add one
- **nurture-skills** (draft): `## the run — the proposed shape` → `## the run`. `## prior art here` → `docs/knowledge/authoring-skill.md` (eval mechanics are craft; nurture-memory l114 already sends readers to «`recipes/nurture-skills/`» for this, so that pointer moves too), and one line «prior art: see authoring-skill.md § evals» stays under `### research`. the dead `_spec.md` mention (l13) → «the want, vectors, cadence are filled at the first run». the link `nurture-memory.md` (l16, broken) → `../nurture-memory/recipe.md`
- **refresh-agent-ops**: `## last run` → a log.md entry `- 2026-10-07 · seed run, distilled into agent-fleet-maintenance.md · ? · exa 109 s, parallel 591 s, opus · docs/research/agent-fleet-maintenance.md`. step 5 → `## findings`. add the log step
- **refresh-art-kit**: step 5's «grade every lane in its test-drive file» stays as a run step; «print dima the delta per branch» → `## findings`. the owner is probably designer («the next design lane grooms `refresh-art-kit`», SKILL.md l118)
- **refresh-cc-mods**: `## next run — the leads still open` → dated lines under `### analysis` (each is a re-check), and the parked builds → FRM-304, the open list named in `## artifacts`. step 3's print → `## findings`
- **refresh-crew-classifier**: `## verify` → the jev guide (today `cclio/memory/sys-jev.md` «the rules», later `x:guide-classification`, per recipe.md l65). research vector 3's «last run's finds: kerpopule/…, aurelio-labs/semantic-router» → `docs/research/skill-router.md`, and the vector keeps the question. `## findings` gains the classifier checklist crew-coordinator already names («the engine judged, the jobs found, the budget gate», crew-coordinator l119)
- **refresh-crew-coordinator-adviser**: step «3b» → renumber. `## done` → `## findings`. vector labels → `### research` / `### analysis`, and the «cut (settled)» paragraph → `### cut`. `owner: coordinator + adviser` → a single enum value plus a co-owner note, or the enum widens (dima's call «?»). log l4 → trimmed to ≤280 chars; its decision list already lives in `x:crew-adviser` and `ccrow/AGENTS.md` (the log names both)
- **refresh-crew-coordinator**: 127 lines with no contents → add. the «two halves» paragraph (l13–18) → the head of `## the run`. no `## artifacts` → add, from frontmatter. vector labels → `### research` (craft, classifier seat, tools, models as bold lead-ins) / `### analysis`. log.md: add the header; l5's dima quote → `## the want` under «model picks», and the entry keeps «dima asked for opus 5.5 + fable 5.1 cards»; l6's `last/distill.md` → the distilled content belongs in `spawning-mechanics.md` / `models.md` (whether it landed there is not checked «?»)
- **refresh-crew-designer**: `## lanes` → step 2 («spawn the lanes on one brief: exa agent · parallel core · …»). step 5's «log the run below» → «log today's line in log.md». vector 11's incident story (stickies, 1.5 h) → `docs/research/design-review-comms.md` (already named there), and the vector keeps its question and check list. step 4 → `## findings`
- **refresh-guide-go**: no purpose line → add («keeps `x:guide-go` and the cli's go stack current»). `## last run` («none yet», stale) → log.md l3 already records the run; the seed note «the first run seeds `charm.md` before the next cli lane» joins log l3's outcome. log l3 → five fields; its «found 10-09: 0 of 8 coders read it…» lives in `x/go/AGENTS.md` (log l3 says so). log l4 (a todo) → the pocket task pk-44 (it exists as `pocket/tasks/pk-44 - …`) and a run step «write the nonce line»
- **refresh-job-market**: log l3 → `- 2026-10-06 · the first run · ? · ? · ?` (unknowns marked, the rest is not recoverable from the log «?»). step 4 → `## findings`
- **refresh-monorepo**: step 3's print → `## findings`. otherwise on shape
- **refresh-speak**: `## lanes` (with the blind booth template) → steps 2–3. step 5's «log the run below» → the log step
- **refresh-writing-for-humans**: step 1's «the research vectors above» → «below». cadence's reminder sentence → frontmatter. step 4 → `## findings`
- **run-diorama** (the exception): only the contents line above the heading (l11) → below `# run-diorama`. `## artifacts — where they live` → `## artifacts`. the trace and pitfalls stay; the test keys its strictness on `kind: run`

## 6. rules a vitest test can check

grade against `script/lib/recipe-shape.test.ts`:

keep (already checked, l83–142, l154–178):
- frontmatter present; `kind` ∈ refresh|nurture|run; name starts with `<kind>-`; `cadence` truthy; `artifacts` is a list and every entry exists; `groomed` matches `^\d{4}-\d{2}-\d{2} \(dima\)$`; `script` is `none`, a package.json key or an x verb; the first `# ` heading equals the folder; want before run, vectors after run; the want quotes «» or `>`; log.md exists; no live file names an old name from `was:`; git-crypt ciphertext is skipped (l87)

replace:
- the prefix match `text.indexOf('\n## the want')` (l125) accepts every variant title. replace it with exact h2 matching: collect `^## (.+)$` lines and compare them to an allowed list

extend (recipe.md), for `kind` ∈ refresh|nurture and `draft` ≠ true:
- R1 the h2 list, in order, is a subsequence of `[contents, the want, the run, vectors, artifacts, findings]`, and it contains `the want`, `the run`, `vectors`, `artifacts`, `findings`. any other h2 fails
- R2 `contents` is present if and only if the file has more than 100 lines
- R3 between `## vectors` and the next h2, the h3s are a subsequence of `[research, analysis, cut]` and contain `analysis` (`research` is required for `kind: refresh`)
- R4 frontmatter has `owner` ∈ `coordinator|coder|designer|fleet` (or the widened enum)
- R5 every frontmatter artifact appears (as a path or an `x:` skill name) in the `## artifacts` body
- R6 every top-level numbered item in `## the run` (`^\d+\. `) contains `done:`, and the last one mentions `log.md`
- R7 no file in the recipe folder besides `recipe.md`, `log.md`, `last/`, `scripts/`, `log-*.md` (this rules out card.md)
- for `kind: run`: only the existing checks plus R1 with the allowed list `[contents, the want, artifacts, the run, vectors]`, with nothing else required

extend (log.md), every recipe including run and draft:
- L1 line 1 is exactly `# <folder> — run log`, line 2 is blank
- L2 every other non-empty line matches `^- \d{4}-\d{2}-\d{2} · [^·]+ · [^·]+ · [^·]+ · [^·]+$` (exactly five fields; `?` allowed)
- L3 every entry line is ≤ 280 chars (`[...line].length`, not bytes)
- L4 dates are non-decreasing top to bottom
- L5 the file is ≤ 8,192 bytes
- L6 the encrypted job-market log follows the same ciphertext skip as l87

applied today, L1–L3 fail on: nurture-memory and crew-coordinator (no header), guide-go l3/l4 and job-market l3 (fields), adviser l4 and guide-go l3 (length). R1 fails on 13 recipes until the cadence and log stubs are folded.

## 7. what the skill restates that belongs only in recipes/AGENTS.md

- `recipes/AGENTS.md` holds only the want (8 lines: «recipes are your door to more capability…»). so nothing is restated yet; the overlap runs the other way: the folder's contract lives only in the skill, and a session working in `recipes/` without loading the skill can't see it
- the skill sections that describe what a recipe *is* and so belong in AGENTS.md: the definition (SKILL.md l9–11 «A **recipe** is a repeatable procedure that keeps something fresh…»); `## the folder` (l16–22); `## recipe.md` with the frontmatter and section order (l24–41); `## log.md` (l43–45); `## names` (l47–51); the ✅/❌ `## practices` that are about the folder (l130–131, l135); the reshape half of the completion criterion (l138–139, «`pnpm test` passes the recipe shape test»)
- dima's want-level quotes about recipes belong in AGENTS.md's `## the want` next to the 10-09 one: «recipes are special, they are not plain scripts, they want intention…» (l84) and «exit criteria kind of forces you to make changes, but it is not always needed» (l92)
- the skill keeps the procedure: `## running one` (steps 0–6), `## the shared vectors`, the owner and groom duties (l88–119, minus the two quotes), the findings print parts (l97–108), `## creating one`, and the run half of the completion criterion. it gets one pointer, «the shape: `recipes/AGENTS.md`», in place of the moved sections
- the skill has 4 lines that contradict the recipes and need fixing during the move: «the run count is its line count» (l20, against the headers); «`scripts/`» (l21, no recipe has one); «`last/` … overwritten each run» (l22, the adviser keeps three rounds; true per run, not per round); `owner:` as mandatory (l88, in 2 of 15)
