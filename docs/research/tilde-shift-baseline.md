---
dies-when: its findings are distilled into x:crew-tilde and FRM-368, or the tilde trial is dropped
---

# tilde research — clio's turns in the 2026-11-03 shift, by trigger

Ticket: FRM-368

The «before» number for moving lane coordination out of the main clio session. Measured, not estimated; unknown stays unknown.

## Source and window

- Timestamps in the jsonl are UTC: the first entry is `2026-11-03T08:01:26.855Z`, and `duckdb` shows the same instant as `10:01:26.855+02`. Window is 12:43:00Z to 17:28:00Z (14:43 to 19:28 local, UTC+2). Away part: 12:43Z to 14:12Z (14:43 to 16:12 local). Back part: 14:12Z to 17:28Z.
- Main session: `/Users/dima/.claude/projects/-Users-dima-frame--clio/668daff8-4fe5-4ffd-bd02-6a24361742ad.jsonl` (104,564,965 bytes, 2026-11-03 10:01 to 21:33 local). It is the only top-level jsonl in the dir with entries in the window (listing command below). Not a subagent: subagent transcripts live under `668daff8-.../subagents/` and are not counted, so their tokens are not in any number here.
- No compaction split the session across files: the 5 compactions are inside this one file (`compact_boundary` entries). Other files in the dir that mention the id: `96392cd0-...jsonl` (2026-11-04), outside the window.
- Deviation from the brief: the session's `cwd` is not a constant `/Users/dima/frame/_clio`. Its first entry has that cwd, but inside the window 5,662 raw lines (duplicates included) carry `/Users/dima/frame` and 2,782 carry `/Users/dima/frame/_clio` (rest: none or other subdirs). The file sits in the `_clio` project dir and nothing else qualifies, so I took it. Say so if the cwd rule was meant to exclude it.

Commands behind the source facts:

```
duckdb -json -c "select filename[-45:] f, count(*) n, min(timestamp) mn, max(timestamp) mx from read_json('*.jsonl', filename=true, format='newline_delimited', ignore_errors=true, maximum_object_size=100000000) group by 1 order by mn"   # run in the project dir
grep -l 668daff8 *.jsonl                      # which files mention the session id: 668daff8 itself and 96392cd0 (2026-11-04)
```

## Method

- Every number below comes from the script at the end of this file (`python3 -I baseline.py`), one pass over the main jsonl.
- The file repeats entries (rewrites after compaction: 7,796 uuids appear 2 to 5 times). Entries are deduped by `uuid`, first copy kept.
- One assistant API response is written as several entries (one per content block) with the same `message.id` and the same `usage` (0 mismatches found). Tokens are taken once per `message.id`. Tool calls are distinct `tool_use` block ids.
- A turn starts at each user-role entry that is not a `tool_result` (literal reading of the brief). It owns every assistant message up to the next turn start. That means context-only user entries (a skill body load after a slash command, a local-command caveat, stop-hook feedback) count as their own turns; the count of those with no assistant message of their own is printed under each table. Turns are counted by start time in the window; tokens and tool calls by assistant-message time in the window. «carry-in» is the few messages in the window that belong to a turn that started before 12:43Z.
- Tokens: `usage.output_tokens` and `usage.cache_read_input_tokens` of the assistant message. Percentages are the share of that table's total (whole window, away part, back part), per column.
- Classes are decided on the entry text and its `origin` field, first match wins:
  - member ping: `Another Claude session sent a message` / `origin.kind = peer` (cross-session message), sender not crow or helga. Includes the `clio (side)` session, which is neither a lane member nor crow/helga; it is counted here because it arrives as a peer message.
  - sidecar: the same peer message when `from-name` is crow or helga.
  - idle notice: text opening `[Cross-session idle notice]`, and the harness `<system-reminder>` «The session "..." you started ... finished a turn» or «ended its turn». The second form is my call: the brief names no class for it, and it is the harness telling clio a started session went idle. 25 of the 36 idle-notice turns are this form (table below), and it includes one entry tagged `origin.kind = human` (13:52:45Z) that is a system reminder, not a typed prompt.
  - watch or monitor: text opening `<task-notification>`. No pr-watch or ci-watch text appeared as its own trigger in the window.
  - keep-hot or waker: «The x-mod-stash plugin sent a message» with keep-hot or waker.
  - dima: `origin.kind = human`, not meta, not a system reminder.
  - other: everything else, split by form in the form table; the three quoted examples are the three largest forms.
