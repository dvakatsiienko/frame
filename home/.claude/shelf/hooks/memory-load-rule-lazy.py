#!/usr/bin/env python3
# a lazy rule (`rules-lazy/<rule>.md`) stays out of resident memory and loads once per session when
# one of its triggers in `rules-lazy/triggers.json` fires. a project trigger (the session's cwd) and a
# prompt trigger inject the rule; a tool trigger refuses the call once with the rule attached —
# injected context alone lands after the command is already written. Stop logs a miss: a signal in a
# session where the rule never loaded. a compaction drops what every memory-load-* hook loaded, so it
# clears their marks and reloads at once each lazy rule loaded before it — the summary carries the
# work on, and no trigger fires again for work already under way. `pnpm memory-load:replay` runs the same matching over real transcripts.
import glob
import json
import os
import re
import sys
import tempfile
import time

# lexical, never resolved: run from ~/.claude/shelf/hooks it reads ~/.claude/rules-lazy
RULES = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "rules-lazy"))
try:
    TRIGGERS = json.load(open(os.path.join(RULES, "triggers.json")))
except (OSError, ValueError) as error:  # a memory hook must never break a session
    print(f"memory-load-rule-lazy: {error}", file=sys.stderr)
    TRIGGERS = {}
# the PreToolUse matcher in settings.json; the replay reads it to skip the tools the hook never sees
TOOLS = ("Bash", "Edit", "Write", "MultiEdit")
STATE_DIR = os.path.join(tempfile.gettempdir(), "cc-memory-load-rule-lazy")
LOG = os.environ.get("MEMORY_LOAD_LOG", os.path.expanduser("~/.local/state/memory-load-rule-lazy.tsv"))


def first_match(patterns, text):
    for pattern in patterns:
        found = re.search(pattern, text)
        if found:
            return found.group(0).lstrip("\n;&|($ ").strip()
    return None


def strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        # an edit that removes a ticket line is not writing one
        for key, item in value.items():
            if key != "old_string":
                yield from strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from strings(item)


def project_trigger(rule, cwd):
    return first_match(TRIGGERS[rule]["project"], cwd)


def prompt_trigger(rule, prompt):
    return first_match(TRIGGERS[rule]["prompt"], prompt)


def tool_trigger(rule, tool, tool_input):
    if tool not in TOOLS:
        return None
    if tool == "Bash":
        hit = first_match(TRIGGERS[rule]["command"], str(tool_input.get("command", "")))
        if hit:
            return hit
    return next((hit for text in strings(tool_input) if (hit := first_match(TRIGGERS[rule]["input"], text))), None)


def reply_signal(rule, text):
    return first_match(TRIGGERS[rule]["signal"]["reply"], text)


def tool_signal(rule, tool_input):
    return next(
        (hit for text in strings(tool_input) if (hit := first_match(TRIGGERS[rule]["signal"]["tool"], text))), None
    )


def loaded(session):
    path = os.path.join(STATE_DIR, session)
    return set(open(path).read().split()) if os.path.exists(path) else set()


def mark(session, rule):
    os.makedirs(STATE_DIR, exist_ok=True)
    with open(os.path.join(STATE_DIR, session), "a") as state:
        state.write(rule + "\n")


def log(event, what, detail):
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    stamp = time.strftime("%Y-%m-%dT%H:%M:%S")
    session = str(event.get("session_id", ""))[:8]
    where = os.path.basename(event.get("cwd") or os.getcwd())
    clean = detail.replace("\t", " ").replace("\n", " ")[:80]
    with open(LOG, "a") as out:
        out.write(f"{stamp}\t{session}\t{where}\t{what}\t{clean}\n")


def rule_text(rule, how):
    path = os.path.join(RULES, f"{rule}.md")
    head = f"{rule} — a lazy rule ({path}), loaded {how}. binding for the rest of this session (memory-load-rule-lazy)"
    return f"{head}:\n\n{open(path, encoding='utf-8').read()}"


