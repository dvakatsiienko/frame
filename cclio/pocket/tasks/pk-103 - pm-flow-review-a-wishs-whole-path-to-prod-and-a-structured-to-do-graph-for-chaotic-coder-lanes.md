---
id: PK-103
title: >-
  pm flow review: a wish's whole path to prod, and a structured to-do graph for
  chaotic coder lanes
status: open
assignee: []
created_date: '2026-10-13 10:40'
updated_date: '2026-10-22T14:37:00Z'
due_date: '2026-10-22'
labels:
  - m
dependencies: []
priority: now
type: wish
ordinal: 9999
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ticket: FRM-72 · the pm module revamp, turn 2 of 2026-10-22 · his raw drops sit in the notes below
W1 review the pm flow from A to B: how a wish of mine reaches prod — the shape-idea and shape-lane steps, a wish shaped into a spec that prepares the flow for coders, the lane-closing parts included
W2 evaluate how good it is now: find the weak parts and gaps, find and apply shortcuts, cut redundancies — sharpen and smooth the pm and the coordinator/lead flows together, since they sit close
W3 the biggest failure point: chaotic lanes like the 10-12 mods lane — my steers, my asks, cclio's wants and the wisps forwarded to the coder as cross-session messages, unstructured and easy to lose (they live only in two contexts), so glide shows invalid data
W4 harden and set in stone: my wish (or a found wisp) → to-spec → the coder runs to-tickets → cclio reviews and builds an ordered task graph, the coder's plan and the source of truth for everyone, which glide follows
W5 ❓ who orders the coder's tickets: the coder knows the efficient order of its own scope, cclio sees what is planned after it — grill it
W6 such chaotic lanes are natural and will happen often: they deserve their own name
W7 revisit the lane vocabulary — main lane, second or parallel lane, quick lane — I keep mixing them up
W8 FRM-266 joins the revamp, solved all at once
W9 split summoning and spawning: crew members (cclio, coder, verifier, designer, ccrow, composer) are summons, longer-lasting threads; subagents (researcher, wishkeeper and the rest) are spawns that do something and die — names through x:top-seven
W10 every fleet member's name renamed and reshaped here, one name per thing across fleet-identity, fleet-doors and the skills; first case: «cc cloud» is a claude.ai project thread in x:research but a claude --cloud session in fleet-identity
W11 the PK-240 wish loss is partly a pm-module issue: the full review sees the whole path — wish intake → pocket fold → grill → build — with the audit's numbers (docs/research/wish-data-loss-audit-2026-10-21.md)
W12 the open half of PK-240: wish-loss monitoring, built inside the revamp
W13 the board first: the pm flow drawn in the PM column of «🛼 crew and pm, end to end», one to one from craft-pm, cclio:pm and craft-fleet-flow, then the revamp runs as dima-intervenes' first full-area fix
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

2026-10-21 20:35 halt: folded into W1–W13 (the 17:51 ask); raw drops above unchanged

2026-10-22 inbox (first action), folded — add to the pm revamp scope:
W14 topic to review: the pocket ↔ linear ticket balance
W15 after the pocket moved from a plain file to Backlog.md tickets, PK items flood it; cclio keeps tickets in the pocket and uses linear less often now
W16 ❓ why?
W17 not necessarily bad
W18 the contract of how, when and where tickets are created and placed needs a revisit: is ticket routing set up right in the flows?
W19 tickets land on the right surface, and leave each surface at the right time too

2026-10-22 raw drop (inbox, first actions):
> **add this to pm revamp scope**
> topic to review: pocket/linear ticket balance. after we changed your pocket from plain file to more granularized ticket system via backlog, PK-tickets started to flood your pocket. e.g. you tend to keep tickets in a pocket, and use linear less often now. why? this is not necessarily bad. although the contract of how/when/where you create and place tickets needs a revisit to see if ticket routing is correctly setup in your flows. so tickets lands in a correct surface and leave each surface in a right time too.

2026-10-22 15:25 dima, folded (on the pm board):
W20 a blueprint shows the flow at highlight level only; renames and granular items (FRM-266, summons vs spawns, member renames) stay off the board
W21 the rename revamp (W9, W10) runs after the pm mechanisms are fixed: renames are cosmetic

2026-10-22 16:18 dima's guess at the worst parts (fix mode step 3), folded:
W22 inbox: the main concern is data loss — 10-21 uncovered roughly 35 % of my wishes' data lost; fix this first. if you keep forgetting what I asked for initially, we build the wrong stuff
W23 pocket vs linear: described in my FigJam comments
W24 a lot of lane types confuse me: open the renaming part by rethinking the lane names, shift and night-shift lanes included, and reduce how many lane types we have
W25 fix or resolve in place whenever possible, to stop pocket clutter with chores before it happens — a big one
W26 the loop I keep catching: an «almost freebie» (a thing that could just be solved) gets folded → stays parked, forgotten for a week → I ask for low tide → it gets unfolded and solved; instead, resolve it in place
W27 not for everything, but your call on what can be done now instead of postponed is not precise enough; I often catch your intent to hold things that could be resolved in place, and ask you to do them
raw drop: in this session's transcript, 16:18