- Context size: input_tokens + cache_read_input_tokens + cache_creation_input_tokens of the assistant message nearest the moment; the message before and after are given too.
- Compactions: distinct `system` entries with `subtype = compact_boundary` (the file holds 11 copies of 5 uuids). Per-day counts: distinct uuids over every top-level `*.jsonl` in the project dir, day = local date at UTC+2. Subagent transcripts were not scanned. The oldest file in the dir starts 2026-10-30, so 10-28, 10-29 and 10-31 have no data at all; their count is unknown, not 0.

## Things to know before using the numbers

- Dima typed during the «away» part: `/clio:shift` at 14:52 local and the keep-hot question at 15:37 local (crow's line at 13:19Z says he approved from mobile at 15:17). The away/back split is by the clock times given, not by his typing.
- A usage limit hit inside the window: the «Usage limit reached» note arrived at 16:03Z (18:03 local, class `other`) and the waker resumed the session at 17:00Z (class `keep-hot or waker`).- Subagent (Agent tool) token cost is outside these numbers; tool calls to launch them are inside.

## Results

### Whole window 12:43-17:28Z (14:43-19:28 local)

| class | turns | tool calls | output tokens | cache-read tokens |
|---|---|---|---|---|
| dima | 6 (5.1%) | 31 (4.1%) | 14,895 (4.7%) | 9,595,054 (4.4%) |
| member ping | 19 (16.1%) | 190 (25.1%) | 73,867 (23.4%) | 56,032,069 (25.7%) |
| idle notice | 36 (30.5%) | 132 (17.4%) | 58,735 (18.6%) | 49,365,587 (22.6%) |
| watch or monitor | 11 (9.3%) | 139 (18.3%) | 55,591 (17.6%) | 39,706,929 (18.2%) |
| keep-hot or waker | 2 (1.7%) | 16 (2.1%) | 6,949 (2.2%) | 5,239,919 (2.4%) |
| sidecar | 9 (7.6%) | 42 (5.5%) | 18,634 (5.9%) | 12,002,836 (5.5%) |
| other | 35 (29.7%) | 199 (26.3%) | 82,498 (26.2%) | 44,455,257 (20.4%) |
| carry-in | 0 (0.0%) | 9 (1.2%) | 3,976 (1.3%) | 1,579,978 (0.7%) |
| **total** | 118 | 758 | 315,145 | 217,977,629 |

Turns with no assistant message of their own (context-only entries): dima 2, idle notice 1, other 19

### Dima away: 12:43-14:12Z (14:43-16:12 local)

| class | turns | tool calls | output tokens | cache-read tokens |
|---|---|---|---|---|
| dima | 2 (3.2%) | 8 (2.1%) | 4,006 (2.6%) | 2,611,575 (2.2%) |
| member ping | 14 (22.2%) | 109 (28.8%) | 42,075 (27.2%) | 38,657,466 (32.4%) |
| idle notice | 19 (30.2%) | 94 (24.9%) | 40,286 (26.1%) | 34,399,748 (28.9%) |
| watch or monitor | 5 (7.9%) | 77 (20.4%) | 33,135 (21.4%) | 24,191,834 (20.3%) |
| keep-hot or waker | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) |
| sidecar | 7 (11.1%) | 35 (9.3%) | 14,770 (9.6%) | 9,153,726 (7.7%) |
| other | 16 (25.4%) | 46 (12.2%) | 16,399 (10.6%) | 8,574,893 (7.2%) |
| carry-in | 0 (0.0%) | 9 (2.4%) | 3,976 (2.6%) | 1,579,978 (1.3%) |
| **total** | 63 | 378 | 154,647 | 119,169,220 |

Turns with no assistant message of their own (context-only entries): dima 1, other 11

### Dima back: 14:12-17:28Z (16:12-19:28 local)

