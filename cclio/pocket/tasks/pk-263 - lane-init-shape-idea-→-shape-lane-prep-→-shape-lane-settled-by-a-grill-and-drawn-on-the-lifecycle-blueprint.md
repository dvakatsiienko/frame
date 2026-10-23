---
id: PK-263
title: >-
  lane init: shape-idea → shape-lane-prep → shape-lane, settled by a grill and
  drawn on the lifecycle blueprint
status: open
assignee: []
created_date: '2026-10-23T12:50:00Z'
updated_date: '2026-10-23T13:36:00Z'
labels:
  - m
dependencies: []
priority: now
type: task
ordinal: 9999
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
the job: dima's 15:50 draft splits shape-lane into a prep skill with him (seal a chunk, a linear label, seal dates kept as history) and a machine dispatch skill (to-spec, exit lines in the spec, the coder's to-tickets). grill it with ccrow's consult, then wishkeeper over the change (dima 15:50), then draw it on the linear/pocket/spec lifecycle blueprint beside the crew and pm boards. W-lines come from composer's prompt-groom; his raw drop sits in the notes below.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-23 15:50 dima's raw drop, verbatim (prompts file 2026-10-23.md:254–353):

> <pasted_content id="69eb">
> I see an issue. Shape-lane does too much stuff at once. Shape-lane does both the planning job that we do with me (e.g. it involves me) and a chunk dispatch job. Because questions are present, it's a decision by me of what we do, including deciding my wish, processing my wish, and refining my wish.
> 
> This is an issue. Why? Because, as I mentioned, I often want to prep executable chunks for lanes upfront. If we do this with Shape-lane grilling and terrorizing me with questions before each lane is spawned, we will do a lot of moves here back and forth. It's not efficient.
> 
> The efficient way is to plan lane chunks up front, do shape-lane steps 1, 2, and 3, and have this as a probably even separate skill. I think it should be something like prep lane, so we have two skills: prep lane and shape plane. Shape plane will have steps 4 to 7. They are machined and automated.
> 
> Since steps 1 to 3 via the prep lane skill will be connected to me, by executing a prep lane, we agree and we define what we do in the scope of that ticket. That's how a shape-lane chunk is finalized (e.g., approved by me). Then it is considered sealed. We can prep a large amount.
> 
> The requirement for the prep lane skill is the ability to prep a large amount of lane chunks up front, even 10 or even 20. A sealed ticket should be somehow recognizable, maybe with some kind of marker and a date, for example, when a ticket was sealed. When a good time arrives, I could ask you, "Go get prepped chunks for lanes. What can we dispatch?" You could go and grab those prepped tickets and run shape-lane over them yourself.
> 
> What is shape-lane? Shape-lane is a skill where you take a previously prepped/approved by me lane chunk and run to spec over that chunk/ticket or number of tickets. I am still thinking how to make it work.
> 
> Then, in the scope of the shape-lane, after running to spec, the spec should be ready based on the prepped, groomed, sealed chunk. You write exit lines right in the spec and then hand over to coder. Coder does two tickets, and then everything goes as usual. Coder hands over his two-ticket draft to you, and you launch him.
> </pasted_content id="69eb">
> 
>  
> 
> tldr whats new to groom/grill:
> cclio:shape-lane-prep ← current shape-lane 1-3 ← with me, once dune the «chunk» is sealed. proposal: new linear label? so you can filter over prepped chunks to shape them?
> cclio:shape-lane ← current shape-lane 4-7, machinic. you take prepped chunks and formulate to-spec over the chunk. spec includes exit lines.
> 
> questions i do not understand
> chunk vs ticket. We started to use word «chunk» At some point, I actually like it, but let's clear out what it means because it's kind of blurry. How do you think "chunk" means: a ticket or a number of tickets? What is a prep lane chunk? Can a chunk be consisted of multiple tickets? I think not. I think a chunk can simply be referred to as a prepped ticket. 
> chunk — a sealed ticket (with «prepped» label). a produce of «shape-lane-prep» skill. official vibe word. so when i ask what prepped chunks we have you pull «prepped» chunks.
> 
> chunk is NOT the spec. spec is a spec.
> 
> let's grill on name:
> 
> * skil names i proposed good? i yes - lets have them
> * chunk - propose top7 plus is it worth to have «chunk» at all? maybe just «prepped tickets»? but chunk is shorter i like it. still, propose top 7 + emoji
> * «prepped» linear label — propose top7+emoji so we settle everything in fleet vibe. if «shaped» label already exists then is should be «prepped»
> * sealed/prepped — two keywords. means similar thing but i actually like both. let's have both? or discard one? propose.
> 
> 
> contracts:
> 
> * shape-lane-prep: in order to start a side lane,  skill first must be run to decide what side lane does
>    * skill have to support ability to prep large amount of chunks, each sealed with label once sealed. 
>    * each sealed chunk must have a last seal date.
>    * re-seals are possible — when prepped chunk have additions after initial seal.
>    * if re-sealed — new date is appended:
>       * sealed at xx.xx.xxxx
>       * re-sealed at xx.xx.xxxx
>       * important to not overwrite (keep history) for easier tracking/flow debugging
>    * prepped and sealed tickets must be pretty and easy to read, optionally have emojies
> * spec is short-lived. 
>    * born by shape-lane skill, which runs right before the side lane is up to be started
>    * parked only because of a reason — for example my weekly window run out, or i asked to pase lane mid-flight because im tired.
>    * spec is mandatory for «side lane» and «shift lane», «quick lane» can have spec optionally
> 
> 
> --refinement
> i think «prepped» is redundant. «sealed» is better.
> final proposal (and you propose yours ideas too, and fixes on what i missed):
> 
> * shape-lane-prep ← starts prepping. the result is «sealed» chunk.
> * «sealed» - is a label in linear, you filter with it to find sealed chunks for dispatching
> * dispatch — new keyword, when i ask like «what can we dispatch?» 
>    * means — starting a side lane or shift lane
>    * you go look for «sealed» chunks and offer.
>    * since a sealed chunks is always prepped (seal or re-seal date is a proof)
>    * only sealed chunks can be dispatched
>    * dispatching assumes ongoing shape-lane skill run over a picked sealed chunk
> * shape-lane — you thank a sealed chunk and run to-spec over it. a spec is born in place.
>    * to-spec → exit lines inside → coder runs to-tickets → hands over to you, you approve and coder starts
>    * after side lane is done
> * shape-lane-prep and shape-lane both
>    * applies to any side lane and any shift lane. each sealed chunk must be compatible with ongoing shape-lane run for these types of lanes.
>    * side lane and shift lane cannot run without these
>    * quick lane can
> 
> --
> 
> * A pocket item that becomes a 🔧 coder job: does it get a linear ticket first, or go straight to a spec? ← to be decided later, i think a pocket item can be shape-lane-prep first, then be dispatched with «shape-lane» right after.
> 
> --
> my questions :
> 
> * how shape-idea fits here? print what shape idea does now.
> * shape-idea → shape-lane-prep → shape-lane flow works?
> 
> --
> 
> <pasted_content id="69eb">
> I was just printing this whole prompt for about half an hour, at least. As you see, I've discovered a pretty noticeable issue in how our lane initialization phase was previously made. Here is my ask: carefully parse this draft that I just proposed, and let's think on it and maybe even grill on it so we settle:
> 
> 1. shape idea
> 2. shape lane prep
> 3. shape lane flow
> 
>  Grill on everything: every part of my proposal, names, emojis, keywords, and entities that should be present in Fleet Vibe, so we can clearly distinguish keywords. Think critically and propose cuts on what is not needed as well. Do not rely on my proposals as valid ones, because I expect that you will propose your improvements to my ideas as well. Most importantly, save everything up to the blueprint drawing part, because printing everything like this takes a really lot of time and effort from me. I want everything that we currently discuss to be drawn on a blueprint. Also, find the nearest best time to actually draw blueprints, as we agreed:
> 
> 1. draw and translate existing figjam to all surfaces: Obsidian, draw.io, and ntn. Let me pick a comparison.
> 2. start drawing a linear/pocket contract in a blueprint, including all these details that I just printed in this prompt, so we have it visualized.
> </pasted_content id="69eb">
> 

