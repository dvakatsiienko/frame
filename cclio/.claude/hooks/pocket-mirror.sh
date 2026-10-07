#!/bin/bash
# one-way copy of the pocket into the vault, so dima reads it on his phone; a phone edit there is overwritten
set -euo pipefail
src="$HOME/frame/cclio/pocket.md"
dest="$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian Dima's Vault/_hq/pocket.md"
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
{
  printf -- '---\nicon: 🫙\ndescription: cclio work pool, read-only mirror\n---\n\n'
  echo '> 🔒 read-only mirror of `~/frame/cclio/pocket.md`, rewritten after every cclio turn. edits here are lost — drop asks in the inbox.'
  echo
  cat "$src"
} >"$tmp"
cmp -s "$tmp" "$dest" 2>/dev/null || cp "$tmp" "$dest"
