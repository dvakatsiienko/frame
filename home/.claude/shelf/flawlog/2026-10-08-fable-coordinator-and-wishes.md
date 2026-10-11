# flawlog · 2026-10-08 · fable-coordinator-and-wishes · run `cc·20260929·readaloud`

one line per flaw: what broke · cost · lesson. `fixed:` opens a closed one. tags `#dima-caught` `#brief`.


- fixed: a recipe's research ran before dima's word on its groom, twice in two days (refresh-crew-coordinator 10-07; the adviser recipe's lanes 1 min after its reshape, 10-08 16:22) and I printed the synthesis without checking step 0 · cost: a report he called confusing and «another time you rush» · lesson → FRM-352, research:lanes refuses an unstamped brief; the adviser recipe carries the first `groomed:` stamp #dima-caught
- fixed: the cloud research lane landed and sat unseen; the plugin monitor pr-watch never started in this session, and no watch was armed at the launch · cost: dima saw it ready first · lesson → the boot arms pr-watch + ci-watch by hand when ps shows none (cclio 0.3.118) #dima-caught
- fixed: «that becomes a wisp» printed bare, against the bold + badge rule · cost: one question · lesson → the x-mod-stash autofix (mods coder, 18:14) + pocket 56 counts its hits #dima-caught
- fixed: «haiku 5.5 is the pick everywhere» covered two files; three runnable probes still pinned 4.5 (ccrow caught it 17:42) · lesson → one grep before any «all / every / everywhere» claim
- fixed: FRM-346 exit line 2 rested on «640 dev-build lines» from the CST, never measured; 665/665 lines were main · cost: 2 decision rounds · lesson → craft-spawning: an exit line on a data field carries its live count #brief
- fixed: the #67 pr watch searched `head:coder/` while the branch was `worktree-FRM-346-…`, blind 30 min · lesson → craft-spawning: the watch searches the ticket in the title #brief
- fixed: my cost grade summed usage over 39 transcript lines that were 9 responses (~$4.75 read for ~$1.17); 🪶 sifter caught it · lesson → fleet-claude-capabilities: sum once per message id; craft-spawning: numbers off transcripts go to sifter
- fixed: a classifier-seat vector seeded into refresh-crew-coordinator while refresh-classification already existed · lesson → «does a home exist?» one rg over recipes/ before a new vector (in cclio-wants.md for the adviser)
- fixed: the mods coder ran from ~/frame/cclio, firing cclio's Stop hook, so ccrow read the wrong thread 16:30–17:07 · lesson → ccrow/wake.ts wakes only on a session named cclio (472f6549)

## FRM-347 verifier retro (18:56) #brief
- exit lines 1–3 said «the same numbers» without naming the output; agent-mode json forced env stripping on a pty. write: «the board's number sequence equals the script's, on a frozen copy of ~/.claude/projects»
- exit 4's grep carve-out list missed a routed line → one arbitration round; routing goes in the body before the coder's first ping
- exit 5 «every new test proven red» ≠ coverage: 5 ported branches had no test. add «every ported branch has a test that bites»
- automation: `x fleet` A/B diff helper · `x --board` forces the human view · `x lane unlock` shim passes -buildvcs=false in a locked worktree
- x/AGENTS.md#verify candidates: port equality on a frozen transcript copy · verifier's own red-proof mutations · `go test -run` names checked against real names

## FRM-346/347 coder retro (18:57) #brief
- 9 guard refusals, ~12 calls lost; the mods gate refused a 30-file commit over one handed mods line (FRM-342 owns it; until then a brief handing a mods line says «main only»)
- equality harness compared numbers only; review caught it → an «old door vs new verb, numbers + words» x verb (same ask as the verifier's A/B helper)
- `x lane merge-main` failed once with no output, clean on rerun → ✨ wisp: print git's stderr
- go json.Marshal escapes `<` → transcript fixtures need SetEscapeHTML(false); one line for x/go/AGENTS.md
- review layers: coderabbit 1 (declined) · matt's review 2 real unique · verifier 6 unique — none redundant

## guard down fleet-wide, 18:59–19:00 #dima-caught? no — cclio caught
- every session hot-reloads x-mod-guard from the working tree; the mods coder's half-done rules.ts split sat in the tree for ~5 min, so every reloading session got a guard that could not load → fail-closed refusal of ALL Bash (even `echo`). reverted by the coder at ~19:00
- fix candidate: a mods coder edits a live mod in scratch until it compiles (fleet-hazards «shared working tree» already says it for repo gates) — the mods coder (inference, unprobed): the module loaded and threw on every call (bad cross-file import), so a keep-last-good loader would not have helped; the real gate is a scratch copy loaded with --plugin-dir, moved in once `claude plugin test` is green

## main red after the 19:20 push (19:24) #brief

- #70 (a replaces port) went green on its branch; a doc line naming the dead script landed on main after #70 branched, so TestReplacedDoorsAreDead only failed on main. fixed in place (ac71a8ac). lesson: a pr that deletes a door merges main in, or re-runs `go test -run TestReplacedDoorsAreDead` on main, before the merge

- 20:43 · cclio · #probe · a live `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=45` in `cclio/.claude/settings.local.json` compacted cclio at 51 % one turn later — `get_usage` still read `autoCompactsAtPercent: 97`, so «the running session ignores it» was printed as a finding and was wrong. the knob is LIVE (settings hot-reload); a probe of a compaction knob runs in a throwaway session, never the coordinator's own. no data loss: the summary carried every pending ask, the transcript stays on disk

- 21:48 · cclio · #brief · the night plan's «turbo: skip doc-only builds» step was already on bytes main (301db920, reported done on BYT-106); the plan copied BYT-106's slice section without checking main — the rule «exit lines are checked against main at planning time» (`craft-spawning`) was skipped; the coder caught it in one message. fix candidate: `x brief check` greps the exit's named keys on main and warns «already holds»

- 22:47 · cli coder (FRM-342 pr C) · #hazard · a vitest fixture that ran `git init` inside the pre-commit hook inherited its `GIT_*` env and wrote `core.bare=true` into frame's own `.git/config` — every git call in main and every worktree failed ~3 min. restored by the coder; cclio verified at 22:48: bare=false, git-crypt filters, remote, branch config intact, HEAD bb080072. guard candidate: a test spawning git strips `GIT_*` (lane_test's `cleanEnv` does) — an x-mod-guard / lint rule for `spawnSync('git'` in a test without an env, or a shared fixture helper

- 00:24 · cclio · #dima-caught · spawned two coders (FRM-355, FRM-356) on ask 13, «lanes run as a day lane now … they start on your word», which dima accepted as written — the recommendation itself said «on your word», and his reply gave none; he wanted only the grill and a wrap-up. the miss: a recommendation that names a later word is not that word. fix candidate: a spawn ask is its own ⏳ line that reads «spawn now?», never folded into a plan line
