#!/usr/bin/env python3
# Stop hook, log-only: reads the reply that just ended and logs every shape the output-format rules
# ban. it never blocks. the log measures which rules break, so a rule that fires often gets its root
# fixed instead of a validator stopping every reply. `pnpm reply-check:report` reads it.
import json
import os
import re
import sys
import time

LOG = os.environ.get("REPLY_CHECK_LOG", os.path.expanduser("~/.local/state/reply-check.tsv"))

FENCE = re.compile(r"```.*?```", re.S)
LINEAR_LINK = re.compile(r"\[[^\]]*\]\(https://linear\.app/[^)]*\)")
URL = re.compile(r"https?://\S+")
TICKET = re.compile(r"\b(?:FRM|BYT|DOT)-\d+\b")
TABLE_SEPARATOR = re.compile(r"^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$", re.M)
MIDDOT = re.compile(r"\w[^\n·]*\s·\s[^\n·]*\w")
CIRCLED = re.compile(r"[①-⑳]")
HASH = re.compile(r"(?<![\w/.-])(?=[0-9a-f]*[a-f])(?=[0-9a-f]*\d)[0-9a-f]{7,40}(?![\w/.-])")


def last_reply(path: str) -> str:
    texts: list[str] = []
    with open(path) as transcript:
        lines = transcript.readlines()
    for raw in reversed(lines):
        try:
            entry = json.loads(raw)
        except json.JSONDecodeError:
            continue
        message = entry.get("message") or {}
        content = message.get("content")
        if entry.get("type") == "user":
            is_tool_result = isinstance(content, list) and any(
                isinstance(block, dict) and block.get("type") == "tool_result" for block in content
            )
            if not is_tool_result:
                break
            continue
        if entry.get("type") == "assistant" and isinstance(content, list):
            for block in reversed(content):
                if isinstance(block, dict) and block.get("type") == "text":
                    texts.append(block.get("text", ""))
    return "\n".join(reversed(texts))


def findings(reply: str) -> list[tuple[str, str]]:
    prose = FENCE.sub("", reply)
    found: list[tuple[str, str]] = []
    unlinked = URL.sub("", LINEAR_LINK.sub("", prose))
    found += [("bare-ticket", m.group(0)) for m in TICKET.finditer(unlinked)]
    found += [("table", m.group(0).strip()[:40]) for m in TABLE_SEPARATOR.finditer(prose)]
    for line in prose.split("\n"):
        found += [("middot", m.group(0)[:40]) for m in MIDDOT.finditer(line)]
    found += [("circled-digits", m.group(0)) for m in CIRCLED.finditer(prose)]
    found += [("commit-hash", m.group(0)) for m in HASH.finditer(URL.sub("", prose))]
    return found


def main() -> None:
    event = json.load(sys.stdin)
    # the transcript can lag the stop by one text block; the event's own field cannot
    reply = event.get("last_assistant_message")
    if not isinstance(reply, str):
        path = event.get("transcript_path")
        if not path or not os.path.exists(path):
            return
        reply = last_reply(path)
    hits = findings(reply)
    if not hits:
        return
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    stamp = time.strftime("%Y-%m-%dT%H:%M:%S")
    session = str(event.get("session_id", ""))[:8]
    where = os.path.basename(event.get("cwd") or os.getcwd())
    with open(LOG, "a") as log:
        for rule, snippet in hits:
            clean = snippet.replace("\t", " ").replace("\n", " ")
            log.write(f"{stamp}\t{session}\t{where}\t{rule}\t{clean}\n")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # a logging hook must never break a session's stop
        print(f"reply-check: {error}", file=sys.stderr)
    sys.exit(0)
