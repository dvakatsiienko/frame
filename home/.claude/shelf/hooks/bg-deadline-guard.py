#!/usr/bin/env python3
# PreToolUse on Bash: a background command carries its deadline, or it does not run.
# a coder's brew sat hung for 12+ min behind run_in_background on 2026-09-28 and only dima's
# peek caught it — «every wait gets a deadline» was a rule, this makes it a mechanism.
# passes: a `timeout <n>` / `gtimeout <n>` wrapper, or a `# deadline: <bound>` comment for a
# loop that bounds itself (a poll with a max iteration count).
import json
import re
import sys

WRAPPED = re.compile(r"(?:^|[\s;&|(])g?timeout\s+\d")
DECLARED = re.compile(r"#\s*deadline:\s*\S")

tool_input = json.load(sys.stdin).get("tool_input", {})
command = tool_input.get("command", "")
if tool_input.get("run_in_background") and not (WRAPPED.search(command) or DECLARED.search(command)):
    json.dump(
        {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": (
                    "a background command needs a deadline, or a hang runs unseen: wrap it as "
                    "`timeout <seconds> <command>` (about 2× the time you expect), or add a "
                    "`# deadline: <bound>` comment when the loop bounds itself."
                ),
            }
        },
        sys.stdout,
    )
