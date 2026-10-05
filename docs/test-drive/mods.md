---
dies-when: the verdict line below is written (2026-10-19) — mods become a fleet-aware layer (rules line + contracts), stay dima's own toy, or get pruned
---
Ticket: [FRM-303](https://linear.app/x-com/issue/FRM-303)

# mods — cc function-hook plugins on trial

- **what:** `home/.claude/plugin-x/mods/` — stash (asks · afk · holds · keep-hot) and breather today; docs in `mods/AGENTS.md`, stash's in `stash/{PRODUCT,FTR,CONTEXT}.md`
- **dima's want:** «mods would allow us to solve lots of issues, including my UX and DX, and maybe even some issues from flowlog or fleet flow issues» · «I still explore them myself and can't tell for sure how much fleet should be aware of mods»
- **the question the verdict answers:** does the fleet need to know about mods, and how much — a rules line, a per-mod contract, or nothing
- **window:** 2026-10-05 → 2026-10-19
- **every halt:** one log line — which mod fired for real, what it saved or broke, any fleet miss that a mod could have caught

## stress list — one real try each

- holds: two live sessions on one file, the second refused with the holder named · a Bash-written file (heredoc, `sd`) — the Edit/Write hook never sees it, so a hold is never taken: measure how often the fleet writes through Bash
- holds across a `--bg` coder and cclio on frame main (the CST's mods-coder plan)
- asks: the ⏳ block in stash matches the reply's bucket, resolved items leave (FRM-303 item 3)
- keep-hot: a ping keeps the switch on (FRM-302 — 🔥 now lives in the stash store and survives a reload; the 10-04 untick came with no source edit in its window, so its trigger is unproven — a live tick through a ping is the check)
- afk: on → a shift's pings go bare; off → the missed-brief prints
- the surfaces: terminal session, Code-tab session, a `--remote-control` view ([claude-code#99217](https://github.com/anthropics/claude-code/issues/99217): mods draw only on the host)
- a fleet flowlog miss a mod would have caught — name it when it happens
- ~~spawn hints~~ — settled early: dropped 2026-10-05 after 0 for 1 on the first real fire; the board's off-pattern name flag stays (FRM-304)

## surface matrix — one sitting with dima (FRM-319)

the coder cannot see a surface; dima walks each, ticks what holds, notes what does not. open one session per surface on frame, `/board` in each.

- **terminal (iTerm2 or Ghostty, pointer reporting on)**
  - [ ] the band draws one row: `⏳ n open`, `📋` `🔥` `💨` `🚦` and the folder
  - [ ] hovering each control shows its card on the row, the toggles naming their next press
  - [ ] a click on the band, then `c` copies the asks, `b` folds the board, `f` folds the asks
  - [ ] the board pane: cclio pinned and bold, aligned columns, `⏳ 0` dimmed, a 🔭 line under a waiting thread
  - [ ] breather's band shows during a long turn and leaves when it ends
- **desktop Code tab**
  - [ ] the same band, the on-state toggles as a light chip, never black
  - [ ] the key badges sit in the hover cards, none on the icons
  - [ ] a press on a board name (or cclio's `↗`) opens that session in the desktop
  - [ ] a ticket link opens linear; `FRM-306` stays on one line
- **Warp**
  - [ ] the band draws and its hover cards show (Warp reported the pointer on 10-05)
  - [ ] the board pane opens from `🚦`, or name what Warp draws instead
- **a `--remote-control` view (phone or web)**
  - [ ] nothing a mod draws shows — expected ([claude-code#99217](https://github.com/anthropics/claude-code/issues/99217)); note if that changed
  - [ ] a prompt typed there clears the host session's asks (`bridge` origin)
- **redact, any surface**
  - [ ] `pnpm mods:probe-redact` exits 0 on this mac

## borrow read — the 6 candidates (FRM-319, 2026-10-05; for cclio to fold into the recipe's «last run»)

- `cctop` (tomstagl/cctop, `CLAUDE.md`) — skip: a Rust btop dashboard reading the registry, transcripts and cost; the board already reads the registry and `session.measure`, cost per session nobody asked for
- `agent-flow` (Charlie0113-T/claude-agent-flow, `hooks/register.ts`) — borrow: `command.run` on `clear`/`resume` as the one reset point for stash and redact (fleet ideas in `api-map.md`); its permission-prompt row mark is covered by the registry `status`
- `cc-pr-tracker` (sezaakgun/cc-pr-tracker, `hooks/register.tsx`) — maybe: one `gh api graphql` per pr on a 60 s clock for a board pr + ci column; its cost is the per-tick `gh` call
- `AFKSwitch` (augbastos/afkswitch, `README.md`) — borrow: a «while you were away» digest when `💨` turns off, «needs you first, then done»
- `claude-queue` (vasiliyk/claude-queue, `README.md`; JCSnap/claude-code-queue is a near twin) — skip: it polls claude.ai's internal usage endpoints, which its own README flags against the terms; keep-hot reads `rateLimits` already
- `pii-guard` (danyuchn/pii-guard, `examples/claude-code-hook/README.md`) — skip: a retired PreToolUse-on-Read hook whose own retro lists the holes redact closes (silent fail-open, Bash `cat`, subagents, MCP)

## log — date · session · mod · real use · note

- 2026-10-05 · cclio · holds · none yet · FTR: every holds line ✅ (verify recipe), none 🔎 (dima's use) — the collision guard is built but unproven in a real two-session clash
- 2026-10-05 · coder FRM-303 · holds · Bash veto shipped · `pnpm mods:writes 7`: 2378 Edit/Write vs 1374 Bash writes (37 %, the baseline holds); the veto reads 523 of the Bash writes (38 %) — the rest are mostly python `open(p, 'w')` through a variable, which no parser can read. the steer «hand edits go through Edit» (fleet-hazards) is what closes the rest
- 2026-10-05 · coder FRM-303 · asks · answered asks still listed · two causes. (a) dima's 15:3x screenshot of cclio's band was mid-turn (spinner on), and his 15:33:36 message asked about names and hover, so cclio's three asks were still open by its own ⏳ bucket — correct. (b) a real bug: in this coder's background session dima's answers arrive with `promptSource: sdk`, not `composer`, so the round-1 allow-list kept answered asks; the list is now `composer` + `sdk` + `bridge`. how: cclio's and this coder's transcripts by timestamp, and the stash store's `asks:` entries
- 2026-10-05 · coder FRM-303 · holds · blind-spot count · last 7 days of fleet file writes (2026-09-28 → 10-05): **2414 Edit/Write/NotebookEdit vs 1438 through Bash** — python `open(…,'w')`/`.write(` 774 · heredoc/`cat >`/`tee` 389 · `sed -i` 143 · `sd` 110 · `edit-anchored`/`edit-batch` 22 — so ~37 % of writes take no hold. counted: every `tool_use` in the 362 `~/.claude/projects/**/*.jsonl` touched in 8 days with a timestamp from 09-28, Bash commands classed by regex (`writes.jq`); rough both ways — `.write(` and `tee` also catch non-file writes, a redirect like `> file` without heredoc is missed
- 2026-10-05 · cclio · stash spawn hints · first real fire, a false positive · «a mechanical job belongs on chore-helper» on «Wayfinder research: one watcher» — a judgment job (source reading, a design call), not mechanical; dima saw the toast and asked «useful call?». count for the 10-19 verdict: 1 fire, 0 right
- 2026-10-05 · coder FRM-319 · all three · the recipe's open leads closed · the «not yet probed» block in `mods/AGENTS.md` probed (11 proven or types-backed, 2 corrected: no 50 ms `prompt.edit` budget, drawings reach mobile and vscode too; 3 need a live session); api-map regenerated from the types (its ranges had drifted ~190 lines), `ui.fault` and `ui.selection` added; state audit: redact keeps its vault in `$.state`, breather's module state may reset, stash's fold state and 5h reset should not (🐞 in its FTR)
