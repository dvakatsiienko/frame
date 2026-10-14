#!/usr/bin/env python3
# Stop hook: reads the reply that just ended and logs every shape the output-format rules ban.
# it blocks only what misleads: a 🔭 on ccrow, cclio's 🔭 without dima while his ask is open, a table, an answer buried mid-turn.
# a style miss (a stamp off the clock, a ·-list, a grill fence, an unglossed id, a dead link) is logged and returns as one
# reminder line on the next prompt (`--prompt`, a UserPromptSubmit hook). `pnpm reply-check:report` reads the log.
import json
import os
import re
import sys
import time
from urllib.parse import unquote

LOG = os.environ.get("REPLY_CHECK_LOG", os.path.expanduser("~/.local/state/reply-check.tsv"))
REMIND_DIR = os.environ.get("REPLY_CHECK_REMIND", os.path.expanduser("~/.local/state/reply-check-remind"))

FENCE = re.compile(r"```.*?```", re.S)
URL = re.compile(r"https?://\S+")
TABLE_SEPARATOR = re.compile(r"^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$", re.M)
INLINE_CODE = re.compile(r"`[^`\n]*`")
MIDDOT = re.compile(r"\w[^\n·]*\s·\s[^\n·]*\w")
HASH = re.compile(r"(?<![\w/.-])(?=[0-9a-f]*[a-f])(?=[0-9a-f]*\d)[0-9a-f]{7,40}(?![\w/.-])")
REPORT_STAMP = re.compile(r"📄[^\n]*?\b(\d{1,2}):(\d{2})\b")
# a ccrow wake is a Stop-hook side effect, never a block: a 🔭 line naming it read as a hang (dima, 2026-10-10)
WAIT_ON_CCROW = re.compile(r"^\s*🔭.*ccrow.*$", re.M)
GRILL_ANSWER = re.compile(r"^\s*Q\d+\s*[:\-–]?\s*[a-e]\b", re.M)
# a link the desktop pane opens: no scheme, no #anchor; the pane resolves it from the session's folder (dima, 2026-10-11, o125)
LOCAL_LINK = re.compile(r"\]\((?![a-z][a-z0-9+.-]*:|#)([^)\s]+)\)")
LINE_SUFFIX = re.compile(r":\d+(?::\d+)?$")
HOME = os.environ.get("REPLY_CHECK_HOME", os.path.expanduser("~"))
# while dima owes cclio an answer, her 🔭 names him (o45; missed twice on 10-12 after it was set)
WAIT_LINE = re.compile(r"^\s*🔭.*$", re.M)
# an internal id dima cannot read cold: an orbit ask, a pocket item, a letter-digit label (o54: o56, PK-50, I7); a grill's
# `Q1` is its own label, printed with its question in the same reply
INTERNAL_ID = re.compile(r"(?<![\w/.#-])(o\d{1,4}|[Pp][Kk]-\d{1,4}|[A-PR-Z]\d{1,2})(?![\w/-])")
# glossed: words right after it in brackets, or after a colon or a dash, at least two of them
GLOSS_AFTER = re.compile(r"^\s*(?:\(|:\s|[—–-]\s|=\s)\s*[^\s)]+\s+[^\s)]+")
MD_LINK_LABEL = re.compile(r"\[[^\]]*\]\([^)]*\)")
# a can't with no command beside it is an inference dressed as a fact (two unproven can'ts on 10-13: PK-98, the hook claim)
CANT = re.compile(r"\b(?:can't|cannot|can not|impossible)\b", re.I)


def dead_links(prose: str, roots: list[str]) -> list[str]:
    # the event's cwd follows each Bash cd; the launch folder does not, so a link resolving from either one passes
    dead: list[str] = []
    for m in LOCAL_LINK.finditer(prose):
        target = os.path.expanduser(unquote(LINE_SUFFIX.sub("", m.group(1))))
        if not any(os.path.exists(os.path.join(root, target)) for root in roots):
            dead.append(m.group(1))
    return dead


def unglossed(prose: str) -> list[str]:
    # each id judged at its first use only; a link label is its own gloss, inline code is a machine string
    text = INLINE_CODE.sub("", MD_LINK_LABEL.sub("", prose))
    seen: set[str] = set()
    bare: list[str] = []
    for m in INTERNAL_ID.finditer(text):
        token = m.group(1)
        if token.lower() in seen:
            continue
        seen.add(token.lower())
        if not GLOSS_AFTER.match(text[m.end():]):
            bare.append(token)
    return bare


