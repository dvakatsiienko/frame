#!/usr/bin/python3
# rename-asks-count.py <since YYYY-MM-DD> <out file>: dima's prompts with a rename word, deduped across resumed copies
# a floor: a plain «what is X?» and a slash command's args hold no counted rename word. stamps are local time
# the _clio/memory/_reminders.md recount line owns this script
import glob, json, os, re, sys
from datetime import datetime

since, out = sys.argv[1], sys.argv[2]
since_epoch = datetime.fromisoformat(since).timestamp()
rename_word = re.compile(r"\brenam|\bbetter names?\b|\bname battle\b|\bnames? for\b|\bfamily-first\b|\btop ?(7|seven|5)\b[^.\n]{0,40}\bnames?\b", re.I)
not_his = ('<cross-session', '<command-', '<local-command', '<task-notification', 'Caveat:', 'This session is being continued', '<side-sessions', '<ci-monitor', 'Another Claude session')
reminder = re.compile(r"<system-reminder[^>]*>.*?</system-reminder[^>]*>", re.S)


def local(stamp):
    return datetime.fromisoformat(stamp.replace('Z', '+00:00')).astimezone().strftime('%Y-%m-%dT%H:%M')


# a resumed copy keeps its text and its stamp, so the pair is one prompt; the same words on another day are two
prompts = set()
for path in glob.glob(os.path.expanduser('~/.claude/projects/**/*.jsonl'), recursive=True):
    if '/subagents/' in path or os.path.getmtime(path) < since_epoch:
        continue
    for line in open(path, errors='ignore'):
        if '"type":"user"' not in line and '"queued_command"' not in line:
            continue
        try:
            entry = json.loads(line)
        except ValueError:
            continue
        stamp = entry.get('timestamp', '')
        # a prompt typed mid-turn lands as a queued_command attachment, not a user entry
        queued = entry.get('attachment', {}) if entry.get('type') == 'attachment' else {}
        is_queued = queued.get('type') == 'queued_command' and queued.get('commandMode') == 'prompt'
        if not (is_queued or entry.get('type') == 'user') or entry.get('isSidechain') or entry.get('isMeta') or not stamp:
            continue
        when = local(stamp)
        if when[:10] < since:
            continue
        content = queued.get('prompt') if is_queued else entry.get('message', {}).get('content')
        if isinstance(content, list):
            if any(isinstance(b, dict) and b.get('type') == 'tool_result' for b in content):
                continue
            content = ' '.join(b.get('text', '') for b in content if isinstance(b, dict))
        if not isinstance(content, str):
            continue
        text = reminder.sub('', content).strip()
        if text and not text.startswith(not_his):
            prompts.add((when, text))

hits = sorted(p for p in prompts if rename_word.search(p[1]))
with open(out, 'w') as handle:
    for when, text in hits:
        match = rename_word.search(text)
        handle.write(f"{when} | {text[max(match.start() - 110, 0):match.end() + 130]!r}\n")
print(f"{len(prompts)} prompts since {since}, {len(hits)} with a rename word: {out}")