| class | turns | tool calls | output tokens | cache-read tokens |
|---|---|---|---|---|
| dima | 4 (7.3%) | 23 (6.1%) | 10,889 (6.8%) | 6,983,479 (7.1%) |
| member ping | 5 (9.1%) | 81 (21.3%) | 31,792 (19.8%) | 17,374,603 (17.6%) |
| idle notice | 17 (30.9%) | 38 (10.0%) | 18,449 (11.5%) | 14,965,839 (15.1%) |
| watch or monitor | 6 (10.9%) | 62 (16.3%) | 22,456 (14.0%) | 15,515,095 (15.7%) |
| keep-hot or waker | 2 (3.6%) | 16 (4.2%) | 6,949 (4.3%) | 5,239,919 (5.3%) |
| sidecar | 2 (3.6%) | 7 (1.8%) | 3,864 (2.4%) | 2,849,110 (2.9%) |
| other | 19 (34.5%) | 153 (40.3%) | 66,099 (41.2%) | 35,880,364 (36.3%) |
| **total** | 55 | 380 | 160,498 | 98,808,409 |

Turns with no assistant message of their own (context-only entries): dima 1, idle notice 1, other 8

### Turn forms inside each class (whole window)

| class | form | turns |
|---|---|---|
| dima | typed | 6 |
| member ping | peer msg | 19 |
| idle notice | started session finished/ended a turn | 25 |
| idle notice | cross-session idle notice | 11 |
| watch or monitor | task-notification | 11 |
| keep-hot or waker | keep-hot ping | 1 |
| keep-hot or waker | waker | 1 |
| sidecar | peer msg from helga | 5 |
| sidecar | peer msg from crow | 4 |
| other | skill body load | 13 |
| other | slash command line | 6 |
| other | stop-hook feedback | 5 |
| other | local-command caveat | 4 |
| other | compaction summary | 2 |
| other | local-command stdout | 2 |
| other | usage-limit note | 2 |
| other | image placeholder | 1 |

Three examples of `other` (local time, first 100 chars):

- 14:52:27, form "skill body load": `Base directory for this skill: /Users/dima/frame/_clio/plugin-clio/skills/shift  # /clio:shift <plan`
- 14:46:51, form "slash command line": `<command-name>/reload-skills</command-name>             <command-message>reload-skills</command-mess`
- 15:36:07, form "stop-hook feedback": `Stop hook feedback: 🌤️ siesta due: 3 member done ping(s) — load clio:siesta`

Typed prompts by dima (local time, first 80 chars):

- 14:52:27: `<command-message>clio:shift</command-message> <command-name>/clio:shift</command`
- 15:37:31: `I enabled keep hot mode for everyone before IFK. A question for you now: can you`
- 16:39:47: `* 💡 mod idea: a 🔥 row per '--bg' member on the fleet board, so you can flip them`
- 16:41:28: `pk-313 ← Can we shape and sign it now?`
- 16:44:10: `sign`
- 19:10:16: `note: keep-hot did not worked for sixth sense: mods lane 4 | main. i watched his`

### Context size (input + cache_read + cache_creation, nearest assistant message)

- start 12:43:00Z: 311,688 tokens at 12:43:03.981Z
- end 17:28:00Z: 303,329 tokens at 17:27:54.265Z
- last message before the start: 310,379 tokens at 12:42:40.893Z
- first message at/after the end: 305,024 tokens at 17:28:57.386Z

### Compactions in the window

2 in window: 13:55:52Z (manual, preTokens 606,120, postTokens 53,363); 17:14:41Z (manual, preTokens 514,922, postTokens 49,424)

All in this file: 10:02:30Z, 12:27:04Z, 13:55:52Z, 17:14:41Z, 19:08:11Z

### Compactions per local day (UTC+2), all top-level sessions in the project dir

| day | raw jsonl lines timestamped that day | compactions |
|---|---|---|
| 2026-10-28 | 0 | unknown (no entries) |
| 2026-10-29 | 0 | unknown (no entries) |
| 2026-10-30 | 10225 | 2 |
| 2026-10-31 | 0 | unknown (no entries) |
| 2026-11-01 | 7877 | 1 |
| 2026-11-02 | 15303 | 3 |
| 2026-11-03 | 33121 | 5 |

