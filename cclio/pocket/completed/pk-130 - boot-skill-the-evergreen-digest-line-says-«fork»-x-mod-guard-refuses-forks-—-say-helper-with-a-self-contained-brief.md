---
id: PK-130
title: 'evergreen runs only through its skill: boot step 4 + the reader''s banner'
status: done
assignee: []
created_date: '2026-10-14 11:50'
updated_date: '2026-10-14 12:42'
due_date: '2026-10-14'
labels:
  - xs
dependencies: []
priority: next
type: task
ordinal: 10090
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
flawlog 2026-10-14 14:47: the fork was refused (a fork carries ~220k parent ctx); a helper ran it in 28 s. edit plugin-cclio/skills/boot/SKILL.md step 4's evergreen line, then the cclio bump.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
dima 15:08: «how to make you not forget that each evergreen is tightly related to the evergreen skill?» root: cclio never loaded cclio:evergreen and wrote a narrowed brief. fix by mechanism: (1) boot step 4: an apps-lane DUE line → cclio loads cclio:evergreen in her own thread first, then its § 2 read goes to a fresh general-purpose agent whose brief is the skill path itself, never a narrowed summary; (2) skill:evergreen-apps prints a first line «raw input for cclio:evergreen §2–4, not a digest — load the skill» so any session that runs the reader is pointed back; (3) the prefetch DUE line names the skill too.

done 15:28: boot/SKILL.md step 4 loads cclio:evergreen first and briefs a fresh agent with the skill path; skill-evergreen-apps.ts prints a «raw input for cclio:evergreen, never the digest» first line (smoked); boot-prefetch.sh DUE line names the skill (bash -n ok).

15:33 reopened to claimed (wishkeeper): done only when the commit and the x + cclio plugin bumps land.

15:46 live: committed 61e083ce, cclio 0.3.170 cache carries the boot line.
<!-- SECTION:NOTES:END -->
