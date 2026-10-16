---
id: PK-160
title: "x-mod-stash: several \U0001F52D holders print under one «waiting on», comma-separated"
status: waiting
assignee: []
created_date: '2026-10-16 11:11'
updated_date: '2026-10-16 11:11'
due_date: '2026-10-24'
labels:
  - s
dependencies: []
priority: later
type: task
ordinal: 133000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the mods lane (PK-120).
dima, 2026-10-16 (screenshot of the band): the band repeated «waiting on» per holder; he wants one «waiting on» and the holders split by commas — «waiting on wishkeeper, researcher, dima» — done in the mod, mechanically, not as a memory rule. touches parse.ts parseWait (joins the 🔭 lines with '; ' today) and register.tsx's bold rendering (lines ~3088, ~5605–5640 split on '; ' and match a per-part «waiting on»), plus band.test.ts 'the 🔭 line prints who it waits on in bold'. a scratch try on 10-16 went red on that test and was not pushed. done: the band shows one «waiting on», commas, each holder still bold; the interim line in rules/fleet-output-format.md goes.
<!-- SECTION:DESCRIPTION:END -->