def last_turn(path):
    texts, tools = [], []
    with open(path) as transcript:
        lines = transcript.readlines()
    for raw in reversed(lines):
        try:
            entry = json.loads(raw)
        except json.JSONDecodeError:
            continue
        content = (entry.get("message") or {}).get("content")
        if entry.get("type") == "user":
            if entry.get("isMeta") or isinstance(content, list) and any(
                isinstance(block, dict) and block.get("type") == "tool_result" for block in content
            ):
                continue
            break
        if entry.get("type") == "assistant" and isinstance(content, list):
            for block in content:
                if not isinstance(block, dict):
                    continue
                if block.get("type") == "text":
                    texts.append(block.get("text", ""))
                elif block.get("type") == "tool_use":
                    tools.append(block.get("input") or {})
    return texts, tools


def load(event, session, rule, by, hit, why):
    # read before marking: an unreadable rule must stay unloaded, so the next trigger tries again
    text = rule_text(rule, why)
    mark(session, rule)
    log(event, f"load {rule} by {by}", hit)
    return text


def on_tool(event, session, fresh):
    tool, tool_input = event.get("tool_name", ""), event.get("tool_input") or {}
    hits = {rule: tool_trigger(rule, tool, tool_input) for rule in fresh}
    loads = [load(event, session, r, "command", h, f"because this {tool} call matched {h!r}") for r, h in hits.items() if h]
    if loads:
        reason = "refused once, so the rule below lands before the call runs. read it, then retry the same call"
        output = {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": f"{reason}.\n\n" + "\n\n".join(loads),
        }
        json.dump({"hookSpecificOutput": output}, sys.stdout)


def on_stop(event, fresh):
    path = event.get("transcript_path")
    texts, tools = last_turn(path) if path and os.path.exists(path) else ([], [])
    final = event.get("last_assistant_message")
    # the transcript can lag the stop by one text block; the event's own field cannot
    if isinstance(final, str) and final not in texts:
        texts.append(final)
    for rule in fresh:
        hit = next((s for t in texts if (s := reply_signal(rule, t))), None) or next(
            (s for i in tools if (s := tool_signal(rule, i))), None
        )
        if hit:
            log(event, f"miss {rule}", hit)


def forget(session):
    for state in glob.glob(os.path.join(tempfile.gettempdir(), "cc-memory-load-*", session)):
        open(state, "w").close()


def main():
    event = json.load(sys.stdin)
    # a subagent shares its parent's session id but not its context, so it loads on its own
    session = "-".join(str(part) for part in (event.get("session_id") or "none", event.get("agent_id")) if part)
    name = event.get("hook_event_name")
    loads = []
    if name == "SessionStart" and event.get("source") == "compact":
        before = loaded(session)
        forget(session)
        loads += [load(event, session, r, "compaction", "compact", "again after a compaction") for r in before & set(TRIGGERS)]
    fresh = [rule for rule in TRIGGERS if rule not in loaded(session)]
    if name == "SessionStart":
        cwd = str(event.get("cwd", ""))
        hits = {rule: project_trigger(rule, cwd) for rule in fresh}
        loads += [load(event, session, r, "project", h, f"because the session runs in {h}") for r, h in hits.items() if h]
    elif name == "UserPromptSubmit":
        prompt = str(event.get("prompt", ""))
        hits = {rule: prompt_trigger(rule, prompt) for rule in fresh}
        loads += [load(event, session, r, "prompt", h, f"because the prompt names {h}") for r, h in hits.items() if h]
    elif name == "PreToolUse":
        on_tool(event, session, fresh)
    elif name == "Stop":
        on_stop(event, fresh)
    if loads:
        output = {"hookEventName": name, "additionalContext": "\n\n".join(loads)}
        json.dump({"hookSpecificOutput": output}, sys.stdout)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # a memory hook must never break a session
        print(f"memory-load-rule-lazy: {error}", file=sys.stderr)
    sys.exit(0)
