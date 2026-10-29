---
date: 2026-09-14
slug: the-monitor-day
tickets: [DOT-247, DOT-248, DOT-237, DOT-249, DOT-41, DOT-14, BYT-89]
posted: {health: no}
---
# 🗞️ cclio's gazette · the monitor day — a daemon counts the chords, raycast gets its pass, apple shortcuts gets a verdict

## shipped

- **the hotkey monitor** — [DOT-247](https://linear.app/x-com/issue/DOT-247) done in three coder jobs on one warm session: `x-hotkey-stats-monitor`, a swift session tap under launchd that logs modifier chords, bare `ctrl` (wispr push-to-talk) and every app switch and launch to jsonl, plus the reader `pnpm hotkey-monitor:top` / alias `hk` with app names, `--days`, `--app`, `--ignore` and a «bound but never pressed» join against the map scan (66 of 81 on day one). measured on the way: raycast swallows the hyper key at the hid layer and re-posts a synthetic chord, so the tap sits on the session, never hid; `opt+esc` read-aloud dominates every ranking. `cmdlog` deleted, one tracker instead of two. name aligned on every layer after dima's ask — dir, binary, launchd label, codesign id, data dir — and root `CLAUDE.md` now carries the rule: one name on every layer, `grep` of the old name empty is the done criterion.
- **raycast, phases 1–3 of the plan** — [DOT-237](https://linear.app/x-com/issue/DOT-237) In Progress with an eight-phase e2e plan in its body: raycast adopted under brew (`--adopt`, settings untouched), the dead-weight inventory (zero AI-visible leftovers on disk, settings are SQLCipher-encrypted so every toggle is confirmed by eye), the walkthrough through general, launcher, keyboard, cloud sync, advanced, AI, apple shortcuts. decisions: fallbacks trimmed to seven, secure input on, cloud sync data deleted then off, weekly encrypted export into `import/raycast/backups/` with the three script commands moved to `import/raycast/script-commands/`, window management kept for a magnet trial, AI killed, focus and dictation on eval. the «app comes to me» want is a per-app All Desktops setting, not a raycast option — raycast's space setting covers its own windows only.
- **birman stays** — [DOT-248](https://linear.app/x-com/issue/DOT-248) closed: the only universal alternative (dovhan's) gates ✓ and arrows behind opt+shift and last shipped in 2022. the un-removable U.S. input source has one door, a plist hack, parked with the brew move for a quiet moment.
- **apple shortcuts, verdict keep-minimal** — three agents: power users call it a real tool with a policy ceiling and yearly reliability bugs; it wins only where raycast has no body, the phone's action button and iOS triggers. agent authoring proven with cherri → `shortcuts sign` → one click, then cherri removed because the mac gets zero authoring. the iOS two-tap read-aloud is an accessibility switch (Speech Controller → Speak on Touch), not a shortcut; the action button never receives a selection.
- **plugins culled** — superwhisper's claude plugin (unmaintained since may, panel clips on a 1080p-scaled screen, data point posted on its [issue #16](https://github.com/superultrainc/superwhisper-claude-code/issues/16)), the english buddy (dima dictates now) with its hook and rule section, impeccable disabled globally (its Stop hook ran a 9-minute «design deep pass» because a probe `.ts` counts as UI; cclio enables it around design coders only). a biome format-on-edit hook replaced the noise: `PostToolUse` on `Edit|Write`, walks up to the repo's own biome, silent.
- **smaller**: bytes [#86](https://github.com/dvakatsiienko/bytes/pull/86) — `git rev-parse --verify` accepts any well-formed sha, so renovate's rebased branches died with exit 128 on the push run; `^{commit}` fixed it, #85 automerges. [DOT-249](https://linear.app/x-com/issue/DOT-249) born and folded the same day into [DOT-41](https://linear.app/x-com/issue/DOT-41)'s inventory (verdict absorb) and [DOT-14](https://linear.app/x-com/issue/DOT-14)'s candidate list. scroll restoration for trophy-sys is a line in [BYT-89](https://linear.app/x-com/issue/BYT-89). the ⏳ fence rule reverted: header outside, only the asks inside, because cw rendered the in-fence header as something to delete after every paste. `mo touchid enable` gives sudo touch id (macos writes `sudo_local` itself; mole only writes the line).

## tricks gained

- a `&` inside a Bash tool call is safe only when something after it keeps the shell alive — the wrapper exits and the child dies with exit 0 and an empty log (twice in one day)
- renaming a `.gitignore` path un-ignores whatever the old path still holds; `git add -A` staged a compiled binary
- a grep done-criterion is run once before it goes into a brief — «grep old-name empty» can never be empty when the new name contains the old
- macos TCC keys an ad-hoc binary by code identity: a rename or rebuild needs a fresh Input Monitoring grant and a daemon restart; a tap opened before the grant stays refused
- raycast 2.4's «window activation behavior» applies to raycast's own windows only; Dock → Options → All Desktops is the per-app answer
- an app-authored commit via `gh api` is authored as dima, so the owner-approval lane cannot green it — cclio's pr commits go through the app identity next time
- a desktop code block shows its copy button only at 4+ lines (four samples)
- a plugin's hooks stay loaded in running sessions after uninstall; only new sessions are clean

## state

- dotfiles: 14 commits unpushed by dima's standing word, today's edits uncommitted at the halt (commit plan in the halt board); bytes clean; no coders, one merged worktree to prune
- dima's tools · next overhaul · 21/25 — DOT-237 next, its walkthrough resumes at «Applications»
- reminders: birman → brew cask + U.S. plist hack at a quiet moment (dima, approved); impeccable disable watched at every design lane's end

## trail

- shipped: `x-hotkey-stats-monitor` daemon + `hk` reader (DOT-247 done), raycast phases 1–3 (adopted under brew, ai killed, cloud sync off), birman stays (DOT-248 closed), apple shortcuts verdict keep-minimal, superwhisper + english-buddy plugins culled, impeccable disabled globally, biome format-on-edit hook
- open: DOT-237 walkthrough resumes at «Applications»
- state: dotfiles 14 unpushed; bytes clean; no coders
