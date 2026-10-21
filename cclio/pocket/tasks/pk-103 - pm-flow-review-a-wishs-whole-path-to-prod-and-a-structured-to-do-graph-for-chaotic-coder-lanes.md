---
id: PK-103
title: >-
  pm flow review: a wish's whole path to prod, and a structured to-do graph for
  chaotic coder lanes
status: open
assignee: []
created_date: '2026-10-13 10:40'
updated_date: '2026-10-21T15:49:00Z'
due_date: '2026-10-21'
labels:
  - m
dependencies: []
priority: later
type: wish
ordinal: 100104
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ticket: FRM-72. inbox 10-13 (the Pm wish, his desktop edit recovered from obsidian snapshots + the mobile dictation): after the memory sweep, review the pm flow A→B — how a wish goes to prod; shape-idea / shape-lane. the biggest failure point: chaotic lanes like the 10-12 mods lane, where steers, asks, cclio's wants and wisps reached the coder as cross-session messages, easy to lose and leaving glide showing wrong data. his fix: wish (or a found wisp) → to-spec → the coder runs to-tickets → cclio reviews and builds an ordered task graph, the coder's plan source of truth for everyone, which glide can follow. the open conflict: who orders the coder's tickets (his take: cclio) — wants a grill. also: name such lanes, and revisit the lane vocabulary (main lane, second/parallel lane, quick lane — he mixes them up). TL;DR: harden and set in stone the to-spec → to-tickets flow. after the memory sweep is fully resolved. full text: cclio/.scratch/boot-2026-10-13/inbox-recovered.md
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parked: after the memory sweep (his words: «to be done after memory sweep is fully resolved»)

his edited desktop version, recovered verbatim (10-13):

**Pm**
Remind yourself if you have a ticket to granularly review your PM habit right after memory sweep.
To be checked: most likely everything that was already planned in that ticket. plus review how your PM flow works from A to B.
For example when I provide you with a wish - how my wish goes into prod. 
It is more about a shape idea or shape lane skills, related to a process of shaping a wish into a spec to prepare the flow for coders. 

