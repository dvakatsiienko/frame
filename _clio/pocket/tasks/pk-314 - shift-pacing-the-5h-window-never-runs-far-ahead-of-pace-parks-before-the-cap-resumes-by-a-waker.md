---
id: PK-314
title: >-
  shift pacing: the 5h window never runs far ahead of pace, parks before the
  cap, resumes by a waker
status: open
assignee: []
created_date: '2026-11-03T17:10:00Z'
updated_date: '2026-11-03T17:18:00Z'
labels:
  - m
dependencies: []
priority: now
type: task
ordinal: 9999
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima 19:10 (after the 18:03 cap starved keep-hot for 7 of 8 members). W-lines from helga's groom of grooms/2026-11-03-1910.raw.md. homes: clio:shift § presence and the 5h rules, habit-ctx-load-balancing, a waker. the keep-hot miss on the mods sixth sense rides here (inference: its key was armed 16:36 after its last turn end at 16:34, and stash reads the key only at a turn end)
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
W1 (2026-11-03 19:10, dima): note: keep-hot did not work for sixth sense: mods lane 4 | main. i watched his cache timer and it reached 52-53m. so i pinged him manually.
W2 (2026-11-03 19:10, dima): but codie: clio-lean | FRM-491 actually refreshed. odd.
W3 (2026-11-03 19:10, dima): why sixth sense did not keep hotted? ❓
W4 (2026-11-03 19:10, dima): everyone else looks to be keep-hotted.
W5 (2026-11-03 19:10, dima): 5h 100% reached earlier than everyone could survive keep-hot. fyi. that's fine for now but not good overall.
W6 (2026-11-03 19:10, dima): We need to find a way to avoid a clash like this, where, after parking everyone, there is not enough space in the 5-hour window to sustain keeping cache hot for everyone until the full reset.
W7 (2026-11-03 19:10, dima): This time today, we started with roughly 97% of the 5-hour window, when there were around 2 hours 20 minutes left until the 5-hour reset. We had roughly 3% of the 5-hour window to sustain keeping cache hot for everyone that is currently present. It is 8 threads with different context sizes.
W8 (2026-11-03 19:10, dima): Everyone survived the first wave of keep cache hot, but on the second wave, the 5-hour limit was too filled, overfilled. Now it caused a clash where everyone doesn't have a space for keep cache hot, and the cache of almost everyone except you went hot. Only you were able to fit in to do the last cache hot.
W9 (2026-11-03 19:10, dima): It's because of luck, so this needs to be solved. Let's find out how. I see a few key points where we need to aim to make sure that everyone survives.
W10 (2026-11-03 19:10, dima): 1. always keep an eye on 5h window, its the worst enemy of the shift sustain
W11 (2026-11-03 19:10, dima): 2. when shift approaches ~90% if 5h - park everyone. do not let anyone to finish the current chunk. instead — plan earlier. roughly at ~70-80% tell lanes to not start next chunk. instead — park and wait for:
W12 (2026-11-03 19:10, dima): 2.1. 5h window pace to cool down
W13 (2026-11-03 19:10, dima): 2.2. 5h window reset
W14 (2026-11-03 19:10, dima): 2.3. then resume them when either of these is unlocked
W15 (2026-11-03 19:10, dima): 3. so everyone should stop at roughly ~90% of 5h window.
W16 (2026-11-03 19:10, dima): 3.1. then — you should have some watcher/waker — ping yourself and check 5h window state. wait for reaching around -2%-1% or 0.
W17 (2026-11-03 19:10, dima): 3.2. then resume, ideally when there is ~1h left until 5h reset so no keep cache hot pings are needed — after 5h reset everyone just gets resumed with a waker
W18 (2026-11-03 19:10, dima): 4. this is a strategy when lanes are far too ahead of 5h pace. but actually, it is better just to avoid a situation like this that we just had now, because right now we kind of stress-tested a shift by reaching too far ahead of the 5-hour pace before actually parking everyone.
W19 (2026-11-03 19:10, dima): At the moment of parking, when we were at about 97% of the 5-hour window and there were about 2 hours left until the 5-hour reset, we were around 20% or 30% ahead of the actual 5-hour pace. We were in a rough situation initially, and this is not good.
W20 (2026-11-03 19:10, dima): As of now, partially it was because of my instructions, because I told you to run the main, but we need to change this habit by default. You would then keep an eye on the 5-hour base yourself and not let the 5-hour base get higher than 5% to 10% ahead of time, usually during a shift when I am not new to the keyboard.
W21 (2026-11-03 19:10, dima): When you spot that the 5-hour window goes too far ahead of the base, you tell everyone to park and wait for the base to cool down until there is around 1% to 2%, or 0%, roughly.
W22 (2026-11-03 19:10, dima): so. when i afk and shift is active your prios:
W23 (2026-11-03 19:10, dima): 1. park everyone more often, do not let 5h pace to go too far ahead, make lanes pit stops instead
W24 (2026-11-03 19:10, dima): 2. this way, reaching 90% of 5h window will be smoother. if at ~90% 1h or less of 5h is met — you just push everyone until 100% then waker wakes everyone.
W25 (2026-11-03 19:10, dima): when i am next to kb its also good habit, but when i tell to go, you go. because often i just want to burn 5h window (like right now).

W26 (2026-11-03 19:14, dima): note: today, yesterday, and tomorrow, I push you to do a lot of stuff and stress test, like today, because I'm also burning the weekly usage.
W27 (2026-11-03 19:14, dima): My current plan will finish on Thursday around 5 pm, so until then, I'm burning my weekly usage by clean activity that we do right now.
W28 (2026-11-03 19:14, dima): Currently, weekly usage is 60%, which is what I want.
W29 (2026-11-03 19:14, dima): Today, let's burn the remaining 5-hour window, but also try to do meaningful stuff and finish everyone before the 5-hour window resets.
W30 (2026-11-03 19:14, dima): Tomorrow, we do similar stuff.
W31 (2026-11-03 19:14, dima): We burn 5-hour windows fully, and ideally tomorrow or the day after tomorrow, reach 100% of weekly usage or 95%, so I will have space to work with the game project.
W32 (2026-11-03 19:14, dima): Then I will park and wait until I buy the $200 plan as soon as I planned.

W33 (2026-11-03 19:16, dima): by burning 5h and weekly window i mean that we not just burn, we do useful stuff. no waste burning.
<!-- SECTION:NOTES:END -->
