#!/bin/bash
# keeps a wing's worktree level with main, both ways (PK-351:W16, W48)
# usage: tree-sync.sh        UserPromptSubmit: main into this session's tree; a session with no tree exits fast
#        tree-sync.sh land   a finished piece: main in, fast-forward main, bump a changed plugin, one push, refresh the other wings' trees
set -uo pipefail
root="${TREE_SYNC_ROOT:-$HOME/frame}"
trees="$root/.claude/worktrees"

# the thread's tree outlives the session, so its number is read from the registry; a tree from before threads goes by session id
thread_tree() {
	local sid=$1 file name
	file=$(grep -lE "\"sessionId\": *\"$sid" "${TREE_SYNC_SESSIONS:-$HOME/.claude/sessions}"/*.json 2>/dev/null | head -1)
	if [ -n "$file" ] && [[ $(<"$file") =~ \"name\":\ *\"[^\"]*wing\ ([0-9]+) ]]; then
		name="$trees/clio-wing-${BASH_REMATCH[1]}"
		[ -d "$name" ] && { echo "$name"; return; }
	fi
	echo "$trees/fork-${sid:0:8}"
}

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
	# under the hook's own limit, since a merge the hook killed would stay half done
	local limit="${TREE_SYNC_MERGE_LIMIT:-20}" status
	output=$(timeout "$limit" git -C "$tree" merge --no-edit --quiet refs/heads/main 2>&1)
	status=$?
	if [ "$status" -eq 0 ]; then
		echo "🌿 tree synced: $behind new from main"
		return 0
	fi
	if [ "$status" -eq 124 ]; then
		# this branch runs only on a clean tree, so a reset can take nothing of the session's
		git -C "$tree" reset --merge --quiet
		echo "🌿 tree $behind behind main, the merge outlasted ${limit} s and was undone, the next prompt tries again"
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
	[[ $input =~ \"session_id\":\ *\"([^\"]+) ]] || exit 0
	tree=$(thread_tree "${BASH_REMATCH[1]}")
	[ -d "$tree" ] || exit 0
	sync_tree "$tree"
	ahead=$(git -C "$tree" rev-list --count refs/heads/main..HEAD 2>/dev/null) || exit 0
	[ "$ahead" -eq 0 ] || echo "🌿 $ahead commits not on main yet, at a finished piece: $0 land"
	exit 0
fi

sid="${CLAUDE_CODE_SESSION_ID:-}"
tree=$(thread_tree "$sid")
[ -n "$sid" ] && [ -d "$tree" ] || {
	echo "tree-sync land: no tree for this session, $tree" >&2
	exit 2
}
branch=$(git -C "$tree" symbolic-ref --short HEAD) || exit 1
# from what origin holds, so a retry after a failed push still sees what changed
before=$(git -C "$root" rev-parse --verify --quiet refs/remotes/origin/main || git -C "$root" rev-parse refs/heads/main) || exit 1
sync_tree "$tree"
behind=$(git -C "$tree" rev-list --count HEAD..refs/heads/main)
[ "$behind" -eq 0 ] || {
	echo "tree-sync land: stopped, the tree is still $behind behind main" >&2
	exit 1
}
# a peer's git holds main's lock for moments at a time
for _ in 1 2 3 4 5; do
	output=$(git -C "$root" merge --ff-only --quiet "refs/heads/$branch" 2>&1) && break
	grep -q 'index.lock' <<<"$output" || break
	sleep 1
done
# an ancestor, so a peer moving main right after is no refusal
git -C "$root" merge-base --is-ancestor "$(git -C "$tree" rev-parse HEAD)" refs/heads/main || {
	echo "tree-sync land: main refused the fast-forward: $output" >&2
	exit 1
}
# x acts on the folder it runs in, and from a tree it would push the tree's branch
cd "$root" || exit 1
changed=$(git -C "$root" diff --name-only "$before" refs/heads/main)
# a bump writes its manifest in main, and left there it is a chore for whoever comes next
bump() {
	local name=$1 message="$tree/.scratch/plugin-bump-message.txt"
	mkdir -p "$tree/.scratch"
	echo "🔧 plugin-$name: bump for the landing of $branch" >"$message"
	x lane commit --bump "$name" "$message" || exit 1
}
if grep -q '^_clio/plugin-clio/' <<<"$changed"; then
	bump clio
fi
# mods run from source, so only the rest of plugin x needs a bump
if grep '^home/.claude/plugin-x/' <<<"$changed" | grep -qv '^home/.claude/plugin-x/mods/'; then
	bump x
fi
# a pr merged on github leaves main behind origin, and the push would be refused for every clio: take origin in first
if git -C "$root" fetch --quiet origin main 2>/dev/null &&
	! git -C "$root" merge-base --is-ancestor refs/remotes/origin/main refs/heads/main; then
	git -C "$root" merge --no-edit --quiet refs/remotes/origin/main || {
		# a conflict must never leave dima's checkout mid-merge
		git -C "$root" merge --abort 2>/dev/null
		echo "tree-sync land: origin/main would not merge into main, a peer's uncommitted file or a conflict: ask clio" >&2
		exit 1
	}
fi
# one push for the piece and its bumps: each push reruns the tests
x lane push --apply || exit 1
for other in "$trees"/fork-* "$trees"/clio-wing-*; do
	[ -d "$other" ] && [ "$other" != "$tree" ] || continue
	sync_tree "$other" >/dev/null
done
echo "🌿 landed $(git -C "$root" rev-list --count "$before..refs/heads/main") commits from $branch"