I think that the biggest failure point in failure right now is our "quick lanes".
yesterday, during mods lane (one coder), where we build catch mod.
during that mod lane You kept delegating to the coder different kinds of stuff, like my steers, my asks, your own wants ans wisps you or me found.
You kept forwarding coder delegations via cross-message API with no structured approach. I think it is not optimal. Because it functionally works but this appapron is a full failure point itself because when you forward todoes to a coder via cross-message API, they are very easy to lose (because they are only present in your own and coder's ctx).

a case: when we do chaotic lanes like this and continue adding to coder's pool. and his flow is unstructured.  this also decreases the value of glide mode because it essentially starts to show not valid data.
 I think it can be solved if you could create a kind of linear coder's to-do list. 
 for example:
my wish (or you found a wisp) → to-spec → coder does to-tickets → you review an build an ordered linear task graph for a coder, that serves as a coder's plan source of truth for everyone.
and it would be easier for you to update glide mod based on that. or, eventually maybe 

That's why I want to review your PM flow and sharpen it very hard.

I think such kinds of lanes deserve their dedicated name, like we have a lane, the main lane, the second lane, and the quick lane. 

We need to revisit our vocabulary because it's messy. I keep mixing up the lanes. I remember that our lane is the main lane and I refer to the second lane as a parallel lane or second lane, and I keep mixing them up. Also we have a quick lane so let's revisit this part and harden especially deep A lanes, like yesterday's mods lane, a chaotic one. I think that such kinds of lanes will happen often and such kinds of lanes are natural. They are real. They are a result of what's happening in reality.

I propose for such lanes to prep coders' scope via to-spec math skill so his work is always structured. When you do to-spec delegations to a coder, the coder uses two tickets over spec so his flow is structured and well organized. But it is also important to note that after coder created tickets out of spec. Those tickets also have to be ordered somehow and this is a point of responsibility conflict because the coder knows how to organize an order for his tickets by his own convenience to structure an efficient order of the entire scope. You, however, have a higher-level view of the scope because you can also see what is planned after the scope that the coder already has.

You can provide a better idea of what the coder's execution order can look like. So as you see APM question is kind of tricky so it has to be revisited. 

TL;DR: define "harden and set in stone" to spec/to tickets flow. 
To be done after memory sweep is fully resolved.

dima, 2026-10-18 (inbox W3 + steering): connect FRM-266 to your pm module revamp and solve it all at once. ~the day after tomorrow: the pm module revamp — review your full pm flows plus the coord flows, since they sit close together; the visualization tool helps here. bring the ticket close so it is at hand.

parked: until the weekly reset (2026-10-19 07:00) — dima 10-18: today is the parse, the answers, the small stuff and the viz-tool shape; the pocket is solved after the reset

dima, 2026-10-18 (inbox W4): to fix, sharpen and smoothen your pm, i should first review all your pm flows from a to b, including the lane-closing parts; then evaluate how good the current flow is, find weak parts and gaps, find and apply shortcuts, cut redundancies. tl;dr: your pm and coord/lead flows need sharpening and smoothing (🎙️ «colors/lead» → coord/lead). the intervention skill PK-173 is tried on this first.

inbox 10-19 (idea, his ask: fold into the pm module revamp): split summoning and spawning — crew members are «summons», subagents are «spawns», for a clearer boundary: a summon is a longer-lasting thread entity, a spawn is smaller, it does something and dies. summons: cclio, coder, verifier, designer, ccrow, composer. spawns: researcher, wishkeeper and the rest of the subagents. a naming change → x:top-seven candidates when the revamp reaches it.

2026-10-20 19:08 low tide: postponed to 10-21 on dima's word («resolve everything that does not want a grill, postpone everything else to tomorrow») — a grill: the pm flow review

2026-10-21 15:15 dima (o11): the rename and reshape of every fleet member's name rides this pm revamp. first case: x:research's per-surface bullet calls a claude.ai project thread «cc cloud», while fleet-identity's cc cloud is a claude --cloud session (which clones frame) — one name per thing across fleet-identity, fleet-doors and the skills.

2026-10-21 17:02 dima, folded: the PK-240 data-loss issue is partly a pm-module issue — that's why i said something is wrong with your pm module; now we found a part of it. solve PK-240 now, and fold this incident into the pm revamp, so its full-mode review (dima-intervenes' first run) sees the fuller picture of the pm flow: wish intake → pocket fold → grill → build, where PK-173 lost ~35 %.

2026-10-21 17:51 correction (wishkeeper): the 17:02 note's «dima, folded» part is his words only up to «review a fuller picture of your pm flow in full mode»; «dima-intervenes' first run» and «where PK-173 lost ~35 %» were cclio's adds — PK-240 was the skill's first fix run, PK-103 is its first full-area run. before that run, PK-103 is folded into W-lines.

2026-10-21 17:55 the data-loss incident, folded for the revamp (dima: «it's important, we should somehow remember that»): the dima-intervenes fix run on PK-240 audited 8 wishes, 139 points (docs/research/wish-data-loss-audit-2026-10-21.md): composer 1.4 % lost, pocket 0.7 %, an old ticket absorbing a wish as a note 38.7 %, first use (grill, brief, spec) 9.4 % lost + 10.1 % blurred — the inbox was covered, the loss sat in the middle, after every guard. shapes: dropped questions 18, re-summaries 13, dropped why 9; long prose wishes lose most. fixes landed: W-lines at the parse, wish-cover.ts at five doors, the ticket wish block = the fold, wishkeeper + ccrow nets. the revamp reviews the whole path with these numbers; the open half is monitoring (dima 17:54).

2026-10-21 17:58 the wish-loss monitor, dima's picks, built inside this revamp: M1 a pocket close runs wish-cover on the close note (each W-line cited done, moved or dropped on his word); M2 pocket-check reds an item born after 10-21 with no W-lines; M3 a weekly wish-loss audit as a cclio skill, not a recipe (dima: «let's keep it as your skill for now»), in the Wednesday pass, the per-hop numbers trended.

2026-10-21 18:49 dima: «tomorrow, we open with the PM revamp, right, as a second turn after the boot» — the pm research of run #6 feeds it: https://claude.ai/artifact/UQDHgn3qcntgD2UCShxpfv
<!-- SECTION:NOTES:END -->
