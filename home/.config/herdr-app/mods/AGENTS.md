# AGENTS.md: our herdr mods

our own mods for herdr, the fleet's cockpit. this dir mirrors `~/.config/herdr-app/mods/`; herdr's other mods there are not ours.

read first, in order:
- `~/frame/herdr/PRODUCT.md` whole: what herdr is for dima, his values, the facts every seat must know
- `~/frame/AGENTS.md` § the boundary: what is built here, what is a cc mod's, what is an `x` verb
- `~/.config/herdr-app/AGENTS.md`: herdr's own guide, whole once, then by section; its `.d.ts` files are the api's truth
- the skills `x:herdr-customize` and `x:herdr`, then `x:guide-code` and `x:guide-ui-ux` before the first edit

## what he wants in every chunk

dima's values are standing rules here (PRODUCT.md § the values quotes them). a chunk that breaks one is not done:

- pretty and sharp, never clunky: a shot of every visible change goes to him, its absolute path in the reply
- ux first: every state, input and edge he meets; hotkeys welcome
- a feature that has a choice gets its settings row, the essential knobs only, never an overload; a preference never hides in code
- slipstream first wherever he talks to a seat, with visible feedback that it worked
- cheap to change stays cheap: one mod per feature, plain JS, colours from `theme()`, no layer a newcomer must learn first
- his word wins over every guard: none locks him out of any action, a merge and a delete just work; his tick and his override switch work from a guard's first commit
- hot reload is smooth or not done: at once, no flicker, no shifted tabs, no lost text
- he lives in the Chat view: a thing he must see or click is drawn there, never only in a seat's Terminal view

## for a sixth sense

- grade the look by taste, from the shot: a UI you would not want to use fails, with what is off in one line
- check each rule above beside the exit lines

## the loop after every change

- `herdr-app check <mod dir>`, then `herdr-app status`, then `herdr-app shot <png>` and look at it yourself
- edit in frame; `pnpm herdr-mods:land --watch` lands each save that passes `herdr-app check` into herdr's real folder, which reloads live; a link never does
- a herdr restart is his hand alone: it can lose a prompt he is typing
- commit through `x lane commit`, in the background; a new mod's `landedByCopy` line in `script/lib/manifest.ts` rides the commit that adds it

## never

- switch herdr's theme, or change its settings, while seats are live: a theme switch kills them
- read a cc mod's private store: the state you draw comes from a file under `~/.claude/shelf/` that the mod writes
- give a button that unlocks something (a sign, a merge, a delete) a keyed command: click-only, since any shell can reach a keyed command
- restart or kill a live seat for a proof: a throwaway seat, killed after
- close with a bare close: it kills dima's focused seat (`x:herdr` traps)
- cut or trim a cc mod's band, board or orbit for a herdr twin: they are his fallback (dima, 20:09)

## hazards

- a seat started with `hc run --no-parent` has no tab until `skills/herdr/scripts/seat-tab.ts` gives it one; herdr learns of it a moment after `hc run` returns, so the keep and the rename retry
- `hc ls --json` is an object: `.terminals[]`
