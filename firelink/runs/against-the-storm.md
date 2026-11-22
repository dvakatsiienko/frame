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

## open: 4K sharp + 60 fps + fast cmd+tab, 2026-11-21 (play thread ✦ 4)

### what he wants, his order

1. 60+ fps
2. sharp 4K picture, text included
3. High graphics (he compared Medium and High closely and wants High)
4. fast cmd+tab, no Option+Return dance

his report: earlier on Highball he had «4k sharp, max graphics and 90–120 fps», on Scarlet Orchard too, at the cost of Exclusive Full Screen; leaving it took Option+Return, and coming back left the text soft until he set Full Screen Window → Exclusive again by hand

### changes made today, all in the `Games` bottle

- `user.reg` `[Software\\Wine\\Mac Driver]`: `RetinaMode=y` (sharp text, the game sees real 4K pixels), `WindowsFloatWhenInactive=none`; set with Highball quit, or through `wine reg add` with `WINEMSYNC=1` while its Steam runs
- backups beside the bottle: `user.reg.bak-retina-20261121`, `-retina-20261121-postquit`, `-float-20261121`, `-retinaoff-20261121`
- cmd+tab fixed: game windowed + macOS native full screen (its own Space)

### what he measured, 4K, Scarlet Orchard, fresh settlement

- windowed + native full screen, RetinaMode on: High 40–45, Medium ~70, Low 80–90
- 1440p High: ~70 fps, visibly softer, rejected
- Exclusive Full Screen, RetinaMode on: ~40–45, crisp, Option+Return round trip stays crisp now
- Exclusive Full Screen, RetinaMode off: ~45, crisp, ui huge, fast tabbing gone; RetinaMode put back to `y` right after
- settlement size ruled out: he had just started the map
- the mac on AC power, `powermode 0`
- the game's prefs (`ClientPrefs` in `user.reg`, read 21 Nov): 3840x2160 at 120, `screenMode` 1, `vSync` 0, `maxFPS` 120

### what is known

- 📌 the 11-10 Highball 120 fps above was measured at **1920x1080**, maxed, GPU avg 57–75 %: a quarter of 4K's pixels. the 4K 90–120 he remembers has no measurement in this file (inference: it was the 1080p setup, which RetinaMode-off scales up to the panel)
- every window and Retina combination gives the same ~45 at 4K High: the frame rate follows render resolution, not the window mode (inference from his A/Bs, GPU % not sampled today)
- frame gen in Highball = Lossless Scaling lsfg-vk, needs his Lossless Scaling purchase, untested

### leads, untested

- sample mac GPU % (`ioreg` Device Utilization) at 4K High: ≥95 % confirms GPU-bound, which closes the window-mode question
- `WindowsFloatWhenInactive=none` is the one change not A/B'd; backup `user.reg.bak-float-20261121`
- 4K with the game's own upscaler, if ATS has one (FSR or a render scale slider): not checked
- per-setting cost at 4K: shadows, fog, complex effects off one at a time on High
- Lossless Scaling frame gen to 60+ from 40–45 base, his call on the purchase
- 21 Nov, his test: shadows off at 4K High doesn't change fps
- 21 Nov, his trace of the old 120 fps mode: game at 1920x1080, Exclusive Full Screen; Option+Return out, Option+Return back → soft text; set Full Screen Window, then Exclusive again → sharp and 120. lead (inference): the dance makes Wine switch the panel to a real 1080p mode, which the monitor scales up by exactly 2x (sharp), and that mode switch is what blocks cmd+tab. check: read `system_profiler SPDisplaysDataType` while in that state (normal is 3840x2160, «looks like» 1920x1080 @ 120). if it holds, a `betterdisplaycli` (installed) mode toggle plus windowed 1080p could give 120 + sharp + cmd+tab
- 21 Nov correction, his word: the old 120 fps mode had the game's resolution set to 4K, not 1920x1080 (the 11-10 1080p measurement was his first probe only)
- 21 Nov 22:42, his old mode rebuilt (RetinaMode off, game 4K, Exclusive Full Screen, the dance): 40 fps; the panel read «looks like 3840 x 2160 @ 120» (the exclusive mode drops HiDPI and drives native 4K at 1x); mac GPU at 100 % over 5 s: GPU-bound
- the math: 11-10 at 1080p maxed the GPU took 5.75 ms a frame; 4K is 4x the pixels, ~23 ms, ~43 fps, which matches the 40 measured. so 4K High on this M4 Pro tops out near 40 in ATS, and the remembered 4K 120 rendered about 1080p's pixels whatever the menu said (inference, strong)
- `bottle.json` holds `"frameGen": 1`; meaning of the value not checked
- verdict: no window or Retina setting gets 60+ at 4K High; the doors left are fewer pixels (4K Medium ~70, 1440p ~70 soft) or frame gen
- 21 Nov 22:46: RetinaMode back to y on his ask; he plays crisp ~45 with fast cmd+tab

