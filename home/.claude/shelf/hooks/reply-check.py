#!/usr/bin/env python3
# Stop hook: reads the reply that just ended and logs every shape the output-format rules ban.
# it never blocks: a re-prompt reprints a reply dima already read (dima, 2026-10-14, o94). every miss is logged and returns
# as one reminder line on the next prompt (`--prompt`, a UserPromptSubmit hook). `pnpm reply-check:report` reads the log.
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
# a crow wake is a Stop-hook side effect, never a block: a 🔭 line naming it read as a hang (dima, 2026-10-10)
WAIT_ON_CROW = re.compile(r"^\s*🔭.*\bc?crow\b.*$", re.M)  # read-both: ccrow too
GRILL_ANSWER = re.compile(r"^\s*Q\d+\s*[:\-–]?\s*[a-e]\b", re.M)
GRILL_HEAD = re.compile(r"^🔥 grill:.*$", re.M)
GRILL_QUESTION = re.compile(r"^(\d+)\. \*\*", re.M)
ASK_NUMBER = re.compile(r"\bQ(\d+)\b")
# a link the desktop pane opens: no scheme, no #anchor; the pane resolves it from the session's folder (dima, 2026-10-11, o125)
LOCAL_LINK = re.compile(r"\]\((?![a-z][a-z0-9+.-]*:|#)([^)\s]+)\)")
LINE_SUFFIX = re.compile(r":\d+(?::\d+)?$")
HOME = os.environ.get("REPLY_CHECK_HOME", os.path.expanduser("~"))
# while dima owes clio an answer, her 🔭 names him (o45; missed twice on 10-12 after it was set)
WAIT_LINE = re.compile(r"^\s*🔭.*$", re.M)
# an internal id dima cannot read cold: an orbit ask, a pocket item, a letter-digit label (o54: o56, PK-50, I7); a grill's
# `Q1` is its own label, printed with its question in the same reply
INTERNAL_ID = re.compile(r"(?<![\w/.#-])(o\d{1,4}|[Pp][Kk]-\d{1,4}|[A-PR-Z]\d{1,2})(?![\w/-])")
# glossed: words right after it in brackets, after a colon or a dash, or a comma appositive («PK-219, the cli wish»), at least two of them
GLOSS_AFTER = re.compile(r"^\s*(?:\(|:\s|[—–-]\s|=\s|,\s+(?:the|your|my|our|a|an)\s)\s*[^\s)]+\s+[^\s)]+")
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


def unproven_cants(prose: str) -> list[str]:
    return [m.group(0) for para in re.split(r"\n\s*\n", prose) if "`" not in para for m in [CANT.search(para)] if m]


# a claim of «every / all / whole» wider than its check (10-16: «7 quotes stay whole», «every skill», «all the scripts exist»)
WIDE_CLAIM = re.compile(r"\b(?:nothing (?:lost|dropped|missing)|all (?:kept|landed|caught|green|exist)|every (?:one|line|file|skill|quote|check)\b[^.\n]{0,30}\b(?:caught|kept|landed|whole|pass(?:es|ed)?)|stays? whole)\b", re.I)


def wide_claims(prose: str) -> list[str]:
    return [m.group(0) for para in re.split(r"\n\s*\n", prose) if "`" not in para for m in [WIDE_CLAIM.search(para)] if m]


# a claim of how a door works (an api, a cli, a sync, an auth path) needs the file:line, command or doc it was read from beside it
# in the same paragraph (PK-224, FRM-429): inline code, a link or a url is the source
DOOR_NOUN = r"(?:api|cli|mcp|plugin|sync|auth(?:entication)?|endpoint|door|connector|webhook)"
DOOR_CLAIM = re.compile(
    rf"\b{DOOR_NOUN}\b[^.\n]{{0,50}}\b(?:takes no|needs|requires|only (?:takes|accepts|supports|works|reads|writes)|never (?:reads|writes|syncs|takes)|(?:does not|doesn't|cannot|can't) (?:support|take|read|write|sync|reach|accept)|has no (?:way|door|access)|is limited to)\b",
    re.I,
)
SOURCE = re.compile(r"`|https?://|\]\(")


def door_claims(prose: str) -> list[str]:
    return [m.group(0)[:40] for para in re.split(r"\n\s*\n", prose) if not SOURCE.search(para) for m in [DOOR_CLAIM.search(para)] if m]


