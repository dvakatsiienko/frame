#!/usr/bin/env python3
# of the sessions that really edited a kind of source file, how many reached its guide or shelf file first.
# a refused or failed call changed no file, so it is no edit: refuse, load, retry counts as loaded first.
import argparse
import glob
import json
import os
import time

KINDS = {
    "ts": ((".ts", ".tsx"), ("x:guide-typescript", "x:guide-code")),
    "go": ((".go",), ("x:guide-go", "go-charm")),
}


def entries(path):
    for raw in open(path, encoding="utf-8", errors="replace"):
        if '"tool_use"' in raw or '"is_error"' in raw:
            try:
                yield json.loads(raw)
            except json.JSONDecodeError:
                continue


def blocks(entry):
    content = (entry.get("message") or {}).get("content") if isinstance(entry, dict) else None
    return [b for b in content if isinstance(b, dict)] if isinstance(content, list) else []


def first_edits(path):
    failed = {b.get("tool_use_id") for e in entries(path) for b in blocks(e) if b.get("type") == "tool_result" and b.get("is_error")}
    reached, first = set(), {}
    for entry in entries(path):
        if entry.get("type") != "assistant":
            continue
        for block in blocks(entry):
            if block.get("type") != "tool_use":
                continue
            name, tool_input = block.get("name"), block.get("input") or {}
            # the 47 % baseline counted a Skill call, or a Read or Bash that reached the file, the same way
            if name in ("Skill", "Read", "Bash") and block.get("id") not in failed:
                text = str(tool_input.get("skill", "")) if name == "Skill" else json.dumps(tool_input)
                reached.update(door for _extensions, doors in KINDS.values() for door in doors if door.removeprefix("x:") in text)
            if name in ("Edit", "Write", "MultiEdit") and block.get("id") not in failed:
                path_edited = str(tool_input.get("file_path", ""))
                for kind, (extensions, _doors) in KINDS.items():
                    if path_edited.endswith(extensions):
                        first.setdefault(kind, set(reached))
    return first


def main():
    parser = argparse.ArgumentParser(description="share of sessions that reached the guide before the first real edit")
    parser.add_argument("--days", type=int, default=14)
    parser.add_argument("--transcript", help="one transcript instead of the last --days of main sessions")
    args = parser.parse_args()
    since = time.time() - args.days * 86400
    paths = [args.transcript] if args.transcript else [
        p for p in glob.glob(os.path.expanduser("~/.claude/projects/*/*.jsonl")) if os.path.getmtime(p) >= since
    ]
    firsts = [first_edits(p) for p in paths]
    for kind, (_extensions, doors) in KINDS.items():
        sessions = [f[kind] for f in firsts if kind in f]
        for door in doors:
            hits = sum(door in reached for reached in sessions)
            share = f" ({100 * hits / len(sessions):.0f} %)" if sessions else ""
            print(f"{door} before the first {kind} edit: {hits}/{len(sessions)}{share}")


if __name__ == "__main__":
    main()
