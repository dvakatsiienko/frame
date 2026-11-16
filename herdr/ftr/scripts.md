# herdr — scripts

wish: PK-363 · legend and the other areas: [FTR.md](../FTR.md)

- ✅ `pnpm herdr-mods:land <mod>` lands a mod from frame into herdr
  - makes: the mod's changed files in `~/.config/herdr-app/mods/<mod>`, a real folder
  - given a mod in `home/.config/herdr-app/mods/<mod>`
  - when the command runs
  - then herdr reloads that mod live, with no restart (proven on fleet-board, 16:20:39)
  - decision: a real folder, not a link: herdr reloads a real folder on save and never a link
- ✅ `pnpm herdr-mods:land --watch` lands every save in frame
  - given the watcher runs (it prints its pid; stop it by that pid)
  - when a mod file in frame is saved and `herdr-app check` passes on it
  - then its changed files land in one write once the check passes (~7 s: `herdr-app check` runs through the window), and herdr reloads it live
  - and a save the file watch misses still lands: a sweep by mtime each second catches it
  - and when the check fails, nothing lands and the watcher prints why (live: a half-built fleet-board save held, 16:30:09)
- ✅ `pnpm herdr-mods:typecheck` type-checks every herdr mod that turns strict null checks on
  - given a mod whose `jsconfig.json` sets `strictNullChecks` to true (today: `x-herdr-chat`)
  - when the command runs, alone or inside `pnpm typecheck` (the commit gate and ci run that)
  - then every `.js` file of the mod is checked against herdr's own type files, and one line says how many mods and files were clean; a type error exits 1 and names its file (proven: a planted error refused a commit's dry run, 2026-11-16)
  - and where herdr is not installed (ci), only the files that import their siblings alone are checked, and the line says how many were left out; a run that checked no file is red

