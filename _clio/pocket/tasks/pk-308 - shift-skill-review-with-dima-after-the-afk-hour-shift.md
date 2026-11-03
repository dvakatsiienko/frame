---
id: PK-308
title: shift skill review with dima, after the afk-hour shift
status: open
assignee: []
created_date: '2026-11-03T13:00:00Z'
updated_date: '2026-11-03T17:08:00Z'
labels:
  - s
dependencies: []
priority: now
type: task
ordinal: 9999
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima 14:49: review how shift mode ran and fix clio:shift's weak spots, after a wishkeeper flow over the shift. inputs: the plan's ## shift watch (_clio/shifts/2026-11-03-afk-hour.md); his 14:39 shift-groom W-lines sit in PK-159 as W1834–W1854; his 14:49 and 14:50 lines land here as W-lines
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
W1863 (2026-11-03 14:49, dima): Okay, I then start the shift plane now and go AFK.
W1864 (2026-11-03 14:49, dima): While you will be in shift mode, it is important to observe how shift mode works and trace inefficiencies in this skill and weak spots.
W1865 (2026-11-03 14:49, dima): When I return, let's review how shift mode was running, and let's find which weak spots are in the shift skill.
W1866 (2026-11-03 14:49, dima): I want it to be reliable.
W1867 (2026-11-03 14:49, dima): Ask Cicro to monitor shift mode as well.
W1868 (2026-11-03 14:49, dima): After shift mode is disabled (e.g., when I return), we will run a wishkeeper Flow over shift mode to analyze what's happened for mistakes, details, or weak spots, or what was missed.
W1869 (2026-11-03 14:49, dima): Don't forget about this.
W1870 (2026-11-03 14:49, dima): You can also use a side channel somehow to check if shift mode works well.
W1871 (2026-11-03 14:49, dima): It's up to you.
W1872 (2026-11-03 14:50, dima): tell when all ready for shift/afk.
W1873 (2026-11-03 14:50, dima): And final thing for a shift: when you are at about 90% or 87% of the 5-hour window, park everyone, because I want space to hold everyone if we go overboard with the CTX usage.

