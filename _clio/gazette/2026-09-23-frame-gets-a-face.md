---
date: 2026-09-23
slug: frame-gets-a-face
tickets: [FRM-26, FRM-255, FRM-257, FRM-258, FRM-259]
posted: {health: yes}
---
# 🗞️ cclio's gazette · frame gets a face

**shipped**
- the rename held: `~/dotfiles` is `~/frame` on every layer, verified line by line against the migrator's list; the linear team key is FRM, old DOT ids still resolve
- frame's readme is a real front page — purpose line, pixel banner, the 80s mac beside the toc, a frame:link clip, an animated sline showcase, a chords shot, emoji sections, and its own pixel badges drawn by `pnpm badges:sync`; ci draws its badge live onto a `badges` branch and turns it red on failure — [FRM-26](https://linear.app/x-com/issue/FRM-26)
- notifications tamed on github and linear, repo settings are one command (`pnpm repo:defaults`, squash + rebase only), bytes lost 13 dead deploy environments — [FRM-259](https://linear.app/x-com/issue/FRM-259) done
- the fleet has faces: cclio the owl, coder the bulldog astronaut, reviewer the basset detective, all in `frame/brand/avatars/`; cclio signs 🦉 now
- chords: pageup and pagedown finally light up on the board, one live stream per tab — [FRM-255](https://linear.app/x-com/issue/FRM-255)
- the leaked `.rayconfig` commits are gone from github for good; `root claude.md` + fleet-identity reshaped, jev joins the members as classifier, the vault's `prompts/` became `_hq/`

**tricks gained**
- vhs 0.12 exits 0 and writes no gif (#787): record frames, build the gif with ffmpeg
- the commit hook linted a different file set than ci — three reds from generated svg until svg joined the glob
- a vault `AGENTS.md` never loads: nested memory stops at the session's working tree, `--add-dir ~` included
- a pixel sprite reads its species in the silhouette — pointed head corners say «cat» at 16 px

**state**
- FRM-26 open for its children: [FRM-258](https://linear.app/x-com/issue/FRM-258) profile page, [FRM-257](https://linear.app/x-com/issue/FRM-257) visit cards + bytes' readme + the trophy-sys vercel git link
- flawlog flush waits on two yeses: the boot-board flawlog gate, the ci-watch hazard line
- bytes 5 local commits held by dima's word

## trail
- shipped: frame readme with pixel art, live badges and clips (FRM-26) · notifications + repo:defaults + env prune (FRM-259 done) · fleet avatars owl/bulldog/basset · chords page keys + one stream (FRM-255) · rayconfig purge confirmed · prompts → _hq
- open: FRM-258 profile · FRM-257 visit cards + bytes readme + trophy-sys git link · 2 flawlog rule yeses · migration backup trash 09-24 · jev review 09-26
- state: frame pushed, bytes 5 ahead held, no coders, cclio 0.3.62 · x 0.11.100 · x-cw 0.2.33
