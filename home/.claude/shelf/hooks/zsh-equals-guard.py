#!/usr/bin/env python3
# PreToolUse on Bash: refuse a command holding an unquoted word that starts with `=`.
# zsh equals-expansion reads `==x` as a command path, fails, and every command after the
# `&&` silently never runs (four sightings by 2026-09-26, FRM-264).
import json
import re
import sys

HEREDOC = re.compile(r"<<-?\s*(['\"]?)([A-Za-z_][A-Za-z0-9_]*)\1")
# a bare comparison operator inside [[ ]] is parsed by zsh as syntax, not expanded
TEST_OPERATORS = {"=", "==", "=~"}


def strip_heredoc_bodies(command: str) -> str:
    kept: list[str] = []
    delimiter: str | None = None
    for line in command.split("\n"):
        if delimiter is not None:
            if line.strip() == delimiter:
                delimiter = None
            continue
        kept.append(line)
        match = HEREDOC.search(line)
        if match:
            delimiter = match.group(2)
    return "\n".join(kept)


def unquoted_equals_words(command: str) -> list[str]:
    words: list[str] = []
    quote: str | None = None
    word_start = True
    current: list[str] | None = None
    escaped = False
    for char in command:
        if escaped:
            escaped = False
            if current is not None:
                current.append(char)
            word_start = False
            continue
        if char == "\\" and quote != "'":
            escaped = True
            continue
        if quote:
            if char == quote:
                quote = None
            if current is not None:
                current.append(char)
            continue
        if char in "'\"":
            quote = char
            word_start = False
            continue
        if char.isspace() or char in ";&|()":
            if current is not None:
                words.append("".join(current))
                current = None
            word_start = True
            continue
        if word_start and char == "=":
            current = [char]
        elif current is not None:
            current.append(char)
        word_start = False
    if current is not None:
        words.append("".join(current))
    return words


def main() -> None:
    command = json.load(sys.stdin).get("tool_input", {}).get("command", "")
    body = strip_heredoc_bodies(command)
    flagged = unquoted_equals_words(body)
    if "[[" in body:
        flagged = [w for w in flagged if w not in TEST_OPERATORS]
    if not flagged:
        return
    reason = (
        f"zsh would expand the unquoted word `{flagged[0]}` as a command path and abort the whole "
        "chain silently. quote it (`'{0}'`) or drop it.".replace("{0}", flagged[0])
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
