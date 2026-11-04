---
id: PK-307
title: 'second wind, mechanical: x-mod-stash winds every session at ~55 % ctx'
status: done
assignee: []
created_date: '2026-11-03T12:48:00Z'
updated_date: '2026-11-04T13:44:00Z'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima o77 ✓ 14:47: shape as a mods chunk with the stuck 🌀 row wisp (lane-4 plan), after FRM-472. W1 «And actually, for a side lane, Cody and SixSense, you should keep an eye on their CTX window yourself… during the day, I often spot myself managing their CTX myself, and I always tell them to second wind. How to automate it?» W2 «so SW happens for everyone» W3 «outside shift, too.» W4 «ideally sw is handled mechanically, i suppose it is a place for a miss which is not desirable.» (14:42–14:43). next: a full ticket in mods (🐋 safer, quieter mods) with ⚖️ worth it + 🔌 fleet wired, then his sign
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
W1855 (2026-11-03 14:42, dima): And actually, for a side lane, Cody and SixSense, you should keep an eye on their CTX window yourself.
W1856 (2026-11-03 14:42, dima): How to make it work well? ❓
W1857 (2026-11-03 14:42, dima): Because during the day, I often spot myself managing their CTX myself, and I always tell them to second wind.
W1858 (2026-11-03 14:42, dima): How to automate it? ❓
W1859 (2026-11-03 14:42, dima): What's actually the best way to automate it: for you to watch their CTX or for themselves? So everyone gets second wind before 60%, roughly? ❓
W1860 (2026-11-03 14:42, dima): So SW happens for everyone.
W1861 (2026-11-03 14:42, dima): Outside shift, too.
W1862 (2026-11-03 14:43, dima): Ideally SW is handled mechanically; I suppose a manual step is a place for a miss, which is not desirable.
raw 14:42–14:43, verbatim:
And actually, for a side lane, Cody and SixSense, you should keep an eye on their CTX window yourself. How to make it work well? Because during the day, I often spot myself managing their CTX myself, and I always tell them to second wind. How to automate it? What's actually the best way to automate it: for you to watch their CTX or for themselves? So everyone gets second wind before 60%, roughly?

---

so SW happens for everyone

---

outside shift, too.
---
ideally sw is handled mechanically, i suppose it is a place for a miss which is not desirable.

scope widened 15:12 (wishkeeper): the mechanical door also carries the auto-wake for hot caches — W1845 (2026-11-03 14:39, dima): If anyone goes stale for longer than 1 hour, it should not lose the hot state of its cache, so everyone should be auto-woken up and auto-refreshed, cache-wise. the description's W1–W4 are superseded by W1855–W1862 in these notes.

dima 15:37: «can you see the state of this mod on any thread, and can you actually flip this mod state yourself? … if you cannot, then it actually would be a good idea to add support for it.» → clio reads keep-hot per session from x-mod-stash's store (`hot:<sid>`), but has no door to flip it; the chunk adds one (an orbit op or an x verb), so a shift turns keep-hot on for every member itself

dima 15:42: «For automated second wind, I'd like some settings. For example, in mod settings, I'd like to have the ability to tweak a threshold at which the second wind happens, because it will be hard-coded at 60%, but I like to tweak this value in settings. It's fine for the first iteration for it to work on everyone. If I edit settings to, let's say, 61%, it would apply to all threads, including yourself, so it's fine like this. No need to granularize it very much.» → one 🎛️ settings value, the second-wind threshold %, default 60, global across every session. also: «remind me when the chunk for that will be done»

Q4 (2026-11-03 15:33, clio, quoted by dima): 🔁 Your hot-cache line is regroomed in the skill: «any thread inactive for 50 minutes is auto-woken by a waker»
W1884 (2026-11-03 15:33, dima): By a keep-cache-hot mod, the waker is a different one.
W1885 (2026-11-03 15:33, dima): Find the precise mod name.
W1891 (2026-11-03 15:37, dima): I enabled keep hot mode for everyone before AFK.
W1892 (2026-11-03 15:37, dima): A question for you now: can you see the state of this mod on any thread, and can you actually flip this mod state yourself? ❓
W1893 (2026-11-03 15:37, dima): It actually solves one of your habits in shift lane, if you can.
W1894 (2026-11-03 15:37, dima): If you cannot, then it actually would be a good idea to add support for it.
W1898 (2026-11-03 15:42, dima): Adding support for your ability to flip keep-hot mod looks like an easy change.
W1899 (2026-11-03 15:42, dima): Can you add it as a rider to some of the mods chunks, maybe even an existing one? ❓
W1901 (2026-11-03 15:42, dima): Watching EG keeping cache hot.
W1902 (2026-11-03 15:42, dima): So then, once all done, Second Wind will be automated by everyone, and "keep cache hot" can also then be automated in an easier way than manual watching.
W1903 (2026-11-03 15:42, dima): As for automated second wind, remind me when the chunk for that will be done? ❓
W1904 (2026-11-03 15:42, dima): For automated second wind, I'd like some settings.
W1905 (2026-11-03 15:42, dima): For example, in mod settings, I'd like to have the ability to tweak a threshold at which the second wind happens, because it will be hard-coded at 60%, but I like to tweak this value in settings.
W1906 (2026-11-03 15:42, dima): It's fine for the first iteration for it to work on everyone.
W1907 (2026-11-03 15:42, dima): If I edit settings to, let's say, 61%, it would apply to all threads, including yourself, so it's fine like this.
W1908 (2026-11-03 15:42, dima): No need to granularize it very much.

ticket: FRM-505
close: 2026-11-04 — folded into FRM-505, signed on his o60

close: 2026-11-04 — all moved to FRM-505: W1855 W1856 W1857 W1858 W1859 W1860 W1861 W1862 W1884 W1885 W1891 W1892 W1893 W1894 W1898 W1899 W1901 W1902 W1903 W1904 W1905 W1906 W1907 W1908
<!-- SECTION:NOTES:END -->
