---
id: PK-101
title: 'repos backup: a synced mirror of frame + bytes off github, free tier'
status: open
assignee: []
created_date: '2026-10-13 10:40'
updated_date: '2026-10-14 11:48'
due_date: '2026-10-16'
labels:
  - s
dependencies: []
priority: next
type: wish
ordinal: 10700
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
inbox 10-13: «what if github dies suddenly? how to have a synced backup mirror of my repos, just in case? if gh dies, i'd clone frame/bytes from that mirror. what are decent code-storage alternatives to gh, ideally supporting mirrors? no budget, a generous free tier is really nice to have. ideally solid, not dying.» a research question: answer with options (codeberg, gitlab pull mirrors, a local bare mirror) and one pick.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
researched 10-13: ~/frame/.scratch/research/repos-backup/synthesis.md — pick: a github action mirrors to gitlab.com on push + daily, and the git-crypt key exported to 1password (the real single point of failure). waits for dima's pick (orbit).

picked 2026-10-14: codeberg (he registered); setup runs in batch C

10-13 second round: ~/frame/.scratch/research/code-hosts/synthesis.md — backup pick codeberg push mirror; someday: tangled, mesa, code.storage

inbox 2026-10-14: he registered on codeberg — https://codeberg.org/dvakatsiienko . wants it set up the most automated way: syncs all the time, never distracts or interferes with flows. asks: what he must give (api key? anything else), does codeberg have a cli.
<!-- SECTION:NOTES:END -->