Checks: usage mismatches across entries of one message id: 0; messages: 1705; turns in file: 322.

## Script (`python3 -I baseline.py`)

```python
"""Baseline for the 2026-11-03 shift: per-trigger turns, tool calls, output and cache-read tokens
of the main clio session. Run: python3 -I baseline.py   (prints markdown to stdout)"""
import collections
import datetime
import glob
import json
import os
import re

DIR = os.path.expanduser('~/.claude/projects/-Users-dima-frame--clio')
MAIN = DIR + '/668daff8-4fe5-4ffd-bd02-6a24361742ad.jsonl'
W0 = '2026-11-03T12:43:00'  # 14:43 local, UTC+2
W1 = '2026-11-03T17:28:00'  # 19:28 local
AWAY_END = '2026-11-03T14:12:00'  # 16:12 local
CLASSES = ['dima', 'member ping', 'idle notice', 'watch or monitor', 'keep-hot or waker', 'sidecar', 'other']


def load(path):
    seen, out = set(), []
    for line in open(path):
        r = json.loads(line)
        u = r.get('uuid')
        if u:
            if u in seen:
                continue
            seen.add(u)
        out.append(r)
    return out


def text_of(r):
    c = r['message']['content']
    if isinstance(c, str):
        return c
    return ' '.join(x.get('text', '') for x in c if x.get('type') == 'text')


def is_tool_result(r):
    c = r['message']['content']
    return not isinstance(c, str) and any(x.get('type') == 'tool_result' for x in c)


def classify(r):
    t = text_of(r).lstrip()
    o = r.get('origin') or {}
    m = re.search(r'from-name="([^"]*)"', t[:400])
    if t.startswith('Another Claude session sent a message') or t.startswith('<teammate-message') or o.get('kind') == 'peer':
        name = m.group(1) if m else ''
        if 'crow' in name or 'helga' in name:
            return 'sidecar', 'peer msg from ' + ('crow' if 'crow' in name else 'helga')
        return 'member ping', 'peer msg'
    if t.startswith('[Cross-session idle notice]'):
        return 'idle notice', 'cross-session idle notice'
    if t.startswith('<system-reminder>') and re.search(r'The session ".*" you started .* (finished a turn|ended its turn)', t[:600]):
        return 'idle notice', 'started session finished/ended a turn'
    if t.startswith('<task-notification>'):
        return 'watch or monitor', 'task-notification'
    if t.startswith('The x-mod-stash plugin sent a message:') and ('keep-hot' in t[:200] or 'waker' in t[:200]):
        return 'keep-hot or waker', 'keep-hot ping' if 'keep-hot' in t[:200] else 'waker'
    if o.get('kind') == 'human' and not r.get('isMeta') and not t.startswith('<system-reminder>'):
        return 'dima', 'typed'
    first = t.split('\n')[0][:48]
    if r.get('isCompactSummary'):
        sub = 'compaction summary'
    elif t.startswith('<local-command-caveat>'):
        sub = 'local-command caveat'
    elif t.startswith('<command-name>'):
        sub = 'slash command line'
    elif t.startswith('<local-command-stdout>'):
        sub = 'local-command stdout'
    elif t.startswith('<command-message>'):
        sub = 'slash command line'
    elif t.startswith('Base directory for this skill') or t.startswith('(Re-invocation'):
        sub = 'skill body load'
    elif t.startswith('Stop hook feedback'):
        sub = 'stop-hook feedback'
    elif t.startswith('[Usage limit') or t.startswith('[Earlier usage-limit'):
        sub = 'usage-limit note'
    elif t.startswith('[Image'):
        sub = 'image placeholder'
    else:
        sub = 'UNSORTED: ' + first
    return 'other', sub


def tools_in(m):
    return [b['id'] for b in m['content'] if b.get('type') == 'tool_use']


def ctx(u):
    return u.get('input_tokens', 0) + u.get('cache_read_input_tokens', 0) + u.get('cache_creation_input_tokens', 0)


rows = load(MAIN)
rows.sort(key=lambda r: r.get('timestamp') or '')  # stable; file is already near-chronological
# turns over the whole file; assistant messages deduped by message.id
turns = []  # dict(ts, cls, sub, text)
cur = None
msgs = {}  # id -> dict(ts, out, cr, ctx, tools, turn)
usage_mismatch = 0
for r in rows:
    ty = r.get('type')
    if ty == 'user' and not is_tool_result(r):
        cls, sub = classify(r)
        cur = {'ts': r['timestamp'], 'cls': cls, 'sub': sub, 'text': text_of(r), 'n_asst': 0}
        turns.append(cur)
    elif ty == 'assistant':
        m = r['message']
        mid = m.get('id') or r['uuid']
        u = m.get('usage') or {}
        if mid in msgs:
            e = msgs[mid]
            if (u.get('output_tokens', 0), u.get('cache_read_input_tokens', 0)) != (e['out'], e['cr']):
                usage_mismatch += 1
            e['tools'] |= set(tools_in(m))
            continue
        msgs[mid] = {'ts': r['timestamp'], 'out': u.get('output_tokens', 0), 'cr': u.get('cache_read_input_tokens', 0),
                     'ctx': ctx(u), 'tools': set(tools_in(m)), 'turn': cur}
        if cur:
            cur['n_asst'] += 1


def part_of(ts):
    return 'away' if ts[:19] < AWAY_END else 'back'


def inwin(ts):
    return W0 <= ts[:19] < W1


def agg(part):
    d = {c: dict(turns=0, empty=0, tools=0, out=0, cr=0) for c in CLASSES + ['carry-in']}
    for t in turns:
        if inwin(t['ts']) and part in ('all', part_of(t['ts'])):
            d[t['cls']]['turns'] += 1
            if t['n_asst'] == 0:
                d[t['cls']]['empty'] += 1
    for e in msgs.values():
        if not inwin(e['ts']) or not (part == 'all' or part == part_of(e['ts'])):
            continue
        t = e['turn']
        c = 'carry-in' if (t is None or not inwin(t['ts'])) else t['cls']
        d[c]['tools'] += len(e['tools'])
        d[c]['out'] += e['out']
        d[c]['cr'] += e['cr']
    return d


def table(part):
    d = agg(part)
    tot = {k: sum(v[k] for v in d.values()) for k in ('turns', 'tools', 'out', 'cr')}
    L = ['| class | turns | tool calls | output tokens | cache-read tokens |', '|---|---|---|---|---|']
    pc = lambda x, y: '%.1f%%' % (100 * x / y) if y else 'n/a'
    for c in CLASSES + ['carry-in']:
        v = d[c]
        if c == 'carry-in' and not any(v[k] for k in ('turns', 'tools', 'out', 'cr')):
            continue
        L.append('| %s | %d (%s) | %d (%s) | %s (%s) | %s (%s) |' % (
            c, v['turns'], pc(v['turns'], tot['turns']), v['tools'], pc(v['tools'], tot['tools']),
            format(v['out'], ','), pc(v['out'], tot['out']), format(v['cr'], ','), pc(v['cr'], tot['cr'])))
    L.append('| **total** | %d | %d | %s | %s |' % (tot['turns'], tot['tools'], format(tot['out'], ','), format(tot['cr'], ',')))
    return '\n'.join(L), d


def local(ts):
    return (datetime.datetime.fromisoformat(ts.replace('Z', '+00:00')) + datetime.timedelta(hours=2)).strftime('%Y-%m-%d %H:%M:%S')


out = []
for part, title in (('all', 'Whole window 12:43-17:28Z (14:43-19:28 local)'),
                    ('away', 'Dima away: 12:43-14:12Z (14:43-16:12 local)'),
                    ('back', 'Dima back: 14:12-17:28Z (16:12-19:28 local)')):
    tb, d = table(part)
    out.append('### ' + title + '\n\n' + tb + '\n')
    out.append('Turns with no assistant message of their own (context-only entries): ' +
               ', '.join('%s %d' % (c, d[c]['empty']) for c in CLASSES if d[c]['empty']) + '\n')

# sub-breakdowns
sub = collections.Counter()
ex = collections.defaultdict(list)
for t in turns:
    if inwin(t['ts']):
        k = (t['cls'], t['sub'])
        sub[k] += 1
        if len(ex[k]) < 3:
            ex[k].append((local(t['ts'])[11:], t['text'].replace('\n', ' ')[:100]))
out.append('### Turn forms inside each class (whole window)\n')
out.append('| class | form | turns |\n|---|---|---|')
for (c, s), n in sorted(sub.items(), key=lambda kv: (CLASSES.index(kv[0][0]), -kv[1])):
    out.append('| %s | %s | %d |' % (c, s, n))
out.append('\nThree examples of `other` (local time, first 100 chars):\n')
shown = 0
for (c, s), n in sorted(sub.items(), key=lambda kv: -kv[1]):
    if c == 'other' and shown < 3:
        tm, tx = ex[(c, s)][0]
        out.append('- %s, form "%s": `%s`' % (tm, s, tx.replace('`', "'")))
        shown += 1