### status, 21 Nov 22:47 — pick up here

- 📌 his position: Highball was fast from the very first launch (up to 120, less GPU than steamac), with the game set to 4K; «something changed and it is not fast anymore». his report wins over my inference above; the open question is what changed
- my position: the logged 11-10 runs were all 1920x1080; 4K at 1x measured 40 fps at GPU 100 %, which the 1080p frame time predicts
- to settle it next time: check the game's own fps at 1920x1080 High now. ~120 means nothing changed and resolution explains it; well below 120 means something in the bottle or engine did change (then diff `bottle.json`, the engine version, `frameGen`, and Highball's version against 11-10)
- current setup he plays: RetinaMode=y, WindowsFloatWhenInactive=none, game 4K High windowed + macOS native full screen, ~40–45 fps, crisp, fast cmd+tab
- his want, unchanged: 60+ fps, sharp 4K, High, fast cmd+tab

### his report, 22 Nov 19:58 (his words, folded)

- «right from the first launch it was working very fast, about 120 fps», but in a strange window mode: Exclusive Full Screen, beside a windowed and a borderless mode
- in that mode cmd+tab did nothing; to look up a wiki or ask cc mid-game he had to Option+Return out, look, Option+Return back; after coming back the ui went blurry, and crisp 4K came back only by switching Exclusive to another window mode and back: many clicks each time he tabs out
- crisp 4K only in Exclusive Full Screen; any other window mode looked blurry, «like 180p»
- yesterday's cc fix made cmd+tab work, and after it the fps dropped to 40
- his want, unchanged: at least 60 fps, ideally 120; a crisp, high-resolution picture; a quick cmd+tab out of the game
- 22 Nov 20:04, his ask «bring my old mode back, then trace»: Highball quit, today's `user.reg` kept as `user.reg.bak-before-restore-20261122`, the pre-fix `user.reg.bak-retina-20261121` restored (no RetinaMode, no WindowsFloatWhenInactive); his note: GPU load in Highball was much lower than on steamac from the first launch, so the GPU was not the bottleneck then
- 22 Nov 20:05–20:09, the old mode rebuilt (pre-fix registry, game 3840x2160, Exclusive Full Screen `screenMode` 0, High): his read: the menu 120, in the settlement 40 → 60–90 → 30–40, settled ~40; mac GPU (`ioreg` Device Utilization, every 5 s): menu and load 24–80 %, in play 90–100 % from 20:06:21 to 20:07:36, then 15–17 % after he left. verdict: GPU-bound at 4K High in the old mode too; yesterday's change did not add the bottleneck. the menu's 120 is a light scene, not play
- 22 Nov 20:11, frame generation read: Highball's is Lossless Scaling's (it asks for `lsfg-vk.dll` from a Lossless Scaling install, the paid Steam app) — not free; its free DLSS → MetalFX bridge needs a game with DLSS, and the game folder holds no nvngx or dlss file (inference: ATS has none). the free doors left: lighter settings at 4K (4K Medium ~70 measured 21 Nov), one heavy setting at a time
- 22 Nov 20:15, DLSS verified absent: the game's code (`Assembly-CSharp.dll` strings) names no dlss, fsr or upscaler, so Highball's free DLSS → MetalFX bridge has nothing to hook; fast cmd+tab settings restored (RetinaMode y, float none; the old-mode registry kept as `user.reg.bak-oldmode-20261122`). next: High kept, one heavy setting off per launch, fps read each time
- 22 Nov 20:17, Lossless Scaling on Highball, read: Highball pr #87 and #109 wire frame gen from a local Lossless Scaling `lsfg-vk.dll` (lsfg-metal, MoltenVK shim under Rosetta); reported Valheim on DXMT, M2: 25–27 → 48–55 fps presented at 2x; CURE II 30 → 60 at 2x; unofficial, beta, x86 through Rosetta; codeweavers lists Lossless Scaling itself «Installs, Will Not Run» on mac, which does not matter here: only its dll is used
- 22 Nov 20:24, frame gen not reachable yet: Lossless Scaling bought and installed on its lsfg-vk branch (`lsfg-vk.dll` in the Games bottle's Steam); Highball 0.10.26 shows no frame-gen switch in Environment settings (Graphics, Display, Advanced read from his shots) and logs `frameGen=off`; its source: pr #109 (lsfg-metal) merged 18 Sep, the maintainer wrote the component «still needs pinning in an engine revision», and the launcher refuses frame gen while «the component, the shader package or the real driver are missing». inference: our engine revision lacks it; a Highball or engine update brings the switch (releases watched)
- 22 Nov 20:30, his test at 4K High: Motion Blur off, Complex Effects off, shadows: no fps change; only the preset and the resolution move it, and he keeps both. verdict: the free settings path is spent; 60+ at 4K High waits on Highball's frame gen (pr #109, a free MIT build, not yet in his 0.10.26; releases watched)
