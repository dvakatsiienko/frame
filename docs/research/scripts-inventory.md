---
dies-when: the x rebuild has moved or dropped every script listed
---

Ticket: FRM-284

# the package.json scripts inventory

every script in the root `package.json` on main (2e9d183), judged for the x rebuild against the
admission rule in `x/PRODUCT.md`.

## how it was read

- **callers** — `rg -F` for the script name and for its target path, repo-wide, minus
  `node_modules`, `pnpm-lock.yaml`, `package.json`, the encrypted set and `cclio/`.
- 📌 **`cclio/` was not read** (AGENTS.md: a non-coordinator never reads under it). every «no caller»
  below means «no caller outside `cclio/`». cclio's boot, halt and shift likely call some of them.
- a target that only names itself, a flawlog line or a jev fixture is not counted as a caller.
- **alive** — every `.ts` target passes `node --check`, every `.sh` passes `sh -n`, the `.py`
  compiles. the read-only ones also ran with `--help` or no args on linux (node 24.21, pnpm 12.6).
  a mac-only failure on linux (no `defaults`, no wispr db, no `~/.claude/shelf`) is not «dead».
- `pnpm test` passed (36 files, 390 tests); `pnpm typecheck` passed. the go tests did not run here:
  the container has go 1.24.7, `x/go` wants 1.27.1, `sline` wants 1.24.13. ci runs both.
- nothing that writes, pushes or calls a network ran (linear, github, op, jev, launchd, swiftc).
- **verdicts**:
  - keep — a fleet op, with the x family it belongs to
  - app-dev — stays a pnpm script: a package's lifecycle, or a tool with one surface
  - drop — nothing calls it, and it is dead or replaced
  - ? — the evidence does not settle it
- PRODUCT.md names the families `lane`, `handoffs`, `schema`, `pm`, `notes`, `scheduling` and
  `evergreen`; the registry adds `brief`, `probe`, `knowledge`, `completion`. a keep with no fitting
  family says «none yet» and proposes one.

## the scripts

