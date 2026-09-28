#!/bin/sh
# seed a fresh mac with frame. run it from the clone: script/seed.sh [--claude] [--dry-run]
# agent-first: one status line per step, safe to re-run. exit 2 = a human stop — the waiting
# lines say what his hands must do, and the next run picks up from there. plain sh: no node yet.
set -eu

claude=0
dry=0
for arg in "$@"; do
    case "$arg" in
    --claude) claude=1 ;;
    --dry-run) dry=1 ;;
    -h | --help)
        sed -n '2,4p' "$0"
        exit 0
        ;;
    *)
        echo "unknown flag: $arg" >&2
        exit 1
        ;;
    esac
done

cd "$(dirname "$0")/.."

line() { printf '%-12s %-8s %s\n' "$1" "$2" "$3"; }
hands() {
    line "$1" waiting "needs your hands: $2"
    exit 2
}
# a sign-in stop at the end: every one is named in the same run, then exit 2
stops=0
later() {
    line "$1" waiting "needs your hands: $2"
    stops=$((stops + 1))
}
# a step that changes the machine: printed under --dry-run, run otherwise
act() {
    step="$1"
    shift
    if [ "$dry" = 1 ]; then
        line "$step" dry-run "$*"
    else
        "$@" || return
        line "$step" ran "$*"
    fi
}

# 0 · the clone lives at ~/frame — the zsh stubs, macos-setup and every config point there
if [ "$(pwd -P)" != "$(cd "$HOME/frame" 2>/dev/null && pwd -P)" ]; then
    if [ "$dry" = 1 ]; then
        line clone dry-run "would stop: this clone is $(pwd -P), not ~/frame"
    else
        hands clone "move this clone to ~/frame, then run ~/frame/script/seed.sh"
    fi
fi

# 1 · the command line tools — git and the compilers every later step needs
if xcode-select -p >/dev/null 2>&1; then
    line clt "done" "$(xcode-select -p)"
else
    act clt xcode-select --install || true
    hands clt 'click Install in the Command Line Tools dialog, then re-run'
fi

# 2 · homebrew — its installer asks for the admin password, so it is a human stop
for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do
    [ -x "$b" ] && eval "$("$b" shellenv)" && break
done
if command -v brew >/dev/null 2>&1; then
    line brew "done" "$(brew --prefix)"
else
    hands brew 'install Homebrew with the one-line installer on https://brew.sh, skip its «next steps» (the seed writes a ~/.zprofile stub that does it), then re-run'
fi

# 3 · fnm + pnpm through brew, node through fnm (the version is .node-version's major)
for f in fnm pnpm; do
    if command -v "$f" >/dev/null 2>&1; then
        line "$f" "done" "$(command -v "$f")"
    else
        act "$f" brew install "$f"
    fi
done
node_major="$(cat .node-version)"
if command -v fnm >/dev/null 2>&1; then
    eval "$(fnm env --shell bash)"
    if fnm list | grep "v$node_major\." >/dev/null; then
        line node "done" "v$node_major via fnm"
    else
        act node fnm install "$node_major"
    fi
    act node fnm default "$node_major"
    [ "$dry" = 1 ] || fnm use "$node_major" >/dev/null
else
    line node dry-run "fnm install $node_major (after fnm lands)"
fi

# 4 · the repo's own tooling — pnpm install also sets up the lefthook git hooks
act deps pnpm install --frozen-lockfile

# 5 · the Brewfile, macos defaults, duti — the repo's existing script, unchanged
# App Store apps wait on a sign-in no script can give (mas hangs on it) — brew skips them, step 9 names them
mas_ids="$(sed -n 's/^mas .*id: *\([0-9][0-9]*\).*/\1/p' Brewfile | tr '\n' ' ')"
export HOMEBREW_BUNDLE_MAS_SKIP="$mas_ids"
if ! act macos pnpm macos:setup apply; then
    hands macos 'the Brewfile or a macos default failed — read the lines above, fix the cause, then re-run'
fi

# 6 · the mirror — ~/.claude stays out unless --claude
link_flag=--without-claude
[ "$claude" = 1 ] && link_flag=
if [ "$dry" = 1 ]; then
    line link dry-run "node script/frame-link.ts apply $link_flag"
elif ! node script/frame-link.ts apply $link_flag; then
    hands link 'frame-link failed — a file «in the way» above is kept (mv into home/) or dropped; any other error is a bug to report; then re-run'
fi

# the zsh files are sourced by a stub, never linked (manifest.ts noLink) — the seed writes the stubs
for f in .zshenv .zprofile .zshrc; do
    src="source \"\$HOME/frame/home/$f\""
    if grep -qxF "$src" "$HOME/$f" 2>/dev/null; then
        line zsh "done" "~/$f sources frame"
    elif [ -e "$HOME/$f" ]; then
        hands zsh "~/$f exists — add the line $src to it (or drop the file), then re-run"
    elif [ "$dry" = 1 ]; then
        line zsh dry-run "write the ~/$f stub"
    else
        printf '%s\n' '# stub — real file lives in the frame repo.' \
            '# Not symlinked: Cowork refuses to trust a folder that a protected home path resolves into.' \
            "$src" >"$HOME/$f"
        line zsh "done" "~/$f stub written"
    fi
done

if [ "$claude" = 1 ] && [ "$dry" = 1 ]; then
    line claude dry-run "$HOME/.claude would be linked"
elif [ "$claude" = 1 ]; then
    line claude "done" "$HOME/.claude linked"
else
    line claude skipped 'the agent system stays out — re-run with --claude to link ~/.claude'
fi

# 7 · claude parts need the app launched once; skip, never fail, when it is absent
if [ "$claude" = 1 ]; then
    if [ -d /Applications/Claude.app ] || command -v claude >/dev/null 2>&1; then
        line claude "done" 'plugins install from the linked settings.json on the next claude launch'
    else
        line claude skipped 'Claude is not installed yet — install it, launch it once, re-run with --claude'
    fi
fi

# 8 · git-crypt — one file (gmail/blocklist.json); the seed never unlocks it
line git-crypt skipped 'gmail/blocklist.json stays locked — unlock by hand when a gmail filter job needs it'

# 9 · App Store apps from the Brewfile — step 5 skipped them; mas installs once he is signed in
if [ -n "$mas_ids" ] && [ "$dry" = 1 ]; then
    line appstore dry-run "check that mas list holds $mas_ids"
elif [ -n "$mas_ids" ]; then
    installed="$(mas list 2>/dev/null)"
    missing=""
    for id in $mas_ids; do
        printf '%s\n' "$installed" | grep -qw "$id" || missing="$missing $id"
    done
    if [ -n "$missing" ]; then
        later appstore "sign in to the App Store app, then run  mas install$missing"
    else
        line appstore "done" "$mas_ids"
    fi
fi

# 10 · 1password — installed by the Brewfile; SSH signing waits on his sign-in
if [ "$dry" = 1 ]; then
    line 1password dry-run 'check that the 1Password cli sees a signed-in account'
elif command -v op >/dev/null 2>&1 && [ "$(op account list --format=json 2>/dev/null)" != "[]" ] && [ -n "$(op account list 2>/dev/null)" ]; then
    line 1password "done" 'an account is signed in'
else
    later 1password 'open 1Password, sign in, turn on Settings → Developer → SSH agent and CLI integration'
fi

if [ "$stops" -gt 0 ]; then
    line seed waiting "the machine is set up — do the $stops sign-ins above, then re-run"
    exit 2
fi
line seed "done" 'frame is seeded'
