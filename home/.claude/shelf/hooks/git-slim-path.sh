#!/bin/bash
# SessionStart hook — the Bash tool's shell snapshot ends by exporting PATH, past home/.zshenv, so cc's env file puts git-slim first; a missing build is skipped by the PATH lookup.
[ -n "${CLAUDE_ENV_FILE-}" ] || exit 0
# a broken build stays off this session's PATH; the boot row names the rebuild
"$HOME/.local/state/x/git-slim/current/bin/git" --version >/dev/null 2>&1 || exit 0
echo 'export PATH="$HOME/.local/state/x/git-slim/current/bin:$PATH"' >>"$CLAUDE_ENV_FILE"
