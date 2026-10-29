#!/bin/zsh
# prints a fresh groom list: every memory file a session can load, by layer, each ⬜ with its bytes.
# usage: groom-list.sh > recipes/nurture-memory/last/groom-list.md, then mark what the run already holds
set -u
F=~/frame
rows() { local base=$1; shift; for f in "$@"; do [[ -f $f ]] && printf -- '- ⬜ `%s` — %s B\n' "${f#$base/}" "$(wc -c < $f | tr -d ' ')"; done; }

print "# groom list — sweep run #? (FRM-267)\n"
print "one line per memory file, in the recipe's layer order (step 8). bytes on disk at $(date '+%Y-%m-%d %H:%M'). a line flips the turn its step lands; the trace in \`docs/test-drive/memory-sweep.md\` holds the how.\n"
print "✅ groomed · 🔄 in this round · 🟡 touched, not groomed whole · ⏭️ deferred, with where · ⬜ not yet\n"
print "<!-- the count, never by hand: for s in ✅ 🔄 🟡 ⏭️ ⬜; do grep -c \"^- \$s\" groom-list.md; done -->\n"
print "## 1 · root\n"; rows $F $F/home/.claude/CLAUDE.md
print "\n## 2 · rules (global)\n"; rows $F/home/.claude $F/home/.claude/rules/*.md ${(f)"$(jq -r 'keys[]' $F/home/.claude/rules-lazy/triggers.json | sed "s|^|$F/home/.claude/rules-lazy/|; s|$|.md|")"}
print "\n## 3 · clio\n"; rows $F/_clio $F/_clio/AGENTS.md $F/_clio/memory/*.md $F/_clio/gazette/_trail.md
print "\n## 4 · frame project\n"; rows $F ${(f)"$(cd $F && git ls-files '*AGENTS.md' | grep -v '^_clio/' | sed "s|^|$F/|")"} $F/.claude/rules/*.md(N)
print "\n## 5 · other projects (~/projects)\n"; rows ~/projects ${(f)"$(find ~/projects -maxdepth 4 \( -name AGENTS.md -o -name CLAUDE.md \) -not -path '*/node_modules/*' -not -path '*/.claude/worktrees/*' -not -path '*/.scratch/*' 2>/dev/null)"}
print "\n## 6 · knowledge docs that steer memory edits\n"; rows $F $F/docs/knowledge/authoring-*.md
print "\n## 7 · always loaded, outside the layers\n"; rows $F $F/home/.claude/output-styles/*.md $F/home/.claude/agents/*.md $F/_clio/.claude/agents/*.md
print "\nskills are step 9, groomed in the order of recipe.md step 9.5."