- chords:dev · `pnpm --filter chords dev` · hotkeys/AGENTS.md, chords AGENTS.md, chords-run skill · app-dev · a package lifecycle (dev)
- chords:build · `pnpm --filter chords build` · hotkeys/serve.ts, chords-run skill, hotkeys/AGENTS.md · app-dev · a package lifecycle (build)
- badges:sync · `script/badges-sync.ts` «draws the readme's badges in the banner's style» · ci.yml (by path), AGENTS.md · app-dev · a render, and ci runs the file by path
- profile:redraw · `gh workflow run redraw.yml -R dvakatsiienko/dvakatsiienko` · none · ? · no caller; the workflow lives in a repo outside this session's scope, so alive is unproven
- frame:link · `script/frame-link.ts` «frame — reconcile ~ with the mirror» · lefthook pre-push, .claude session-start hook, AGENTS.md, README.md · keep → none yet (proposed `dotfiles`, the FRM-14 want) · the mirror engine; three surfaces; it refuses to clobber, a hidden hazard
- frame:seed · `script/seed.sh` «seed a fresh mac with frame» · README.md, seed-tart test drive (by path) · app-dev · the bootstrap runs before node, go and x exist on the mac, so it cannot be an x verb
- toolchain:sync · `script/toolchain-sync.ts` «the installed node and pnpm are the source of truth» · AGENTS.md, renovate.json · keep → evergreen · writes pins in frame and bytes, a sequence over two repos
- vorssaint:export · `defaults export com.vorssaint.utils … plutil` · none · app-dev · no caller, but `import/vorssaint/` holds its output; one surface (dima), mac-only
- vorssaint:import · `osascript quit && defaults import && open` · none · app-dev · no caller; the pair of export, one surface (dima)
- vorssaint:shelf · `script/vorssaint-shelf.ts` «prints what dima dropped on the vorssaint utils shelf» · vorssaint-shelf test drive · app-dev · on trial to 2026-10-17; admission waits on that verdict
- wispr:add · `script/wispr-add.ts` «adds or updates a word in Wispr Flow's dictionary» · rules/dima-signals.md (every cc and cw session), explore test drive · keep → none yet (proposed `wispr`) · a fleet rule calls it from every surface; it hides the wal-safe db write
- github:agent-token · `script/github-agent-token.ts` «prints a fresh github installation token for our github app `x-coder`» · cmt-trigger eval prompt (by path) · keep → lane · the coder's gh auth; `x lane pr-open` is its natural home (x/go does not call it yet)
- autoclean-screenshots:build · swiftc `schedule/jobs/x-autoclean-screenshots/main.swift` + `script/lib/sign.sh` · its launchd plist, schedule/README.md · app-dev · a daemon build
- monitor-hotkey:keycodes · `script/monitor-hotkey-keycodes.ts` «writes the swift half of the carbon keycode table» · monitor-hotkey:build, hotkeys/chord.ts, keycodes.swift · app-dev · a codegen step of the build
- monitor-hotkey:test · swiftc `chord.test.swift` (no header comment) · monitor-hotkey:build, chord.test.swift · app-dev · a test step of the build
- monitor-hotkey:build · swiftc `schedule/jobs/x-monitor-hotkey-stats/*.swift` + sign.sh · its launchd plist · app-dev · a daemon build
- speak:test · swiftc `schedule/jobs/x-speak/normalize.test.swift` «golden.json is dima's real text» · speak:build · app-dev · a test step of the build
- speak:build · swiftc x-speak + sign.sh + `script/lib/relaunch.sh` · its launchd plist, speak/AGENTS.md · app-dev · a daemon build; the relaunch is the package's own deploy step
- speak:admin · `speak/server.ts` «the voice admin's server» · x-speak-admin launchd plist, speak skills, speak/AGENTS.md, README.md · app-dev · the app's serve step, run by launchd
- speak:admin-dev · `pnpm --filter speak dev` · speak-run skill, speak/AGENTS.md, speak/FTR.md · app-dev · a package lifecycle (dev)
- speak:admin-build · `pnpm --filter speak build` · x-speak-admin plist, speak skills, speak/AGENTS.md · app-dev · a package lifecycle (build)
- ccrow:ensure · `ccrow/ensure.ts` (no header comment; usage «start ccrow on the day's arm unless one already runs») · ccrow/AGENTS.md (cclio's boot runs it) · app-dev · one surface (cclio), ccrow is on test drive
- ccrow:start · `ccrow/start.ts` (no header comment; usage «park ccrow, cclio's adviser, on that arm») · ccrow/AGENTS.md, ensure.ts, wake.ts · app-dev · one surface; `--help` path ran clean
- ccrow:stop · `ccrow/stop.ts` «the registry entry goes before the process does» · ccrow/AGENTS.md (cclio's halt runs it) · app-dev · one surface (cclio)
- ccrow:wake · `ccrow/wake.ts` «a Stop hook and a PreCompact hook can fire in the same second» · ccrow/AGENTS.md, charter.md · app-dev · one surface; the hook wiring is not in the global settings, so it sits in cclio's; `--help` ran clean
- ccrow:vet · `ccrow/vet.ts` (no header comment; usage «log a verdict on one note») · ccrow/AGENTS.md, ccrow test drive · app-dev · one surface (cclio)
- design:contrast · `design/contrast.ts` (no header comment; usage «every fg and ui role on every bg») · crew-designer skill · app-dev · a designer instrument (AGENTS.md: `pnpm design:*`); `--help` ran clean
- design:comp-render · `design/comp-render.ts` (usage «a Claude Design canvas's boards as pngs») · crew-coder skill, design-run test drive · app-dev · a render; `--help` ran clean
- design:cvd · `design/cvd.ts` (usage «can every fg and ui role still be told apart») · crew-designer skill, x/go/view.go comment · app-dev · a designer instrument; `--help` ran clean
- design:diff · `design/diff.ts` (usage «how far a build shot sits from its comp») · crew-coder skill · app-dev · a designer instrument; `--help` ran clean
- design:palette · `design/palette.ts` (usage «a ramp of the seed hue») · crew-designer skill · app-dev · a designer instrument; `--help` ran clean
- design:scale · `design/scale.ts` (usage «fluid type and space steps (utopia)») · crew-designer skill · app-dev · a designer instrument; `--help` ran clean
- design:states · `design/states.ts` (usage «which board shows which ftr state») · crew-designer skill, coderabbit test drive · app-dev · a designer instrument; `--help` ran clean
- design:tokens · `design/tokens.ts` (usage «DTCG tokens → a tailwind v4 @theme block») · none beyond AGENTS.md's `design:*` family line · app-dev · a codegen; `--help` ran clean
- hotkeys:audit · `hotkeys/macos-audit.ts` «does macOS still hold the hotkey settings we committed?» · none (flawlog and a jev fixture only) · app-dev · alive (parses) but uncalled; one surface (dima)
- hotkeys:map · `open http://localhost:7373` · hotkeys/AGENTS.md, chords AGENTS.md, hotkeys/ports.ts · app-dev · a thin alias that opens the app
- hotkeys:live · `hotkeys/live.ts --watch` «the always-on half of the hotkey map» · x-monitor-hotkey-live plist (by path), chords board.tsx, chords-run skill · app-dev · the app's daemon, run by launchd
- hotkeys:scan · `hotkeys/scan.ts` «prints every hotkey the machine will tell us about» · chords app (board, shell), hotkeys/serve.ts, live.ts, top.ts · app-dev · the chords app's data source
- hotkeys:stamp · `hotkeys/stamp.ts` «writes `feature` onto every press line the recorder logged before it stamped» · hotkeys/AGENTS.md, chords FTR.md · app-dev · a one-shot backfill of the hotkeys home
- hotkeys:top · `hotkeys/top.ts` «what the x-monitor-hotkey-stats daemon recorded» · zsh aliases.zsh, both hotkey plists, hotkeys/report.ts · app-dev · the hotkeys home's reader; `--help` ran clean
- jev:inbox · `script/inbox-triage.ts` «dry run: lanes every inbox item through jev» · none · ? · no caller, yet maintained in #58; `jev:test`'s `inbox-lanes` fixture asks the same `inboxQuestions`
- jev:flawlog · `script/flawlog-triage.ts` «lanes every line of a flawlog file through jev before the halt flush reads it» · none · ? · its caller is the halt, which lives in `cclio/`
- jev:route · `script/skill-route.ts` «the skill router: the skills a prompt should load» · shelf/hooks/skill-route.sh (by path), jev-vet and jev-report (as a flow label) · app-dev · the hook runs the file by path; the pnpm name is a manual door
- jev:router · `script/jev-router.ts` «the skill router's kill switch» · shelf/hooks/skill-route.sh comment · app-dev · a thin on/off of one file; admission rule 3
- jev:report · `script/jev-report.ts` «how jev did today, one block per flow» · skill-router fixture only · app-dev · a report read at the halt (`cclio/`); one surface
- jev:test · `script/jev-test.ts` «the fixture suite of every jev flow» · skill-route.ts, skill-router research doc · app-dev · a test suite
- jev:vet · `script/jev-vet.ts` «the trial period of every jev flow» · home/.claude/CLAUDE.md (every session), crew-coder skill · keep → none yet (proposed `jev`) · the global CLAUDE.md sends every session to it
- the token script · ported to `x as <member>` (FRM-344) «prints a fresh linear app-actor token» · done · the keys package mints and caches it
- the archive script · ported to `x linear archive` (FRM-344) «archives closed tickets … as the cclio app» · done
- the push hook · ported to `x linear push` (FRM-344) «link a pushed commit to its ticket ourselves» · lefthook pre-push, cmt skill, linear-flow rule · done · the script, its lib and its pnpm name are gone
- the read script · ported to `x linear read` (FRM-344) «print one ticket's whole fetch contract» · done · the pm skill reads through the verb
- macos:setup · `script/macos-setup.ts` «bring a Mac up to this repo's baseline» · seed.sh, README.md, seed-tart test drive · keep → none yet (proposed `dotfiles`) · a sequence (brew bundle, defaults, duti, vim-plug) the seed and dima both call
- mcp:build · `pnpm --filter mcp-x-cw build` · AGENTS.md, cclio-mode skill · app-dev · a package lifecycle (build)
- mods:live · `home/.claude/plugin-x/mods/live.ts` «a dev server for a mod» · mods/AGENTS.md, fleet-flow rule · app-dev · a dev server
- mods:probe-redact · `home/.claude/plugin-x/mods/probe-redact.ts` «proves redact live» · mods test drive, redact FTR.md · app-dev · a mod's live test
- mods:test · `claude plugin test` over every mod · mods/AGENTS.md, guard rules.ts, vitest.config.ts · app-dev · a test suite
- mods:writes · `home/.claude/plugin-x/mods/writes.ts` «the fleet's file writes by channel» · mods test drive, stash FTR.md · app-dev · a report for the mods home; usage path ran clean
- memory-load:replay · `script/memory-load-replay.py` «replays memory-load-rule-lazy over real transcripts» · memory-load-rule-lazy.py hook comment, rules-lazy FTR/PRODUCT, memory-load test drive · app-dev · a replay tool for one hook; `--help` ran clean
- memory-sync:map · `script/memory-sync-map.ts` «prints what reaches cw from the cc masters» · memory-update skill, the synced instructions head (dima's routes line) · keep → none yet (proposed `memory`) · dima and the cw skill both call it
- memory-sync:copy · `script/memory-sync-copy.ts` «renders `account / profile / instructions` fresh and puts it on the clipboard» · memory-update skill and its instructions-head.md · keep → none yet (proposed `memory`) · dima and the cw skill both call it; a render + clipboard sequence
- plugin:release · `script/plugin-release.ts` «bump the plugins the tree moved past, and refresh them» · package-json.md (as a naming example) · ? · a fleet procedure by its header, yet no caller outside `cclio/`
- rayconfig:decrypt · `script/rayconfig-decrypt.ts` «reads a raycast `.rayconfig` export and prints what it has bound inside» · none (a flawlog only) · app-dev · a one-surface reader; its lib is tested
- repo:defaults · `script/repo-defaults.ts` «applies ours to every repo dima» owns · none · ? · no caller; it writes github settings, so it was not run
- reply-check:report · `script/reply-check-report.ts` «counts what the reply-check Stop hook logged» · reply-check.py hook comment, reply-check test drive · app-dev · a report for one hook on test drive; ran clean («nothing logged yet»)
- research:lanes · `script/research-lanes.sh` «runs the free research lanes on one brief, in parallel» · rules/fleet-flow.md (every session), design-run test drive · keep → none yet (proposed `research`) · a global rule calls it; it hides a parallel two-lane sequence
- schedule:install · `schedule/install.ts` «link every job's plist into ~/Library/LaunchAgents and load it» · schedule/README.md, x-ray AGENTS.md, x-atelier-live plist, restart.ts · keep → scheduling · the one door for launchd installs
- schedule:restart · `schedule/restart.ts` «restart ONE job on the plist launchd already holds» · speak skills, speak/AGENTS.md, x-speak-admin plist · keep → scheduling · skills and dima both call it; the wait-until-running is a hidden hazard
- skill:cclio-mode-snapshot · `script/skill-cclio-mode-snapshot.ts` «compiles the coordinator's whole brain into ONE file cw can read» · mcp-x-cw cclio.ts (by path), cclio-mode skill · app-dev · mcp-x-cw spawns the file by path; the pnpm name is a dev door
- skill:evergreen-apps · `script/skill-evergreen-apps.ts` «the changelog delta of the self-updating apps» · none outside `cclio/` (a flawlog only) · keep → evergreen · PRODUCT.md names the evergreen family; its caller, `cclio:evergreen`, lives under `cclio/`
- the node handoff store script «the one door to the CST handoff store» · handoff and handoff-ingest skills, CST-SPEC.md, ADR-0002 (all by path) · ported → `x handoff` (list, peek, ingest, write, delete), the script and its pnpm name deleted (FRM-343, 2026-10-07)
- skill:memory-sync-mirror · `script/skill-memory-sync-mirror.ts` «renders the `sync: cw` sections of the cc masters into the paste block» · memory-update skill (by path), memory-sync-mirror lib · app-dev · its only caller is a skill (the `skill:` family rule)
- sline:build · `go build` in `home/.claude/sline` · seed.sh, sline/AGENTS.md, seed-tart test drive · app-dev · a package lifecycle (build)
- sline:test · `go test` in `home/.claude/sline` · ci.yml, sline/AGENTS.md · app-dev · a test suite (not run here: go too old)
- x-go:build · `go build` in `x/go` · x/go/AGENTS.md · app-dev · a package lifecycle; the `bin/x` shim rebuilds on its own
- x-go:test · `go test` in `x/go` · ci.yml, x/go/AGENTS.md · app-dev · a test suite (not run here: go too old)
- x-ray:icon-generate · `script/x-ray-icon-generate.ts` «renders an emoji into an x-ray command tile» · none · app-dev · a render for one raycast extension; usage path ran clean
- typecheck · `tsc --noEmit && pnpm -r typecheck` · lefthook pre-commit, ci.yml, AGENTS.md, many skills · app-dev · the type gate; ran clean
- test · `vitest run` · lefthook pre-commit, ci.yml, AGENTS.md · app-dev · the test gate; 390 passed
- test:watch · `vitest` · package-json.md, four test file comments · app-dev · a dev loop
- check · `biome check --write` · AGENTS.md, ci (as `biome ci`), many docs · app-dev · lint and format
- crew:audit · `script/crew-audit.ts` «did each coder read its lessons file before its first edit» · crew-coder skill and how-you-work.md · keep → none yet (proposed `crew`) · the coder contract and the coordinator both read it; ran clean
- fleet-hazards:check · `script/fleet-hazards-check.ts` «pre-commit (FRM-314): a hazard line … carries `guard:`» · lefthook pre-commit (by path) · drop · the pnpm name has no caller; lefthook runs the file by path, and the file stays
- flow:report · `script/flow-report.ts` «the fleet-flow done test (FRM-309)» · rules/fleet-flow.md (every session), bare-cc test drive · keep → none yet (proposed `flow`) · a global rule calls it
- shift:checkup · `script/shift-checkup.ts` «every guard a shift leans on, checked red and green» · none · ? · no caller outside `cclio/` (the shift contract lives there); it runs hooks and trashes a scratch dir, so it was not run

## totals

- keep — **17**
  - pm: the token and read scripts, since ported to `x as` and `x linear read`
  - scheduling: schedule:install, schedule:restart
  - evergreen: toolchain:sync, skill:evergreen-apps
  - handoff: the node store script, since ported to `x handoff` (FRM-343)
  - lane: github:agent-token
  - none yet: frame:link, macos:setup (`dotfiles`), wispr:add (`wispr`), jev:vet (`jev`), memory-sync:map, memory-sync:copy (`memory`), research:lanes (`research`), crew:audit (`crew`), flow:report (`flow`)
- app-dev — **58**
- drop — **2** (the push hook — since ported to `x linear push` —, fleet-hazards:check: the pnpm entry only, the file stays)
- ? — **7** (profile:redraw, jev:inbox, jev:flawlog, the archive script (since `x linear archive`), plugin:release, repo:defaults, shift:checkup)
- all — **84**

## what the count says

- 📌 **9 of 17 keeps have no family in PRODUCT.md.** `dotfiles` and `memory` cover four of them; each
  new family goes through the admission rule before v2.
- 📌 **five of the seven ? are «no caller outside `cclio/`».** one coordinator-side grep settles them.
- stale reference outside scope: `home/.claude/shelf/hooks/worktree-seed.sh` runs a `worktree:seed`
  script that frame does not define (bytes does, the hook says so), so in frame it is a no-op.
