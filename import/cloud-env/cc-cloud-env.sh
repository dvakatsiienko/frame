#!/bin/bash
# Cloud environment setup: Node 24 for Claude Code sessions.
# The image ships Node 22; package.json engines wants >=24, and pnpm only warns.
set -uo pipefail

NODE_VERSION=26
FNM_DIR="$HOME/.local/share/fnm"
BIN="$HOME/.local/bin"
export FNM_DIR
mkdir -p "$BIN" "$FNM_DIR"

# The official installer is a wrapper around the GitHub release asset. Its own
# host is 403 under Trusted network access, so fall back to the asset directly.
if ! curl -fsSL https://fnm.vercel.app/install | bash -s -- --skip-shell; then
  arch=$([ "$(uname -m)" = x86_64 ] && echo linux || echo arm64)
  curl -fsSL "https://github.com/Schniz/fnm/releases/latest/download/fnm-$arch.zip" -o "$FNM_DIR/fnm.zip"
  unzip -oqd "$FNM_DIR" "$FNM_DIR/fnm.zip" && rm "$FNM_DIR/fnm.zip"
fi

"$FNM_DIR/fnm" install "$NODE_VERSION"
"$FNM_DIR/fnm" default "$NODE_VERSION"

# This script's shell exits before Claude Code launches, so `fnm use` would not
# survive it. Symlinks do, and ~/.local/bin already leads PATH.
ln -sf "$FNM_DIR/aliases/default/bin/"{node,npm,npx} "$BIN/"

corepack enable
node --version
