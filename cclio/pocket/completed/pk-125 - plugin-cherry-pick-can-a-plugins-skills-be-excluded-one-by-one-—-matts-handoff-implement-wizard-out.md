---
id: PK-125
title: >-
  plugin cherry-pick: can a plugin's skills be excluded one by one — matt's
  handoff, implement, wizard out
status: done
assignee: []
created_date: '2026-10-14 11:48'
updated_date: '2026-10-14 13:03'
due_date: '2026-10-14'
labels:
  - xs
dependencies: []
priority: next
type: question
ordinal: 10080
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
inbox 2026-10-14 (cc marketplace plugins). he wants those three uninstalled, they are useless to him. check the cc docs (claude-code-guide) for a per-skill disable; no door → the options (a local fork of matt's plugin, a skill override, a ticket upstream).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
15:30 cc docs (claude-code-guide, Haiku 5.5): no per-skill off switch for plugin skills — skillOverrides skips plugin skills, /plugin is whole-plugin only. a Skill(...) deny rule is undocumented for plugin skills and likely blocks invocation only, the listing stays (inference). options: a local marketplace entry listing only the wanted skill dirs (manifest: listed skills load, the default scan is skipped; untested on a plugin we didn't write, no auto-update), or a fork via --plugin-dir (session-only).

16:00 probe (claude -p --plugin-dir, Haiku 5.5, 3 runs): a trimmed plugin whose plugin.json skills array drops handoff/implement/wizard loads its 10 model-visible skills and no wizard — but only from a real copy of the skills dir; a symlinked skills dir loaded nothing (2 runs). handoff + implement are user-only, so they leave his / menu, not the model listing. the door: a local plugin copy synced from matt's auto-updated clone by one script (rsync + jq filter), run with every evergreen. waiting on dima's pick.

16:02 dima o17: a local copy breaks auto-update, so no cherry-pick — keep matt's marketplace install in full. closed.
<!-- SECTION:NOTES:END -->
