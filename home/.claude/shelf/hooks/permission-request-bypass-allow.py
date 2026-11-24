#!/usr/bin/env python3
# PermissionRequest on Bash: cc asks even in bypassPermissions when its parser cannot read a command (a zsh
# `${(j:,:)a}` flag), and an unattended session then waits ~2 min for a deny (FRM-684, probed 2026-11-22).
# a Bash call in bypass is always answered: allowed when its text holds no deletion or truncation shape, else
# denied with the script-file door, so no member waits on a press (the mods codie stood 9 min, 2026-11-24).
# any other mode or tool prints nothing, so cc's own dialog stands. x-mod-guard still refuses at PreToolUse.
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


# a truncation may move to a script file; a delete may not, since x-mod-guard does not read a script run by path
SCRIPT_DOOR = (
    "cc could not parse this Bash call, and its text holds a `>` that can truncate a file, so it is refused "
    "instead of waiting on a dialog nobody watches. Write the lines to a script file in your scratchpad "
    "(the Write tool) and run it by path; nothing else changes."
)
DELETE_DOOR = (
    "cc could not parse this Bash call, and its text holds a delete, kill or git reset/clean shape, so it is "
    "refused instead of waiting on a dialog nobody watches. Not through a script file either: run that one "
    "step as its own plain command (`trash <path>`, a kill of a pid you captured), so the guard reads it, or "
    "ask your coordinator with the target named. The rest of the lines may go in a script file run by path."
)


# None leaves cc's dialog standing: only a Bash call in bypass is answered here
def answer(payload: dict) -> str | None:
    if payload.get("tool_name") != "Bash" or payload.get("permission_mode") != "bypassPermissions":
        return None
    command = payload.get("tool_input", {}).get("command", "")
    if not command:
        return None
    if DELETES.search(command):
        return DELETE_DOOR
    return SCRIPT_DOOR if ">" in HARMLESS_REDIRECT.sub("", command) else "allow"


payload = json.load(sys.stdin)
behavior = answer(payload)
if behavior not in (None, "allow"):
    json.dump(
        {
            "hookSpecificOutput": {
                "hookEventName": "PermissionRequest",
                "decision": {"behavior": "deny", "message": behavior, "interrupt": False},
            }
        },
        sys.stdout,
    )
if behavior == "allow":
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
