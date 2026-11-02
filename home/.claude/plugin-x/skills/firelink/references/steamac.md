# steamac — the vm in depth

read from `firelink/SKILL.md` § 2 before any vm work: what the vm holds, what clio can do in it, the tweak ladder for a game that will not run, and the rockstar launcher.

## the vm, as probed 2026-11-02

- SteamOS 0.4.5, aarch64, 8 cores, 11 GB ram; `/home` ~127 GB and runs near full: `df -h ~` before a download
- proton: `Proton 11.0 (ARM64)` is the default (on Steam Linux Runtime 4 arm64), `Proton 10.0` is the x86 one through FEX; no per-game override is set yet (`config/config.vdf` → `CompatToolMapping` empty)
- tools in the vm: `mangohud`, `vulkaninfo`, `gamescope`, `flatpak`, `steamos-session-select`; no `protontricks`, `winetricks` or `xdotool`
- paths: library `~/.local/share/Steam/steamapps/common/`, manifests `appmanifest_<appid>.acf` (`grep -l <name>` finds an appid), one proton prefix per game `steamapps/compatdata/<appid>/pfx` — nothing is shared between games, a launcher or a sign-in included; launch options `userdata/<id>/config/localconfig.vdf`; steam's own logs `~/.local/share/Steam/logs/` (`compat_log.txt` names the proton each launch used)
- steamac's own layer: `~/.config/steamac/title-defaults.json` holds the launch options it pre-sets per title (dx12 games get `VKD3D_FEATURE_LEVEL=12_1 VKD3D_SHADER_MODEL=6_6`), `game-profiles.json` the per-game profiles, `config/steamac-shader-defaults` and `steamac-idle-screensaver` its toggles
- the session is gamescope gaming mode: a window steam did not start stays invisible (`xprop -display :0 -root GAMESCOPE_FOCUSABLE_APPS` lists what shows); desktop mode is Steam → Power → Switch to Desktop, which restarts the session and pauses downloads

## what i can do from here (Bash through `steamac-ssh.sh`)

- read: the installed games and their sizes, a game's prefix and config, steam's and proton's logs, which proton ran, `game-stats.json`, mac swap
- end a hung process: name its pid and command to dima first; a pid matched by name is never ended unasked
- stop one game's wine world: `WINEPREFIX=<prefix> "<proton>/files/bin-arm64/wineserver" -k` ends everything in that prefix only
- run an exe under proton outside steam: `proton run <exe>` with `STEAM_COMPAT_DATA_PATH` and `STEAM_COMPAT_CLIENT_INSTALL_PATH` set, `DISPLAY=:0` — it runs, but stays hidden in gaming mode
- a command whose path has spaces goes in as a script on stdin: `steamac-ssh.sh 'bash -s' < script.sh`; inline quoting breaks
- dima's hands: anything clicked in the steam ui (a launch, a proton pick, a launch option typed in Properties), a sign-in, a code. a vdf edit by me only with steam exited, since steam rewrites its config on exit (inference)

## a game that won't run or runs badly — the ladder, cheapest first

1. measure: `game-stats.json` for the session; `MANGOHUD=1 %command%` for a live overlay; `PROTON_LOG=1 %command%` writes `~/steam-<appid>.log` in the vm
2. stuck on «Running install script» (a vcredist under proton): the installer waits on an invisible dialog — `ps` shows `vcredist_x86.exe` / `msiexec` at 0 cpu over a minute; ending those two pids lets steam move on, and proton ships the runtimes anyway (bully, 11-02)
3. another proton: Properties → Compatibility → Proton 10.0 (x86 through FEX) vs 11.0 ARM64
4. a launch option (Properties → Launch options), general proton practice, untested here unless marked: `PROTON_USE_WINED3D=1` (dx9–11 through opengl instead of DXVK), `PROTON_NO_ESYNC=1` / `PROTON_NO_FSYNC=1` (hangs), `WINEDLLOVERRIDES="dinput8=n,b"` (asi mod loaders), the `VKD3D_*` set steamac pre-sets for dx12
5. a stutter: `scripts/swap-watch.sh` on the mac; the caps in `steamac-play.sh`
6. a broken prefix: a fresh one is `compatdata/<appid>` moved aside — ask first, saves may live inside it (`pfx/drive_c/users/steamuser/Documents`, `AppData`)
7. every try lands as one line in the game's home (§ 3) or the live pocket item, so the next session starts from it

results so far: against the storm, manor lords, system shock, noita, dwarf fortress fine; satisfactory p50 20; gta iv p50 60, avg 47, 1 % low 15, 65 hitches/min (11-01); bully reaches its menu (11-02)

## rockstar games in the vm

- a rockstar title starts the Rockstar Games Launcher in steam mode (`-steamAppId`): it signs in to the Rockstar account linked to his steam account on rockstar's server; no local reset changes that, and every game's fresh launcher lands on the same account
- the steam link is not on rockstargames.com's Connections page: it forms only in the launcher, and unlinks only through rockstar support, asked from the linked account
- «Verify your email» codes count against a quota: never press «Resend code» in a loop; «too many emails» locks the address for hours
- a code going to an address he can't reach: first try to register that address (a gmail typo may never have existed) — on 11-02 `imagnumm.satellite` was free, and owning it turned the dead account recoverable
- bully, max payne 1–2 and the old gta trilogy run without the launcher
- the live case (gta iv on a typo email, 2026-11): pocket PK-298