15:50 dima, mid-turn: «Consult with cCRO, and once we groom ourselves, do a wishkeeper over this change because it kind of matters.»

2026-10-23 15:53 the fold, by composer's prompt-groom (one point a line; 🎙️ «shape plane» → shape-lane, «thank» → take, «cCRO» → ccrow, «ntn» → n8n):
W1 i see an issue. shape-lane does too much stuff at once.
W2 shape-lane does both the planning job we do with me (it involves me) and a chunk dispatch job.
W3 because questions are present, it's a decision by me of what we do: deciding my wish, processing my wish, and refining my wish.
W4 this is an issue. as i mentioned, i often want to prep executable chunks for lanes upfront.
W5 if we do this with shape-lane grilling and terrorizing me with questions before each lane is spawned, we will make a lot of moves back and forth. it's not efficient.
W6 the efficient way: plan lane chunks up front, do shape-lane steps 1, 2, and 3, and probably even have this as a separate skill.
W7 i think it should be something like prep lane, so we have two skills: prep lane and shape plane.
W8 shape plane will have steps 4 to 7. they are machined and automated.
W9 steps 1 to 3 via the prep lane skill will be connected to me. by executing a prep lane, we agree and define what we do in the scope of that ticket.
W10 that's how a shape-lane chunk is finalized (e.g., approved by me). then it is considered sealed.
W11 we can prep a large amount.
W12 the requirement for the prep lane skill is the ability to prep a large amount of lane chunks up front, even 10 or even 20.
W13 a sealed ticket should be somehow recognizable, maybe with some kind of marker and a date, for example when the ticket was sealed.
W14 when a good time arrives, i could ask: «Go get prepped chunks for lanes. What can we dispatch?» you could go and grab those prepped tickets and run shape-lane over them yourself.
W15 shape-lane is a skill where you take a previously prepped, approved-by-me lane chunk and run to spec over that chunk/ticket or number of tickets.
W16 i am still thinking how to make it work.
W17 in the scope of shape-lane, after running to spec, the spec should be ready based on the prepped, groomed, sealed chunk.
W18 you write exit lines right in the spec, and then hand over to coder.
W19 coder does two tickets, and then everything goes as usual.
W20 coder hands over his two-ticket draft to you, and you launch him.
W21 tldr, what's new to groom/grill:
W22 cclio:shape-lane-prep ← current shape-lane 1-3 ← with me, once the «chunk» is sealed.
W23 cclio:shape-lane ← current shape-lane 4-7, machinic. you take prepped chunks and formulate to-spec over the chunk.
W24 spec includes exit lines.
W25 questions i do not understand:
W26 chunk vs ticket. we started to use the word «chunk» at some point. i actually like it, but let's clear out what it means, because it's kind of blurry.
W27 i think not. i think a chunk can simply be referred to as a prepped ticket.
W28 chunk: a sealed ticket (with «prepped» label). a produce of the «shape-lane-prep» skill. official vibe word.
W29 so when i ask what prepped chunks we have, you pull «prepped» chunks.
W30 chunk is NOT the spec. spec is a spec.
W31 let's grill on names.
W32 skill names: i yes, let's have them.
W33 chunk: still, propose top 7 + emoji. but chunk is shorter, i like it.
W34 «prepped» linear label: propose top 7 + emoji, so we settle everything in fleet vibe.
W35 if a «shaped» label already exists, then it should be «prepped».
W36 sealed/prepped: two keywords. they mean similar things, but i actually like both.
W37 contracts:
W38 shape-lane-prep: to start a side lane, the skill must first be run to decide what the side lane does.
W39 the skill has to support prepping a large amount of chunks, each sealed with a label once sealed.
W40 each sealed chunk must have a last seal date.
W41 re-seals are possible, when a prepped chunk has additions after its initial seal.
W42 if re-sealed, the new date is appended: «sealed at xx.xx.xxxx», then «re-sealed at xx.xx.xxxx».
W43 important: do not overwrite, keep history, for easier tracking and flow debugging.
W44 prepped and sealed tickets must be pretty and easy to read, optionally with emojis.
W45 spec is short-lived.
W46 born by the shape-lane skill, which runs right before the side lane is up to be started.
W47 parked only for a reason: for example my weekly window ran out, or i asked to pause the lane mid-flight because i'm tired.
W48 spec is mandatory for «side lane» and «shift lane»; «quick lane» can have spec optionally.
W49 refinement:
W50 i think «prepped» is redundant. «sealed» is better.
W51 final proposal (and you propose your ideas too, and fixes on what i missed):
W52 shape-lane-prep ← starts prepping. the result is a «sealed» chunk.
W53 «sealed» is a label in linear. you filter with it to find sealed chunks for dispatching.
W54 dispatch: a new keyword, when i ask like «what can we dispatch?»
W55 means: starting a side lane or shift lane.
W56 you go look for «sealed» chunks and offer.
W57 since a sealed chunk is always prepped (the seal or re-seal date is the proof).
W58 only sealed chunks can be dispatched.
W59 dispatching assumes an ongoing shape-lane skill run over a picked sealed chunk.
W60 shape-lane: you thank (?) a sealed chunk and run to-spec over it.
W61 a spec is born in place.
W62 to-spec → exit lines inside → coder runs to-tickets → hands over to you; you approve and the coder starts.
W63 after side lane is done.
W64 shape-lane-prep and shape-lane both:
W65 applies to any side lane and any shift lane.
W66 each sealed chunk must be compatible with the ongoing shape-lane run for these types of lanes.
W67 side lane and shift lane cannot run without these.
W68 quick lane can.
W69 to be decided later: i think a pocket item can be shape-lane-prep first, then be dispatched with «shape-lane» right after.
W70 my questions:
W71 i was just printing this whole prompt for about half an hour, at least.
W72 i've discovered a pretty noticeable issue in how our lane initialization phase was previously made.
W73 my ask: carefully parse this draft i just proposed, and let's think on it, and maybe even grill on it so we settle:
W74 1. shape idea · 2. shape lane prep · 3. shape lane flow
W75 grill on everything: every part of my proposal, names, emojis, keywords, and entities that should be present in Fleet Vibe, so we can clearly distinguish keywords.
W76 think critically and propose cuts on what is not needed as well.
W77 do not rely on my proposals as valid ones, because i expect you will propose your improvements to my ideas too.
W78 most importantly, save everything up to the blueprint drawing part: printing everything like this takes a really lot of time and effort from me.
W79 i want everything we currently discuss to be drawn on a blueprint.
W80 also, find the nearest best time to actually draw blueprints, as we agreed:
W81 1. draw and translate existing figjam to all surfaces: Obsidian, draw.io, and ntn.
W82 let me pick a comparison.
W83 2. start drawing a linear/pocket contract in a blueprint, including all these details i just printed in this prompt, so we have it visualized.
W84 consult with cCRO.
❓1 (275) would a new linear label let you filter over prepped chunks to shape them?
❓2 (279) how do you think «chunk» means: a ticket or a number of tickets?
❓3 (279) what is a prep lane chunk?
❓4 (279) can a chunk consist of multiple tickets?
❓5 (286) are the skill names i proposed good?
❓6 (287) is it worth having «chunk» at all, or maybe just «prepped tickets»?
❓7 (289) let's have both? or discard one? propose.
❓8 (331) a pocket item that becomes a 🔧 coder job: does it get a linear ticket first, or go straight to a spec?
❓9 (336) how does shape-idea fit here?
❓10 (336) print what shape-idea does now.
❓11 (337) does the shape-idea → shape-lane-prep → shape-lane flow work?

