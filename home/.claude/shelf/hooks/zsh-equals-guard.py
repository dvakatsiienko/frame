#!/usr/bin/env python3
# PreToolUse on Bash: refuse two zsh shapes that fail silently.
# 1. an unquoted word starting with `=`: equals-expansion reads `==x` as a command path, fails, and
#    every command after the `&&` never runs (four sightings by 2026-09-26, FRM-264). a bare `=` is
#    left alone by zsh, so `[ "$a" = b ]` passes.
# 2. an unquoted `$VAR` whose value, set in the same command, holds a space: zsh does not word-split
#    it, so `git add $P` gets one path named «a b c» (two sightings, 2026-09-26/27).
import json
import re
import sys

HEREDOC = re.compile(r"<<-?\s*(['\"]?)([A-Za-z_][A-Za-z0-9_]*)\1")
# a bare comparison operator inside [[ ]] is parsed by zsh as syntax, not expanded
TEST_OPERATORS = {"=", "==", "=~"}
SPACED_ASSIGNMENT = re.compile(r"(?:^|[\s;&|(])([A-Za-z_][A-Za-z0-9_]*)=(['\"])([^'\"]*\s[^'\"]*)\2")


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


def unquoted_words(command: str) -> list[str]:
    words: list[str] = []
    quote: str | None = None
    current: list[str] = []
    quoted = False
    for char in command:
        if quote:
            if char == quote:
                quote = None
            continue
        if char in "'\"":
            quote = char
            quoted = True
            continue
        if char.isspace() or char in ";&|()":
            if current and not quoted:
                words.append("".join(current))
            current, quoted = [], False
            continue
        current.append(char)
    if current and not quoted:
        words.append("".join(current))
    return words


def unsplit_variables(command: str) -> list[str]:
    spaced = {m.group(1) for m in SPACED_ASSIGNMENT.finditer(command)}
    if not spaced:
        return []
    return [w for w in unquoted_words(command) if w in {f"${n}" for n in spaced} | {f"${{{n}}}" for n in spaced}]


def main() -> None:
    command = json.load(sys.stdin).get("tool_input", {}).get("command", "")
    body = strip_heredoc_bodies(command)
    flagged = unquoted_equals_words(body)
    flagged = [w for w in flagged if w != "="]
    if "[[" in body:
        flagged = [w for w in flagged if w not in TEST_OPERATORS]
    split = unsplit_variables(body)
    if flagged:
        reason = (
            f"zsh would expand the unquoted word `{flagged[0]}` as a command path and abort the whole "
            "chain silently. quote it (`'{0}'`) or drop it.".replace("{0}", flagged[0])
        )
    elif split:
        reason = (
            f"zsh does not word-split `{split[0]}`: its value holds spaces, so it arrives as ONE argument. "
            "write the items out, use `${=VAR}`, or run the command under bash."
        )
    else:
        return
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
