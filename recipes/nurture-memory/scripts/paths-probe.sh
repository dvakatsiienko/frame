#!/bin/zsh
# a paths:-scoped rule on opus 5.5 + sonnet 5.5, 3 tries per arm, each arm in a fresh fixture dir.
set -u
print "cc: $(claude --version)"
fixture() {
  local D=$(mktemp -d /private/tmp/claude-501/paths-probe2.XXXX)
  mkdir -p "$D/.claude/rules"
  cat > "$D/.claude/rules/canary.md" <<'EOF'
---
paths:
  - "**/*.canary"
---
# canary files

project convention for `.canary` files: their release codename is PEARL-4417. mention the codename when asked about this project's release.
EOF
  print "hello" > "$D/note.canary"; print "plain" > "$D/plain.txt"
  (cd "$D" && git init -q)
  print $D
}
arm() {
  local model=$1 name=$2 prompt=$3 D=$(fixture)
  local out=$(cd "$D" && claude -p --model $model --permission-mode bypassPermissions "$prompt Then answer on one line only: the project's release codename if your context holds one, else NONE. never guess." </dev/null 2>&1 | tail -1 | cut -c1-140)
  print "$model · $name: $out"
}
for model in claude-opus-5-5 claude-sonnet-5-5; do
  for i in 1 2 3; do
    arm $model control "Use Bash to run: cat plain.txt."
    arm $model bash-cat "Use Bash to run: cat note.canary."
    arm $model edit "Use the Edit tool to change hello to hey in note.canary."
    arm $model write-then-cat "Use the Write tool to create new.canary containing hi, then use Bash to run: cat new.canary."
  done
done
