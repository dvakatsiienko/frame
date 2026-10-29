---
id: PK-108
title: >-
  billing: the $100 → $200 plan switch — when, how proration works, what to
  pre-plan
status: done
assignee: []
created_date: '2026-10-13 10:40'
updated_date: '2026-10-13 15:29'
due_date: '2026-10-20'
labels:
  - m
dependencies: []
priority: later
type: wish
ordinal: 100109
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
recovered inbox 10-12 (billing, his full desktop section in cclio/.scratch/boot-2026-10-13/inbox-recovered.md): $100 window too narrow; considering $200 for a month. questions: is x20 vs x5 really 4×; why the upgrade quoted $148.69 ($200 − $76.09 prorated credit + $24.78 tax) on 10-13 with billing on the 5th; does an upgrade mid-week refresh the weekly window; is a burn-then-switch hack worth it; his idea: ride $100 to 11-04, switch fresh on 11-05; what to push in the $200 window (cli, wide sweeps, designs, building trophy-sys, hq, bytes, atelier), what to pre-plan as execution chunks, a meaningful backup burn (claude plugin eval). wants a few grill sessions upfront. pairs with PK-10.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parked: after the memory sweep (cclio's proposal at the 10-13 boot, his word pending)

his full desktop section, recovered verbatim (10-13):

**billing**
my current cc plan is $100. overall, its usage window is to narrow for me (i have to use cc sparingly to fit). i condsider try $200 at some point. and have few clarification questions and concerns.

plan volume
$100 is advertised as x5. and $200 is as x20. so $200 is 4 bigger than $100? so to get most out of $200 i will have to code four times as much? 

i want to get most use of $200 plan.

when
i'd like to plan this move properly for a few reasons.
1. my chaotic system. i have a lot of meta work planned, which i truly want to complete because i like tidy system, especially if that system is mine.
	1. that's why i ask you to do so many meta work — we polishing my system, i want it to be pristine. after memory sweep we're gona do some some apps (i think speak), and continue meta - migrate to bun, oxc. chords app (sharpening designer skill), then trophy sys. then likely start migrating frame to bytes, plan my hq app and start moving towards my cv.pdf and cv app. evolving our x cli in free windows meanwhile.
	2. all of this wants a lot of my attention and granular refinements. so why i consider this a $200 window spending blocker? because it blocks next point, which is a $200 window full spending door.
2. lack of pre-planned coding scope.
	1. imo, to get most use of $200 i have to plan. and plan a lot. from my experience, our second CLI lane moves pretty fast. it executes prepped lane spec chunks fast, while we prepping them in main lane. to fully utilize $200 window we have to have something moving in parallel all the time, while up-planning, and steering existing prepped chunks in main lane, keeping an eye on actual lane so it does not drifts, and solving their roadblocks. ideally doing something else useful at main lane. doing all of that in likley unavoidable, be still hot.
	2. so, to support that i think it is worth to have a lot of pre-planned chunks across multiple surfaces: apps, meta work, cli, experiments, and possibly, benches: skill benches (claude plugin eval)

plan joining
- how price recalculation works money wise? for example, my $100 bill date is 5 of each month (5.10.2026 last time). i just opened upgrade plan page on 13.10, and it counted me ~$148 up-pay for a switch. does not seem to be fair. i just paid $100 and i'd expect different delta — e.g. up-pay ~$80 to align with $200 x20 plan baseline. why it calculates so oddely?

billing date: 05.10.
```
Order details
Max plan 20x more usage than Pro
$200
Adjustments
Prorated credit for the remainder of Max plan
-$76.09
Subtotal
$123.91
Tax
$24.78
Total due today
$148.69
```
- another tricky question. if i would go via this way: upgrade tmrw, right on 13.10. what happens then? describe full picture. what happens with my current weekly usage if i upgrade? for example if i would use 100% weekly usage up to wednesday. and immediately upgrade to $200. weekly window will refresh? and after than i could go overboard and spend $200 week usage leftover from scratch? e.g. week starts with $100 → i spend 100% weekly window up to ~wednesday → upgrade to $200 → weekly window refreshes → i spend fresh $200 weekly window up until monday. ← the mechanic is like this? and finally: is it worth it?

notes:
- i plan to try $200 plan for one month, then will see
- partially because of this idea of plan swtich, i currently refine the meta work with you now. refining memory system, optimizing fleet flows, sharpening crew-* and subagents skills. so we would have a nice streamlined harness before switch.
- i want to plan the spend smart. x4 usage does not mean burning the money.
- i want to get most gains out of it — spending it on areas i most want to: cli, expensive wide sweeps (like doing a renaming unification sweep — e.g. «fixing off names everywhere» — it is not critical, but costs), drawing designs (they burns quota quickly), and actually, building stuff - trophy sys, my hq, upgrading bytes, and exploring more ideas like evolving atelier into something meaningful — a great art produce spot, maybe exploring video editing, multimodal gen app, etc etc

so:
- help me pick best strategy to upgrade. when would be best time to upgrade?
	- my idea — use current plan up to 4.11 (4 Nov), disable autobill, when my plan ends on 05.11 i enable $200 plan from fresh.
- how to get most use of an actual plan swtich? try some hack like that mid-week-100-burn-then-200switch-and-more-burn? or not worth it?
- what are best areas to push and spent effort on, during $200 plan window? 
- how and what would you suggest to pre-plan? (execution chunks)
- the goal is to spent into something meaningful
- but also have a backup plan to burn qouta on, if we will code not hard enough. my ideas:
	- claude plugin eval — is my only idea, i don't know other ways to burn qouta while having something meaningful out of it.
	- propose what to have here. i want something useful for myself.
- we will have to grill and plan alot upfront, via at least few, dedicated sessions

18:01 researched (3 lanes): ~/frame/.scratch/research/billing-200/synthesis.md. pick: auto-renew off before 11-04, 20× fresh on 11-05 (~$240 with VAT), no mid-week trick (weekly reset undocumented, reports split). left: the pre-plan grill session(s) for the $200 month's chunks.

18:14 dima o153/o154 ✓: reminders 10-27 (planning session), 11-03 (auto-renew off), 11-05 (buy 20×). spend notes, folded from the 3 lanes (outside view, to cut at the 10-27 session): large refactors in worktrees with gates (the naming sweep, merge slices) · one consequential feature end to end per week (trophy-sys, hq, atelier) · design rounds · claude plugin eval against a no-plugin baseline (the backup burn that also grades our skills) · research fan-outs · background and cloud jobs overnight. waste: idle fan-out, panels on routine work. sources: .scratch/research/billing-200/synthesis.md

18:30 done (o157): answered 18:00, the 10-27/11-03/11-05 reminders carry the rest
<!-- SECTION:NOTES:END -->
