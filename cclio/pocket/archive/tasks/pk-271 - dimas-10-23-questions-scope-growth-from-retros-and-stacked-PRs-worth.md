---
id: PK-271
title: 'dima''s 10-23 questions: scope growth from retros, and stacked PRs'' worth'
status: done
assignee: []
created_date: '2026-10-23T20:31:00Z'
updated_date: '2026-10-25T11:45:00Z'
due_date: '2026-10-26'
labels:
  - s
dependencies: []
priority: later
type: task
ordinal: 164000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** tomorrow's boot — answer both first
W1 (2026-10-23 23:31, dima's dictation): ❓ Q1, scope growth from retros: «Tell me if my observation is correct, and I'd like to measure if it is possible somehow: how far and how fast a scope grows compared to how fast we resolve chunks? I'd like to know the numbers.»
W2 (2026-10-23 23:31, dima's dictation): the observed loop: «Their retro creates new work. … after each closed chunk, we have new to-dos, and it creates new chunks.» He agrees with the proposals; his worry is «a growing scope».
W3 (2026-10-23 23:31, dima's dictation): no ban: «I am not banning this right now. I am just asking for informative reasons, and I also think that it is actually fine for a scope to grow, especially since our CLI is relatively new.»
W4 (2026-10-23 23:31, dima's dictation): his bottleneck is elsewhere: «my 100 plan, which doesn't allow a lot of movements, so I operate our fleet in economy mode.»
W5 (2026-10-23 23:31, dima's dictation): ❓ Q2, stacked PRs: «Coder told me that, for one of the lanes or chunks, stacked PRs are useless and may even be less efficient than simple PRs.»
W6 (2026-10-23 23:31, dima's dictation): how to prep: «how do you think we can then prep chunks with stacked PRs in mind, for example, to plan a chain of related PRs … to be resolved in a stacked manner?»
W7 (2026-10-23 23:31, dima's dictation): the plain-merge alternative: «Or is it also a useless idea because, in the same exact manner, we could just take four or five chunks and sequentially resolve them one by one via plain merges?»
W8 (2026-10-23 23:31, dima's dictation): the goal of Q2: «I'm just trying to understand if stacked PRs mean something useful for fleet execution or not.»
W9 (2026-10-23 23:31, dima's dictation): ❓ scope of the handoff: the entry says both «fold into handoff and open tomorrow with answers» and, later, «don't fold them to answer tomorrow». Which one stands?
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
I'm already playing a game, so not able to communicate. A few things that I want you to fold into handoff and open tomorrow with answers about my questions:

1. The retros and the scope growth. From what I observed, each time you collect a retro, you collect feedback from crew members, and they provide valuable info about how to improve our systems. I mostly observe interesting ideas, and I even agree with proposals, but there is a catch here. Each proposal is additional to those, and it seems that after each resolved chunk, we resolve prepped, signed work, and coder plus verifier provides a retro. Their retro creates new work. With this approach, it seems that after each closed chunk, we have new to-dos, and it creates new chunks. I don't even know how to formulate my question because, from one point of view, I understand why this happens: I've asked to collect retros and to collect suggestions on how to improve our system and to actually build up our CLI based on the feedback. CLI is essentially a specialized framework for fleet, and the best candidates to tell what fleet wants are actual fleet. Our tactic is correct, but what I worry about is a growing scope. Tell me if my observation is correct, and I'd like to measure if it is possible somehow: how far and how fast a scope grows compared to how fast we resolve chunks? I'd like to know the numbers. As for the actual effects of this scope growing, I am not banning this right now. I am just asking for informative reasons, and I also think that it is actually fine for a scope to grow, especially since our CLI is relatively new. We barely set up a proper flow of CLI and actual side lanes' execution, especially after today's revamp of the skills. My bottleneck is in another area: it's my 100 plan, which doesn't allow a lot of movements, so I operate our fleet in economy mode. It's an overall type of question. The other question is about stacked PRs. Coder told me that, for one of the lanes or chunks, stacked PRs are useless and may even be less efficient than simple PRs. My question is the following: how do you think we can then prep chunks with stacked PRs in mind, for example, to plan a chain of related PRs (e.g., chunks, for them to be resolved in a stacked manner)? Or is it also a useless idea because, in the same exact manner, we could just take four or five chunks and sequentially resolve them one by one via plain merges? I'm just trying to understand if stacked PRs mean something useful for fleet execution or not. That's all my questions. As I told you, don't fold them to answer tomorrow. Since I'm dictating it via wishkeeper Flow and it will take a lot of space, you may compact it via Composer. Groom it and remove all the fluff because I am speaking to a second monitor while playing a game.
</pasted_content id="69eb">

wire+

2026-10-25 boot: Q1 and Q2 answered on the board (numbers: .scratch/boot-2026-10-25/q1-scope.md, docs/test-drive/stacked-prs.md round 1); W9: the first instruction stood. closed on dima's o2 tick.
close: W1 W2 W3 W4 W5 W6 W7 W8 done — answered on the 2026-10-25 boot board; W9 done — the first instruction stood

close: W1 W2 W3 W4 W5 W6 W7 W8 W9 done — answered on the 2026-10-25 boot board (pocket migration, dima's o45, 2026-10-25)
<!-- SECTION:NOTES:END -->