def session_name(session: str) -> str:
    folder = os.path.join(HOME, ".claude/sessions")
    for entry in os.listdir(folder) if os.path.isdir(folder) else []:
        try:
            with open(os.path.join(folder, entry)) as f:
                record = json.load(f)
        except (OSError, json.JSONDecodeError):
            continue
        if record.get("sessionId") == session:
            return str(record.get("name") or "")
    return ""


def open_asks(session: str) -> int:
    # the asks x-mod-stash mirrors for its board: dima's unmarked ones, under a day old, from the newest store file
    entry = store_entry(f"asks:{session}")
    if time.time() * 1000 - float(entry.get("at") or 0) > 24 * 3600 * 1000:
        return 0
    items = entry.get("items")
    if isinstance(items, list):
        return sum(1 for item in items if isinstance(item, dict) and not item.get("mark"))
    return len(entry.get("asks") or [])


def store_entry(key: str) -> dict:
    folder = os.path.join(HOME, ".claude/plugins/store")
    files = [os.path.join(folder, f) for f in os.listdir(folder) if f.startswith("x-mod-stash_")] if os.path.isdir(folder) else []
    if not files:
        return {}
    with open(max(files, key=os.path.getmtime)) as f:
        return (json.load(f) or {}).get(key) or {}


def in_second_wind(session: str) -> bool:
    # a 🐦‍🔥 second wind turn is writing its handoff or compacting; a block there costs the refresh (dima, PK-118)
    return store_entry(f"wind:{session}").get("state") in ("writing", "refreshing")


def unproven_cants(prose: str) -> list[str]:
    return [m.group(0) for para in re.split(r"\n\s*\n", prose) if "`" not in para for m in [CANT.search(para)] if m]


def waits_without_dima(prose: str, session: str) -> bool:
    if not re.search(r"(^|\s)cclio$", session_name(session)) or not open_asks(session):
        return False
    return not any("dima" in line for line in WAIT_LINE.findall(prose))


def minutes_now() -> int:
    hours, minutes = os.environ.get("REPLY_CHECK_NOW", time.strftime("%H:%M")).split(":")
    return int(hours) * 60 + int(minutes)


def future_stamps(prose: str) -> list[str]:
    now = minutes_now()
    late: list[str] = []
    for m in REPORT_STAMP.finditer(prose):
        ahead = (int(m.group(1)) * 60 + int(m.group(2)) - now) % 1440
        # over 12 h «ahead» is a stamp from before midnight; one minute of slack for the clock tick
        if 1 < ahead < 720:
            late.append(f"{m.group(1)}:{m.group(2)}")
    return late


PROMPT_NOW = re.compile(r"hook additional context: now (\d{1,2}):(\d{2})")


def prompt_now(path: str) -> int | None:
    with open(path) as transcript:
        lines = transcript.readlines()
    # only the hook's own attachment counts: a tool result quoting «now 10:39» once matched first
    for raw in reversed(lines):
        try:
            entry = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if entry.get("type") != "attachment" or (entry.get("attachment") or {}).get("hookEvent") != "UserPromptSubmit":
            continue
        m = PROMPT_NOW.search(json.dumps(entry.get("rendered"), ensure_ascii=False))
        if m:
            return int(m.group(1)) * 60 + int(m.group(2))
    return None


def is_rewind(path: str) -> bool:
    # a `rewind` reprints an old report with its true time, so its 📄 line is meant to be behind the clock
    with open(path) as transcript:
        lines = transcript.readlines()
    for raw in reversed(lines):
        try:
            entry = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if entry.get("type") != "user":
            continue
        content = (entry.get("message") or {}).get("content")
        if isinstance(content, list):
            if any(isinstance(b, dict) and b.get("type") == "tool_result" for b in content):
                continue
            content = " ".join(b.get("text", "") for b in content if isinstance(b, dict))
        return isinstance(content, str) and content.strip().lower().startswith("rewind")
    return False