out.append('')
out.append('Typed prompts by dima (local time, first 80 chars):\n')
for t in turns:
    if inwin(t['ts']) and t['cls'] == 'dima':
        out.append('- %s: `%s`' % (local(t['ts'])[11:], t['text'].replace('\n', ' ').replace('`', "'")[:80]))
out.append('')

# context size
asst = sorted(((e['ts'], e['ctx']) for e in msgs.values() if e['ctx']), key=lambda x: x[0])


def nearest(ts):
    t0 = datetime.datetime.fromisoformat(ts + '+00:00')
    return min(asst, key=lambda a: abs(datetime.datetime.fromisoformat(a[0].replace('Z', '+00:00')) - t0))


out.append('### Context size (input + cache_read + cache_creation, nearest assistant message)\n')
for lab, ts in (('start 12:43:00Z', W0), ('end 17:28:00Z', W1)):
    a = nearest(ts)
    out.append('- %s: %s tokens at %sZ' % (lab, format(a[1], ','), a[0][11:23]))
pre = [a for a in asst if a[0][:19] < W0][-1]
out.append('- last message before the start: %s tokens at %sZ' % (format(pre[1], ','), pre[0][11:23]))
post = [a for a in asst if a[0][:19] >= W1][0]
out.append('- first message at/after the end: %s tokens at %sZ' % (format(post[1], ','), post[0][11:23]))
out.append('')