2026-10-22 FigJam comments on the pm column (11, read 16:20), folded:
W28 (intake band) the most crucial part: it creates the scope of what we do, and data loss here drifts everything else (the ~35 % wish-loss incident)
W29 (first-use tile) ❓ why lost? how do we not lose data? it is important
W30 (linear rarely reached) true, and understandable: I asked for a fast by-hand tool because linear is farther away (network hops); you have it and it is good, but the balance is off — grill the linear ↔ pocket contract for a turn or two
W31 (two homes) agree on the purpose of each: why both, which kind of ticket at which stage lives on which surface; history: the flowlog file came first, cluttered and parked too long; Backlog.md replaced it, the root issue stayed
W32 (two homes) ❓ why two places at all, why not linear only? linear: the long shelf (bytes, trophy-sys, cv, things for next week or month) + initiatives and milestones; the pocket: the closest stuff in sequential order, because main lanes get steered constantly (today: the railway mails before the pm revamp)
W33 (two homes) the pocket is cclio's mini to-do for the observable future, as empty as possible: by-hand tickets, to-dos born in place, things solvable today or tomorrow; a week out → linear in a good spot; always resolve pocket items (preferred) or move them to linear
W34 (two homes) alternative: the pocket as a lane's plan — store a spawned lane's plan there, handy in shift lanes while I'm afk
W35 (board header) ❓ why are initiatives and milestones not drawn? not drawn = buried, so they get forgotten; low attention to them makes scope steer through the pocket, which is why it grows
W36 (board header) a flow to grill: roadmap/initiatives → milestones → linear tickets → pocket items; or pocket items first (tickets born in the pocket, how/when to refine) → initiatives → milestones → tickets → pocket; initiatives and milestones become two always-watched monitoring points, kept in good shape
W37 (hand-off) ❓ are you still sure to-tickets is better run by the coder, not by you?
W38 (hand-off) without a clear contract the glide is always outdated
W39 (hand-off) steers are unavoidable: I steer the coder on early mistakes or ask you to; you send your own catches; both of us add wishes and corrections
W40 (hand-off) ideally the lane shape is automated; ❓ remind me how you do it now; today you manage it, partly through steers; my steer to the coder drifts the glide, or you forget to update it
W41 (hand-off) ❓ could the glide read its scope from a file — how, is it possible, would it interfere with the flow?

2026-10-22 16:31 dima, folded (band 4 answers + data loss):
W42 agreed: the coder runs to-tickets, then tells cclio to review and steer the order against the overall flow; cclio has the final word
W43 cclio is aware of every steer, however it happened, to steer the coder's order herself
W44 the gap: dima steering a coder inside its own thread; the coder reports to cclio how its execution order changed — a tiny steer (a typo, bold → plain) changes nothing, a steer that adds a mini to-do does
W45 those reports are silent: no push to cclio, delivered through a silent mod (slipstream)
W46 ❓ why summarize my wishes at all, if composer already groomed them into a compact form with no fluff? composer's grooming at the birthplace was meant to solve the bloat (wispr dictation is long and fluffy); bloat is bad too
W47 side ❓ spawn wishkeeper now to formulate the pm module's problem area, spot weak spots, maybe suggest fixes — or zoom further first?

2026-10-22 16:38 dima, folded:
W48 side ❓ can wishkeeper read the FigJam map? it would be useful for it to look
W49 ❓ are the band 4 decisions enough to automate the glide order, or is something left uncovered? if cclio knows everything that steers a coder's order, can cclio shape the final execution order, so the glide is automated from that key file — and what is that file?
W50 ❓ the flow in my mind: cclio runs to-spec → hands the spec to the coder → the coder runs to-tickets → hands the final shape back to cclio; what is the final shape — the many ticket files to-tickets writes, one file holding all of them, or a separate file with the execution order? which file does the glide read? which file holds the coder's final execution order?

2026-10-22 16:53 dima, folded (on the issue list):
W51 plan.md wants a clearer name — lane plan, glide plan, lane glide plan, or similar
W52 ❓ the coder appending a steer line: should it also tell cclio, or is editing the file enough? if the glide is automated and catches the edit itself, cclio is aware anyway, so the message is optional; either way a coder → cclio message is silent (slipstreamed, never pushed)
W53 ❓ why is a verb needed to draw the glide? can the glide run more automated, on its own?
W54 my pocket/linear lines so far are thoughts and ideas to grill on, not a contract yet; generally true, but I expect cclio's own review and proposals
W55 ❓ how do we define a role for pocket and linear so both are useful? we could throw the pocket away and use only linear — simpler? is the pocket dead weight and one more place of confusion?
W56 the pocket's idea: a quick place for cclio to read tickets fast, without becoming clutter; an unfinished contract
W57 a gotcha in I2: today's models, Opus 5.5 included, overestimate time — a 5-minute fix estimated at an hour, a 1-minute freebie at 20 minutes; maybe that is the cause; don't push too hard on it, the built-in habit is tuned that way and my asks could break it
W58 still: tune the habits so cclio resolves in place and does freebies more proactively; maybe a new entity, the «almost freebie» — the folded items are often almost freebies cclio never marked as freebies; propose how to solve it

