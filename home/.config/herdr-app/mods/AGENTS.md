# AGENTS.md: our herdr mods

our own mods for herdr, the fleet's cockpit. this dir mirrors `~/.config/herdr-app/mods/`; herdr's other mods there are not ours.

read first, in order:
- `~/frame/herdr/PRODUCT.md` whole: what herdr is for dima, his values, the facts every thread must know
- `~/frame/AGENTS.md` § the boundary: what is built here, what is a cc mod's, what is an `x` verb
- `~/.config/herdr-app/AGENTS.md`: herdr's own guide, whole once; its `.d.ts` files are the api's truth
- the skills `x:herdr-customize` and `x:herdr`, then `x:guide-code` and `x:guide-ui-ux` before the first edit

## what he wants in every chunk

dima's values are standing rules here (PRODUCT.md § the values quotes them). a chunk that breaks one is not done:

- pretty and sharp, never clunky: a shot of every visible change goes to him, its path in the reply
- ux first: every state, input and edge he meets; hotkeys welcome
- a feature that has a choice gets its settings row, the essential knobs only, never an overload; a preference never hides in code
- slipstream first wherever he talks to a thread, with visible feedback that it worked
- cheap to change stays cheap: one mod per feature, plain JS, colours from `theme()`, no layer a newcomer must learn first
- his word wins over every guard: none locks him out of any action, a merge and a delete just work; his tick and his override switch work from a guard's first commit
- hot reload is smooth or not done: at once, no flicker, no shifted tabs, no lost text
- he lives in the Chat view: a thing he must see or click is drawn there, never only in Terminal view
- a ux fix he wants herdr-wide lands its rule in `herdr/PRODUCT.md` § the values the same turn; later builds follow it

## for a sixth sense

- grade the look by taste, from the shot: a UI you would not want to use fails, with what is off in one line
- check each rule above beside the exit lines

## the loop after every change

- `herdr-app check <mod dir>`, `herdr-app status`, `herdr-app shot <png>`, then read the shot
- edit in frame; `pnpm herdr-mods:land --watch` lands each save `herdr-app check` passes into herdr's folder, live; a link never does
- a landing restarts the mod and stalls his chats: one per finished job, none for a probe while he types, «landing now» in the ping
- a herdr restart is his hand alone: it can lose his typed prompt
- commit through `x lane commit` in the background; a new mod's `landedByCopy` line (`script/lib/manifest.ts`) rides its first commit

## never

- change a layout while a thread holds focus: it dies (herdr-app#861)
- read a cc mod's private store: draw from its file in `~/.claude/shelf/`
- key an unlocking button (sign, merge, delete): any shell reaches a key
- restart or kill a live thread for a proof: a throwaway one, killed after
- start a second Herdr window while dima works, even on a throwaway home: his window reloads and loses his typed draft (2026-11-11, 8 probe starts)
- close with a bare close: it kills dima's focused thread
- trim a cc mod's band, board or orbit for a herdr twin: they are his fallback

## hazards

- a `hc run --no-parent` thread has no tab until `skills/herdr/scripts/thread-tab.ts` gives it one
- a helper green in vitest can lack a herdr global (`TextEncoder`); `check` renders one frame: after a landing, shoot a view that ran it
