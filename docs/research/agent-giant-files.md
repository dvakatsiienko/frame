---
dies-when: folded into the FRM-629 regrill's decided lines
---

Ticket: FRM-629

# agent giant files: why agents grow them, when one helps, how to stop it

wish: FRM-629:W30, W31, and dima's 19 Nov asks (the research, a baseline number for the 5.5 family, a 50k-line file). read on 2026-11-19 by the stray codie: two web lanes (exa 124 s, parallel 273 s, `research:lanes`), every load-bearing source opened again, and our own numbers measured.

**the verdict**: a file-size cap is worth it, and our own tools set the number. Claude Code reads at most **25,000 tokens** a call. our code costs **14–18 tokens a line** as the Read tool shows it. so **~1,400 lines** is the largest file an agent reads whole in one call, and **1,500 sits just past that edge**. the cap: **1,200 lines**. a stated exception is fine up to **2,000**. past 2,000 the file splits.

## our cases

- `home/.claude/plugin-x/mods/x-mod-stash/hooks/register.tsx`: **11,518 lines, 529 KB, 184,506 tokens** (`wc -l -c`, the count_tokens api, Opus 5.5); over the Read tool's 256 KB whole-file refusal, so it can never be read whole
- `home/.config/herdr-app/mods/x-herdr-chat/main.js`: 4,381 lines on 18 Nov, **1,430 today**, split by view in three commits on 19 Nov (`git log -3 -- …/x-herdr-chat/main.js`: «the quill owns…», «the message rows own…», «the message list owns…»)
- the 18 Nov retro, finding 8 (`.scratch/retro-2026-11-18/main.md:46-49`): the herdr codie ran 12 compactions in 11.5 h and read `main.js` 18 times
- frame today: of 863 tracked code files, **42 are ≥ 800 lines, 32 ≥ 1,000, 16 ≥ 1,400, 13 ≥ 1,500, 6 ≥ 2,000** (`git ls-files` over ts, tsx, js, go, py, sh, swift, no `.d.ts`, vendor or fixtures, `wc -l`); the top 6 are register.tsx and four x-mod-stash test files (5,500 · 4,460 · 2,780 · 2,736) and `crew-adviser/scripts/lib.ts` (2,078)

## 1. why agents drift toward one growing file

