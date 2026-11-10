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
- ux first: every state, input and edge he meets; a hotkey where an action repeats
- a feature that has a choice gets its settings row; a preference never hides in code
- slipstream first wherever he talks to a seat, with visible feedback that it worked
- cheap to change stays cheap: one mod per feature, plain JS, colours from `theme()`, no layer a newcomer must learn first
- he lives in the Chat view: a thing he must see or click is drawn there, never only in a seat's Terminal view

## for a sixth sense

- grade the look by taste, from the shot: a UI you would not want to use does not pass, and say what is off in one line
- check each standing rule above beside the exit lines

## the loop after every change

- `herdr-app check <mod dir>`, then `herdr-app status`, then `herdr-app shot <png>` and look at the shot yourself
- a change loads on a save, or on a herdr restart when it does not; a restart is safe for live seats and is his hand
- commit through `x lane commit`, in the background

## never

- switch herdr's theme, or change its settings, while seats are live: a theme switch kills them
- read a cc mod's private store: the state you draw comes from a file under `~/.claude/shelf/` that the mod writes
- give a button that unlocks something (a sign, a merge, a delete) a keyed command: click-only, since any shell can reach a keyed command
- restart or kill a live seat for a proof: a throwaway seat, killed after

## hazards

- a seat started with `hc run --no-parent` has no tab until `skills/herdr/scripts/seat-tab.ts` gives it one; herdr learns of a new terminal a moment after `hc run` returns, so the keep and the rename retry
- `hc ls --json` is an object: `.terminals[]`
- `SendUserFile` from a herdr seat reaches him nowhere: a shot goes out as its absolute path
