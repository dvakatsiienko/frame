#!/bin/sh
# seed a fresh mac with frame. run it from the clone: script/seed.sh [--claude] [--dry-run]
# agent-first: one status line per step, safe to re-run. exit 2 = a human stop — the last line
# says what his hands must do, and the next run picks up from there. plain sh: no node yet.
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
# a step that changes the machine: printed under --dry-run, run otherwise
act() {
    step="$1"
    shift
    if [ "$dry" = 1 ]; then
        line "$step" dry-run "$*"
    else
        "$@"
    fi
}

# 1 · the command line tools — git and the compilers every later step needs
if xcode-select -p >/dev/null 2>&1; then
    line clt "done" "$(xcode-select -p)"
else
    act clt xcode-select --install
    hands clt 'click Install in the Command Line Tools dialog, then re-run'
fi

# 2 · homebrew — its installer asks for the admin password, so it is a human stop
for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do
    [ -x "$b" ] && eval "$("$b" shellenv)" && break
done
if command -v brew >/dev/null 2>&1; then
    line brew "done" "$(brew --prefix)"
else
    hands brew 'install Homebrew with the one-line installer on https://brew.sh, then re-run'
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
act macos pnpm macos:setup

# 6 · the mirror — ~/.claude stays out unless --claude
link_flag=--without-claude
[ "$claude" = 1 ] && link_flag=
if [ "$dry" = 1 ]; then
    line link dry-run "node script/frame-link.ts apply $link_flag"
elif ! node script/frame-link.ts apply $link_flag; then
    hands link 'the files «in the way» above are real files where a link belongs — keep (mv into home/) or drop each, then re-run'
fi
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

# 9 · 1password — installed by the Brewfile; SSH signing waits on his sign-in
if [ "$dry" = 1 ]; then
    line 1password dry-run 'check that the 1Password cli sees a signed-in account'
elif command -v op >/dev/null 2>&1 && [ "$(op account list --format=json 2>/dev/null)" != "[]" ] && [ -n "$(op account list 2>/dev/null)" ]; then
    line 1password "done" 'an account is signed in'
else
    hands 1password 'open 1Password, sign in, turn on Settings → Developer → SSH agent and CLI integration, then re-run'
fi

line seed "done" 'frame is seeded'
