#!/bin/zsh
# against the storm (highball): when the last settlement save was made, in clock time and in-game year/season,
# beside where the game is now (the last [CAL] line of Player.log). read-only: never touches a save.
set -euo pipefail
dir="$HOME/Library/Application Support/Highball/bottles/Games/drive_c/users/dima/AppData/LocalLow/Eremite Games/Against the Storm"
[[ -f "$dir/Save.save" ]] || { print -u2 "no settlement save in $dir"; exit 1; }
exec python3 - "$dir" <<'EOF'
import json, os, sys, time
d = sys.argv[1]
seasons = ['Drizzle', 'Clearance', 'Storm']
quarters = ['First', 'Second', 'Third', 'Fourth']
def ago(t):
    s = int(time.time() - t)
    return f"{s // 60} min ago" if s >= 60 else f"{s} s ago"
for name, label in (('Save.save', 'last save'), ('Save_Backup.save', 'one before')):
    p = os.path.join(d, name)
    if not os.path.exists(p):
        continue
    t = os.path.getmtime(p)
    g = json.load(open(p, encoding='utf-8-sig'))['gameplay']
    print(f"💾 {label:<10} {time.strftime('%H:%M', time.localtime(t))} ({ago(t)}) — year {g['year']}, "
          f"{seasons[g['season']]} {quarters[g['quarter']]}")
log = os.path.join(d, 'Player.log')
if os.path.exists(log):
    cal = [l for l in open(log, errors='ignore') if l.startswith('[CAL] Moved to ')]
    if cal:
        y, s, q = cal[-1].strip().removeprefix('[CAL] Moved to ').split(':')
        print(f"🌦️ now        year {y}, {s} {q} (Player.log)")
EOF
