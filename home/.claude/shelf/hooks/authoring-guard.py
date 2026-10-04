#!/usr/bin/env python3
# PreToolUse on Write/Edit/MultiEdit: an agent-consumed document (a skill, an AGENTS.md / CLAUDE.md,
# a rule, a command, a memory leaf) is written only after `writing-for-agents` loaded this session.
# the path-scoped `authoring-trigger` rule fires on Read only, so a fresh write got no reminder
# (two sightings, 2026-09-29 flawlog). refused once; loading the skill clears it.
import json
import re
import sys

AGENT_DOC = re.compile(r"(/|^)(CLAUDE\.md|AGENTS\.md|SKILL\.md)$|/commands/[^/]+\.md$|/rules/[^/]+\.md$|/memory/[^/]+\.md$")
LOADED = "writing-for-agents"


def main() -> None:
    event = json.load(sys.stdin)
    path = event.get("tool_input", {}).get("file_path", "")
    if not AGENT_DOC.search(path):
        return
    transcript = event.get("transcript_path", "")
    try:
        with open(transcript, encoding="utf-8", errors="ignore") as f:
            if any(LOADED in line for line in f):
                return
    except OSError:
        return
    reason = (
        f"`{path.rsplit('/', 1)[-1]}` is read by agents. load `mattpocock-skills:writing-for-agents` "
        "first (the craft authority, docs/knowledge/authoring-memory.md), then retry the write."
    )
    json.dump(
        {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": reason,
            }
        },
        sys.stdout,
    )


main()