2026-10-23 16:29 dima, raw (prompts file :398):
> ## 16:29
> 
> shape-idea, your framing: it’s the right one, and today’s skill doesn’t match it. Today it outputs app documents (PRODUCT.md, a features doc, glossary words), never a ticket ← 
> 
> <pasted_content id="69eb">
> A question: why does today's Shape Idea not create a ticket out of an idea, but create a product.md, feature doc, and glossary words right away, upfront? Isn't it too quick to create product.md and feature docs right away?
> 
> Again, I was just printing my thoughts. I think I do not propose my idea as the right one. I don't know if it will work. I expect you will propose your own ideas on how to make this work.
> 
> Why do I think it is a good idea to use a Shape Idea? I think a Shape Idea is a skill that makes a solid ticket be born out of my wish. How, then, will tickets be born out of my wishes?
> 
> Shape Idea is optional, Dora, because, as I told previously, a ticket can be created even without Shape Idea if that is a simple wish, like a mechanical one. If it is more intricate and related to a feature or a product, or even a technical one that I want to shape granularly, we run Shape Idea over it. I'm not sure what to do with product.md, feature docs, and glossary words. They are also still needed, and if we cut them out of Shape Idea, where do they belong, then? How to not forget about them?
> </pasted_content id="69eb">
> 
>  
> 
> --
> draw.io ← Do not forget to clear all test drives and watchers and everything related, so the Blueprint tool is settled. 
> 
> --
> And let's not rush with everything. Let's first settle these changes to skills that we currently grill on. After everything is completed, print me the full flow in this thread, with all steps for each skill: Shape Idea, then Shape Lane, and Shape Lane Dispatch. Ensure that the flow is good, covers everything and all cases, and we don't miss anything. Also answer what to do with product.md and other things that currently Shape Idea does? 
> 
> Also, you are at 60% CTX, and you need a second wind. Tell me when I can set a second wind. You pick a good spot.
>

2026-10-23 16:30 cclio, settled by his ticks: Q1 shape-lane (with dima) + shape-lane-dispatch (cclio); Q2 «chunk» = one signed ticket, emoji 🍫; Q3 ✍️ signed (his yes, a linear label) → 🦭 sealed (spec + exit lines + lane plan ready, in the lane folder; «seal» keeps today's meaning) → dispatched (lane started); Q4 a `## signed` block, one appended line per sign or re-sign. round 2 open: shape-idea's output (a ticket? where PRODUCT.md, FTR, glossary go), a quick lane without a sign, a stale sign at dispatch, the spawn ask folded into the dispatch pick, two chunks in parallel, a pocket item signed into linear (W69). then wishkeeper over the change, then the full flow printed per skill (dima 16:29).

W85 once we groom ourselves, do a wishkeeper over this change, because it kind of matters.
2026-10-23 16:33 dima, raw: «so PRODUCT.md and rest of docs that currently shape-idea procues are better to be written via shape-lane (when applicable, optional. or not optional?)? or when?» · «I approve issue posting it right away. Send me a link after it is created.» · «and whats wrong? why ticket is created?» (posted: https://github.com/github/gh-stack/issues/587)
<!-- SECTION:NOTES:END -->
