#!/bin/zsh
# refuses a ✅ line that carries no bytes before → after or misses a lens verdict (the 10-11 run passed 27 files «unchanged»).
# a skill line (## 8 · skills) needs a whole-groom round: a 9.5 round «— rN» or «— step 10 groom»; a partial pass alone («9.4 B» dupes, a «9.3» prune verdict, «side work») is not a groom (10-16: 14 skills sat ✅ on a partial pass).
# --final (step 10's gate) adds: no ⬜ or 🟡 line, a ⏭️ only with a named home, every ✅ file's size on disk within 2 % of its recorded after — an edit after the groom re-opens the line — and no two bullets merged on one line in any ✅ file.
# usage: groom-list-check.sh [--final] [groom-list.md] — exit 1 names every bad line
set -u
final=0
[[ ${1:-} == --final ]] && { final=1; shift }
L=${1:-$(dirname $0)/../last/groom-list.md}
lenses=(dupe superseded enforced unused no-op altitude trim merge placement deferral protected)
bad=0
skills=0
while IFS= read -r line; do
  [[ $line == '## 8 · skills'* ]] && { skills=1; continue }
  if (( final )); then
    [[ $line == '- ⬜'* || $line == '- 🟡'* ]] && { print -r -- "✗ ${line[1,90]} — not groomed (final)"; bad=1; continue }
    [[ $line == '- ⏭️'* && $line != *'·'* ]] && { print -r -- "✗ ${line[1,90]} — a deferral names no home"; bad=1; continue }
  fi
  [[ $line == '- ✅'* ]] || continue
  miss=()
  [[ $line =~ '[0-9,]+ → [0-9,]+ B' ]] || miss+=(bytes)
  if (( skills )); then
    [[ $line =~ '— ([^—]* )?(r[0-9]|step 10 groom)' ]] || miss+=('whole groom (a partial pass only)')
  else
    [[ $line == *'lenses:'* ]] || miss+=(lenses:)
    for l in $lenses; do [[ $line == *"$l"* ]] || miss+=($l); done
  fi
  if (( ${#miss} )); then
    print -r -- "✗ ${line[1,90]} — missing: ${(j:, :)miss}"
    bad=1
  fi
done < $L
if (( final )); then
  python3 -I - "$L" <<'EOF' || bad=1
import os, re, sys
home = os.path.expanduser('~')
base = {'1': f'{home}/frame/home/.claude', '2': f'{home}/frame/home/.claude/rules', '3': f'{home}/frame/_clio',
        '4': f'{home}/frame', '5': f'{home}/projects', '6': f'{home}/frame', '7': f'{home}/frame'}
sec, bad = None, 0
merged = re.compile(r'[\w.)»*]- [^\s-]|[^\s\d-]\d+\. \*\*')
code = re.compile(r'`[^`]*`')  # a swallowed newline: «word- next bullet» (10-16, 12 sightings)
for line in open(sys.argv[1]):
    m = re.match(r'## (\d) ·', line)
    if m: sec = m.group(1); continue
    if not line.startswith('- ✅'): continue
    p = re.search(r'`([^`]+)`', line).group(1)
    if sec == '8':
        ns, name = p.split(':', 1)
        path = f'{home}/frame/home/.claude/plugin-x/skills/{name}/SKILL.md' if ns == 'x' else f'{home}/frame/_clio/plugin-clio/skills/{name}/SKILL.md'
    elif p.startswith(('home/', 'docs/', '_clio/', 'recipes/', 'x/', 'hotkeys/', 'import/', 'schedule/', 'gmail/', 'gifs/', 'speak/', '_crow/', '.claude/')):
        path = f'{home}/frame/{p}'
    elif sec == '2' and p.startswith('rules-lazy/'):
        path = f'{home}/frame/home/.claude/{p}'
    elif sec == '5' and '(~/projects)' in line:
        path = f'{home}/projects/AGENTS.md'
    elif sec == '5' and p.startswith('bytes/'):
        path = f'{home}/projects/{p}'
    else:
        path = f'{base.get(sec, home)}/{p}'
    m = re.search(r'([0-9,]+) → ~?([0-9,]+) B', line)
    if not m: continue
    after = int(m.group(2).replace(',', ''))
    if not os.path.exists(path):
        print(f'✗ {line[:90].rstrip()} — file gone: {path}'); bad = 1; continue
    fence = False
    for n, text in enumerate(open(path, encoding='utf-8'), 1):
        if text.lstrip().startswith('```'): fence = not fence
        if not fence and merged.search(code.sub('``', text)):
            print(f'✗ {path}:{n} — two bullets merged on one line: {text.strip()[:70]}'); bad = 1
    disk = os.path.getsize(path)
    if after and abs(disk - after) > max(40, after * 0.02):
        print(f'✗ {line[:90].rstrip()} — changed after its groom: {after} B recorded, {disk} B on disk'); bad = 1
sys.exit(bad)
EOF
fi
(( bad )) && exit 1
print "groom list: every ✅ carries bytes and all ${#lenses} lens verdicts; every ✅ skill a whole groom$( (( final )) && print -n '; final: nothing open, every size matches the disk')"
