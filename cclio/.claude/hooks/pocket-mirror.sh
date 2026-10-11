#!/bin/bash
# one-way copy of the live pocket into the vault, so dima reads it on his phone; a phone edit there is overwritten
set -euo pipefail
vault_dest="$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian Dima's Vault/_hq/pocket.md"
dest="${POCKET_MIRROR_DEST:-$vault_dest}"
list="$(BACKLOG_CWD="$HOME/frame/cclio" backlog task list --plain --sort ordinal 2>/dev/null)" || list=""
if [ -z "$list" ]; then
  # a failed read keeps the last list but says so, so a stale mirror never passes for a live one
  [ -f "$dest" ] && ! grep -q '^> ⚠️ stale since' "$dest" &&
    awk -v line="> ⚠️ stale since $(date '+%F %H:%M'): the pocket could not be read, this is the last good copy" 'n==2 && !done {print ""; print line; done=1} {print} /^---$/ {n++}' "$dest" >"$dest.tmp" && mv "$dest.tmp" "$dest"
  exit 0
fi
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
{
  printf -- '---\nicon: 🫙\ndescription: cclio work pool, read-only mirror\n---\n\n'
  echo '> 🔒 read-only mirror of the pocket (`~/frame/cclio/pocket/`, Backlog.md), rewritten after every cclio turn. edits here are lost — drop asks in the inbox.'
  echo
  echo '```'
  printf '%s\n' "$list"
  echo '```'
} >"$tmp"
cmp -s "$tmp" "$dest" 2>/dev/null || cp "$tmp" "$dest"
