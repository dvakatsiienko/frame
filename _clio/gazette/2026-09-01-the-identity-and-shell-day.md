---
date: 2026-09-01
slug: the-identity-and-shell-day
tickets: [DOT-34, DOT-35, DOT-31, DOT-226, DOT-119, DOT-82, DOT-56, DOT-160, DOT-222, DOT-36]
posted: { health: yes }
---

# 🗞️ cclio's gazette · the identity and shell day — cclio gets a face, omz dies, starship reborn

## shipped

- **cclio is a real linear user now** — oauth app actor, $0, no seat: comments and mutations
  attribute to «cclio», dima's key stays his. minted through `pnpm linear-agent-token`
  (keychain-backed, self-refreshing 30d token). delegation trialing live ([DOT-226](https://linear.app/x-com/issue/DOT-226)
  closed by its own delegate) · `createAsUser` stamps demoed · «coder» app approved for tomorrow.
  research: `cclio/docs/research/linear-users.md`.
- **oh-my-zsh deleted after years of being a ghost** ([DOT-34](https://linear.app/x-com/issue/DOT-34),
  [DOT-35](https://linear.app/x-com/issue/DOT-35)) — `plugins=()` all along; replaced by own
  compinit + direct sourcing, 15M freed, `zsh-custom/` rename, .zshenv bugs fixed (TERM force,
  dead tilde PATHs), `take`/`extract` adopted. research: `docs/research/zsh-stack-2026.md`.
- **starship visible in warp again after years** — the unflipped `honor_ps1` setting was the
  whole mystery; prompt redesigned live with dima ([DOT-31](https://linear.app/x-com/issue/DOT-31)):
  ⚡️ badge → dir → node+package pill → git with octicon → dark tail holding +/− diff counts
  that hides when clean. `command_timeout` 2000→500.
- **brew pruned and fed** ([DOT-226](https://linear.app/x-com/issue/DOT-226)) — out: crush,
  graphite, gitingest (killed the pydantic wart at the root), tree, hyperfine; in: gron, yq, sd
  under a 2026-09-15 transcript-grep vet · bundle satisfied, doctor clean.
- **slk lands the fleet slack lane** — cli over connector confirmed (binary `slk`, desktop-session
  auth); g2i workspace reachable. warp agents fully disabled — dima's terminal is a terminal again.
- [DOT-119](https://linear.app/x-com/issue/DOT-119) verified-closed · [DOT-82](https://linear.app/x-com/issue/DOT-82)
  standing retired · dupes folded (56→222, 160→34) · sline peek+close is roadmap step 5.

## tricks gained

- agent Write/Edit AND heredocs strip PUA nerd-font glyphs silently — byte-level python/perl
  escapes are the only safe channel for icon work, and every glyph patch needs a hexdump verify ·
  a python `str.replace` that matched nothing reports nothing — count replacements (`re.subn`) ·
  linear client-credentials needs explicit `scope=` (default bounces invalid_scope).

## state

- 9 commits unpushed at write time · next overhaul milestone: 15 open, 7 retired today ·
  tomorrow: spawn-mechanics run #2 first, «coder» app, then aliases + git + vibe — dima's tools
  resolves fully.
