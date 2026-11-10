# against the storm, Steam 1336490, Unity 2021.3 D3D11

first look 2026-11-10, steamac 1.9.13, Proton 11.0-100 ARM64. raw: `game-stats.json`, the prefix's `Player.log`.

## what he wants

- «smooth stable 60fps (or 120 if possible, my mon runs 120hz)»
- «as good graphics as possible to have steady fps»
- «no freezes, no stutters»

## baseline, as found

- in game: 1920x1080 at 60, Exclusive Full Screen, High, VSync Monitor Rate, `maxFPS` 60, motion blur, screen fog, complex effects and lightning on; depth of field and chromatic aberration on in `user.reg`, with no toggle in the menu
- `game-stats.json`: 11-08 avg 48.9, p50 59.3, 1 % low 26.4, 26.8 hitches/min (111 s); 11-01 avg 44.7, 1 % low 20.3, 25.6 hitches/min (328 s)
- the mac GPU at 87–98 % (`ioreg` Device Utilization) with the options popup open over a settlement, 11-10 02:15: GPU-bound
- 2 min sample while he played, 11-10 02:17: mac GPU avg 95 %, max 100; the game's main thread avg 35 % of a core, the job workers ~6 % each, `dxvk-cs` 8 %: GPU-bound, the CPU has room
- `Player.log`: «vsync is broken (it does not limit frame rate properly). Delta time will now be calculated using cpu-side time stampling»
- the vm started with its caps: gpu 10 GiB, `MESA_KK_COMPILE_THREADS=4`
- no launch options, no proton override, empty FEX config

## tries, one change per launch

- round 1, 11-10 02:31, three changes at once (his pick): motion blur off, VSync off with Max FPS 60 (the slider reaches 120), the mac display at 60 Hz; High kept. mac GPU over 2 min of play: avg 89 %, 5 of 120 s at ≥99 % (baseline avg 95 %); `game-stats.json`'s row covers the whole 68 min launch, mostly before the change, so it can't judge round 1: avg 48.4, 1 % low 25.9, 17.8 hitches/min, res 1816x1022, `screenMode` 0 after his menu pass
- round 2, 11-10 02:37, by codie with the game closed: depth of field and chromatic aberration off in `user.reg`; backup `user.reg.bak-20261110-codie` beside it, the undo is copying it back
- rounds 1+2, a clean 7 min launch at full screen, 11-10 02:48: avg 56.5, p50 60.2, 1 % low 29.3, 10.1 hitches/min, 1920x1080, Exclusive Full Screen (`screenMode` 0); against the baseline avg 48.9, low 26.4, 26.8 hitches/min. mac GPU over 5 min: avg 87 %, 5 of 300 s at ≥99 %
- round 3, 11-10 02:50, his pick: depth of field back on alone, by codie with the game closed; backup `user.reg.bak-20261110-codie-r2`
- round 3 result, 5 min: avg 56.8, p50 60.2, 1 % low 29.5, 10.4 hitches/min, the same as rounds 1+2; mac GPU avg 86.6 % in minutes 1–5. DoF stays on
- his freezes in round 3: one on placing a second woodcutters' camp, one on marking trees to cut, both first-time actions; leading read, untested: first-time shader compiles (the game's mesa cache holds 4.1 MB, the DXVK state cache is empty)

## Highball A/B, 11-10 03:05

- bottle `Games`, engine `x64-crossover26.3-r29`, renderer DXMT (D3D11 → Metal), frame gen off, Metal HUD on
- his first probe: 1920x1080, everything maxed with shadow distance, VSync off, cap 120, the mac at 120 Hz: «it runs in 120fps! and almost no lags»; mac GPU over the last 40 s avg 57 %, never ≥99 % (steamac: 87 % at High, capped 60)
- his 5 min play, maxed, cap 120: «it is not even comparable, much better»; Metal HUD at 03:11: 120 fps, GPU 5.75 ms a frame, presentation Direct, `DXMT D3D11 FL_11_1`; mac GPU over 268 s avg 75 %, 1 s at ≥99 %
- verdict: Highball is this game's route; steamac stays for gta iv
- in game on Highball: Full Screen Window, so cmd+tab leaves cleanly; Option+Return toggles full screen (his check)
- the Metal HUD has no live toggle: Highball sets `MTL_HUD_ENABLED` at the environment's launch from `bottle.json` → `metalHUD`. codie set it false 11-10 03:16, backup `bottle.json.bak-20261110-codie`; it applies on the next environment launch. Highball holds its settings in memory and showed the toggle still on: a `bottle.json` edit goes in with Highball quit, and the door for dima is Environment settings → Games → Graphics → Metal performance HUD

the prefs live in `pfx/user.reg` → `ClientPrefs_h3664234030` (hex json); the game rewrites them on exit.
