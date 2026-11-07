#!/bin/bash
# SessionStart hook — the Bash tool's shell snapshot ends by exporting PATH, past home/.zshenv, so cc's env file puts git-slim first; a missing build is skipped by the PATH lookup.
[ -n "${CLAUDE_ENV_FILE-}" ] || exit 0
echo 'export PATH="$HOME/.local/state/x/git-slim/current/bin:$PATH"' >>"$CLAUDE_ENV_FILE"