his 14:39 shift-groom lines, copied from PK-159 (helga's groom, where they first landed): W1834–W1854; the shift-skill review folds them here. PK-159 keeps its copy until dima says drop. raw drops: ~/.local/state/clio/grooms/2026-11-03-1439.raw.md, -1449.raw.md, -1450.raw.md

W1874 (2026-11-03 15:18, dima): I don't like how your shift skill gate request is texted.
W1875 (2026-11-03 15:18, dima): It says that if anyone goes stale for longer than 1 hour, it should not lose the hot state in its cache, but after 1 hour has passed, the cache is already lost.
W1876 (2026-11-03 15:18, dima): It should say instead: if anyone goes stale for longer than 15-50 minutes, it should not lose the hot state of its cache.
W1877 (2026-11-03 15:18, dima): Everyone should be auto-woken and up to date, cache-wise.
W1878 (2026-11-03 15:18, dima): You can actually groom this line and make it simpler.
W1879 (2026-11-03 15:18, dima): Just say that to keep everyone's cache hot and not going cold, every 50 minutes of inactivity any thread should be auto-woken by a waker.
W1880 (2026-11-03 15:18, dima): keep hot mod
W1881 (2026-11-03 15:18, dima): Print a very short report of this chunk, because I'm on mobile now.
W1882 (2026-11-03 15:18, dima): Only the essentials for me to know what mod chunk changes.
W1883 (2026-11-03 15:18, dima): I approve, then you proceed, because it's inconvenient for me to answer from mobile.
raw 15:18, verbatim:
i don't like how your shift skill gate request is texted. it says that if anyone goes stale for longer than 1 hour, it should not lose the hot state in its cache but after 1 hour has passed, the cache is already lost. it should say instead: if anyone goes stale for longer than 15-50 minutes, it should not lose the hot state of its cache. everyone should be auto-woken and up to date, cache-wise.

you can actually groom this line and make it simpler. just say that to keep everyone's cache hot and not going cold, every 50 minutes of inactivity any thread should be auto-woken by a waker. keep hot mod

---

print a very short report of this chunk because i'm on mobile now. only the essentials for me to know what mod chunk changes. i approve then and you proceed because it's inconvenient for me to answer from mobile.

W1886 (2026-11-03 15:35, dima): When I returned from AFK, log O77 and O79.
W1887 (2026-11-03 15:35, dima): Why do you ask me questions in Orbit while I'm at AFK during shift? ❓
W1888 (2026-11-03 15:35, dima): I can't answer them if I'm at AFK, or are those important ones? ❓
W1889 (2026-11-03 15:35, dima): Could you solve them without me? ❓
W1890 (2026-11-03 15:35, dima): This is to process when I return from AFK, not now.
W1895 (2026-11-03 15:39, dima): Don't forget to park everyone at about 88% to 92% because it is 3 hours 20 minutes until the 5-hour reset.
W1896 (2026-11-03 15:39, dima): When we reach that roughly 22% threshold, I'll keep cache of everyone by keeping hot while the time passes.
W1897 (2026-11-03 15:39, dima): When the 5-hour window closes to reset, we will resume.
W1900 (2026-11-03 15:42, dima): Once it's done, remind me to update your habits, because once you have the ability to flip-keep-hot mod yourself, you can use it in a shift lane to unload your manual keep-hot.
Q6 (2026-11-03 15:51, clio, quoted by dima): 🌼 clean
W1909 (2026-11-03 15:51, dima): Print the keyword in bold.
W1910 (2026-11-03 15:51, dima): Is it in a fleet vibe? ❓

moved from PK-159 (dima o85, 2026-11-03 16:15)
W1834 (2026-11-03 14:39, dima): shift.
W1835 (2026-11-03 14:39, dima): If it is rusty, and if the shop trip plan was not drafted and it wasn't actually dropped, it isn't relevant anymore.
W1836 (2026-11-03 14:39, dima): Let's take a look at the skill and refresh it.
W1837 (2026-11-03 14:39, dima): Let's groom it a little.
W1838 (2026-11-03 14:39, dima): I'm concerned about a few key points:
W1839 (2026-11-03 14:39, dima): 1. The second wind. It should clearly say that you should keep an eye on your second wind while you're on shift and do a second wind for yourself when you approach 60% (when you're at about 55% or something like this).
W1840 (2026-11-03 14:39, dima): Do it carefully because your context will grow slowly while you're on shift, so you have plenty of time to plan your second winds properly.
W1841 (2026-11-03 14:39, dima): No rushes there, and the same for everyone else.
W1842 (2026-11-03 14:39, dima): Since you observe and you can plan, pick good times for everyone to second shift, and you should second wind everyone.
W1843 (2026-11-03 14:39, dima): Go there or fire crow, and even a side channel if it is already parked.
W1844 (2026-11-03 14:39, dima): 2. Shift should enable hot cache state for everyone.
W1845 (2026-11-03 14:39, dima): If anyone goes stale for longer than 1 hour, it should not lose the hot state of its cache, so everyone should be auto-woken up and auto-refreshed, cache-wise.
W1846 (2026-11-03 14:39, dima): 3. As I mentioned previously, the usual pattern for shift is that you merge automatically without my approval, but for this certain day, it's an exception.
W1847 (2026-11-03 14:39, dima): Once merge is ready, stay parked until I approve.
W1848 (2026-11-03 14:39, dima): 4. The PK159 is still left for you to auto-merge.
W1849 (2026-11-03 14:39, dima): It's fine, but don't forget wishkeeper and everything else.
W1850 (2026-11-03 14:39, dima): 5. Take a look at what other parts in shift skill are stale or need a refresher, because we changed what since the previous shift run.
W1851 (2026-11-03 14:39, dima): How we groom it the best way: shape, idea, skill, or how to properly groom it? Propose. ❓
W1852 (2026-11-03 14:39, dima): let's groom your shift, start the refreshed state and i go afk ~1h.
W1853 (2026-11-03 14:35, dima, o75 steer): No, let's do it slightly the other way.
W1854 (2026-11-03 14:35, dima, o75 steer): Currently, your shift should tell you to merge yourself, and it is correct, but my ask to hold with merge is an exception for today.

16:35 steer, groomed (W7–W8 of grooms/2026-11-03-1635.groomed.md), acted: the lane parked
W7 (2026-11-03 16:35, dima): why is the 491 lane active? ❓
W8 (2026-11-03 16:35, dima): park them.
<!-- SECTION:NOTES:END -->
