# .zprofile should contain commands that should run once at login

# Set PATH, MANPATH, etc., for Homebrew.
eval "$(/opt/homebrew/bin/brew shellenv)"

# git-slim: login startup's path_helper rebuilds PATH past .zshenv, so agent shells take it again here
if [ -n "${CLAUDECODE-}" ]; then
  typeset -U path
  path=("$HOME/.local/state/x/git-slim/current/bin" $path)
fi
