---
id: PK-125
title: >-
  plugin cherry-pick: can a plugin's skills be excluded one by one — matt's
  handoff, implement, wizard out
status: open
assignee: []
created_date: '2026-10-14 11:48'
updated_date: '2026-10-14 12:27'
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
<!-- SECTION:NOTES:END -->
