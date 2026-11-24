---
id: PK-468
title: 'ticket flow: no forgotten seals, the sign removed, scope creep still visible'
status: open
assignee: []
created_date: '2026-11-24T14:49:00Z'
updated_date: '2026-11-24T15:44:00Z'
labels:
  - s
  - clio-wing-1
dependencies: []
priority: next
type: task
ordinal: 99999
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-468:W1 (2026-11-24 16:45, dima): Okay my next ask is related to ticket flow.

PK-468:W2 (2026-11-24 16:45, dima): Recently there were more incidents where crew members were parked because you forgot to seal the ticket.

PK-468:W3 (2026-11-24 16:45, dima): This is the first problem that I want to solve.

PK-468:W4 (2026-11-24 16:45, dima): The second problem is the signing of the tickets.

PK-468:W5 (2026-11-24 16:45, dima): I feel that since we introduced the ticket signing step, I am not sure that it is useful.

PK-468:W6 (2026-11-24 16:45, dima): As far as I remember, signing of the tickets was intended as a gate on me so I approve the tickets that way.

PK-468:W7 (2026-11-24 16:45, dima): Now I'm not sure if signing of the tickets is actually needed.

PK-468:W8 (2026-11-24 16:45, dima): What I observed is that you ask me an incredible large amount of times in Orbit to allow you to sign a ticket.

PK-468:W9 (2026-11-24 16:45, dima): I feel that this back-and-forth is probably redundant or needs to be turned into something useful.

PK-468:W10 (2026-11-24 16:45, dima): From what I see you just block yourself by asking me to sign a ticket, which looks like a simple permission request.

PK-468:W11 (2026-11-24 16:45, dima): You ask me, "Can I sign a ticket?" and I tick yes.

PK-468:W12 (2026-11-24 16:45, dima): I don't have any useful info about the sign and what's happening is just that you ask me to click and that's it.

PK-468:W13 (2026-11-24 16:45, dima): The gate that was intended to be useful, by me protecting the tickets from unnecessary scope creeping, turned into plain clicking, which also blocks the lane sometimes because you cannot dispatch an unsigned chunk to a lane.

PK-468:W14 (2026-11-24 16:45, dima): You also often forget to ask for a sign, which creates multiple layers of problems on top of that.

PK-468:W15 (2026-11-24 16:45, dima): Let's unfold this part.

PK-468:W16 (2026-11-24 16:45, dima): Remind me why we have signing and how it works, in short, in simple language, and propose how to optimize this part.

PK-468:W17 (2026-11-24 16:45, dima): In my mind I was planning to actually remove the signing of the tickets entirely, fully, but I still wanted to protect tickets somehow from the scope creeping.

PK-468:W18 (2026-11-24 16:45, dima): I discovered that scope creep is actually dangerous stuff, especially after our incident with a guard lockout, where you built a guard that locked us out.

PK-468:W19 (2026-11-24 16:45, dima): I still want a mechanism to see what you want to fold into the tickets but I wanted it to work in a way so it doesn't distract me too much and doesn't block you.

PK-468:W20 (2026-11-24 16:45, dima): How could we have that? ❓

