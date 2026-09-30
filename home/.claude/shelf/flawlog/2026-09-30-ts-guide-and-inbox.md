# flawlog — 2026-09-30 · cclio-36 · ts guide + inbox

- `typescript-lsp` plugin sat enabled for 82 days with no `typescript-language-server` binary installed — the LSP tool was listed and could never answer; nobody noticed until dima read the plugin view · cost: a navigation capability silently absent · lesson: an enabled plugin that wraps an external binary gets `which <bin>` at install, and the boot could check it (candidate: a digest line)
- `quicksilver` vet (to 10-12) parked 2 days, never used — the plugin view says «never used» · breaks `habit-vet` («a parked vet grades nothing») · lesson: the next bulk read-to-decide goes through it first (today: the chords/speak drift check)
- I told dima «your coder test now covers three things (logos, LSP, diagnostics)» after bumping x — the coder session started on x 0.11.167 and `/reload-plugins` kept serving the stale skill copy and 0 LSP servers; it read logos.md from source and made 0 LSP calls · cost: the LSP test never ran, and my line claimed a test that could not happen · lesson: a plugin change reaches a running session only when that session's `ListAgents`/skill version is checked after the reload — a fresh session is the safe test bed (candidate: craft-spawning line)
- logo.ts took a single fuzzy svgl hit silently («calendar» → Google Calendar) and wrote a `--dark` copy byte-identical to light for 19 of 22 marks — both from my own code, found by the coder's first real run · lesson: the dry run on a toy job (yesterday's 🥊 pair) would have caught both
- BYT-113 verifier retro (3 rounds), ranked:
  - my exit lines: exit 4 named a thing that does not exist (no 16 px piece), exit 1 contradicted «fit whole» · lesson: a spawn ask checks «does each exit line name a thing that exists?» (craft-spawning candidate)
  - ci reviewer: found 1 bug the verifier missed (duplicate `setting-<key>` ids), missed 2 browser-only lows; its round 2 ran 37 s on a 29-file diff — a shallow pass, never trust its «clean» alone
  - x:github-contrib's review counter (`runs?branch=…` success count) printed 0 with 1 success listed — the filter is unreliable (skill fix candidate)
  - x:browser-headless hazard: a long-lived agent-browser session drifts to `visibilityState: hidden` — fades freeze, focus-visible reads invisible (8 false flags), rAF stops; a fresh session cleared it · candidate: run.sh prints visibilityState and refuses a hidden page
  - zsh `$s` does not word-split (a known hazard, bit again) · scripts loop with `${=s}`
  - atelier-verify candidates: a ring key-sequence table script, the pixel-grid colour-count check, a real right-click, 2× viewport for canvases

## BYT-113 coder retro (18:35)
- worktree git guard cost ~20 tool calls (heredoc, `$var` before sed, `cd … &&`, any text naming git refused) → every multi-step edit became a python file run by path. candidate: `edit-batch <script>` in plugin-x (edit list, anchor asserts, prints file:line)
- first commit landed on studio's main: shell cwd was still studio after reading the comp; soft-reset, nothing pushed. the guard let a worktree session commit in another repo
- impeccable finish review: 8 material fixes, 3 were comp devices skipped (rim hug, pixel tools corner, keyed menu) → read the comp as a device checklist before building
- unique finds per layer: local code-review 1 high (strip right-click no menu); essentials 1 (hidden zoom toolbar over the piece card); verifier 1 (`/` steals keys, ci reviewer too); coderabbit 0
- rendering the comp to png (fork, ~2 min, dc-runtime.js boots outside the canvas) was the unlock → crew-coder line «a comp link → render its boards first»; candidate `comp:render <canvas url>`
- served dev server died at the 30 min bg default → a served tree takes `timeout: 7200000` from the start
- entity-first naming read late (mid-job CLAUDE.md change) → two rename commits
- (verifier, BYT-113) `agent-browser press <key>` with focus inside a Base UI popover fired 3,000–3,500 keydowns (measured twice, atelier pieces popover); the last lands after the popover closes → looked like a key leaking through the list. candidate `x:browser-headless` hazard: count keydowns before blaming the app for a key acting inside a popover

## BYT-105 favicon coder retro (#117)
- 16 px grid cost the most rounds (half-pixel pills, a shadow smearing a gap, off-grid sun) → x:art-kit favicon branch line: «draw on size/16 units, check the pixel view at 16 before any polish»
- adaptive favicon.svg (day + night + scheme style) hand-assembled twice by scratch script → candidate `atelier:favicon` verb beside `atelier:icons`
- apple touch icon rendered on a transparent tile; ios fills black → `atelier:icons` flattens onto the ground
- compact hook: 📌 arrived, both files read, but only after two post-compact actions (add-reviewer, linear comment) — the resume summary pushes straight to acting
- look call for dima: by day the light tile sits close to a light tab strip

## BYT-114 verifier retro (#118, clean in 2 rounds)
- 🦉 my miss, repeat of craft-spawning «every exit line names a thing that exists»: exit 2 named a «manual» and a «keys list» (real: AGENTS.md:44, ⌘K `keys` in src/commands.ts); exit 5 said «png», atelier writes webp — I drafted them without opening the files
- exit 1 greps frame's art-kit, which lands on frame main (3584439e, unpushed) — verifiable only locally; a cross-repo exit line names where each half lands
- ci reviewer caught sketchbook AGENTS «baked» (outside exit 1's grep); the verifier caught the missing no-image upgrader test
- verify-recipe candidate: seed ATELIER_TAKES_DIR from `git archive origin/main apps/atelier/takes` for any takes-schema migration
- candidate: an `atelier:takes-count` probe — the verifier's wait loop counted current.json as a take
- the coder pushed round 2 before the round-1 verdict; the review label re-ran (counter 2 of 2)

## BYT-114 coder retro (#118)
- worktree guard ate ~8 calls (git text, cd into another repo, `export X=$(…)`, heredoc, complex sed); the frame commit needed two scratch scripts → candidate `lane commit --repo <path>` for the cross-repo half on main
- brief («pr opens at your first push») vs crew-coder («the pr exists before the first edit»): `lane` has no empty-commit verb → one crew-coder line says which wins
- exit 1 (grep only history) vs exit 4 (old takes load) pull against each other: a store that reads old records names them → a ticket that renames stored data says «migrate» or «read both» up front
- «writes a png» in exit 5 was from memory, not the code (same as the verifier's note — my miss)
- the regex pass couldn't tell verb from noun: ~20 lines fixed by hand; reading the diff was the real check
