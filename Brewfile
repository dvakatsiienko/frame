# Everything this machine is built from. `brew bundle` is the source of truth —
# add a package here, not to a script.
#
#   brew bundle            # install everything missing
#   brew bundle check      # what's missing, without installing
#   brew bundle cleanup    # what's installed but not listed

tap "lutzifer/tap"
tap "oven-sh/bun"
tap "schpet/tap"
tap "teamookla/speedtest"

# ── Shell ───────────────────────────────────────────────────────────────────
brew "zsh"                       # the shell itself, newer than the system one
brew "zsh-autosuggestions"       # fish-style inline suggestions
brew "zsh-syntax-highlighting"   # fish-style command highlighting
brew "starship"                  # the prompt

# ── Moving around ───────────────────────────────────────────────────────────
brew "zoxide"                    # z — jump to any directory by frecency
brew "fzf"                       # fuzzy finder, wired into zoxide's interactive mode
brew "eza"                       # ls
brew "bat"                       # cat, with highlighting
brew "fd"                        # find
brew "ripgrep"                   # grep (replaced the_silver_searcher)
brew "tokei"                     # loc counter
brew "trash"                     # rm, but recoverable
brew "coreutils"                 # gnu twins as g-prefixed names, plus the handful that have no
                                 # bsd counterpart under their plain name — `timeout` among them,
                                 # and macos ships none of its own. sed/date/ls/realpath/stat all
                                 # still resolve to the bsd originals, so nothing is shadowed and
                                 # the gnubin shim stays off PATH. `timeout` and `gtimeout` are
                                 # the same binary; either name works.

# ── Git and review ──────────────────────────────────────────────────────────
brew "git"
brew "gh"                        # GitHub CLI
brew "git-filter-repo"           # history rewriting, for the rare surgery
brew "git-lfs"                   # the lfs filter is wired in .gitconfig with required=true,
                                 # so without this binary an lfs-carrying repo fails to CLONE
brew "git-delta"                 # core.pager in .gitconfig — syntax-highlighted diffs. binary is
                                 # `delta`; git skips the pager off-tty, so agents still see plain diffs
brew "agent-browser"            # headless browser cli for coders: rust daemon, attach in 30 ms, --json verbs.
                                 # the x:browser-headless skill says when; `agent-browser skills get core` says how
brew "schpet/tap/linear"         # Linear CLI — the pm skill runs on this

# ── Languages and package managers ──────────────────────────────────────────
brew "fnm"                       # Node version manager
brew "pnpm"                      # the package manager for every JS project here
brew "oven-sh/bun/bun"           # Bun runtime
brew "go"                        # sline and x are written in Go
brew "govulncheck"               # go dependency vulnerability scan (pnpm x-go:vuln)
brew "gopls"                     # the go language server, for the LSP and editors
brew "staticcheck"               # go lint; brew rebuilds it on each go release
brew "delve"                     # dlv, the go debugger — on a test drive (2026-10-06)
brew "uv"                        # the only approved Python package manager
brew "typescript"                # global tsc/tsserver; the pnpm global shim died in the
                                 # brew move. no global `turbo` on purpose — it has no
                                 # formula, and bytes pins its own, which pnpm exec runs

# ── Editors and formatters ──────────────────────────────────────────────────
brew "vim"
brew "neovim"
brew "biome"                     # JS/TS toolchain
brew "stylua"                    # Lua formatter

# ── Containers ──────────────────────────────────────────────────────────────
brew "colima"                    # container runtime, Docker Desktop replacement
brew "docker"
brew "docker-buildx"
brew "docker-compose"

# ── Media and data ──────────────────────────────────────────────────────────
brew "jq"                        # JSON on the command line
brew "yq"                        # jq-syntax for YAML/TOML — settings.toml, lefthook configs
brew "sd"                        # sed replacement without the macos -i '' quoting traps
brew "ffmpeg"
brew "vhs"                       # charm terminal recorder → gif from a .tape script
brew "freeze"                    # charm code/terminal shots → png; FRM-284 shoots the cli arms with it
brew "sequin"                    # charm's ansi decoder — `… | sequin` shows what a tui redraw really printed
brew "gifski"                    # high-quality gif encoder for browser recordings
brew "yt-dlp"
brew "whisper-cpp"               # local speech-to-text — mcp-x-cw transcripts pipeline calls it
brew "poppler"                   # PDF tooling