- **the harness tells them to.** Claude Code's own system prompt and tool texts, read in this session: «Prefer editing existing files to creating new ones», and the Edit tool's «ALWAYS prefer editing existing files in the codebase. NEVER write new files unless explicitly required». the rule is aimed at stray files, and it holds. **inference**: with no counter-rule, «add a function to the open file» is the one move both the prompt and the task reward
- **the tasks they learn on are patches.** SWE-bench's reference fixes average 1.7 files, 3.0 functions, 32.8 lines ([SWE-bench](https://arxiv.org/html/2310.06770v3)): «modify what is there» is the shape of a success
- **a new module costs decisions now; the open file costs nothing yet.** a new file means a name, a boundary, imports, a test, an index line. appending means none of these (both lanes, labelled inference; no study measures the drift itself). OpenAI's patch tool lists `create_file` beside `update_file` and still asks for «small, focused diffs» ([apply patch](https://developers.openai.com/api/docs/guides/tools-apply-patch))
- **«keep the change local» rules push the same way.** one measured hint: in 5,000+ Claude Code runs on SWE-bench Verified, «do not refactor unrelated code» was a rule that helped ([Guardrails Beat Guidance](https://arxiv.org/abs/2604.11088), abstract). a guard against scope creep also blocks the split. **inference**: our own «edit the lines that change, never a whole file» (`crew-codie/how-you-work.md`) reads the same way
- **the cost comes later, and lands on someone else.** the file grows by one function per chunk, and every later session pays the read

## 2. does a giant file ever help

- **TypeScript's checker, the classic case.** the maintainers' compiler notes: «Ok, yeah, so it's a 40k LOC file. Why 40k lines in one file?»: all of the checker in one place, singleton state for speed, mutual dependence on shared state, and «switching to different files means probably making god objects, and the checker needs to be extremely fast» ([checker.md](https://github.com/microsoft/TypeScript-Compiler-Notes/blob/main/codebase/src/compiler/checker.md), lines 3–16)
- **it is bigger now, and the Go port kept it whole.** `checker.ts` is **54,434 lines, 3.15 MB** on `release-6.0` (`curl … | wc -l -c`); `main` is now the Go compiler, where `tsc/internal/checker/checker.go` is **33,119 lines, 1.48 MB**. its siblings sit in their own files (`relater.go`, `flow.go`, `nodebuilderimpl.go`, …): the port split the edges and kept the core
- 😮 **TypeScript's own `AGENTS.md` says nothing about the file's size or how to navigate it** ([AGENTS.md](https://github.com/microsoft/TypeScript/blob/main/AGENTS.md), 153 lines: build, test, baselines). the giant file is a human decision about runtime speed, not one made for agents
- **no study varies one file's line count and measures agent success** (both lanes, independently). the nearest results are about total context:
  - «Lost in the Middle»: facts mid-context are used worse than at the ends, a U-curve ([arxiv 2307.03172](https://arxiv.org/abs/2307.03172))
  - SWE-Bench Pro: success falls as the files a task touches grow in number ([arxiv 2509.16941](https://arxiv.org/abs/2509.16941)). that cuts against splitting too far
- **for us, a giant file has one more cost, and it lands on the fleet**: `x-mod-holds` allows one writer per file (`rules/fleet-mods.md` § x-mod-holds), so two codies who both need register.tsx run one after the other

## 3. tools for working in a big file

- **Claude Code's Read** ([tools reference](https://code.claude.com/docs/en/tools-reference), «large files»):
  - one call returns at most **25,000 tokens** (`CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS` moves it)
  - a whole file over the limit returns its first page with a `PARTIAL view` notice; a file over **256 KB** is refused, «read a portion with `offset` and `limit`, or … Grep»
  - from v2.1.296, `allow_large: true` reads past the limit, bounded by what context holds
- 😮 **compaction keeps no file over 5,000 tokens.** after a compaction, Claude Code re-reads «up to five» recently touched files, and «a file over 5,000 tokens comes back as a path reference without its content» ([context window](https://code.claude.com/docs/en/context-window), line 77). at our 14–16 tokens a line, that is any file past **~320–360 lines**. a codie in a 4,381-line file comes back from each of its 12 compactions with only the path. **inference**: that explains much of the 18 reads
- **LSP**, our `LSP` tool:
  - TypeScript and JS have a server; Go does not («No LSP server available for file type: .go», probed on `x/go/lane.go`)
  - 😮 an outline is no cheap view of a giant file: `documentSymbol` on register.tsx returned **4,460 lines, 158 KB, 71,066 tokens**, more than the whole of `x/go/lane.go` (24,154). a grep for top-level functions gives 361 lines
  - `workspaceSymbol` found nothing for a symbol that is there: «the LSP server has not finished indexing». a cold server is a silent miss
- **ranged reads and grep**: our `scout` card hands back `path:start-end` ranges, never bodies (`home/.claude/agents/`, `rules/fleet-identity.md`)
- **structure tools**: [ast-grep](https://ast-grep.github.io/) for structural search and rewrite; [aider's repo map](https://aider.chat/docs/repomap.html) packs files and signatures into a token budget (`--map-tokens`). no fleet member has either today
- **retrieval**: Sourcegraph Cody and Devin index code and send ranked snippets, never whole files ([cody](https://sourcegraph.com/blog/how-cody-understands-your-codebase), [devin](https://docs.devin.ai/desktop/context-awareness/overview))

## 4. how to prevent it: what is measured

- **a rule's wording matters more than its content.**
  - 😮 679 scraped rule files, 5,000+ Claude Code runs (Opus 4.6) on SWE-bench Verified: random rules helped as much as curated ones (both +13.8 points on a subset). **every rule that helped alone was a negative constraint** («do not refactor unrelated code»). every one that hurt alone was a positive directive («follow code style») ([Guardrails Beat Guidance](https://arxiv.org/abs/2604.11088), abstract)
  - context files, LLM-written and developer-written alike, «do not generally improve task success rates» and raise cost by over 20 %. they help with «non-standard coding practices» ([Evaluating AGENTS.md](https://arxiv.org/abs/2602.11988), abstract)
  - so the size rule is one line, worded as a «do not», and it names a non-standard practice: our own cap
- **a lint outside the model is the one door that cannot be talked past.** ESLint's `max-lines` defaults to 300, and its docs say there is no objective maximum ([max-lines](https://eslint.org/docs/latest/rules/max-lines)). a commit gate or a test reads the count whatever the agent believes
- **our own precedent works**: `script/lib/skill-size.test.ts` holds every `SKILL.md` under the 19,995-char compaction re-attach cap, with named per-skill caps and a dated `+150` comment beside one raise. it is the model W31 names
- **deep modules**: a plan step that names the owning module before the edit (both lanes, Anthropic's plan-first advice). recommended, not measured

## 5. the baseline number for the 5.5 family

- **one tokenizer for the family**: Opus 5.5, Sonnet 5.5 and Haiku 5.5 counted the same files to the same token (x-herdr-chat `main.js` 19,661, `lane.go` 24,154 on all three; the count_tokens api)
- **tokens per line in our code**, raw text (Opus 5.5):
  - `register.tsx` 16.0, `x/go/lane.go` 15.8, `x-herdr-chat/main.js` 13.8, `x-herdr-agents/main.js` 12.9, `x/go/registry.go` 13.3
  - `script/test-vm-go.sh` 27.2 (dense shell)
- **as the Read tool shows it**: the line-number column adds ~2.6 tokens a line; `lane.go` numbered is **18.3 tokens a line** (28,114 for 1,534 lines)
- **so one default Read holds**: ~1,360 lines of our Go, ~1,500 of our JS, ~900 of dense shell
- **the budget**: the 1M context (`crew-lead/references/model-cards.md`), with the fleet's second wind at 55 % (`rules/fleet-mods.md`): a 1,200-line file is ~22k tokens, 4 % of what a session works in before it winds
- **the answer to «is 1.5k a good baseline?»**: close, a little high. 1,500 lines of our Go overflow one Read (~27k tokens). 1,500 of our JS fill it to the brim
- 📌 **the number: 1,200 lines.** it fits one default Read in every language we write except dense shell, with ~10 % headroom for long lines
- **the exception band, 1,200–2,000**: a stated reason in the file's header, like skill-size's dated raise: a table, a parser, a cohesive core with shared state (the checker's own reason); a test file that keeps one subject's cases together
- **past 2,000**: two reads at least, and nothing a compaction brings back; splits, except generated or vendored code, which stays out of the check

## 6. a 50,000-line file without reading it whole

- **a whole read is off the table.** `checker.go` at 1.48 MB is refused (over 256 KB); 50k lines at ~16 tokens is ~800k tokens, most of a 1M context. so the agent works in slices:
  1. grep for the symbol, or `workspaceSymbol` on a warm TS server
  2. a ranged Read of the definition and its neighbourhood: 150 lines is ~2.7k tokens
  3. `findReferences` and `incomingCalls` for the callers, each read as its own range
  4. the edit, then a re-read of the changed range only
- **what it costs against a split codebase**, estimated from the per-line numbers above:
  - one change in the giant file: 3–6 ranges at ~2–3k tokens each is 10–20k tokens. a split codebase costs about the same, plus an interface file or two
  - the difference is after a compaction. a split file under ~350 lines comes back on its own. a giant file comes back as a path, and the agent re-greps and re-reads its ranges after every compaction: 12 compactions × 10–20k is 120–240k tokens a day
  - the outline is no shortcut: on a giant file it is itself a giant read (71k tokens for register.tsx)
- **where a giant file wins**: tight mutual recursion over shared state (the checker), where a split would add calls in a hot path and a god object. our mods and herdr views have no hot path of that kind; they are views, readers and handlers that split by concern

## recommendation for us

1. **the rule** goes in `x:guide-code` § less is better, one line, a «do not» as § 4 found works: «do not grow a source file past 1,200 lines: the new concern gets its own module; a stated exception up to 2,000 lives in the file's header»
2. **the check** is a test like `skill-size.test.ts`, run in each mod's own suite: each file ≥ 1,200 lines is a named row with its cap and a dated reason; a raise is that row's edit, and it needs dima's word (W31)
3. **the existing giants** become rows at today's size, capped there, so they can only shrink: register.tsx 11,518 and the four stash test files first
4. **sixth sense grades it** beside the exit lines: a diff that grows a file past its cap with no row change is a P1
5. **codie's plan step** names the owning module for each new concern before the first edit (`crew-codie/how-you-work.md` § before the first line)
6. **the counter-rule to the harness**: one line beside «prefer editing existing files»: «a new concern in a file at its cap is a new file, not an exception»
7. **not now**: ast-grep or a repo map. ranged reads, grep and `scout` cover the reads. a Go LSP would help `x/go` and needs its own ⚖️ worth it
