# gta iv, Steam 12210, D3D9, Rockstar launcher

last run 2026-11-05, steamac 1.9.12. raw: `~/.local/share/steamac/traces-keep/`, `~/.local/share/steamac/trace-1105-0204/`.

## what he wants

- «solve the freezes. i'm ok with 52 fps lowest if it doesn't lag, i don't even feel that 52 fps. but freezes are not good»
- «60 hz is not better, i want 120 at least (i usually use 120)», though the 60 Hz run «feels smoother»
- «i won't play without these, never»: Warp, Claude Desktop, Chrome
- the picture matters, he maxed everything himself

## where it stands

- steamac stays for gta iv; Highball lost its A/B: hard lag at first, black vertical lines and blur stay
- launch through `~/Desktop/steam-fx-safe.app`
- in game: 1920x1080, all max, sliders 100/100/100, x16. keep them: each change feeds new shaders
- the freeze cause, leading read, not closed: first-time Metal shader compiles, fading as the cache fills; of 2 long frames only one coincides with its compiles (the other is 5 s off), and a stall capture fits. new areas should freeze again: the open try below settles it
- 1.9.9 unpinned games from 5 of 8 vCPUs, likely the hitch drop (inference). in-app updates may relaunch without the caps (inference); `steamac-update.sh` may be redundant since 1.9.11
- Highball's gta iv copy, 24 GB, stays until he says otherwise, his tick: nothing uninstalled without his word
- left on: `metalHUD` saved ON in steamac (`Ctrl+Cmd+P`); Metal HUD and DXVK async on in Highball's bottle

## the numbers, old vm

- hitches per launch: 1.9.8 150–280. 1.9.12: 87 in 455 s, 95 in 98 s, 68 in 232 s, 113 in 472 s fullscreen, 86 in 478 s at 60 Hz, 161 in 2010 s maxed (avg 65.5, 1 % low 38.6)
- benchmark at max: 62.45 avg, CPU 36 %, GPU ~9 ms. driving maxed: usually 57–60, some areas 52–53
- judder, frames shown over 25 ms / made over 25 ms:
  - monitor 120, guest 60: 5 % / 1.7 %
  - monitor 60, guest 60: 0.3 % / 0.3 %
  - monitor 120, guest 120: 4.8 % / 3.4 %
- the soft picture was a render bug: the game sat at 1280x800
- the compile log, 02:44–02:48: «drove 4 min no freezes», 2 long frames: 475 ms at 02:44:59 beside compiles of 359+218 ms at the same second; 500 ms at 02:44:37, its nearest compiles of 401+265 ms 5 s earlier; 936 compiles, 6 over 50 ms; DXVK cache 0 bytes
- the stall capture, 02:14–02:21: 5 of 5 freezes ≥200 ms had all game threads quiet, `dxvk-cs` in `hrtimer_nanosleep`, `dxvk-queue` in a `drm_syncobj` wait
- ruled out as the cause: sliders, memory compression, guest disk or memory, GPU allocation warnings. FEX JIT 1–2 % while driving

## open tries, cheapest first

- 120 Hz judder: unsolved, only a 60 Hz monitor cleared it. `--refresh 120` in the guest gave nothing
- settle the cause on the old vm: drive a new area with `MESA_KK_DEBUG=compiles`, see whether freezes return with library compiles
- a cloud route, unchecked: Boosteroid lists gta iv, €7.49+
- Highball, when he wants it: mode DXVK on Wine 11 r29 is set. black lines: first «Wine's own Direct3D», then a Wine 10 engine with the DXVK 3.1 macOS fork, then mtld3d. check Video Mode first, a fresh bottle may be low-res
- FEX caches, low priority while shader compiles lead: Proton Experimental (ARM64) has a FEX disk cache; `FEX_DYNAMICL1CACHE=0 FEX_DISABLEL2CACHE=0`; `FEX_MULTIBLOCK=0`. all untested here

## tried and ruled out by research, no need to repeat

`TSOEnabled=0` (hardware TSO works in the guest), `X87ReducedPrecision` (already 1), `d3d9.numBackBuffers` (gone), `DXVK_FRAME_RATE` (gone, use `d3d9.maxFrameRate`), DXMT (no D3D9), more vCPUs (the guest is mostly idle).
