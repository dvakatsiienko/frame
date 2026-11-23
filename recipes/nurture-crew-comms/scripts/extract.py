#!/usr/bin/env python3
"""Extract crew->coordinator cross-session messages and machine notices from clio transcripts.
Usage: python3 -I extract.py [days, default 7] <out dir> -> writes raw.json, notices.json there.
Input events = user entries that are not tool_results, plus queued_command attachments.
"""
import json, re, sys, os, hashlib

D = "/Users/dima/.claude/projects/-Users-dima-frame--clio/"
DAYS = int(sys.argv[1]) if len(sys.argv) > 1 else 7
import glob, time
FILES = [os.path.basename(f)[:-6] for f in sorted(glob.glob(D + "*.jsonl"), key=os.path.getmtime)
         if os.path.getmtime(f) > time.time() - DAYS * 86400]
STOP = {}
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "last")
os.makedirs(OUT, exist_ok=True)
MSG = re.compile(r'<cross-session-message from="([^"]*)" from-name="([^"]*)"[^>]*>\n?(.*?)</cross-session-message>', re.S)


def text_of(e):
    if e.get("type") == "attachment":
        p = e["attachment"].get("prompt")
        if isinstance(p, list):
            return "\n".join(x.get("text", "") for x in p if isinstance(x, dict))
        return p or ""
    c = e["message"]["content"]
    if isinstance(c, str):
        return c
    return "\n".join(x.get("text", "") for x in c if isinstance(x, dict) and x.get("type") == "text")


HELD_ITEM = re.compile(r"^(\d\d:\d\d) (.+?) \(([^)]{1,24})\): (.*)$", re.S)


def held_items(e):
    """quiet comms' held pings riding a prompt as hook context or a plugin note."""
    a = e.get("attachment") or {}
    if a.get("type") not in ("hook_additional_context", "plugin_note"):
        return []
    parts = []
    for k in ("content", "heldContent"):
        v = a.get(k)
        if isinstance(v, list):
            parts += [x for x in v if isinstance(x, str)]
        elif isinstance(v, str):
            parts.append(v)
    out = []
    for p in parts:
        if "held member ping" not in p:
            continue
        p = p[p.index("held member ping"):]
        for chunk in re.split(r"\n- (?=\d\d:\d\d )", p)[1:]:
            m = HELD_ITEM.match(chunk.strip())
            if m:
                out.append(m.groups())
    return out


def is_input(e):
    t = e.get("type")
    if t == "attachment":
        return e["attachment"].get("type") == "queued_command"
    if t != "user":
        return False
    c = e["message"]["content"]
    if isinstance(c, list) and any(isinstance(x, dict) and x.get("type") == "tool_result" for x in c):
        return False
    return True


def react_after(entries, i):
    """coordinator reaction: assistant entries until the next human/peer input or turn end."""
    tools, texts, sends = [], [], []
    j = i + 1
    while j < len(entries):
        x = entries[j]
        if x["type"] == "assistant":
            for b in x["message"].get("content", []) or []:
                if not isinstance(b, dict):
                    continue
                if b.get("type") == "tool_use":
                    nm = b.get("name")
                    inp = b.get("input", {})
                    if nm == "Bash":
                        tools.append("Bash:" + (inp.get("command", "")[:60].replace("\n", " ")))
                    elif nm == "SendMessage":
                        tools.append("SendMessage>" + str(inp.get("to", ""))[:30])
                        sends.append(str(inp.get("message", ""))[:160])
                    else:
                        tools.append(nm)
                elif b.get("type") == "text" and b.get("text", "").strip():
                    texts.append(b["text"].strip())
            if x["message"].get("stop_reason") == "end_turn":
                break
        elif is_input(x):
            break
        j += 1
    return {"tools": tools, "text": " / ".join(texts)[:400], "text_len": sum(len(t) for t in texts), "sends": sends}


msgs, notices = [], []
for f in FILES:
    entries = []
    with open(D + f + ".jsonl") as fh:
        for line in fh:
            try:
                e = json.loads(line)
            except Exception:
                continue
            if e.get("type") not in ("user", "assistant", "attachment"):
                continue
            ts = e.get("timestamp", "")
            if f in STOP and ts and ts >= STOP[f]:
                break
            entries.append(e)
    # index of last assistant before i
    last_asst_stop = None
    last_asst_idx = None
    for i, e in enumerate(entries):
        if e["type"] == "assistant":
            last_asst_stop = e["message"].get("stop_reason")
            last_asst_idx = i
            continue
        if e["type"] == "attachment" and not is_input(e):
            for hhmm, name, kind, body in held_items(e):
                msgs.append({"file": f[:8], "ts": e.get("timestamp"), "sent_local": hhmm, "uuid": e.get("uuid"),
                             "entry": "held", "origin": "quiet-held", "held_kind": kind, "prev_stop": last_asst_stop,
                             "starts_turn": False, "n_in_entry": 0, "with_human": False, "from": "-", "name": name,
                             "body": body.strip(), "react": react_after(entries, i), "entry_has_other_text": 0})
            continue
        if not is_input(e):
            continue
        txt = text_of(e)
        kind_entry = "attachment" if e["type"] == "attachment" else "user"
        origin = (e.get("origin") or {}).get("kind", "-")
        # push = a user entry (not an attachment) that follows an assistant entry that ended its turn
        starts_turn = kind_entry == "user" and last_asst_stop in ("end_turn", "stop_sequence", None)
        react = react_after(entries, i)
        found = MSG.findall(txt)
        head = txt.lstrip()[:120]
        if not found:
            nk = None
            if "[Cross-session idle notice]" in txt: nk = "idle-notice"
            elif "[Cross-session delivery notice]" in txt: nk = "delivery-notice"
            elif txt.lstrip().startswith("<task-notification>") or origin == "task-notification": nk = "task-notification"
            elif "Stop hook feedback" in txt[:200]: nk = "stop-hook"
            elif "quiet" in txt[:300].lower(): nk = "quiet-line"
            if nk:
                notices.append({"file": f[:8], "ts": e.get("timestamp"), "kind": nk, "entry": kind_entry,
                                "origin": origin, "starts_turn": starts_turn, "head": head})
            continue
        for frm, name, body in found:
            msgs.append({"file": f[:8], "ts": e.get("timestamp"), "uuid": e.get("uuid"), "entry": kind_entry,
                         "origin": origin, "prev_stop": last_asst_stop, "starts_turn": starts_turn,
                         "n_in_entry": len(found), "with_human": origin == "human",
                         "from": frm, "name": name, "body": body.strip(), "react": react,
                         "entry_has_other_text": len(MSG.sub("", txt).strip()) })

# dedupe by (name, body)
seen, out = {}, []
for m in msgs:
    k = hashlib.sha1((m["name"] + "\x00" + m["body"]).encode()).hexdigest()
    if k in seen:
        seen[k]["dupes"] += 1
        continue
    m["dupes"] = 0
    seen[k] = m
    out.append(m)
json.dump(msgs, open(OUT + "/occurrences.json", "w"), ensure_ascii=False)
json.dump(out, open(OUT + "/raw.json", "w"), ensure_ascii=False, indent=0)
json.dump(notices, open(OUT + "/notices.json", "w"), ensure_ascii=False, indent=0)
print("raw message occurrences in input entries:", len(msgs), "deduped:", len(out), "notices:", len(notices))