2026-10-22 17:05 grill round 1 answered — all nine picks taken (Q1–Q9: copy never rewrite; wish-cover reads words; a grill round goes to a file first; monitor M1+M2 now, M3 from 10-28; lane-plan.md; a [progress] ping after an in-thread steer; the mod draws the glide from lane-plan.md; the coder ticks + appends, cclio seals; lanes of 2+ tickets). his steers, folded:
W59 (Q1) my verbatims are always groomed, whatever the source: composer grooms only at the inbox parse; my mainline prompts (wispr dictation, like now) arrive bloated, with grammar mistakes and broken sentences, which hurts clarity; ❓ how do we build a mechanism that grooms every prompt of mine, so a copied verbatim from the mainline is never folded raw?
W60 (Q1) one grooming mode for every source; rule one: always preserve my intent, only clear the fluff, fix the grammar, make the sentences read well even for me
W61 (Q1) remove duplications too; the prompt may be optimized, but never in a machine way: it stays my voice, my wish and my intent come first
W62 (Q9) a freebie can be done by anyone — cclio, the main lane, a parallel lane — even while the main lane is busy
W63 the grill habit: write the round, ccrow reviews it, fold her useful edits, then print the refined round once — no reprinted questions, no double reading (resolved in place 17:06: habit-dima-comms § grill)

2026-10-22 17:14 grill round 2 answered — all four picks taken (composer the one grooming runner + W61 in its rules; the pocket kept with a smaller job; the freebie step-count test, no new entity; form 2 at birth, form 1 for placement, a boot health line). his steers, folded:
W64 (Q2) the pocket is a today-and-tomorrow working set, a little wider than today: the smaller things and the slightly bigger ones, never the huge long ones
W65 (Q2) one exception: a long main-lane ticket that runs for days by design (the memory sweep took roughly 5–7 days) may stay in the pocket as the active item — only ever one such ticket, never several
W66 (Q3) let's try it; a reminder: cclio and the main lane are the same thing — what we do in this thread is the main lane
W67 (Q4) ❓ agreed, but how do we keep milestones healthy? when and how is a milestone born? the same for initiative phases?

2026-10-22 17:30 grill round 3 answered — Q1 and Q2 taken with steers, Q3 taken minus the 7-day line. his steers, folded:
W68 (Q1) what a milestone is: a tool that scopes chunks of work; its contents are tickets; a linear project holds several milestones, ordered, so a project's sequence is built from them
W69 (Q1) the catch: ordering across projects (project A has 3 milestones, project B has 4; in real life we switch, A's first, then B's first or B's third)
W70 (Q1) my proposal: keep the milestone order inside every project precise and current; when we switch to B's milestone 3, move it to the top of B's order
W71 (Q1) milestones are for dima and cclio as the pm only — a higher-level order coders never care about; a lane's order lives in lane-plan.md
W72 (Q1) once the pm revamp settles, review our milestones and start test-driving a milestone-first approach; a good way to scope through milestones may solve much of what follows, the pocket clutter included
W73 (Q1) ask the milestone question all the time: a milestone check at every ticket create, maybe at other ticket operations too, keeps milestones healthy by itself
W74 (Q1) milestones are a first resident of cclio's flows, the lift-off point of planning; initiatives come even before: initiatives → milestones → our flow
W75 (Q1) create and manage milestones together: every milestone cclio means to create is proposed to dima first
W76 (Q1) candidate milestones: the pm revamp (now), speak v2, the cli's preplanned chunks (one or several), the trophy-sys redesign, the chords redesign, the frame → bytes merge, the bun (from pnpm) and oxc (from biome) migration
W77 (Q1) keep milestones balanced, not too many, from the start
W78 (Q2) an idle milestone: park it, refill, close — closing last; keep milestones healthy first-hand
W79 ❓ we have the «mils» vibe word: do we have a milestone emoji? propose a top 7
W80 (Q3) milestone checks, maybe guarded by scripts: propose good ones, not too restrictive
W81 (Q3) the 7-day staleness check is wrong most of the time: work is prepped ahead through milestones and parks for weeks while valid (the cli chunks; speak v2, ready for 2+ weeks, held only by meta work and the weekly window)

2026-10-22 17:36 grill round 4 answered — Q1 taken, Q2 reshaped, Q3 his own pick. his words, folded:
W82 (Q1) try 4 open milestones per project, not a strict limit — 5 is fine; keep each milestone pretty and well scoped
W83 (Q1) good milestone names: short, clear for me to read, maybe with an emoji, consistent, never random; set a naming pattern in resident memory or a skill
W84 (Q2) an empty milestone is most likely closed: it is empty because (1) it was just created and waits to be filled, (2) its last ticket completed — close it in place, or (3) it was solved and the close was forgotten — close it too
W85 (Q3) the milestone emoji: 🎑 (moon viewing)
W86 after the pm revamp is fully resolved: prep the few nearest milestones, the cli lane's first; spawn the cli lane today on the refreshed pm module to test it all; find the issues and weak spots and fix them in place, while the trace is hot
<!-- SECTION:NOTES:END -->