# ── Test drives (DOT-250, 2026-09-16) ──────────────────────────────────────
brew "leaf-markdown-viewer"      # tui markdown reader — mermaid, latex, watch, `--inline` to stdout
brew "glow"                      # charm's markdown reader — the charm stack we plan the cli on
brew "duckdb"                    # SQL over jsonl in place — transcripts, x traces; docs/test-drive/duckdb.md
brew "ctx7"                      # context7 docs cli — test drive vs the context7 mcp to 2026-10-07

# ── Odds and ends ───────────────────────────────────────────────────────────
brew "lutzifer/tap/keyboardswitcher"    # drives the Raycast layout switcher
brew "teamookla/speedtest/speedtest"
brew "duti"                             # sets the default app per file type
brew "tree-sitter-cli"                  # was an npm global; brew owns it now
brew "vercel"                           # vercel/vc — deploys; was a pnpm global that broke
brew "mole"                             # `mo` — uninstall + clean + disk treemap; every destructive verb takes --dry-run

# ── Casks ───────────────────────────────────────────────────────────────────
cask "1password-cli"             # op — SSH agent + signing
cask "obsidian"                  # notes — the vault is icloud, config in ~/Library/Application Support/obsidian; ships the official `obsidian` cli
cask "raycast"                   # the launcher — self-updates ahead of brew, `brew upgrade --greedy` follows
cask "warp"                      # terminal — the daily one
cask "iterm2"                    # terminal — fallback; its prefs live in import/iterm2
cask "font-hack-nerd-font"       # the font iTerm2 profiles name; without it, glyphs render as boxes
cask "font-ia-writer-duo"        # cursor markdown font (iA Writer DuoS)
cask "font-ia-writer-quattro"    # proportional sibling, for prose without tables
cask "homebrew-app"              # BrewUI (Homebrew.app) — brew's official gui; installed 2026-09-14, the pretty face over `brew outdated`
cask "mole-app"                  # mole's native gui ($19, lifetime); separate build from the `mole` formula, auto-updates itself
cask "notion-cli"                # `ntn` — notion's official cli; the agent channel for notion, token from ~/.zshenv.local
# NOT a cask on purpose: ilya-birman-typography-layout downloads from ilyabirman.ru, which does not resolve on this network (2026-09-14). the bundle is hand-installed in ~/Library/Keyboard Layouts, static since 2023
cask "battle-net"                # blizzard launcher — the cask is an INSTALLER (Battle.net-Setup.app), run it once; intel-only, needs rosetta until blizzard ships silicon
cask "keka"                      # archiver — bundles its own 7zz/unar/unrar/zstd, so no archive CLIs are needed alongside it
brew "mas"                       # app store cli — the door for App-Store-only apps below; an app must be «gotten» once on the account first
mas "Marco", id: 6746069877      # email client on trial (free, native, no AI); newton is a direct download from newtonhq.com, no cask, no mas
mas "hide.me VPN", id: 953040671     # free vpn with a real country picker; tunnelbear free lost the pick 2026-01
cask "coderabbit"                # `coderabbit` cli — local ai code review; the gh app is retired, cli only
cask "wispr-flow"                # voice-to-text dictation, ai auto-edit; auto_updates, brew only installs
cask "superwhisper"              # dictation, local whisper/parakeet models + llm reformat; auto_updates, adopted 2026-09-12

# ── Apps hoisted from /Applications (the 2026-09-16 sweep) ──────────────────
cask "1password"                 # password manager, the SSH signing agent lives here
cask "bartender"                 # menu bar — v7
cask "betterdisplay"             # display control + `betterdisplaycli`
cask "vorssaint"                 # menu bar toolkit (gpl, local-first) — features are installed per-feature in its hub; on trial 2026-09-24
cask "claude"                    # claude desktop
cask "conductor"                 # parallel coder workspaces
cask "cursor"                    # the editor
cask "discord"
cask "figma"
cask "firefox"
cask "google-chrome"             # the browser
cask "granola"                   # meeting notes
cask "linear"                    # the tracker's desktop app
cask "loom"
cask "macvim-app"                # gui vim
cask "neovide-app"               # gui neovim
cask "notion"
cask "notion-calendar"
cask "nuphyio"                   # nuphy keyboard config
cask "perplexity"
cask "slack"
cask "spotify"
cask "steam"
cask "t3-code"
cask "tunnelbear"                # the vpn
cask "viber"
cask "visual-studio-code"
# cleanshot — adopted by accident with a 5.0 receipt over a licensed 4.8.10; NOT listed until resolved
