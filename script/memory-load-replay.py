#!/usr/bin/env python3
# replays memory-load-rule-lazy over real transcripts: every signal (a reply naming a ticket, a
# `linear` call, a `- ticket:` line) is a hit when a trigger loaded its rule earlier in the session,
# or in the same tool call (the refusal lands the rule before the call runs). prints the hit rate
# per session role and every miss. the matching is the hook's own, imported, so the two cannot drift.
import argparse
import glob
import importlib.util
import json
import os
import sys
import time

HOOK = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "home", ".claude", "shelf", "hooks")
spec = importlib.util.spec_from_file_location("hook", os.path.join(HOOK, "memory-load-rule-lazy.py"))
hook = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hook)

CODER = "<command-name>/x:crew-coder</command-name>"


def prompt_text(entry):
    # a compaction summary is a user entry no prompt hook ever sees
    if entry.get("type") != "user" or entry.get("isMeta") or entry.get("isCompactSummary"):
        return None
    content = (entry.get("message") or {}).get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list) and not any(b.get("type") == "tool_result" for b in content if isinstance(b, dict)):
        return "\n".join(b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text")
    return None


def replay(path, rule, subagent=False):
    # a subagent gets no SessionStart and no UserPromptSubmit: only its own tool calls load a rule
    loaded, role, cwd, seen, signals, misses = False, None, None, set(), {"text": 0, "tool_use": 0}, []
    if subagent:
        role = "subagent"
    for raw in open(path, encoding="utf-8", errors="replace"):
        try:
            entry = json.loads(raw)
        except json.JSONDecodeError:
            continue
        # a resumed session repeats earlier lines
        uuid = entry.get("uuid")
        if uuid and uuid in seen:
            continue
        seen.add(uuid)
        if cwd is None and entry.get("cwd"):
            cwd = entry["cwd"]
            loaded = loaded or (not subagent and bool(hook.project_trigger(rule, cwd)))
        if entry.get("type") == "system" and entry.get("subtype") == "compact_boundary":
            # the hook reloads at a compaction what was loaded before it
            loaded = loaded or bool(cwd and hook.project_trigger(rule, cwd))
            continue
        prompt = prompt_text(entry)
        if prompt is not None:
            role = role or ("coder" if CODER in prompt else "other")
            loaded = loaded or (not subagent and bool(hook.prompt_trigger(rule, prompt)))
            continue
        if entry.get("type") != "assistant":
            continue
        for block in (entry.get("message") or {}).get("content") or []:
            if not isinstance(block, dict):
                continue
            if block.get("type") == "text":
                hit = hook.reply_signal(rule, block.get("text", ""))
            elif block.get("type") == "tool_use":
                tool_input = block.get("input") or {}
                loaded = loaded or bool(hook.tool_trigger(rule, block.get("name", ""), tool_input))
                hit = hook.tool_signal(rule, tool_input)
            else:
                continue
            if hit:
                signals[block["type"]] += 1
                if not loaded:
                    misses.append((entry.get("timestamp", "")[:16], block.get("type"), hit))
    if not subagent and os.path.basename(os.path.dirname(path)).endswith("-cclio"):
        role = "cclio"
    return role or "other", signals, misses


def main():
    parser = argparse.ArgumentParser(description="replay memory-load-rule-lazy over real transcripts")
    parser.add_argument("--days", type=int, default=14)
    parser.add_argument("--rule", default="linear-flow")
    args = parser.parse_args()
    if args.rule not in hook.TRIGGERS:
        print(f"no triggers for {args.rule} in {hook.RULES}/triggers.json", file=sys.stderr)
        sys.exit(2)
    since = time.time() - args.days * 86400
    paths = [
        p
        for pattern in ("*/*.jsonl", "*/*/subagents/*.jsonl")
        for p in glob.glob(os.path.expanduser(f"~/.claude/projects/{pattern}"))
        if os.path.getmtime(p) >= since
    ]
    totals, missed = {}, []
    for path in sorted(paths):
        role, signals, misses = replay(path, args.rule, subagent="/subagents/" in path)
        total = totals.setdefault(role, {"sessions": 0, "text": 0, "tool_use": 0})
        total["sessions"] += 1
        for kind in signals:
            total[kind] += signals[kind]
        missed += [(role, os.path.basename(path)[:8], *m) for m in misses]
    print(f"{args.rule} — {len(paths)} sessions, last {args.days} days")
    # a tool signal is also a tool trigger, so it hits by construction; replies are the real measure
    for role in ("cclio", "coder", "subagent", "other"):
        total = totals.get(role, {"sessions": 0, "text": 0, "tool_use": 0})
        lost = sum(1 for m in missed if m[0] == role)
        count = total["text"] + total["tool_use"]
        rate = f"{100 * (count - lost) / count:.1f} %" if count else "n/a"
        print(
            f"- {role}: {count - lost}/{count} signals after a load ({rate}) — "
            f"{total['text']} in replies, {total['tool_use']} in tool calls, {total['sessions']} sessions"
        )
    print(f"misses: {len(missed)}")
    for role, session, stamp, kind, hit in missed:
        print(f"- {role} {session} {stamp} {kind}: {hit}")
    # a subagent's prompt loads nothing by design, so its rate is reported, not gated
    gated = [m for m in missed if m[0] in ("cclio", "coder")]
    print(f"gate (cclio + coder at 100 %): {'red' if gated else 'green'}")
    sys.exit(1 if gated else 0)


if __name__ == "__main__":
    main()