# a claim stated as checked needs a command or read in the turn (the top #dima-caught type, flat at 10 vs 10, 2026-10-28).
# the claim forms: «copied whole», a first-person «I checked / verified / proved», a label line «proven: …», and «verified by …».
# the bare word was tried first: a week of 3,276 Stop turns flagged 22 replies, most relaying a member's verdict or a promise
CHECKED_CLAIM = re.compile(
    r"\bcopied whole\b|\b(?:i|we)(?:'ve| have)?\s+(?:just\s+)?(?:checked|verified|(?:proven|proved)(?!\s+(?:nothing|none|little)\b))\b|^\W*proven\s*[:—-]|\bverified\s+by\b",
    re.I | re.M,
)
# «not checked», «never verified», «isn't proven»: the word negated is a disclosure, not a claim
NEGATED_CLAIM = re.compile(r"\b(?:not|never|no|isn't|wasn't|aren't|weren't|n't|nothing|un)\s+(?:\w+\s+)?(?:copied whole|checked|verified|proven)\b", re.I)
EVIDENCE = ("Bash", "Read", "Grep", "Glob", "Monitor")
EVIDENCE_MCP = re.compile(r"^mcp__.+?__[^_]*(?:read|get|list|search|query|fetch|find|status)", re.I)


def claims_without_evidence(reply: str, calls: list[tuple[str, dict]]) -> list[str]:
    prose = INLINE_CODE.sub("", FENCE.sub("", reply))
    m = CHECKED_CLAIM.search(NEGATED_CLAIM.sub("", prose))
    if not m or any(name in EVIDENCE or EVIDENCE_MCP.match(name) for name, _ in calls):
        return []
    return [m.group(0).strip().lower()]


def unevidenced(path: str, reply: str) -> list[str]:
    return claims_without_evidence(reply, turn_calls(path))


# an orbit ask added for a grill round (its text names «Q<n>» or a round) with no «❓ **Q<n>**» line in the reply: dima sees the ask
# on the board but never read the question (dima o18, 2026-10-29)
# «round» alone is a verifier's or a review's too (the week replay: 31 of ~40 distinct hits), so a round counts beside «grill»
GRILL_ASK_TEXT = re.compile(r"\bQ\d+\b|\bgrill\b[^\n]{0,40}\bround\b|\bround\b[^\n]{0,40}\bgrill\b", re.I)
# the label may carry its title in the bold («❓ **Q5, build or reuse**», «❓ **Q1 - the birth test**»)
Q_NUMBER = re.compile(r"\bQ(\d+)\b", re.I)
GRILL_PRINTED_NUMBER = re.compile(r"^\W*❓\s*\*\*Q(\d+)\b", re.M)


def grill_asks_unprinted(reply: str, calls: list[tuple[str, dict]]) -> list[str]:
    ops = [op for name, args in calls if name == "mcp__x-mod-stash__orbit" for op in [args, *(args.get("ops") or [])] if isinstance(op, dict)]
    texts = [str(a.get("text", "")) for op in ops if op.get("op") == "add" for a in op.get("asks") or [] if isinstance(a, dict)]
    named = [t for t in texts if GRILL_ASK_TEXT.search(t)]
    printed = {int(n) for n in GRILL_PRINTED_NUMBER.findall(FENCE.sub("", reply))}
    # an ask naming Q3 needs its own «❓ **Q3**» line; a grill-round ask with no number needs any one
    lost = [t for t in named if (({int(n) for n in Q_NUMBER.findall(t)} - printed) if Q_NUMBER.search(t) else not printed)]
    return [lost[0][:40]] if lost else []


def grill_drift(prose: str, session: str) -> str:
    # the reply's grill and its orbit asks are one list: the numbers must match (dima, 2026-10-14: the reply held 5, orbit Q1–Q6)
    head = GRILL_HEAD.search(prose)
    if not head:
        return ""
    entry = store_entry(f"asks:{session}")
    if time.time() * 1000 - float(entry.get("at") or 0) > 24 * 3600 * 1000:
        return ""
    in_reply = {int(n) for n in GRILL_QUESTION.findall(prose[head.end():])}
    items = [i for i in entry.get("items") or [] if isinstance(i, dict) and not i.get("mark")]
    in_orbit = {int(m.group(1)) for i in items for m in ASK_NUMBER.finditer(str(i.get("text", "")))}
    if in_orbit and in_reply != in_orbit:
        return f"reply {sorted(in_reply)}, orbit Q{sorted(in_orbit)}"
    return ""


def waits_without_dima(prose: str, session: str) -> bool:
    if not re.search(r"(^|\s)c?clio$", session_name(session)) or not open_asks(session):  # read-both: cclio before the 10-29 rename
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


