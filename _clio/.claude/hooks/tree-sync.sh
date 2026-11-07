#!/bin/bash
# keeps a wing's worktree level with main, both ways (PK-351:W16, W48)
# usage: tree-sync.sh        UserPromptSubmit: main into this session's tree; a session with no tree exits on one stat
#        tree-sync.sh land   a finished piece: main in, fast-forward main, push, bump a changed plugin, refresh the other wings' trees
set -uo pipefail
root="${TREE_SYNC_ROOT:-$HOME/frame}"
trees="$root/.claude/worktrees"

# prints only what the session must know; a failure never touches the tree's own work
sync_tree() {
	local tree=$1 behind output
	behind=$(git -C "$tree" rev-list --count HEAD..refs/heads/main 2>/dev/null) || return 0
	[ "$behind" -gt 0 ] || return 0
	if [ -n "$(git -C "$tree" status --porcelain --untracked-files=no)" ]; then
		# a fast-forward cannot start a merge, so uncommitted edits stay safe; git refuses one that overlaps them
		if git -C "$tree" merge --ff-only --quiet refs/heads/main >/dev/null 2>&1; then
			echo "🌿 tree synced: $behind new from main"
		else
			echo "🌿 tree $behind behind main, waits for your commit: uncommitted edits"
		fi
		return 0
	fi
	if output=$(git -C "$tree" merge --no-edit --quiet refs/heads/main 2>&1); then
		echo "🌿 tree synced: $behind new from main"
		return 0
	fi
	if git -C "$tree" rev-parse --verify --quiet MERGE_HEAD >/dev/null; then
		local files
		files=$(git -C "$tree" diff --name-only --diff-filter=U | head -5 | tr '\n' ' ')
		git -C "$tree" merge --abort
		echo "🌿 tree $behind behind main, conflict left for you to merge: $files"
	else
		echo "🌿 tree $behind behind main, merge refused: $(head -1 <<<"$output")"
	fi
}

if [ "${1:-}" != land ]; then
	input=$(cat)
	[[ $input =~ \"session_id\":\ *\"([^\"]{8}) ]] || exit 0
	tree="$trees/fork-${BASH_REMATCH[1]}"
	[ -d "$tree" ] || exit 0
	sync_tree "$tree"
	ahead=$(git -C "$tree" rev-list --count refs/heads/main..HEAD 2>/dev/null) || exit 0
	[ "$ahead" -eq 0 ] || echo "🌿 $ahead commits not on main yet, at a finished piece: $0 land"
	exit 0
fi

sid="${CLAUDE_CODE_SESSION_ID:-}"
tree="$trees/fork-${sid:0:8}"
[ -n "$sid" ] && [ -d "$tree" ] || {
	echo "tree-sync land: no tree for this session, $tree" >&2
	exit 2
}
branch=$(git -C "$tree" symbolic-ref --short HEAD) || exit 1
before=$(git -C "$root" rev-parse refs/heads/main) || exit 1
sync_tree "$tree"
behind=$(git -C "$tree" rev-list --count HEAD..refs/heads/main)
[ "$behind" -eq 0 ] || {
	echo "tree-sync land: stopped, the tree is still $behind behind main" >&2
	exit 1
}
git -C "$root" merge --ff-only --quiet "refs/heads/$branch" || {
	echo "tree-sync land: main refused the fast-forward; a file main has staged blocks it, ask clio to commit hers" >&2
	exit 1
}
# x acts on the folder it runs in, and from a tree it would push the tree's branch
cd "$root" || exit 1
x lane push --apply || exit 1
changed=$(git -C "$root" diff --name-only "$before" refs/heads/main)
if grep -q '^_clio/plugin-clio/' <<<"$changed"; then
	x plugin bump --apply clio || exit 1
fi
# mods run from source, so only the rest of plugin x needs a bump
if grep '^home/.claude/plugin-x/' <<<"$changed" | grep -qv '^home/.claude/plugin-x/mods/'; then
	x plugin bump --apply x || exit 1
fi
for other in "$trees"/fork-*; do
	[ -d "$other" ] && [ "$other" != "$tree" ] || continue
	sync_tree "$other" >/dev/null
done
echo "🌿 landed $(git -C "$root" rev-list --count "$before..refs/heads/main") commits from $branch"
