#!/usr/bin/env python3
# PermissionRequest on Bash: cc asks even in bypassPermissions when its parser cannot read a command (a zsh
# `${(j:,:)a}` flag), and an unattended session then waits ~2 min for a deny (FRM-684, probed 2026-11-22).
# allows only a Bash call in bypass whose text holds no deletion or truncation shape; anything else prints
# nothing and exits 0, so cc's own dialog stands. x-mod-guard still refuses at PreToolUse before this runs.
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

LOG = Path(os.environ.get("PERMISSION_ALLOW_LOG") or Path.home() / ".claude/shelf/permission-request-allows.jsonl")

# dima's list (rm, trash, find -delete, kill, git reset, git clean, a > truncation) plus the four cc itself names as deleting
DELETES = re.compile(
    r"\b(?:rm|rmdir|unlink|shred|truncate|trash|kill|pkill|killall)\b"
    r"|\bfind\b.*-delete\b"
    r"|\bgit\b[^;&|\n]*\b(?:reset|clean)\b",
    re.DOTALL,
)
# the `>` forms that cannot truncate a file: append, fd duplication, /dev/null
HARMLESS_REDIRECT = re.compile(r"\d*>>|&>>|\d*>&\d*-?|&?\d*>\s*/dev/null(?![\w./-])")


def allowed(payload: dict) -> bool:
    if payload.get("tool_name") != "Bash" or payload.get("permission_mode") != "bypassPermissions":
        return False
    command = payload.get("tool_input", {}).get("command", "")
    return bool(command) and not DELETES.search(command) and ">" not in HARMLESS_REDIRECT.sub("", command)


payload = json.load(sys.stdin)
if allowed(payload):
    try:
        LOG.parent.mkdir(parents=True, exist_ok=True)
        with LOG.open("a") as log:
            log.write(
                json.dumps(
                    {
                        "time": datetime.now().astimezone().isoformat(timespec="seconds"),
                        "session": payload.get("session_id", ""),
                        "command": payload["tool_input"]["command"][:120],
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )
    except OSError:
        pass
    json.dump(
        {"hookSpecificOutput": {"hookEventName": "PermissionRequest", "decision": {"behavior": "allow"}}},
        sys.stdout,
    )
