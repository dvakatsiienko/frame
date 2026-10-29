---
id: PK-79
title: knowledge files become a must-read whenever their area is touched
status: done
assignee: []
created_date: '2026-10-12 11:08'
updated_date: '2026-10-25T11:45:00Z'
due_date: '2026-10-31'
labels:
  - m
dependencies: []
priority: later
type: wish
ordinal: 145000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the mods lane — its solve is the planned x-primer mod (dima, 2026-10-20: «pk-79 is later, it is connected to the x-primer mod; we already planned a solution to test out»)
dima, inbox 2026-10-12, folded. your line «better to spend 16k tokens reading our knowledge than redo 50 sweep steps» is the why. your token thrift is a double-edged sword: knowledge files look stray and big, so you skip them — but your training has a cutoff, and nothing replaces facts. they are the distilled product of our recipes (my wants → a recipe → its research vector → distilled into knowledge files, kept tidy → repeat), nearly as useful as skills or resident memory; they are not resident only for size and situational use. the sweep already loads its knowledge files up front; the same skeleton should hold for any area a knowledge file covers (a mod, the cli with charm): a coder reads that part up front, mandatory. that makes knowledge files as important as resident memory, so they must stay in a really good shape.
strays to check: docs/knowledge/macos-admin.md (wtf is it?) [now macos-apps.md] · spawning-mechanics.md (not stray, but too fat even as crew-lead's must-have) · writing-for-humans.md (move into the skill, and its recipe updates the skill?) · impeccable-refine.md (how was it made, should it sit parked like this?) · agent-ops.md (wants a rename) · charm.md (wants a prefix, go-charm?)
<!-- SECTION:DESCRIPTION:END -->

halt flush 2026-10-13 (o181): `x fleet flow --days 14` shows the 12 knowledge files read 0 times; 16:14 a cost answer came from recall while fleet-models.md held the number. add: a token, cache or cost question loads fleet-models.md (a rules-lazy trigger).

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
15:27: renames + moves landed (cc048e1e); the must-read hook rides mods lane l8 (brief 2, item 4); area: frontmatter lines are cclio's, after the hook lands

reopened 15:51 (wishkeeper: done on partly done): the renames shipped (cc048e1e, PK-80's job); the delivery waits on grill round 1 (o19–o24, o26–o27); dima 15:39: «we then need to revamp and shake knowledge to make this feature work» — the shelf revamp is part of this item

## the sequence (grill closed 16:01, dima: «ensure the execution sequence is not forgotten/buried»)
1. census of everything that says test drive; scout-tools → docs/test-drive/scouts.md; strays move in, one commit (Q7, Q8) — cclio
2. x:author-memory: the three authoring-* files fold into one skill, core in the body, the rest as references; the nurture recipes load it as step 0 (Q2, PK-82 joins here) — cclio
3. the shelf revamp: each remaining file gets a core ≤4 KB at its top and a `when:` signal line (Q3, Q6) — cclio, one file per proposal
4. rules/authoring-trigger.md → «load x:author-memory» (Q5)
5. the mod's name + its test-drive file, the trace designed upfront (dima 16:01)
6. the mods coder builds the mod: 5 signal kinds (extension, basename, import, command, skill loaded), every session (Q4), a delivery log line each
7. the end-to-end test drive, then the verdict
starts after the mods lane's brief 4 (dima 16:01: one parallel lane at a time). grill: .scratch/knowledge-79/grill.md

dima o31 16:06: the mod is named x-mod-primer («let's try»)

## decided, grill r2 (dima 16:19)
- Q9 a delivery log line (time, session, signal kind, file, bytes); usefulness by a 10-session helper-lite audit at the verdict
- Q10 each shelf file opens with an authored `## core` ≤4 KB; none → red in x knowledge list, never a byte cut. dima: the shelf gets an AGENTS.md naming the primer mod, a connection pointer both ways (the mod's docs name the shelf)
- Q11 once per session per file, re-armed after a compaction
- Q12 a 7-day test drive, a 15k tokens/session cap (past it: skip + log), adopt at 8/10 in the audit
- Q13 a feature lane: to-spec → .scratch/primer/spec.md, exit lines sealed from it

16:22 sealed: spec ~/frame/.scratch/primer/spec.md (wish: PK-79); exit lines ~/frame/.scratch/primer/exit-lines.md — step 0 + 6 lines, the blind critic's 5 findings folded (plan 20261012162001); x brief preflight runs when the ticket is born at dispatch. the build waits on steps 1–4 (the shelf revamp) and the mods lane's brief 4

dima 16:34: Q14 ✅ the primer delivers x:author-memory's core as a 6th source on SKILL.md/AGENTS.md/memory touches — and the halt flush + flawlog parse load the skill once, so a flush becomes a groom (his note, folded); Q15 ✅ go mod init / go get charm.land as go-charm signals («tricky, let's try»). spec updated

17:50: steps 1 (98569e9d scouts), 2 + 4 (d05e6323 x:author-memory, the trigger rule) done; next step 3, the shelf revamp, one proposal per file.

dima o62 18:01: recipes stay wide; each shelf file gets a fed-by: line (recipe <name> | incidents) in its revamp; the both-ways map + reds land in x knowledge list (cli lane, PK-94); knowledge/AGENTS.md states the shelf's purpose; each raw recipe is shaped at its own next run. orphans today: macos-apps (incidents), fleet-claude-capabilities (no feeder yet).

dima o64 18:13, the shelf test for knowledge/AGENTS.md: a subject that lives in one place (the mods, in plugin-x/mods/) keeps its knowledge in that home; the shelf holds subjects scattered across the fs (go/charm in any app).

19:50: steps 1, 2, 4, 5 done (scouts 98569e9d, author-memory d05e6323, primer trace in docs/test-drive/primer.md); step 3 shelf: 4 of 7 landed, 5–7 drafted (o76, o78, o79); knowledge/AGENTS.md landed. left: land 5–7, then the primer build joins the mods lane after l12.

19:57: shelf 6 capabilities landed; 5 fleet-models + 7 spawning-mechanics leave the shelf for x:crew-lead (o76, o81) at the skills groom, PK-83. the shelf revamp is done.

ccrow 17:46 holdout, unvetted at the halt: «step 1 of PK-79 was reported done with half of it skipped» — check it before the primer build starts

17:37 ccrow's holdout checked (Explore census): step 1 half done, confirmed. trials with no test-drive file: delve (Brewfile:56, 10-06), clearvpn (Brewfile:118, 10-10), Marco (Brewfile:117), jj (code-storage.md:29, waits on PK-114), lottie-rive (BYT-127). stale trial markers whose file exists: vorssaint, ctx7 (Brewfile), explore (fleet-models.md:168). notes-stack/ has no top-level file with status:. waits on dima: which of the 5 are live.

17:42 dima: clearvpn adopted, Marco dropped (verdict files + Brewfile, done); delve explained, his call pending. x-mod-primer parked: «let's not rush with x-mod-primer yet, i'll refine the sessions mod first».

parked: rides the mods lane resume beside PK-120 — sequence steps 5-7 (the x-mod-primer trace, the coder build, the 7-day test drive); steps 1-4 done (dima o18, 16:02)

2026-10-15: due pushed in the tail sweep — the delivery rides the knowledge-shelf revamp inside the memory sweep, not a tail.

parked: until the weekly reset (2026-10-19 07:00) — dima 10-18: today is the parse, the answers, the small stuff and the viz-tool shape; the pocket is solved after the reset

10-19 17:18, dima o45 ✓: the primer gains the guide-* skill cores as a source — x:guide-typescript on a .ts/.tsx touch, x:guide-code on a source touch, before the first edit (FRM-243's measure: 49 % load-before-edit, closed). the spec at ~/frame/.scratch/primer/spec.md takes this line at dispatch.

close: moved to FRM-304 — folded under «from the pocket» (0 of 0 W-lines copied, the rest already in a ticket) (pocket migration, dima's o45, 2026-10-25)
<!-- SECTION:NOTES:END -->
