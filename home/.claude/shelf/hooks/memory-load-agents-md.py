#!/usr/bin/env python3
# PreToolUse on Read/Edit/Write/Bash: a file outside this session's project gets its repo's AGENTS.md
# chain injected once per session; a Bash call counts each plain path argument that exists (dima, 2026-10-12:
# «a bash cat would also trigger it»). a compaction empties the marks (memory-load-rule-lazy's forget), so the
# next touch attaches again. cc loads memory only upward from the launch dir and lazily
# below it (code.claude.com/docs/en/memory), so a session that travels into another repo edits
# there blind — a bytes edit from a frame session never saw bytes' rules (dima, 2026-09-28).
import json
import os
import re
import shlex
import sys
import tempfile

MEMORY = ("CLAUDE.md", "AGENTS.md")
IMPORT = re.compile(r"^@(\S+)\s*$", re.M)
INLINE_CAP = 8_000

event = json.load(sys.stdin)
tool_input = event.get("tool_input") or {}
cwd = event.get("cwd") or ""
project = os.path.realpath(os.environ.get("CLAUDE_PROJECT_DIR") or cwd)
home = os.path.realpath(os.path.expanduser("~"))


def bash_paths(command):
    # every word after a command's name that names a path on disk — plain words only, nothing expanded or run
    try:
        lexer = shlex.shlex(command, posix=True, punctuation_chars=True)
        lexer.whitespace_split = True
        words = list(lexer)
    except ValueError:
        return []
    paths, is_name = [], True
    for w in words:
        if w and set(w) <= set("|&;()<>"):
            is_name = w not in "<>" and w not in (">>", "&>", "2>")
            continue
        if is_name:
            is_name = False
            continue
        if not w.startswith("-") and ("/" in w or w.startswith("~")):
            path = os.path.join(cwd, os.path.expanduser(w))
            if os.path.exists(path):
                paths.append(path)
    return paths


raw = bash_paths(str(tool_input.get("command", ""))) if event.get("tool_name") == "Bash" else [tool_input.get("file_path") or ""]
targets = [os.path.realpath(os.path.expanduser(t)) for t in raw if t]
if not targets or not project:
    sys.exit(0)


def within(path, root):
    return path == root or path.startswith(root + os.sep)


# the dirs between each file and home, nearest first; a dir argument counts itself; the project's own ancestors
# are loaded at launch
dirs = []
for target in targets:
    if within(target, project):
        continue
    here = target if os.path.isdir(target) else os.path.dirname(target)
    while within(here, home) and here != home:
        if not within(project, here) and here not in dirs:
            dirs.append(here)
        here = os.path.dirname(here)

state_dir = os.path.join(tempfile.gettempdir(), "cc-memory-load-agents-md")
os.makedirs(state_dir, exist_ok=True)
state = os.path.join(state_dir, event.get("session_id", "none"))
seen = set(open(state).read().split("\n")) if os.path.exists(state) else set()
# the user memory is loaded already; frame's home/.claude/CLAUDE.md is that same file behind the symlink
seen.add(os.path.realpath(os.path.join(home, ".claude", "CLAUDE.md")))


def body(path):
    text = open(path, encoding="utf-8", errors="replace").read()
    base = os.path.dirname(path)

    def expand(m):
        ref = os.path.realpath(os.path.join(base, os.path.expanduser(m.group(1))))
        return open(ref, encoding="utf-8", errors="replace").read() if os.path.isfile(ref) else m.group(0)

    return IMPORT.sub(expand, text)


fresh = []
for d in reversed(dirs):
    found = next((os.path.realpath(os.path.join(d, n)) for n in MEMORY if os.path.isfile(os.path.join(d, n))), None)
    if found and found not in seen:
        fresh.append(found)

if not fresh:
    sys.exit(0)

with open(state, "a") as f:
    f.write("\n".join(fresh) + "\n")

head = (
    f"memory for {os.path.dirname(fresh[0])} — outside this session's project, so cc did not load it. "
    "binding for any work under that path (memory-load-agents-md, once per session)"
)
parts = [f"{head}:"] + [f"\n=== {p} ===\n{body(p)}" for p in fresh]
# the harness moves a big additionalContext to a file and shows a 2 kB preview (29 kB measured, 2026-09-28)
if len("\n".join(parts)) > INLINE_CAP:
    parts = [f"{head}. too long to inline — Read each file below before the edit:"] + [f"- {p}" for p in fresh]
json.dump(
    {"hookSpecificOutput": {"hookEventName": "PreToolUse", "additionalContext": "\n".join(parts)}},
    sys.stdout,
)
