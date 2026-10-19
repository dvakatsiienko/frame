---
dies-when: cclio:system-checkup's skill-shape check stops reading it (it holds that check's method and last run)
---

Ticket: FRM-238, FRM-239

# FRM-238 / FRM-239 candidates

50 skills listed, 44 read whole (the other 6 are under 2,500 chars and not procedures: art-kit, cclio-mode, guide-conventions, mobile-mode, step-by-step, author-blueprint), 294,274 chars of SKILL.md in total. Strength 1-3, 3 = clear win. Existing scripts and hooks are not listed (x lane, x brief, fetch.sh, pocket-check, recipe:brief, research:lanes, gazette-trail, lefthook skip-ci guard).

## split candidates (FRM-238)

- evergreen (11,494): the read-and-judge half, sections 1-3 (~6,000). Loaded by cclio at the board, but the work runs in a `helper` card whose brief is "this file's path", so the card also pays for sections 4-5 (report template, act on his word, ~3,500) and cclio pays for the judge rules it never applies. Shape: a reference `evergreen-read.md` (sections 1-3), loaded by the helper card only; SKILL.md keeps day flow, report, act. Strength 3 (a ~7k card read of 4.5k it does not need, and ~6k out of the main thread).
- pm (11,916): the body spec-seed + writing + run markers (~5,500) are needed when a body is created or rewritten, not for `set` state, `link`, `comment`, sort. Closing + ask-guard (~1,500) are needed only when a close is proposed. Shape: reference `body.md` loaded "before a create or a body rewrite", `closing.md` "before a close proposal"; SKILL.md keeps the door, fields, traps, reading. Who loads: every ticket write. Strength 3.
- cmt (8,901): lanes + deploy-watch (§5 "The lanes", ~1,900). Loaded on every commit in any repo; needed only when the repo has PR lanes or a deployed app (bytes push). Also the §5 skip-ci rule duplicates the lefthook `no-ci-skip-marker` guard (~450 chars, drop or one line). Shape: reference `lanes.md`, loaded "when opening a PR or pushing bytes". Dima's example (a Linear section a non-tracker commit never needs) is this §5, ~1,000 chars of the ticket/closing-keyword text. Strength 2.
- crew-cloud (9,276): "the environment's setup script" + "keys and browsers" + "the meter" (~3,400). Needed once per environment build or when a job needs a key/browser; every cloud spawn pays it. Shape: reference `environment.md`, loaded "when building the environment, adding a key, or a browser check". Strength 2.
- crew-verifier (10,303): "the main lane" (~1,500) is needed only when arg 2 reads `main:<sha>`. Shape: reference `main-lane.md`, loaded on that argument. Strength 2.
- notes (4,868): obsidian half (~2,900) vs notion half (~1,900); a reader needs one. Shape: `obsidian.md` and `notion.md` references named by trigger word. Strength 2.
- gazette (4,846): phase 2 house style for the health update (~1,500) is needed only after a literal "y" at the wire gate; halt loads gazette on every halt. Shape: reference `wire-style.md`, loaded after "y". Strength 2.
- github-contrib (7,752): ci-reviewer / review-lane / babysit details (~3,000) vs issues + outside-repo footer (~1,900) vs plain PR hygiene. Coders opening a pr need little of the first two. Shape: `reviewer-lane.md` loaded when watching or merging; `issues.md` loaded for `gh issue` / outside repos. Strength 2.
- crew-lead (9,688, body is a router already) and crew-coder (10,233, has how-you-work.md): already split; no candidate.
- boot (12,594): "mini mode" (~1,000) loads on every full boot, "Wednesday" lines (evergreen + memory pass, ~1,000) load on 6 of 7 days without use. Shape: mini mode to a reference like board mode already is. Strength 1-2.
- crew-dna (5,418): "coder · verifier — the pr pair" (~1,900) is loaded by designer and adviser too, which the section's own header says it does not bind. Shape: `dna-pr-pair.md`, read by coder and verifier. Strength 1.
- crew-adviser (9,685): decision wake + consult + retro (~2,600) vs the day wake. Strength 1, omitted detail.
- handoff (8,466): trigger D (push to peer, ~1,900) + "peer moves" (~900) vs B/E/F/G. Strength 1.

## scriptify candidates (FRM-239)