def stale_stamps(prose: str, prompted: int) -> list[str]:
    stale: list[str] = []
    for m in REPORT_STAMP.finditer(prose):
        behind = (prompted - (int(m.group(1)) * 60 + int(m.group(2)))) % 1440
        # a stamp copied at the prompt or from a later `date` is never behind the prompt's own clock
        if 2 < behind < 720:
            stale.append(f"{m.group(1)}:{m.group(2)}")
    return stale


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
    found += [("table", m.group(0).strip()[:40]) for m in TABLE_SEPARATOR.finditer(prose)]
    # inline code quotes a machine string, and the 📄 line is a stamp, not a list
    for line in INLINE_CODE.sub("", prose).split("\n"):
        if "📄" not in line:
            found += [("middot", m.group(0)[:40]) for m in MIDDOT.finditer(line)]
    found += [("commit-hash", m.group(0)) for m in HASH.finditer(URL.sub("", prose))]
    found += [("future-stamp", stamp) for stamp in future_stamps(prose)]
    found += [("wait-on-ccrow", m.group(0)[:40]) for m in WAIT_ON_CCROW.finditer(prose)]
    # each fence is judged alone: a Q line in prose between two command fences once matched across them
    found += [("grill-fence", f.group(0)[3:43]) for f in FENCE.finditer(reply) if GRILL_ANSWER.search(f.group(0))]
    found += [("unglossed-id", token) for token in unglossed(prose)]
    found += [("unproven-cant", word) for word in unproven_cants(prose)]
    # a reply that is only the 📄 stamp and the 🔭 line hid its answer in a mid-turn block dima never sees (ccrow, 2026-10-12: three in one evening)
    body = [l for l in reply.splitlines() if l.strip()]
    if body and all(l.lstrip().startswith(("📄", "🔭")) for l in body) and any(l.lstrip().startswith("📄") for l in body):
        found.append(("empty-reply", body[0][:40]))
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
    roots = [r for r in (event.get("cwd"), os.environ.get("CLAUDE_PROJECT_DIR")) if r]
    if roots:
        hits += [("dead-link", link) for link in dead_links(FENCE.sub("", reply), roots)]
    if waits_without_dima(FENCE.sub("", reply), str(event.get("session_id", ""))):
        hits.append(("wait-without-dima", "🔭"))
    path = event.get("transcript_path")
    prompted = prompt_now(path) if path and os.path.exists(path) else None
    if prompted is not None and not is_rewind(path):
        prose = FENCE.sub("", reply)
        hits += [("stale-stamp", s) for s in stale_stamps(prose, prompted)]
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
    by_rule = lambda name: [snippet for rule, snippet in hits if rule == name]
    blocks: list[str] = []
    if by_rule("wait-on-ccrow"):
        blocks.append("a 🔭 line names ccrow: a wake never holds the session. drop the 🔭 line, or name what really holds it (a ci run, a coder).")
    if by_rule("wait-without-dima"):
        blocks.append("orbit holds an ask dima has not answered, and no 🔭 line names him: end with `🔭 waiting on **🙋‍♂️ dima**` (beside any member it also waits on).")
    if by_rule("table"):
        blocks.append("a markdown table: it renders broken in his panes. reprint it as `- key — value` bullets.")
    if by_rule("empty-reply"):
        blocks.append("the reply holds only the 📄 stamp and the 🔭 line: the answer sits in a mid-turn block dima never sees. reprint the answer in full above the stamp.")
    reminds: list[str] = []
    late, stale = by_rule("future-stamp"), by_rule("stale-stamp")
    if late or stale:
        reminds.append(f"📄 stamp {(late or stale)[0]} was off the clock — copy the prompt hook's now")
    if by_rule("middot"):
        reminds.append("a ·-joined list — one bullet per item")
    if by_rule("grill-fence"):
        reminds.append("a grill answer fence — grill picks go to orbit")
    if by_rule("unglossed-id"):
        reminds.append(f"unglossed ids ({', '.join(by_rule('unglossed-id'))}) — a three-word gloss at first use")
    if by_rule("dead-link"):
        reminds.append(f"a dead relative link ({by_rule('dead-link')[0]}) — path from the session folder")
    if reminds:
        os.makedirs(REMIND_DIR, exist_ok=True)
        with open(os.path.join(REMIND_DIR, f"{event.get('session_id') or 'none'}.txt"), "w") as f:
            f.write("; ".join(reminds))
    if blocks and not event.get("stop_hook_active") and not in_second_wind(str(event.get("session_id", ""))):
        # the blocked reply already shows; a full reprint doubled the boot board (dima, 2026-10-13)
        blocks.append("dima already sees the reply above: print only the corrected lines, never the whole reply again.")
        print(json.dumps({"decision": "block", "reason": " ".join(blocks)}))


def prompt() -> None:
    # UserPromptSubmit: the last reply's style misses join this prompt once, then the file is gone
    event = json.load(sys.stdin)
    path = os.path.join(REMIND_DIR, f"{event.get('session_id') or 'none'}.txt")
    if not os.path.exists(path):
        return
    with open(path) as f:
        line = f.read().strip()
    os.remove(path)
    if line:
        context = f"↩️ reply-check, your last reply: {line}. fix the shape from now on; no reprint needed."
        print(json.dumps({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": context}}, ensure_ascii=False))

if __name__ == "__main__":
    try:
        prompt() if sys.argv[1:] == ["--prompt"] else main()
    except Exception as error:  # a logging hook must never break a session's stop
        print(f"reply-check: {error}", file=sys.stderr)
    sys.exit(0)