# compactions
cb = {}
for r in rows:
    if r.get('subtype') == 'compact_boundary':
        cb[r['uuid']] = r
out.append('### Compactions in the window\n')
inw = [r for r in cb.values() if inwin(r['timestamp'])]
out.append('%d in window: ' % len(inw) + '; '.join('%sZ (%s, preTokens %s, postTokens %s)' % (
    r['timestamp'][11:19], r['compactMetadata']['trigger'], format(r['compactMetadata']['preTokens'], ','),
    format(r['compactMetadata']['postTokens'], ',')) for r in sorted(inw, key=lambda r: r['timestamp'])))
out.append('\nAll in this file: ' + ', '.join(r['timestamp'][11:19] + 'Z' for r in sorted(cb.values(), key=lambda r: r['timestamp'])) + '\n')

# per day, all sessions in the project dir (top-level jsonl; distinct compact_boundary uuid, local day UTC+2)
perday = collections.defaultdict(set)
alldays = collections.Counter()
for p in sorted(glob.glob(DIR + '/*.jsonl')):
    for line in open(p):
        if '"compact_boundary"' in line or True:
            r = json.loads(line)
            ts = r.get('timestamp')
            if ts:
                alldays[local(ts)[:10]] += 1
            if r.get('subtype') == 'compact_boundary':
                perday[local(r['timestamp'])[:10]].add(r['uuid'])
out.append('### Compactions per local day (UTC+2), all top-level sessions in the project dir\n')
out.append('| day | raw jsonl lines timestamped that day | compactions |\n|---|---|---|')
for i in range(7):
    day = (datetime.date(2026, 10, 28) + datetime.timedelta(days=i)).isoformat()
    out.append('| %s | %d | %s |' % (day, alldays.get(day, 0), len(perday[day]) if alldays.get(day) else 'unknown (no entries)'))
out.append('')
out.append('Checks: usage mismatches across entries of one message id: %d; messages: %d; turns in file: %d.' % (usage_mismatch, len(msgs), len(turns)))
print('\n'.join(out))
```