BOOKKEEPING = ("mcp__x-mod-stash__", "mcp__ccd_turn__")


def lone_wishkeeper(path: str) -> bool:
    # a siesta's freebie starts beside the wishkeeper spawn: a turn whose last real tool call is the spawn skipped it
    with open(path) as transcript:
        lines = transcript.readlines()
    calls: list[tuple[str, str, str]] = []  # (message id, tool name, subagent card)
    for raw in reversed(lines):
        try:
            entry = json.loads(raw)
        except json.JSONDecodeError:
            continue
        message = entry.get("message") or {}
        content = message.get("content")
        if entry.get("type") == "user":
            if not (isinstance(content, list) and any(isinstance(b, dict) and b.get("type") == "tool_result" for b in content)):
                break
            continue
        if entry.get("type") == "assistant" and isinstance(content, list):
            for block in reversed(content):
                if isinstance(block, dict) and block.get("type") == "tool_use":
                    card = (block.get("input") or {}).get("subagent_type", "")
                    calls.append((message.get("id", ""), block.get("name", ""), card))
    calls.reverse()
    spawns = [i for i, (_, name, card) in enumerate(calls) if name == "Agent" and card == "wishkeeper"]
    if not spawns:
        return False
    spawn_message = calls[spawns[-1]][0]
    work = [
        name
        for i, (message_id, name, card) in enumerate(calls)
        if (i > spawns[-1] or (message_id and message_id == spawn_message))
        and not name.startswith(BOOKKEEPING)
        and not (name == "Agent" and card == "wishkeeper")
    ]
    return not work


PROPOSED_IN_ORBIT = re.compile(r"\bproposed in orbit\b", re.I)
NOW_REDS = re.compile(r"\bnow reds\b", re.I)


def turn_calls(path: str) -> list[tuple[str, dict]]:
    # the tool calls of the turn that just ended, as (name, input)
    with open(path) as transcript:
        lines = transcript.readlines()
    calls: list[tuple[str, dict]] = []
    for raw in reversed(lines):
        try:
            entry = json.loads(raw)
        except json.JSONDecodeError:
            continue
        message = entry.get("message") or {}
        content = message.get("content")
        if entry.get("type") == "user":
            if not (isinstance(content, list) and any(isinstance(b, dict) and b.get("type") == "tool_result" for b in content)):
                break
            continue
        if entry.get("type") == "assistant" and isinstance(content, list):
            calls += [(b.get("name", ""), b.get("input") or {}) for b in content if isinstance(b, dict) and b.get("type") == "tool_use"]
    return calls


def empty_promises(path: str, reply: str) -> list[str]:
    # a promise lands with its call (FRM-427's rider): «proposed in orbit» needs an orbit add, «now reds» a command
    prose = FENCE.sub("", reply)
    calls = turn_calls(path)
    ops = [op for name, args in calls if name == "mcp__x-mod-stash__orbit" for op in [args, *(args.get("ops") or [])] if isinstance(op, dict)]
    found: list[str] = []
    if PROPOSED_IN_ORBIT.search(prose) and not any(op.get("op") == "add" for op in ops):
        found.append("proposed in orbit")
    if NOW_REDS.search(prose) and not any(name in ("Bash", "Monitor") for name, _ in calls):
        found.append("now reds")
    return found


MID_TEXT_MIN = 300
LIST_LEAD = re.compile(r"^[\s\-*#>]*(?:\d+[.)]\s*)?")


