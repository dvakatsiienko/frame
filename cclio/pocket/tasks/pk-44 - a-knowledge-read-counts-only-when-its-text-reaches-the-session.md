---
id: PK-44
title: a knowledge read counts only when its text reaches the session
status: done
assignee: []
created_date: '2026-10-09 13:29'
updated_date: '2026-10-09 17:55'
due_date: '2026-10-10'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 10450
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
sifter 10-09 16:29: both cli coders loaded x:guide-go; 2a read charm (| head -80), but 2b ran `x knowledge read charm >/dev/null 2>&1; echo exit $?` — the read log (knowledge-reads.jsonl) counted it while nothing reached its context. the proof is fakeable. options: an x-mod-guard rule refusing `x knowledge read` sent to /dev/null, or charm.md carries a nonce line the coder quotes (the crew-dna kelp-41 pattern). a mods-coder item beside pk-42
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
shipped as FRM-371 (x-mod-guard refuses a knowledge read sent to /dev/null or a file), closed 20:12
<!-- SECTION:NOTES:END -->
