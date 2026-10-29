---
paths:
  - "**/CLAUDE.md"
  - "**/AGENTS.md"
  - "**/SKILL.md"
  - "**/skills/**/*.md"
  - "**/commands/*.md"
  - "**/rules/*.md"
  - "**/_clio/memory/*.md"
  - "**/recipes/*/recipe.md"
---

(authoring-trigger rule fired) you just touched an agent-consumed document. before editing it:

load `x:author-memory` (where the line goes, the mechanics) and `mattpocock-skills:writing-for-agents` (the craft), once per session.

<!--
why here: loads on a Read, a Bash `cat` or an Edit of a matching file (cc 2.1.296, measured 24/24 on opus + sonnet, 2026-10-11).
gap: a NEW file loads nothing until it is read, so the habit still carries that case.
-->

