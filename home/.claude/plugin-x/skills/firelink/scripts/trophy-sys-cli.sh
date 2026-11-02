#!/bin/zsh
# runs one trophy-sys cli verb and writes clean json (preamble stripped) to the out file
# usage: trophy-sys-cli.sh <verb> [arg] [--out <file>]   default out: /tmp/ts-<verb>.json
# prints the out path and the top-level shape on success; exit 1 when no json came back
set -uo pipefail
source ~/.zshrc 2>/dev/null
app=/Users/dima/projects/bytes/apps/trophy-sys
verb=${1:?verb: profile games game news stats snapshot steam-profile steam-games steam-game steam-wishlist}
shift
args=() out=/tmp/ts-$verb.json
while (( $# )); do
  if [[ $1 == --out ]]; then out=$2; shift 2; else args+=$1; shift; fi
done
raw=$out.raw
(cd $app && node --env-file=.env --env-file-if-exists=.env.local src/server/cli.ts $verb $args > $raw 2>&1)
python3 - "$raw" "$out" <<'EOF'
import json, sys
s = open(sys.argv[1]).read()
starts = [i for i in (s.find('['), s.find('{')) if i >= 0]
if not starts:
    print('no json in output:\n' + s[:800]); sys.exit(1)
d = json.loads(s[min(starts):])
json.dump(d, open(sys.argv[2], 'w'))
shape = f'array of {len(d)}' if isinstance(d, list) else 'object: ' + ' '.join(list(d)[:12])
print(f'{sys.argv[2]} — {shape}')
EOF
