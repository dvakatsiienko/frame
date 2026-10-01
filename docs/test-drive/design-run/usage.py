#!/usr/bin/env python3
# usage.py <session-id>... — tokens, wall minutes and $ per designer session, subagents included
import glob, json, os, sys
from datetime import datetime

# $/MTok: input, output, cache read (docs/knowledge/models.md); cache writes 1.25x (5m) / 2x (1h) of input
PRICES = {'claude-opus-5-5': (4, 20, 0.20), 'claude-fable-5-1': (10, 50, 0.25), 'claude-sonnet-5-5': (2, 10, 0.20)}

def files(sid):
    root = os.path.expanduser('~/.claude/projects')
    return glob.glob(f'{root}/*/{sid}*.jsonl') + glob.glob(f'{root}/*/{sid}*/**/*.jsonl', recursive=True)

for sid in sys.argv[1:]:
    seen, rows, stamps = set(), {}, []
    for f in files(sid):
        for line in open(f):
            try: e = json.loads(line)
            except ValueError: continue
            if e.get('timestamp'): stamps.append(e['timestamp'])
            m = e.get('message') or {}
            u, mid = m.get('usage'), m.get('id')
            if not u or not mid or mid in seen: continue
            seen.add(mid)
            r = rows.setdefault(m.get('model', '?'), dict(inp=0, out=0, read=0, w5=0, w1h=0))
            cc = u.get('cache_creation') or {}
            w1h = cc.get('ephemeral_1h_input_tokens', 0)
            r['inp'] += u.get('input_tokens', 0); r['out'] += u.get('output_tokens', 0)
            r['read'] += u.get('cache_read_input_tokens', 0)
            r['w1h'] += w1h; r['w5'] += u.get('cache_creation_input_tokens', 0) - w1h
    t = sorted(stamps)
    mins = (datetime.fromisoformat(t[-1].replace('Z', '+00:00')) - datetime.fromisoformat(t[0].replace('Z', '+00:00'))).total_seconds() / 60 if t else 0
    total = 0.0
    for model, r in rows.items():
        pi, po, pr = PRICES.get(model, (0, 0, 0))
        usd = (r['inp'] * pi + r['out'] * po + r['read'] * pr + r['w5'] * pi * 1.25 + r['w1h'] * pi * 2) / 1e6
        total += usd
        print(f"{sid[:8]} · {model} · in {r['inp']/1e3:.1f}k · out {r['out']/1e3:.1f}k · cache write {(r['w5']+r['w1h'])/1e3:.0f}k · cache read {r['read']/1e6:.2f}M · ${usd:.2f}")
    print(f"{sid[:8]} · total ${total:.2f} · {mins:.1f} wall min")
