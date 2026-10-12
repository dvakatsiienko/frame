#!/usr/bin/env python3
# Stop hook: reads the reply that just ended and logs every shape the output-format rules ban.
# it blocks the shapes `main` names (a 📄 stamp off the clock, a ·-joined list, a 🔭 on ccrow, a grill answer fence, an unglossed internal id, a relative link that resolves to nothing, cclio's 🔭 without dima while his ask is open); every other rule is log-only. the log measures which rules break, so a rule that fires often gets its root
# fixed instead of a validator stopping every reply. `pnpm reply-check:report` reads it.
import json
import os
import re
import sys
import time
from urllib.parse import unquote

LOG = os.environ.get("REPLY_CHECK_LOG", os.path.expanduser("~/.local/state/reply-check.tsv"))

FENCE = re.compile(r"```.*?```", re.S)
LINEAR_LINK = re.compile(r"\[[^\]]*\]\(https://linear\.app/[^)]*\)")
URL = re.compile(r"https?://\S+")
TICKET = re.compile(r"\b(?:FRM|BYT|DOT)-\d+\b")
TABLE_SEPARATOR = re.compile(r"^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$", re.M)
INLINE_CODE = re.compile(r"`[^`\n]*`")
MIDDOT = re.compile(r"\w[^\n·]*\s·\s[^\n·]*\w")
CIRCLED = re.compile(r"[①-⑳]")
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


def dead_links(prose: str, cwd: str) -> list[str]:
    dead: list[str] = []
    for m in LOCAL_LINK.finditer(prose):
        target = unquote(LINE_SUFFIX.sub("", m.group(1)))
        if not os.path.exists(os.path.join(cwd, os.path.expanduser(target))):
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
    folder = os.path.join(HOME, ".claude/plugins/store")
    files = [os.path.join(folder, f) for f in os.listdir(folder) if f.startswith("x-mod-stash_")] if os.path.isdir(folder) else []
    if not files:
        return 0
    with open(max(files, key=os.path.getmtime)) as f:
        entry = (json.load(f) or {}).get(f"asks:{session}") or {}
    if time.time() * 1000 - float(entry.get("at") or 0) > 24 * 3600 * 1000:
        return 0
    items = entry.get("items")
    if isinstance(items, list):
        return sum(1 for item in items if isinstance(item, dict) and not item.get("mark"))
    return len(entry.get("asks") or [])


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
    unlinked = URL.sub("", LINEAR_LINK.sub("", prose))
    found += [("bare-ticket", m.group(0)) for m in TICKET.finditer(unlinked)]
    found += [("table", m.group(0).strip()[:40]) for m in TABLE_SEPARATOR.finditer(prose)]
    # inline code quotes a machine string, and the 📄 line is a stamp, not a list
    for line in INLINE_CODE.sub("", prose).split("\n"):
        if "📄" not in line:
            found += [("middot", m.group(0)[:40]) for m in MIDDOT.finditer(line)]
    found += [("circled-digits", m.group(0)) for m in CIRCLED.finditer(prose)]
    found += [("commit-hash", m.group(0)) for m in HASH.finditer(URL.sub("", prose))]
    found += [("future-stamp", stamp) for stamp in future_stamps(prose)]
    found += [("wait-on-ccrow", m.group(0)[:40]) for m in WAIT_ON_CCROW.finditer(prose)]
    # each fence is judged alone: a Q line in prose between two command fences once matched across them
    found += [("grill-fence", f.group(0)[3:43]) for f in FENCE.finditer(reply) if GRILL_ANSWER.search(f.group(0))]
    found += [("unglossed-id", token) for token in unglossed(prose)]
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
    cwd = event.get("cwd")
    if cwd:
        hits += [("dead-link", link) for link in dead_links(FENCE.sub("", reply), cwd)]
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
    late = [snippet for rule, snippet in hits if rule == "future-stamp"]
    dots = [snippet for rule, snippet in hits if rule == "middot"]
    crow = [snippet for rule, snippet in hits if rule == "wait-on-ccrow"]
    grill = [snippet for rule, snippet in hits if rule == "grill-fence"]
    # the two blocking rules: logging alone changed nothing (28 stamp hits in a day, dima 2026-10-06; the · list, dima 2026-10-08); a second stop passes, so a block never loops
    reasons: list[str] = []
    if late:
        now = os.environ.get("REPLY_CHECK_NOW", time.strftime("%H:%M"))
        reasons.append(f"the 📄 stamp {', '.join(late)} is later than now ({now}). run `date` and reprint the 📄 line with the real time.")
    if dots:
        reasons.append(f"a ·-joined list in prose («{dots[0]}»): three things in a row are three bullets. reprint it as one `- ` line per item.")
    if crow:
        reasons.append("a 🔭 line names ccrow: a wake never holds the session. drop the 🔭 line, or name what really holds it (a ci run, a coder).")
    stale = [snippet for rule, snippet in hits if rule == "stale-stamp"]
    if stale and prompted is not None:
        asked = f"{prompted // 60:02d}:{prompted % 60:02d}"
        reasons.append(f"the 📄 stamp is a composed clock: {stale[0]} and {asked} (the prompt hook's now) differ by over 2 minutes. copy the hook's now, or run `date`, and reprint the 📄 line.")
    if grill:
        reasons.append("a fence pre-filled with grill answers: grill answers go to orbit, one `Qn <title>` row per question with your pick (dima, 2026-10-11). drop the fence; the round itself stays in the reply.")
    bare = [snippet for rule, snippet in hits if rule == "unglossed-id"]
    if bare:
        reasons.append(f"an internal id with no gloss ({', '.join(bare)}): dima reads it cold. give each its three-word gloss at first use — `o56 (the trash ask)` — or say the plain thing instead.")
    dead = [snippet for rule, snippet in hits if rule == "dead-link"]
    if dead:
        reasons.append(f"a relative link that resolves to nothing from this session's folder ({', '.join(dead)}): dima's click opens nothing. write the path from the session folder, or an absolute one.")
    if any(rule == "wait-without-dima" for rule, _ in hits):
        reasons.append("orbit holds an ask dima has not answered, and no 🔭 line names him: end with `🔭 waiting on **🙋‍♂️ dima**` (beside any member it also waits on).")
    if reasons and not event.get("stop_hook_active"):
        print(json.dumps({"decision": "block", "reason": " ".join(reasons)}))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # a logging hook must never break a session's stop
        print(f"reply-check: {error}", file=sys.stderr)
    sys.exit(0)
