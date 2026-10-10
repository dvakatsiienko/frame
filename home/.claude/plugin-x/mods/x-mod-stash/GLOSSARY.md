# x-mod-stash

dima's command center: one row above the prompt that every live cc session shares, and the fleet board.

## Language

**Stash**:
The shared row and the one store behind it; every feature below lives in it.
_Avoid_: deck, band, dock

**Ask**:
An open question a session put to dima through orbit's tool: one line, its pick and a hidden note, live until the session resolves it.
_Avoid_: question, todo, pending

**Orbit** 🪐:
One session's own list of asks to dima, in the board; he rings 🛎️ (order up: take the pick), sends ↩️ (back to the kitchen) or notes an ask, and the marked ones join his next prompt, or the running turn. Replaced the reply-parsed ask list.
_Avoid_: asks box, wfyb, inbox

**Phases** 🌔:
The session's next moves, at most 5, kept live in the board by the session itself; each leads with a moon that fills by nearness, 🌕 now to 🌑 last.
_Avoid_: planned actions, next block, todo

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
An idle session 15 to 60 minutes past its last turn, its prompt cache nearing the hour it lives; its board state climbs yellow, orange, then red at 30.
_Avoid_: stale, warm

**Cold**:
An idle session an hour or more past its last turn, its prompt cache gone; its board state reads ❄️.
_Avoid_: frozen, expired, dead

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

**Enhancer**:
The band's `🪄` enhance, `⏪` prev and `⏩` new: Haiku rewrites the prompt box once per press; prev and new swap his own text and the enhanced one back without a call.
_Avoid_: prompt rewriter, polish

**Mobile mode**:
Dima away from the board, on the phone: while on, the per-prompt reminder asks for the asks fence instead of orbit; `/mobile-mode` turns it on, «back at the mac», `/mobile-mode off` or a board press off.
_Avoid_: phone mode, away mode

**Asks fence**:
The block a reply ends with in mobile mode: the line «⏳ waiting on your word:» and a fence holding every open orbit ask as `<id>. <ask> ➡️ <pick>`.
_Avoid_: ⏳ block, wfyb

**Wait**:
What a session is blocked on, from the `🔭` line that ends its last reply; on the board it is a row's second line, absent when the reply has none.
_Avoid_: blocker, status, watch

**Fleet word**:
A word of the fleet's own vocabulary that prints bold, its badge glued on: **✨ wisp**, **🌤️ siesta**, **🌠 wish**, **🍀 freebie**, and the members' names (**🦉 cclio**, **🔧 coder** …); the words and badges are `rules/fleet-vibe.md`'s, the members `rules/fleet-identity.md`'s.
_Avoid_: keyword, vibe word
