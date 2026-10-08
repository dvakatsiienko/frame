#!/bin/sh
# PostToolUse(EnterWorktree), user scope: make a fresh worktree runnable in any repo.
# A repo that owns a `worktree:seed` script (bytes: env copies, install, port offset)
# runs it; any other pnpm repo gets `CI=1 pnpm install` so lefthook's postinstall
# cannot rewrite the shared .git/hooks (rules/fleet-hazards.md, git hooks).
# Payload: .tool_response.worktreePath (measured 2026-08-30, cc 2.1.251).
input=$(cat)
wt=$(printf '%s' "$input" | jq -r '.tool_response.worktreePath // empty' 2>/dev/null)
if [ -z "$wt" ] || [ ! -d "$wt" ]; then exit 0; fi
# A git-crypt repo keeps its key in the main .git, not the worktree's gitdir, so a
# fresh tree holds ciphertext and every add/commit dies on the clean filter.
# Unlocking with the main key file decrypts the tree in place (measured 2026-09-24).
key="$(git -C "$wt" rev-parse --git-common-dir 2>/dev/null)/git-crypt/keys/default"
if [ -f "$key" ] && [ ! -d "$(git -C "$wt" rev-parse --git-dir)/git-crypt" ]; then
  # unlock runs `git status`, which dies on the clean filter the tree has no key for yet —
  # so the filter is switched off for that one call (frame AGENTS.md, the git-crypt hazard).
  (cd "$wt" && GIT_CONFIG_COUNT=2 GIT_CONFIG_KEY_0=filter.git-crypt.clean GIT_CONFIG_VALUE_0=cat \
    GIT_CONFIG_KEY_1=filter.git-crypt.required GIT_CONFIG_VALUE_1=false git-crypt unlock "$key") >/dev/null 2>&1 \
    || echo "git-crypt unlock failed in $wt — commits will die on the clean filter"
  # the unlock installs the key but git sees the ciphertext files as unchanged and never
  # re-smudges them — a remove + checkout per encrypted path decrypts them for real
  (cd "$wt" && git ls-files | git check-attr --stdin filter | awk -F': ' '$3=="git-crypt"{print $1}' \
    | while read -r f; do rm -f "$f" && git checkout -- "$f"; done) >/dev/null 2>&1
fi
# a cc mod's `.claude-plugin/types` is generated and gitignored, so a fresh tree has none and
# every type read in it fails (~30 reads lost on one retro, FRM-337): copy the main checkout's
main=$(dirname "$(git -C "$wt" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)")
if [ -d "$main" ] && [ "$main" != "$wt" ]; then
  (cd "$main" && find . \( -name node_modules -o -name .git -o -path ./.claude/worktrees \) -prune \
    -o -type d -path '*/.claude-plugin/types' -print -prune) | while read -r d; do
    [ -e "$wt/$d" ] || { mkdir -p "$wt/$(dirname "$d")" && cp -R "$main/$d" "$wt/$d"; }
  done
fi
[ -f "$wt/package.json" ] || exit 0
if jq -e '.scripts["worktree:seed"]' "$wt/package.json" >/dev/null 2>&1; then
  # no `-s`: pnpm 12 dropped it, and the error hid behind the redirect for a month
  CI=1 pnpm --dir "$wt" worktree:seed "$wt" >/dev/null 2>&1 \
    || echo "worktree:seed failed in $wt — run \`pnpm worktree:seed $wt\` by hand to see why"
elif [ -f "$wt/pnpm-lock.yaml" ]; then
  CI=1 pnpm install --dir "$wt" >/dev/null 2>&1 || echo "pnpm install failed in $wt"
  echo "worktree seeded with a plain install — this repo has no \`worktree:seed\` script; add one if a tree needs env files or its own dev ports (bytes has the reference)"
fi
