#!/usr/bin/python3
# rename-asks-count.py <since YYYY-MM-DD> <out file>: dima's prompts with a rename word, deduped across resumed copies
# a floor: a plain «what is X?» holds no rename word. the _clio/memory/_reminders.md recount line owns this script
import glob, json, os, re, sys

since, out = sys.argv[1], sys.argv[2]
rename_word = re.compile(r"\brenam|\bbetter names?\b|\bname battle\b|\bnames? for\b|\bfamily-first\b|\btop ?(7|seven|5)\b[^.\n]{0,40}\bnames?\b", re.I)
not_his = ('<cross-session', '<command-', '<local-command', '<task-notification', 'Caveat:', 'This session is being continued', '<side-sessions', '<ci-monitor', 'Another Claude session')
reminder = re.compile(r"<system-reminder[^>]*>.*?</system-reminder[^>]*>", re.S)

prompts = {}
for path in glob.glob(os.path.expanduser('~/.claude/projects/**/*.jsonl'), recursive=True):
    if '/subagents/' in path or os.path.getmtime(path) < 0:
        continue
    for line in open(path, errors='ignore'):
        if '"type":"user"' not in line or len(line) > 200000:
            continue
        try:
            entry = json.loads(line)
        except ValueError:
            continue
        stamp = entry.get('timestamp', '')
        if entry.get('type') != 'user' or entry.get('isSidechain') or entry.get('isMeta') or stamp[:10] < since:
            continue
        content = entry.get('message', {}).get('content')
        if isinstance(content, list):
            if any(isinstance(b, dict) and b.get('type') == 'tool_result' for b in content):
                continue
            content = ' '.join(b.get('text', '') for b in content if isinstance(b, dict))
        if not isinstance(content, str):
            continue
        text = reminder.sub('', content).strip()
        if text and not text.startswith(not_his):
            prompts.setdefault(text[:400], stamp)

hits = sorted((stamp, text) for text, stamp in prompts.items() if rename_word.search(text))
with open(out, 'w') as handle:
    for stamp, text in hits:
        match = rename_word.search(text)
        handle.write(f"{stamp[:16]} | {text[max(match.start() - 110, 0):match.end() + 130]!r}\n")
print(f"{len(prompts)} prompts since {since}, {len(hits)} with a rename word: {out}")