def unreached(path: str, reply: str) -> list[str]:
    # a long text block printed before a tool call may never reach dima; its lines must live on in the last message
    # (the sweep's comms read, 10-16: 8 «where is it» turns; the step list and the top-seven names were lost this way)
    with open(path) as transcript:
        lines = transcript.readlines()
    turn: list[tuple[str, str]] = []  # (kind, text) in order: «text» or «tool»
    for raw in reversed(lines):
        try:
            entry = json.loads(raw)
        except json.JSONDecodeError:
            continue
        message = entry.get("message") or {}
        content = message.get("content")
        if entry.get("type") == "user":
            if not (isinstance(content, list) and any(isinstance(b, dict) and b.get("type") == "tool_result" for b in content)):
                break
            continue
        if entry.get("type") == "assistant" and isinstance(content, list):
            for block in reversed(content):
                if isinstance(block, dict) and block.get("type") == "text":
                    turn.append(("text", block.get("text", "")))
                elif isinstance(block, dict) and block.get("type") == "tool_use":
                    turn.append(("tool", ""))
    turn.reverse()
    last_tool = max((i for i, (kind, _) in enumerate(turn) if kind == "tool"), default=-1)
    final = " ".join(reply.split())
    lost: list[str] = []
    for kind, text in turn[:last_tool]:
        if kind != "text" or len(text) < MID_TEXT_MIN:
            continue
        lines_of = [" ".join(LIST_LEAD.sub("", l).split()) for l in FENCE.sub("", text).splitlines()]
        lines_of = [l for l in lines_of if len(l) > 30]
        if lines_of and not any(l in final for l in lines_of):
            lost.append(lines_of[0][:40])
    return lost


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
    found += [("wait-on-crow", m.group(0)[:40]) for m in WAIT_ON_CROW.finditer(prose)]
    # each fence is judged alone: a Q line in prose between two command fences once matched across them
    found += [("grill-fence", f.group(0)[3:43]) for f in FENCE.finditer(reply) if GRILL_ANSWER.search(f.group(0))]
    found += [("unglossed-id", token) for token in unglossed(prose)]
    found += [("unproven-cant", word) for word in unproven_cants(prose)]
    found += [("wide-claim", claim) for claim in wide_claims(prose)]
    found += [("door-claim", claim) for claim in door_claims(prose)]
    # a reply that is only the 📄 stamp and the 🔭 line hid its answer in a mid-turn block dima never sees (crow, 2026-10-12: three in one evening)
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
    drift = grill_drift(FENCE.sub("", reply), str(event.get("session_id", "")))
    if drift:
        hits.append(("grill-drift", drift))
    path = event.get("transcript_path")
    prompted = prompt_now(path) if path and os.path.exists(path) else None
    if prompted is not None and not is_rewind(path):
        prose = FENCE.sub("", reply)
        hits += [("stale-stamp", s) for s in stale_stamps(prose, prompted)]
    if path and os.path.exists(path) and lone_wishkeeper(path):
        hits.append(("lone-wishkeeper", "siesta"))
    if path and os.path.exists(path):
        hits += [("unreached", head) for head in unreached(path, reply)]
        hits += [("empty-promise", said) for said in empty_promises(path, reply)]
        hits += [("unevidenced", said) for said in unevidenced(path, reply)]
        hits += [("grill-unprinted", head) for head in grill_asks_unprinted(reply, turn_calls(path))]
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
    reminds: list[str] = []
    if by_rule("lone-wishkeeper"):
        reminds.append("wishkeeper ran alone — start the siesta freebie now (clio:siesta step 2.2)")
    if by_rule("unreached"):
        reminds.append(f"text printed before a tool call never reached dima («{by_rule('unreached')[0]}…») — what he must read goes in the last message")
    for said in by_rule("empty-promise"):
        reminds.append(f"the reply says «{said}» with no {'orbit add' if said == 'proposed in orbit' else 'command'} that turn — a promise lands with its call")
    if by_rule("empty-reply"):
        reminds.append("the answer sat in a mid-turn block dima never sees — open this reply with it in full")
    if by_rule("wait-on-crow"):
        reminds.append("a 🔭 line named crow — a wake never holds the session")
    if by_rule("wait-without-dima"):
        reminds.append("an open orbit ask and no 🔭 line naming **🙋‍♂️ dima** — end on `🔭 waiting on **🙋‍♂️ dima**`")
    if by_rule("table"):
        reminds.append("a markdown table — `- key — value` bullets")
    late, stale = by_rule("future-stamp"), by_rule("stale-stamp")
    if late or stale:
        reminds.append(f"📄 stamp {(late or stale)[0]} was off the clock — copy the prompt hook's now")
    if by_rule("middot"):
        reminds.append("a ·-joined list — one bullet per item")
    if by_rule("grill-fence"):
        reminds.append("a grill answer fence — grill picks go to orbit")
    if by_rule("grill-drift"):
        reminds.append(f"the grill drifted from orbit ({by_rule('grill-drift')[0]}) — write the grill once, each ask copies its number")
    if by_rule("unglossed-id"):
        reminds.append(f"unglossed ids ({', '.join(by_rule('unglossed-id'))}) — a three-word gloss at first use")
    if by_rule("dead-link"):
        reminds.append(f"a dead relative link ({by_rule('dead-link')[0]}) — path from the session folder")
    if reminds:
        os.makedirs(REMIND_DIR, exist_ok=True)
        with open(os.path.join(REMIND_DIR, f"{event.get('session_id') or 'none'}.txt"), "w") as f:
            f.write("; ".join(reminds))


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
