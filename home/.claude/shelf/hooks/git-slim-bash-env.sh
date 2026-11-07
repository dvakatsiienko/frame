# BASH_ENV for cc's bash children, hooks included, which read neither zsh file nor cc's env file.
# only brew's git is swapped: a test's fake git first on PATH stays first. forcing brew's: env -u BASH_ENV.
if [ "$(command -v git)" = /opt/homebrew/bin/git ] && [ -x "$HOME/.local/state/x/git-slim/current/bin/git" ] && [ -s "$HOME/.local/state/x/git-slim/current/bin/git" ]; then
  PATH="$HOME/.local/state/x/git-slim/current/bin:$PATH"
fi
