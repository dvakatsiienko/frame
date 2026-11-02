#!/usr/bin/env python3
# tags every steam game dima owns with its store platforms (mac / windows / linux)
# usage: steam-platforms.py [--mac | --windows-only]   default: print the summary only
# pulls the library through trophy-sys-cli.sh, then one store appdetails call per new appid.
# resumable: results cache in ~/.local/share/firelink/steam-platforms.json, so a rerun only asks
# for games added since. a full first run is ~15 min (1.6 s per call keeps the store from throttling).
# a mac flag means a macOS build exists, not that it is apple-silicon native.
import json, os, subprocess, sys, time, urllib.request

here = os.path.dirname(os.path.abspath(__file__))
data = os.path.expanduser('~/.local/share/firelink')
os.makedirs(data, exist_ok=True)
lib_path, cache_path = f'{data}/steam-games.json', f'{data}/steam-platforms.json'

subprocess.run([f'{here}/trophy-sys-cli.sh', 'steam-games', '--out', lib_path], check=True, stdout=subprocess.DEVNULL)
games = json.load(open(lib_path))
cache = json.load(open(cache_path)) if os.path.exists(cache_path) else {}

for g in games:
    aid = g['id']
    if cache.get(aid, {}).get('ok'):
        cache[aid]['playSeconds'] = g.get('playSeconds')
        continue
    url = f'https://store.steampowered.com/api/appdetails?appids={aid}&filters=platforms,basic'
    r = None
    for _ in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'firelink-script/1.0'})
            r = json.load(urllib.request.urlopen(req, timeout=20))
            break
        except Exception:
            time.sleep(30)
    entry = (r or {}).get(aid) or {}
    d = entry.get('data') or {}
    cache[aid] = {'name': g['name'], 'ok': entry.get('success', False), 'platforms': d.get('platforms'),
                  'type': d.get('type'), 'playSeconds': g.get('playSeconds')}
    json.dump(cache, open(cache_path, 'w'))
    time.sleep(1.6)

json.dump(cache, open(cache_path, 'w'))
owned = {g['id'] for g in games}
rows = {k: v for k, v in cache.items() if k in owned}
failed = [v['name'] for v in rows.values() if not v['ok']]
kept = {k: v for k, v in rows.items() if v['ok'] and v['type'] == 'game'}
mac = {k: v for k, v in kept.items() if v['platforms'].get('mac')}
print(f'{len(rows)} apps, {len(failed)} store lookups failed, {len(kept)} games: {len(mac)} with a mac build, {len(kept) - len(mac)} windows/linux only')
if failed:
    print('failed (delisted or region):', ', '.join(failed))
pick = {'--mac': mac, '--windows-only': {k: v for k, v in kept.items() if k not in mac}}.get(sys.argv[1] if len(sys.argv) > 1 else '')
for k, v in sorted((pick or {}).items(), key=lambda kv: kv[1]['name'].lower()):
    print(k, round((v['playSeconds'] or 0) / 3600, 1), v['name'], sep='\t')
