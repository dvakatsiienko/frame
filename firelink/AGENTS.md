# AGENTS.md: firelink

the home of game side chores: what vm tuning, traces and route tests found. every door into the games (trophy-sys, game pages, the steamac vm) is the `x:firelink` skill, `home/.claude/plugin-x/skills/firelink/`.

📌 the steamac vm starts only through the skill's `scripts/steamac-play.sh`, `x:firelink` § 3 holds the rule.

📌 the 11-06 freeze: the vm woke at 15:22:26 with Highball's Steam and lanes running; threads wedged in one kernel wait from 15:22:37, the watchdog killed WindowServer at 15:25:38, and force-quitting the vm and Highball did not clear it. the wake as trigger is an inference from one sample: a 13:32 wake left no watchdog report. the gpu cap held (compile threads kept: inference), and the caps don't cover the 28 GB the vm held asleep, a likely contributor, not shown as the cause. on a stall, Help → Report a Problem in the same session, for #50's maintainer.

## what goes where

- a door any session runs, or how to do something → the skill
- what a chore found → here: a game's run in `runs/<game>.md`, what holds across games in this file
- raw logs → `~/.local/share/steamac/`, outside git; a run file points at them
- a research run → its lines worth keeping land here; its files go to `trash` on dima's word, `docs/research/` stays
- notes about playing a game (quests, builds, what next) → the homes in the skill's § 4

## the rig, 2026-11-05

M4 Pro, 14C CPU, 20C GPU, 48 GB, macOS 27.2; AW3225QF, 3840x2160 at 120 Hz. Warp, Claude Desktop and Chrome stay open while he plays, so every test runs with them open.

## routes for windows games on this mac, read 2026-11-05

dated claims, re-check before acting on one.

- run a pair, no single winner (three research lanes). measured: steamac gta iv, Highball Against the Storm (`runs/`); Highball for Satisfactory, reported
- compare routes by 1 % low and the share of frames over 25 ms, at 60 and 120 Hz, never by average
- no route: a native build (Steam reports `mac: false` for all nine games checked), Whisky (archived), Asahi on M4 Pro (no installer, no GPU), GeForce NOW for gta iv (not on its public list)
- D3DMetal and DXMT stop at D3D10–12, so a D3D9 game like gta iv takes DXVK, WineD3D or mtld3d
- left to try for gta iv: [mtld3d](https://github.com/athei/mtld3d) (D3D9 on Metal, background shader builds, logs only from an M5 Max), Parallels with FusionFix (self-reported 80 FPS on M4 Pro, stutter reported through the Steam and Rockstar launchers)
- FusionFix: reports split on stutter, no FEX report, so test it on one route at a time
- watch: x87sidecar, decided for Highball per game; its gain on gta iv is unknown
- Satisfactory: 70–80 FPS reported on M4 Pro through CrossOver (lower resolution, older game) against 20 on steamac; 1.2 defaults to DX12 and crashes on D3DMetal 3, so `-d3d11`
- risk: steamac and Highball are one-author projects; Rosetta narrows after macOS 27, which hits Highball's and CrossOver's x86 engines, not steamac's FEX

## Highball, v0.10.23 by brew

- a Wine 10 engine hung at Rockstar's «Preparing to Install…»; Wine 11 x64-crossover26.3-r29 works
- the Rockstar sign-in window hides behind Highball: raise the wine process through System Events
- computer use hides wine windows: query them through System Events
- its search needs the full title, `gta` finds nothing
