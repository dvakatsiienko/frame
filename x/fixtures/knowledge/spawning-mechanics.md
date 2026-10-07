---
verified-against: claude code 2.1.283, on this mac, 2026-09-27
refresh-when: the claude code minor version changes
---

# spawn mechanics — what is actually true

claim tags: **[verified]** ran it, observed the result · **[schema]** read from `--help` · **[inferred]** reasoning, not evidence.

## 1. subagent — the `Agent` tool

- runs inside the parent's **own os process** [verified]
- **starts in the parent's shell cwd** [verified 2.1.283]

## 2. background session — `claude --bg`

- survives a coordinator reset, and takes `--model` and `--effort` [verified]
