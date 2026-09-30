# LSP tool use across session transcripts, beside the grep it could replace
# usage: python3 docs/vet/ts-lsp/usage.py [since YYYY-MM-DD, default 2026-09-30]
import collections, json, pathlib, re, sys

since = sys.argv[1] if len(sys.argv) > 1 else '2026-09-30'
grep_re = re.compile(r'(^|[\s|;&(])(rg|grep|ugrep)\s')
rows, total_ops, total_grep = [], collections.Counter(), 0

for path in pathlib.Path.home().joinpath('.claude/projects').glob('*/*.jsonl'):
    ops, greps, first = collections.Counter(), 0, None
    for line in path.open(errors='ignore'):
        try:
            entry = json.loads(line)
        except ValueError:
            continue
        stamp = entry.get('timestamp', '')
        if stamp[:10] < since:
            continue
        first = first or stamp[:16]
        content = (entry.get('message') or {}).get('content')
        for block in content if isinstance(content, list) else []:
            if not isinstance(block, dict) or block.get('type') != 'tool_use':
                continue
            name, args = block.get('name', ''), block.get('input') or {}
            if name == 'LSP':
                ops[args.get('operation')] += 1
            elif name == 'Grep' or (name == 'Bash' and grep_re.search(args.get('command', ''))):
                greps += 1
    if ops or greps:
        rows.append((first, path.parent.name.replace('-Users-dima-', '~/'), path.stem[:8], sum(ops.values()), greps, dict(ops)))
        total_ops.update(ops)
        total_grep += greps

for first, project, session, lsp, greps, ops in sorted(rows):
    print(f'{first} · {project} · {session} · lsp {lsp} · grep {greps}' + (f' · {ops}' if ops else ''))
print(f'\nsince {since}: {len(rows)} sessions · lsp {sum(total_ops.values())} {dict(total_ops)} · grep {total_grep}')
