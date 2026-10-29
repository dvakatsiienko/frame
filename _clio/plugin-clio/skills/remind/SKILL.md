---
name: remind
description: Load when Dima types /remind, or asks to be reminded of something, or to drop, stick or list a reminder.
argument-hint: "[stick|unstick|forget|list|clear]"
---

# remind — dima's standing hooks, in `memory/_reminders.md`

a reminder lives in `_clio/memory/_reminders.md` (git-backed), one line each, never in a chat message, a scratch file or a pocket item. the boot digest prints every `⏰📌` line and every `⏰` whose `due:` has come. both tiers die only when dima drops them.

## the line

`⏰ <the thing, his words folded (craft-pm § wishes)> — set <YYYY-MM-DD>`, plus ` · due: <YYYY-MM-DD>` when it has a date. the legend at the file's head: `⏰📌` stuck, `🦉` set by cclio for herself (then 👁️ a watch, 📜 a doc kept alive, 🔬 a probe). a trial's date lives in its test-drive file, never here.

## verbs — confirm each in one line

- **no argument** — one new line; `⏰ reminded: <thing>`. never two lines for one reminder
- **`stick`** — the stuck tier, `⏰📌`; an existing `⏰` is promoted in place. `⏰📌 stuck: <thing>`
- **`yourself stick`** — cclio's own watch or behaviour: `⏰📌 🦉<flavour> …`
- **`unstick`** — back to `⏰`, matched from his plain words; unstick is not forget. `⏰ unstuck: <thing>`
- **`forget`** — match his words, delete the line, `⏰ dropped: <thing>`; two matches → name both and ask; none → say so
- **`list`** — one line each, stuck first, oldest first within a tier
- **`clear`** — every line, both tiers, on his word; the count split by tier

## raising

- **`⏰📌`** — at every boot, unprompted, its own line on the board; then an ordinary reminder for the session
- **`⏰`** — once at a natural moment: the work touches it, a related decision, a wrap; one line, never a recited list
- it dies only on his drop — never on being raised, looking handled, or answered

## a time is not a reminder

a reminder with a time he named also wants a timed ping; `CronCreate` sits in `permissions.deny`, so say plainly that only the line exists.

done: the line is in the file and the one-line confirmation printed.
