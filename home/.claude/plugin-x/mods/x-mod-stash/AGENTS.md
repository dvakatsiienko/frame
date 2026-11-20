# x-mod-stash — the module map

dima's board, band and orbit in one cc mod: `hooks/register.tsx` is the hook wiring, every feature lives in its own module under `hooks/`, and `FTR.md` lists what each feature does. To change one feature, find its module below and read that file; register.tsx only shows when a hook calls it.

## the layers, top down

- **the wiring** — `register.tsx`: each `on(...)` calls the modules in order, builds `viewDoors($)` and the callbacks the owners take; a hook body longer than a few calls is a function in its feature's module
- **the draws** — `board.tsx` (the fleet board pane, `/board`; its cards in `board-orbit.tsx`, `board-glide.tsx`, `board-phases.tsx`, each over `board-kit.tsx`'s shared kit), `band.tsx` (the row above the prompt), `settings-pane.tsx` (🎛️): each is one draw over the view, called by its `ui.render` hook
- **the view** — `view.ts`: `load` re-reads the store, `publish` writes `$.state` view when it changed, `viewOf`, `pressSwitch`, `pressPace`, the `band` reads between loads
- **the hook features** — `session-start.ts` (a start or a reload, the poll), `prompt-notes.ts` (what a prompt carries), `step-notes.ts` (what a tool step carries back), `session-end.ts` (what a conversation leaves behind)
- **the features over the owners** — `fields.ts`, `orbit-presses.ts`, `orbit-tool.ts`, `turn-notes.ts`, `wind-run.ts`, `quiet-gate.ts`, `parked-wake.ts`, `band-presses.ts`, `reply-fix.ts`, `rows.ts`
- **the owners** — each holds one store or shelf file and the only code that writes it
- **the pure rules** — no `$`: `orbit.ts`, `parse.ts`, `pace.ts`, `quiet.ts`, `rounds.ts`' math, `look.ts`, `tree.ts`, `util.ts` (`serial()` for a read-change-write across awaits, `expandHome`)
- **the x door** — `x-cli.ts`: `xRead`, every `x … --json` read

## the rules a move or a change keeps

- an owner reaches the view only through the `view: ViewDoors` its caller passes (`viewDoors($)` in the wiring); the draws alone may import `view.ts`
- a module imports only modules below it; `hooks-cycles.test.ts` (one dir up) reds a cycle
- a shelf file is named in code by its owner alone; `stash-owners.test.ts` (one dir up) holds the map
- a `$.state` key is a literal or a const of the file that calls `$.state`, so a key read in two files has a const in each, the same string
- a `$`-using helper past an import is a `function` declaration: `claude plugin validate` refuses an arrow (`const f = ($) => …`)
- a module-level `let` changes only inside its own module; another module calls its setter (`reshowLanes`, `retakeFields`, `toldOrbitAs`, `nextTurnNo`, `patchBand`)
- a sibling module reruns with the entry on a hot reload, so its lets reset as register.tsx's did (`../engine.md` § engine facts by area, probed 19 Nov)
- `store-keys.ts` holds the keys more than one layer writes; a key there names why it stays

## who owns what

- `session-identity.ts` — who this session is, its thread record, `succ:` after a /clear (`successorOf`)
- `session-record.ts` — `herdr-state/<sid>.json` and `fleet.json`, the model label a step named
- `turn.ts` — the running turn, `startTurn`, `selfSubmit`, `isTurnBusy`
- `settings-store.ts` — every 🎛️ switch and number, `partsShown`, `readSwitch`
- `roster.ts` — the registry rows, `memberOf`, `isOpen`, `openBoard`
- `rows.ts` — the board's session rows (`members`), each clio's waiting asks
- `orbit-store.ts` — `$.state` orbit and ticks, `saveOrbit`, dima's herdr marks (`absorbMarks`, `markAsks`)
- `orbit-presses.ts` — a 🛎️/↩️/steer press, its marks, the wake for them
- `orbit-tool.ts` — the orbit tool's schema and every op (`orbitCall`), the fleet's ask counter
- `turn-notes.ts` — the orbit notes a prompt carries, told once until they change
- `fields.ts` — the steer boxes: drafts, saves, flushes, a thread switch's leave and return
- `lanes.ts` — 🛼 glide: `lanes.json`, the lane steers, a codie's or plan file's step moving a card
- `keep-warm.ts` — 💨 afk, ⏰ waker and the 5h cap it waits on, 🔥 keep-hot, 🍃 auto wind's read, the pace poll
- `boot.ts` — clio's `boot:` key: open at the skill, closed by a board-length reply
- `usage.ts` — the 5h usage mirror, the context fill, the word count
- `held.ts` — the `held:<sid>` store: every message held for a later turn, its holds, releases and tells
- `quiet-gate.ts` — quiet comms: a received message, a ping's send, hold and release, the books poll, `/quiet`
- `quiet-books.ts` — the quiet log, the ledger, the alarms, a silent member
- `parked-wake.ts` — a parked lane's wake, crow's relay (`relay.json`)
- `rounds.ts` — the round count and `lane-rounds.json`
- `wind.ts` · `wind-store.ts` · `wind-run.ts` — second wind's `wind:` key, `second-wind.json`, and the state machine above held, with what a compact sets off
- `joins.ts` — dima's herdr rows joined into a turn
- `override.ts` — the operator override file
- `speak.ts` — x-speak's play state
- `band-presses.ts` — a press from another surface's band
- `reply-fix.ts` — a reply's 🔭 waits and tasks, the red wrap_up stop, its stored and drawn fixes (bullets, bold words, the 📄 stamp)

## checking a change

- every edit goes through `x mods edit` (`../AGENTS.md`, the doors); its push runs the overlay's tsc, validate and the whole suite
- every hooks file stays under 1,200 lines (`~/frame/script/lib/code-size.test.ts`); one past it carries a `size:` line in its head
