# macos admin — app installs and removals

read when adopting, installing or removing a mac app; `rules/fleet-tooling.md` (app removal) points here.

## brew casks

- `brew install --cask --adopt` is the way to bring a hand-installed app under brew, and it has
  two teeth. it **refuses a bundle missing a binary the cask links, and removes the app** before a
  plain install follows (2026-09-08). and it needs a **tty** whenever the bundle is root-owned —
  an agent shell has none, so it dies at the password prompt (keka, 2026-09-13: it bailed before
  touching anything, but the next one may not). check `ls -ld /Applications/<App>.app` first;
  `root wheel` means hand dima the command instead of running it
- a brew-installed app is uninstalled with `brew uninstall --zap --cask <name>`, never with an
  uninstaller app — the cask's hand-written zap stanza beats any heuristic scanner, and it clears
  the Caskroom entry an external uninstaller would orphan (measured on pearcleaner, 2026-09-13:
  zap found `Group Containers`, `Saved Application State` and a `bin/` symlink that mole missed)
- `--adopt` checks the bundle's short version against the cask and refuses a mismatch (nuphyio
  2.2.6 vs 2.2.7), yet wrote a `5.0` receipt over a licensed cleanshot 4.8.10 — read the cask
  version before adopting anything with a licence wall, and never `brew uninstall` an adopted app
  (it deletes the bundle; `rm -rf /opt/homebrew/Caskroom/<cask>` drops the receipt only). `pkg`
  casks cannot adopt at all. cask↔app identity is `codesign -dv` team vs the cask homepage vendor;
  casks carry no bundle id, `brew search` is a guess and `brew info --cask` the check (`sherlock`
  resolves to an iOS debugger, 2026-09-16)
- a gui uninstall that moves the bundle to the Trash leaves its login items alive — appcleaner's
  `SmartDelete` helper ran out of `~/.Trash` for two days and popped on every later deletion
  (2026-09-15). after any app removal: `sfltool dumpbtm | grep -i <name>` and empty the Trash

## claude desktop

- **Claude Desktop writes its in-memory config back to `claude_desktop_config.json` on quit** — an edit made while the app runs silently reverts; edit only with the app closed (two restarts lost, 2026-09-23)