PK-468:W21 (2026-11-24 17:06, dima): [Why we have it. You asked for it on 23 Oct, for two reasons: an edit after your yes is a hint of drift, and ten approved tickets can run alone while you're afk.] [an edit after your yes is a hint of drift] what is it? ❓

PK-468:W22 (2026-11-24 17:06, dima): [ten approved tickets can run alone while you're afk] it can't, instead we created another blocker.

PK-468:W23 (2026-11-24 17:06, dima): q1: I lean towards deleting.

PK-468:W24 (2026-11-24 17:06, dima): q2: herdr not supports assumptions yet (only assks).

PK-468:W25 (2026-11-24 17:06, dima): q3: scope creep protection is important (guard lockout story, that you created while I missed it).

PK-468:W26 (2026-11-24 17:06, dima): [Q4 - how do seals stop being forgotten? a fresh helper drafts the next chunk's spec the moment a chunk starts] Isn't creating the specs (e.g., sealing the chunk right before dispatching) the root of the problem? ❓

PK-468:W27 (2026-11-24 17:06, dima): Because from what I remember, last time you dispatched a ticket without an actual spec and that's why the lane was hanged.

PK-468:W28 (2026-11-24 17:06, dima): no actions yet, I still thinking how to solve.

PK-468:W29 (2026-11-24 17:06, dima): provie feedback on what I wrote.

PK-468:W30 (2026-11-24 17:06, dima): I red your grill proposal.

PK-468:W31 (2026-11-24 17:20, dima): I thinked a little.

PK-468:W32 (2026-11-24 17:20, dima): on siging - I still think to change signing.

PK-468:W33 (2026-11-24 17:20, dima): but now consider to either delete it or just change it.

PK-468:W34 (2026-11-24 17:20, dima): the idea is not bad, current implementation not works.

PK-468:W35 (2026-11-24 17:20, dima): [coord memory index, ticket flow] related: we get rid of "signed/resigned" feature completely.

PK-468:W36 (2026-11-24 17:20, dima): all tickets are edited only by you anyways.

PK-468:W37 (2026-11-24 17:20, dima): I peek into them 1% of time for a min or few, so no too many uses.

PK-468:W38 (2026-11-24 17:20, dima): or we keep it but trim its influence level, remove blocking nature.

PK-468:W39 (2026-11-24 17:20, dima): your tickets are always auto signed.

PK-468:W40 (2026-11-24 17:20, dima): by you.

PK-468:W41 (2026-11-24 17:20, dima): you are not allowed to dispatch unsealed tickets.

PK-468:W42 (2026-11-24 17:20, dima): only signed tickets can be sealed.

PK-468:W43 (2026-11-24 17:20, dima): what is signing: a ready gate check.

PK-468:W44 (2026-11-24 17:20, dima): you groom the ticket, ensure it is relevant, have full necessary content.

PK-468:W45 (2026-11-24 17:20, dima): also contains useful practical info, for example: for speak v2 we did quite a lot of research.

PK-468:W46 (2026-11-24 17:20, dima): targeted research allowed crew to consult with our findings, and verdicts/decisions (each research should have its own verdict/outcome).

PK-468:W47 (2026-11-24 17:20, dima): so whenever ticket scope grows or changes - it needs grooms at certain points.

PK-468:W48 (2026-11-24 17:20, dima): and you often fold small stuff into a ticket.

PK-468:W49 (2026-11-24 17:20, dima): so a sign is a lint that assk you to ensure that ticket integrity is healthy, so it can be dispatched safely.

PK-468:W50 (2026-11-24 17:20, dima): so each ticket links its research.

PK-468:W51 (2026-11-24 17:20, dima): research should apply to all fleet.

PK-468:W52 (2026-11-24 17:20, dima): seals: we have ordered lanes chunks, this is agreed and I set linear ticket order to "manual".

PK-468:W53 (2026-11-24 17:20, dima): seal rule: nearest 2 chunks of each lane must always be fully signed, fully sealed and ready to be started by a lane anytime.

PK-468:W54 (2026-11-24 17:20, dima): signs and seals or reseals are never postponed.

PK-468:W55 (2026-11-24 17:20, dima): if seal is completed but scope changed = reseal right now, no postpones.

PK-468:W56 (2026-11-24 17:20, dima): if two nearest chunks were sealed, but chunks order changed like chunks 2 moved to chunk 4 - keep sealed spec for chunk 4, and create new seal for new chunk 2.

PK-468:W57 (2026-11-24 17:20, dima): if we do dramatic changes like reassemble/merge/cancel tickets - how to solve it? ❓

PK-468:W58 (2026-11-24 17:20, dima): I suppose mergingin/slicing specs could sometimes be easier to do from scratch if sealed chung gets merged into other chunk for example? ❓

PK-468:W59 (2026-11-24 17:20, dima): how do you think? ❓

PK-468:W60 (2026-11-24 17:20, dima): don't grill yet.

PK-468:W61 (2026-11-24 17:20, dima): is my idea works? ❓

PK-468:W62 (2026-11-24 17:20, dima): consult with crow and clio main before answering.

PK-468:W63 (2026-11-24 17:20, dima): my take: most dangerous part here is that I remove the signing part as a protection of scope creep (which does not work well anyways).

PK-468:W64 (2026-11-24 17:20, dima): But doing no actions on this at all is also not good because signing is currently broken and blocks you and distracts me so I want to solve it.

PK-468:W65 (2026-11-24 17:20, dima): I'm not sure if my proposal will work so it is an attempt to fix the flow and improve how everything works.

PK-468:W66 (2026-11-24 17:30, dima): [call it "ready", not "signed"] maybe then let's keep "signed" - it means that I "approved" ticket.

PK-468:W67 (2026-11-24 17:30, dima): done once after we shape idea.

PK-468:W68 (2026-11-24 17:30, dima): not all tickets have sign, only ones that were created via shape idea.

PK-468:W69 (2026-11-24 17:30, dima): no resigns ❓

PK-468:W70 (2026-11-24 17:30, dima): [it can't depend on me remembering. the "two sealed" rule has existed since 23 Nov and nothing runs it except my siestas, the halt and one lane report. it has to fire when the queue moves: a start, a close, a reorder, a ticket edit.] The halt is not a good place for it because usually when I end the day, I ask you to wind down, then you stop everyone, then I ask you to peek lanes.

PK-468:W71 (2026-11-24 17:30, dima): At this point you already should do the sealing of the nearest of two chunks.

PK-468:W72 (2026-11-24 17:30, dima): At the halt I expect that the plan for all lanes is already healthy.

PK-468:W73 (2026-11-24 17:30, dima): You still can have a mechanical check if two nearest chunks for planned lanes are sealed but that's not the real place where I do the lane health check.

PK-468:W74 (2026-11-24 17:30, dima): I do that slightly earlier and actually I could do that at any time, even midday for example.

PK-468:W75 (2026-11-24 17:30, dima): [Where main and I differ. Main wants "two sealed" only for running lanes, since sealing idle ones is work nobody runs. You wrote "each lane", and your pain was the morning prep. I'd take running lanes plus whatever starts tomorrow.] Yes not every single lane milestone we have in Linear because that would be overkill.

PK-468:W76 (2026-11-24 17:30, dima): This rule applies only to lanes that we currently have active.

PK-468:W77 (2026-11-24 17:30, dima): For example we almost every day have active mods lane and Herdr lane.

PK-468:W78 (2026-11-24 17:30, dima): Today we have speak lane and Herdr lane is paused until it had space in capacity.

PK-468:W79 (2026-11-24 17:30, dima): I didn't start Herdr lane because I expected that it will overload the comms channel and only for that reason.

PK-468:W80 (2026-11-24 17:30, dima): FRM-590 — a mod area or simple script? ❓

PK-468:W81 (2026-11-24 17:30, dima): [I'd go with your version plus the "ready" word. Nothing started.] propose how "ready" new keyword would work ❓

PK-468:W82 (2026-11-24 17:30, dima): what odes it mean, and what do you do in terms of that "ready" ❓

PK-468:W83 (2026-11-24 17:37, dima): [a script checks what can be seen. your 🌠 wishes are covered, the done test is there, each research is linked with its verdict, no question of yours is open, its place in the order is set, and my additions are marked.] Research linking is important.

PK-468:W84 (2026-11-24 17:37, dima): I figured out that this is a part that we were missing entirely all the time.

PK-468:W85 (2026-11-24 17:37, dima): With Speak app, for example, we did thorough research about the latest best practices of building read-aloud applications.

PK-468:W86 (2026-11-24 17:37, dima): Lane doesn't know about it but research contains a lot of useful info for them.

PK-468:W87 (2026-11-24 17:37, dima): We are kind of not using the best gains out of the research.

PK-468:W88 (2026-11-24 17:37, dima): Each ticket that has useful research parked for it should link to that research and this knowledge should reach the lane so they can peek into the research.

PK-468:W89 (2026-11-24 17:37, dima): and use that info for building.

PK-468:W90 (2026-11-24 17:37, dima): [The halt. Agreed. Sealing belongs to your lane peek, in the wind-down or at midday, and to the moments the queue moves. The halt keeps only the mechanical check, which should find nothing.] Yes but you still need to tend to keep two nearest chunks for a lane sealed.

PK-468:W91 (2026-11-24 17:37, dima): You keep the current chunk sealed obviously because it usually what The lane is doing currently and one up front, just in case, so the lane can move continuously.

PK-468:W92 (2026-11-24 17:37, dima): And seals are silent.

PK-468:W93 (2026-11-24 17:37, dima): You don't ask me for permission to seal.

PK-468:W94 (2026-11-24 17:37, dima): It's your default habit.

PK-468:W95 (2026-11-24 17:37, dima): The only reason that two nearest chunks can be unsealed is only because you forgot, not because you didn't ask me or I didn't approve you.

PK-468:W96 (2026-11-24 17:37, dima): So except for peek lanes and halt, what are other key points in time where you could do this sealing? ❓

PK-468:W97 (2026-11-24 17:37, dima): And when you plan to groom tickets to be compatible with ReadyCheck? ❓

PK-468:W98 (2026-11-24 17:37, dima): also, let's have an emoji for "ready" check.

PK-468:W99 (2026-11-24 17:37, dima): I want it to be a part for sign-ready-seal set.

PK-468:W100 (2026-11-24 17:37, dima): each with emoji, each via bold font.

PK-468:W101 (2026-11-24 17:37, dima): since it is an essential ticket lifecycle flow.

PK-468:W102 (2026-11-24 17:37, dima): The part counter is neither a mod nor a loose script.

PK-468:W103 (2026-11-24 17:37, dima): [On 13 Nov we settled on a small command in our cli, x fleet growth] can stray do this? ❓

PK-468:W104 (2026-11-24 17:42, dima): [Research. You're right about tickets: of 136 open ones, 17 link a research file, and none of the 8 speak tickets I opened does. Speak's lane isn't fully blind though] link all parked speak reserches to corresponding tickets, and maybe into specs if needed, so lane is aware.

PK-468:W105 (2026-11-24 17:42, dima): ok.

PK-468:W106 (2026-11-24 17:42, dima): do we need a grill after few recent turns? ❓

PK-468:W107 (2026-11-24 17:42, dima): I did not answered your grill fully, because this problem is tricky and complicated.

PK-468:W108 (2026-11-24 17:42, dima): and even current decisions are not clear enough to me.

PK-468:W109 (2026-11-24 17:42, dima): I am not sure if it will solve the problem and if it will make things better.
<!-- SECTION:NOTES:END -->
