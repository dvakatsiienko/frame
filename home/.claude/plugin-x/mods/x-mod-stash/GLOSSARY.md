# x-mod-stash

dima's command center: one row above the prompt that every live cc session shares, and the fleet board.

## Language

**Stash**:
The shared row and the one store behind it; every feature below lives in it.
_Avoid_: deck, band, dock

**Ask**:
An open question a session put to dima through orbit's tool: one line, its pick and a hidden note, live until the session resolves it; a ticked one resolves «as ticked» or «changed: <what>».
_Avoid_: question, todo, pending

**Sending** 📨:
The 5 s after dima ticks or replays an ask: the mark shows, no turn takes it yet, and a second press unsends it.
_Avoid_: pending, queued

**Closing word**:
The word a resolve gives an ask («landed», «dropped: superseded by o58»): the ask stays dim with it for one more turn, then leaves.
_Avoid_: reason, status

**Steer**:
The one line dima types on the board — on an ask, a 🐠 piece, an assumption or a glide step; it goes out with its tick (or 🤔, or ↩️) and its field clears once it has.
_Avoid_: note (that is a session's hidden note), comment, reply

**Orbit** 🪐:
One session's own list of asks to dima, in the board; he rings 🛎️ tick (order up: tick the pick), sends 🔁 replay (another round) or steers an ask, and the marked ones join his next prompt, or the running turn. Replaced the reply-parsed ask list.
_Avoid_: asks box, wfyb, inbox

**Phases** 🌔:
The session's next moves, at most 7 (🎛️ shows 5 to 7), kept live in the board by the session itself; each leads with a moon that fills by nearness, 🌕 now to 🌑 last.
_Avoid_: planned actions, next block, todo

**Lane**:
One piece of fleet work cclio runs, its whole scope as 1–5 plain steps, with its linked members (a coder, a verifier).
_Avoid_: project, run

**Glide** 🛼:
A lane's progress card on every board: its steps in order, done ones kept, the current marked, its members' asks beneath; kept in one shelf file, written only by 🦉 cclio through orbit op `glide`, drawn until her siesta ends it.
_Avoid_: lane tracker, lane card

**Plan step**:
The lane step a linked coder names with its plan (orbit `plan`, `step`), as its brief numbers them; cclio's stash moves the lane's pointer forward to it.
_Avoid_: progress, mirror step

**Step**:
One of a lane's 1–5 plain-word items; done steps stay listed, the current one is «← we are here».
_Avoid_: item, task, phase

**Afk**:
Dima's away switch; while on, every session's prompt carries an away note.
_Avoid_: away mode, shift presence

**Away digest**:
The lines the band shows when dima turns afk off: the sessions that left him asks, then the ones that finished, since afk went on.
_Avoid_: summary, recap, catch-up


**Board**:
The `/board` pane: every live session, its state as cc wrote it, what it waits on, and its facts.
_Avoid_: dock, roster, dashboard

**Board colour**:
The colour MVP on the board, flipped by `/board colour`, off by default; it tints only what a word already says.
_Avoid_: theme, palette mode

**Cooling**:
An idle session 30 minutes or more past its last turn, its prompt cache nearing the hour it lives; its board time reads amber from 30, red from 45.
_Avoid_: stale, warm, cold

**Palette**:
The board's one colour table every card reads: ok, warn, hot, dim, accent, and the ctx meter's calm.
_Avoid_: theme, colours

**Waker**:
The ⏰ switch, one for every session: while on, a session stopped on the 5h cap gets one resume at the reset.
_Avoid_: alarm, auto-resume, wake-up

**Meter**:
One of the two full-width bars under the row: `🔥 5h`, the window against its pace, and `🧠 ctx`, the context against its compaction point.
_Avoid_: gauge, tracker, progress bar

**Pace**:
The share of the 5h window already gone; a used % on pace spends the window evenly.
_Avoid_: budget, target, burn rate

**Debt**:
How far the 5h used % runs ahead of its pace; its opposite is spare.
_Avoid_: overage, overspend

**Compaction point**:
The context % at which cc compacts: the project's `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`, else cc's default.
_Avoid_: threshold, limit, autocompact %

**Assumption**:
A choice the session made without asking that would cost a redo if wrong, shown under «assumed» in orbit; at most 3 a turn, 🛎️ clears it, ↩️ sends it back with a steer, an unmarked one fades after 3 turns.
_Avoid_: guess, assumed ask

**Kind**:
One of a catch piece's seven types, its leading emoji: 📍 effort, 🧷 receipt, ✅ unseen, 🎯 taken as, ⏰ remind-me, 💡 fact, 📦 unshipped; `catch.md` says when each is added and when it leaves.
_Avoid_: type, tag, category

**Catch**:
Cclio's keep-in-mind shelf under 🐠 catch: one-line pieces of seven kinds that dima would otherwise re-ask, added by her orbit `catch` op alone; 5 drawn, 7 held, 🤔 gets one explained, she or dima clears it. The kinds and their lifetimes live in `catch.md`, his file.
_Avoid_: highlight, missed fact, fish

**Quiet comms**:
cclio's thread holding a member's `[progress]` ping until her next turn instead of starting one; every other tag passes; on by default, `/quiet off` (or 🎛️) its revert.
_Avoid_: mute, silent mode, filter

**Enhancer**:
The band's `🪄` enhance, `⏪` prev and `⏩` new: Haiku rewrites the prompt box once per press; prev and new swap his own text and the enhanced one back without a call.
_Avoid_: prompt rewriter, polish

**Mobile mode**:
Dima away from the board, on the phone: while on, the per-prompt reminder asks for the asks fence instead of orbit; `/mobile-mode` turns it on, «back at the mac» or «mobile mode off» typed, `/mobile-mode off` or a 🛎️, 🔁 or ↩️ press in orbit turns it off.
_Avoid_: phone mode, away mode

**Asks fence**:
The block a reply ends with in mobile mode: the line «⏳ waiting on your word:» and a fence holding every open orbit ask as `<id>. <ask> ➡️ <pick>`.
_Avoid_: ⏳ block, wfyb

**Wait**:
What a session is blocked on, from the `🔭` line that ends its last reply; on the board it sits right of the row's name, absent when the reply has none.
_Avoid_: blocker, status, watch

**Fleet word**:
A word of the fleet's own vocabulary that prints bold, its badge glued on: **✨ wisp**, **🌤️ siesta**, **🌠 wish**, **🍀 freebie**, and the members' names (**🦉 cclio**, **🔧 coder** …); the words and badges are `rules/fleet-vibe.md`'s, the members `rules/fleet-identity.md`'s.
_Avoid_: keyword, vibe word

**Second wind**:
A refresh asked of one session from a board's 🐦‍🔥 button: the session finishes its step, writes its handoff, names it through orbit's `op second-wind`, and the mod compacts onto that handoff and ingests it; its states are asked 📨, writing ✍️, refreshing 🌀, cancelled.
_Avoid_: refresh, graceful refresh, checkpoint request, molt
