---
date: 2026-09-13
slug: the-zoo-cull-day
tickets: [DOT-237, DOT-247, BYT-83, BYT-85, BYT-25]
posted: {health: yes}
---
# 🗞️ cclio's gazette · the zoo cull day — one page for every hotkey, six cleaners become one, and two verdicts get reversed

## shipped

- **the hotkey map** — [DOT-237](https://linear.app/x-com/issue/DOT-237) prep done, and the ticket now carries it as a «prep» section above dima's own notes. `pnpm hotkeys:scan` reads wispr flow's `config.json`, magnet's and bartender's plists, cursor's `keybindings.json` and `symbolichotkeys` into one json (81 bindings, modifier order canonical); raycast and cleanshot are sealed, so their rows are typed by hand in `script/lib/hotkeys-manual.ts` from dima's screenshots. the page is an air75 drawn in css grid with a tab per modifier layer, free keys listed per layer, and a note per chord kept in the artifact db — [hotkey map](https://claude.ai/code/artifact/3779fd12-ca37-403d-8083-e0d9c1f130e2), source at `docs/hotkeys/map.html`. seed-only by construction: it has no door into any app.
- **the opt+2 clash, closed** — wispr flow's prompt-engineer transform sat on raycast's ukrainian-layout key and the card's ✕ would not unbind it; the answer is the transforms «opt in» toggle, which drops the whole transform shortcut layer. dima opted out, and the next scan confirmed the binding gone.
- **the cleaner zoo, six to one** — mole is the pick ([repo](https://github.com/tw93/mole), 67k stars, released the same day), free cli via brew plus the $19 native gui dima bought and likes. appcleaner (last release 2023-07-04) removed by the gui; pearcleaner removed after its maintainer's own README turned out to say he lost *a mac to build on*, not the source — dima's recollection was close and wrong on the detail. keka survives a reversed verdict, see below. the brewfile now carries `mole`, `mole-app` and `keka`, and `notion-cli` moved from a formula line to the cask it always was, which is why `brew bundle check` had been failing.
- **two reversals, both on evidence** — keka was recommended for deletion and stays: its bundle ships `keka7zz`, `kekaunar` and `kekaunrar`, so it *is* the archive clis, not a duplicate of them; root `CLAUDE.md` gained one tooling line so the fleet stops re-suggesting `unar`. and `SiriAUSP`, flagged as apple intelligence and 564 MB of it, is `com.apple.texttospeech.SiriAUSP` — dima's read-aloud engine, the siri nora voice on option+escape. turning apple intelligence off frees ~50 MB, not the 2 GB claimed, and read-aloud is untouched by it. a reminder carries that for the next macos release.
- **the halt sweeps lingering tickets** — cclio 0.3.41: phase 0 queries In Progress and In Review in one call and prints «closable, because» or «stays, because» per hit. [BYT-83](https://linear.app/x-com/issue/BYT-83) had sat In Review two days past its merge and closed with a closing word; [BYT-85](https://linear.app/x-com/issue/BYT-85) went back to Todo because its real want is unbuilt; [BYT-25](https://linear.app/x-com/issue/BYT-25) likewise. dima's ask and his reason: no linear automation, because a merge is not a done while coders are still working the ticket.
- **smaller**: [DOT-247](https://linear.app/x-com/issue/DOT-247) — a chord-only `CGEvent` tap daemon plus a `top` reader, created after research found nothing that counts chords per app; it carries dima's «combine, not scatter» note and points at `cmdstats`, the shell-command counter a coder left in `cmdlog.zsh`. `CLAUDE_CODE_SUBAGENT_MODEL=opus` in settings, because a fork always runs the parent model and two fable forks spent ~365k tokens on web reading. two linear quicklinks imported into raycast by deeplink, one jumping to an issue id and one searching both teams.

## tricks gained

- raycast's and cleanshot's stores are encrypted; wispr flow, magnet, bartender, cursor and `symbolichotkeys` all read straight from disk, and any running app's menu shortcuts come out of the accessibility api
- macos exposes no api to enumerate the global hotkeys other apps registered — a leftover chord is resolved by pressing it, not by querying
- raycast has no unattended config write path: the `ray` cli is extension-dev only, and the real door is `raycast://…/import-quicklinks?context=<urlencoded json>`, which prefills everything and still needs one human Enter. aliases and hotkeys have no programmatic path at all
- a brew cask is best removed by `brew uninstall --zap --cask` — mole agrees so strongly that it detects the cask and hands it back to brew; the zap stanza found `Group Containers`, `Saved Application State` and a `bin/` symlink that mole's scan missed
- keka's bundled binaries are reachable as `Keka --cli <bin>`; macos ships no `unrar` and no 7z at all
- macos «inactive» memory is cache that is handed over on demand — 15.6 GB of it read as 81% used while swap sat at 61 MB
- `sudo lsof` on an unexplained vm named it in one line: `~/Library/Application Support/Claude/vm_bundles/`, holding open handles on the dotfiles tree
- `brew install --cask --adopt` needs a tty when the bundle is root-owned, and an agent shell has none

## state

- dotfiles `4f858e5`, 6 commits unpushed by dima's standing «not urgent»; bytes untouched today; no coders, no worktrees
- dima's tools · next overhaul · 19/25 — DOT-247 joined it, DOT-237 keeps its place in the order
- two handoffs pending on purpose: halt16 parks the github ci and pull request plan, today's parks the hotkeys and cleaners thread. a pickup names its slug, never bare
- next: the rebind session on DOT-237 needs the natural-key research first; [DOT-248](https://linear.app/x-com/issue/DOT-248) (kb layout alternatives) arrived from dima and is unread

## trail

- shipped: the hotkey map (`pnpm hotkeys:scan` + the artifact page), opt+2 clash closed, cleaner zoo six → one (mole), keka + SiriAUSP reversals on evidence, halt sweeps lingering tickets (cclio 0.3.41), DOT-247 born, `CLAUDE_CODE_SUBAGENT_MODEL=opus`
- open: DOT-237 rebind session needs natural-key research; DOT-248 unread
- state: dotfiles 6 unpushed; two handoffs pending on purpose (halt16, hotkeys)