- siesta step 3.5: "a `helper-lite` agent counts `helper` and `helper-lite` spawns per live session since the last siesta" — a script (jq over each session transcript, `subagent_type` of Agent calls, cut by `date +%z`) prints the per-session counts. Saves an agent spawn per siesta; removes a stated tz error. Strength 3.
- checkpoint step 3 + halt phase 5: "a `helper-lite` reads this session's transcript ... for his own typed lines" — one script lists dima's typed lines since the last `📄 last report` stamp (halt phase 5 points at checkpoint §3 for the how). Saves a helper-lite read at every halt and checkpoint, and gives both skills one definition of "his line". Strength 3.
- evergreen §1-3: "tier from the branch ... age from createdAt, ci from statusCheckRollup" + the gather block + "peer ranges of every dependant — `pnpm why`, then `npm view <dependant> peerDependencies`" + "`npm view <pkg> time --json`" for the since-major clause — a script prints one row per renovate pr: tier, age, ci, peer-range verdict, previous-major date. Saves the card's derivation tokens and makes the "excludes the new major is a hold" check identical every run. Strength 3.
- halt phases 1.5, 1.7, 3a: "`cp _hq/inbox-template.md _hq/inbox.md`, `trash _hq/inbox-composer.md`", "mark done every github notification whose pr is merged or closed ... `PATCH /notifications/threads/<id>`", the two `find ... -mtime +30 / +14 -exec trash` lines, and the `rg 'until: (FRM|BYT)-N'` list with each id's state — one `halt-sweep` script runs them and prints counts. Fixed commands, ~2,000 chars of halt steps become one call. Strength 3.
- cmt §2/§6 + the lefthook commit-msg block: "`[emoji] [scope]: [description]`", retired emoji list, "no closing keyword next to an id", description "≲60 chars", lowercase — lefthook has skip-ci, trailer and lane-gate only (check lane-gate); a `commit-msg` lint for emoji canon, kebab scope, lowercase, closing-keyword-next-to-id would replace the "scan" in §6 and the 19 format-refusal sightings. Strength 2-3.
- crew-lead preflight: "trust key ... `jq … ~/.claude.json > tmp && mv tmp`", "spare age ... `ps -o pid,lstart ... grep '[b]g-spare'`; older than a day → `claude daemon stop --keep-workers`", and the four argv lines with the `<mode> <role emoji> <ticket> <role word>:` name — a `x spawn-preflight <repo>` (trust key check/set, spare age, name builder). Reliability: one spawn flag order once ate a 1.5 kB brief; the spare bug booted a coder without AGENTS.md. Strength 3.
- boot step 4 and step 8: "arm both watches ... `watch-once.sh ... pr|ci-watch.sh`", "`pnpm ccrow:start opus`", the merge-monitor poll, and the `for i in $(seq 1 60) ... wc -l notes.jsonl` wait — a `boot-arm` script (idempotent, reads the digest's `watches: N of 2`) and a `ccrow-wait <count>` script. Strength 2.
- checkpoint §4 + halt 1.5 + boot step 3: "re-read `inbox.md` and diff it against the pocket — every inbox item must carry ✅ and a pocket item" — a script lists inbox lines with no ✅ or no matching pocket id (inbox-prep-check.ts exists for the composer's prep, not this diff). Strength 2.
- crew-verifier step 3: "the verdict follows from them, the first match from the top wins" (not-checkable / refuted / clean so far / clean) — `x verdict` takes the fields and prints the object and the verdict word; the model fills evidence only. Removes "clean inferred from silence". Strength 2.
- crew-composer receipt: composer-receipt.ts per chore, then a hand-built `jq -n ... | curl localhost:5678/webhook/composer-receipt` per chore on a Haiku session — fold the POST (and "mailbox POST failed" line) into composer-receipt.ts. Strength 2.
- guide-go "The gate": five fixed commands (gofmt -l, go vet, staticcheck, go fix -diff, go test -count=1) — a `go-gate` script in the module dir, plus the dlv init-file recipe as `dlv-test <func> <TestName>`. Strength 2 (gate), 1 (dlv).
- remind: line shape `⏰ <thing> — set <date> · due: <date>`, verbs stick/unstick/forget/list/clear, "stuck first, oldest first" — a `remind` script editing `memory/_reminders.md`. Strength 2.
- pm "run markers": `⸻ 🪪 cc·YYYYMMDD·slug · <model> · agent run stamp — please keep 🙏` and "search the marker plus the title stem" before create; plus the `printf ... sline-focus.sh` claim line — `x run-stamp` / `claim FRM-N`. Also "every id is a link — scan before sending" (named the most-repeated slip): an id-link linter on outgoing text. Strength 2.
- catch-up §1 and §3: window lookup `jq '.["<area>"]'`, `git log --since`, the lag check, and the stamp-writing jq block — `catch-up-gather <area> <paths>` and `catch-up-stamp <area>`. Strength 2.
- handoff-ingest peer mode: the HANDOFF REQUEST message embeds "the full text of CST-SPEC.md" which the model pastes by hand — `x handoff request <target> [focus]` builds and prints the message. Saves the spec's tokens as output and a copy error. Strength 3 (see also duplicated logic).
- crew-designer §8 ledger line (date · app · brief version · mode · takes · artboards · tokens · wall · window % before/after from `cc-usage-window.json` · pick minutes · rounds) — a script appends the line from fields and reads the window file. Strength 2.
- crew-designer-interview step 3 "print this block every job" (links, ~700 chars) and step 6 brief skeleton — `design-brief new <app>` prints the links and writes the heading skeleton. Strength 2.
- shape-test-drive §1: template file with `until:` = today + 14 and `test-drive:check` — `pnpm test-drive:new <subject>`. Strength 2.
- top-seven names: "`rg --hidden -n '<name>'` over ~/frame and ~/projects/bytes before printing" for seven names — `name-clash n1..n7` prints hit counts. Strength 2.
- gazette phase 1: frontmatter + masthead + `## trail` skeleton and the `git log --since=<today>` across touched repos — `gazette-new <slug>`. Strength 1.
- app-author-ftr "over ~150 lines → split" and status legend; crew-cloud meter reading; yt-transcript transit trash; shift report counts — strength 1, omitted.

## duplicated logic

- peer resolution: handoff.md Trigger D step 1 and handoff-ingest PEER MODE step 1 both carry the `jq -r 'select(.sessionId|startswith("<prefix>")) | "\(.pid) \(.name) \(.status)"' ~/.claude/sessions/*.json` map plus the "demand the ref on a first bare-name send" note. One `x handoff peer <id|name>` verb holds it.
- the delivery-failure rule: handoff.md "delivery failure — triggers A and D" and the same paragraph inside handoff-ingest's request template ("DELIVERY FAILURE RULE (MANDATORY)"). Once in CST-SPEC.md.
- "dima's chat lines since the last report": halt phase 5 ("read from the transcript the way `cclio:checkpoint` § 3 does") and checkpoint §3 — one script (see scriptify).
- inbox → pocket home check: boot step 3, halt 1.5, checkpoint §2 and §4 each restate "every item has a pocket item" with a different mark rule (✅ in place vs reset from template).
- flush steps: checkpoint §2 repeats halt 3a (flawlog flush), 3.5 (milestones) and the coder roster ("retro received? stopped?") by reference; the roster check recurs in halt phase 0 and phase 5. A shared `coder-roster` script (claude agents --json + retros dir + kill -0) serves both.
- commit body contract: crew-coder §2 ("first line names the step, no closing keyword next to an id, trailer `Agent: coder · <model>`") restates cmt §4 and §5; crew-coder §4 pr watch and crew-cloud step 4 and github-contrib "babysitting" each describe the same `x gh pr <n> --since` poll.
- worktree creation: crew-dna "proof" and crew-verifier step 1 both give the `git worktree add ... + frame git-crypt flags + seed` recipe; crew-coder §2 says "the dna's".
- skip-ci marker: cmt §5 and lefthook `no-ci-skip-marker` (the hook is the enforcer; the skill line can drop to a pointer).
- the 5-hunt `x:browser-headless` essentials line quoted in crew-coder §5, crew-verifier verdict object, guide-ui-ux "done", app-setup-essentials — pointers, fine.

## looked at, no candidate

guide-code, guide-typescript, guide-react, guide-ui-ux, step-by-step, walkthrough, writing-for-humans, yt-transcript (already scripted), browser-headless (already run.sh), app-setup-essentials (script holds the list), crew-subagent, crew-designer (takes procedure is judgment), shape-lane, shape-idea, shape-recipe, research, flawlog, shift (checkup scripted), author-memory, author-blueprint, mobile-mode, cclio-mode, art-kit, guide-conventions.
