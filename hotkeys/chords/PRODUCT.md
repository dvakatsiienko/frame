# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

dima, alone. a frontend engineer who drives macos almost entirely from the keyboard, on one
mac, with a NuPhy Air75. no second user exists and none is planned.

## Product Purpose

represent dima's hotkey press stats via pretty UI. and provide a good UX of updating existing hotkeys.
why? because i have hotkeys assigned via inaccessible places like raycast. so cc and app itself can not read them - the only way to update a changed hotkey in app is:
- i tell cc about an update
- i update myself in app UI

chords is the one place that knows both halves of the keyboard: what is **bound**, read from six
app config files, and what is actually **pressed**, counted by an always-on tap daemon. those two
facts live apart on this machine, and the apps that own the most-used bindings — raycast,
cleanshot, 1password — seal their shortcut lists, so nothing can reconcile them automatically.

it succeeds when a rebind is decided from evidence rather than memory, and when that evidence
survives the rebind.

## Positioning

a hotkey manager knows what is bound. a key monitor knows what was pressed. chords is the only
thing that knows **which binding a press belonged to at the moment it happened** — the scanner
and the keyboard daemon spell a chord the same way on purpose, which is what lets the two halves
be joined at all.

## Operating Context

one loop, and both of its halves run on the same screen:

1. dima glances at the press counts to see what he actually uses
2. that number tells him what is worth moving
3. he makes the change inside the sealed app, which chords cannot observe
4. he records it in chords, which writes `manual.ts`
5. the counts stay attributed to what he invoked, not to the keycap

step 3 is why the product exists. raycast and its peers will not tell anyone what changed, so
the reconciliation is manual by nature, and the app has to make recording a change cheaper than
skipping it.

served by the `x-monitor-hotkey-live` launchd job on `127.0.0.1`, opened in a browser tab. never
deployed, and there is nothing to deploy it to: it reads this mac's preference files and this
mac's press log.

## Capabilities and Constraints

- `manual.ts` is the single source for the sealed apps. the app is its editor; nothing caches it,
  and a change to it is picked up by mtime, the same road a hand edit takes
- config sources are read automatically (wispr flow, magnet, bartender, macos, plus
  the hand-kept list). raycast, cleanshot and 1password are hand-kept because they seal theirs
- the board is drawn as a NuPhy Air75; the layout table is that keyboard, not a generic one
- local only, no auth, no deployment target. the press log is a precise record of how dima works
  and never leaves the machine
- **half-built — press history follows a binding across a rebind in `hotkeys:top`, and nowhere
  else.** the read path exists and is tested: `stats.ts` `labelAt` picks the row whose `since` is
  the latest not after the press, `byLabelledChord` tallies by it, and `top.ts` uses that key — so
  the terminal view already splits a swapped chord into one row per meaning. what is missing is
  the other two thirds: the app's own per-key counts tally `event.chord` alone (`live.ts`), and
  nothing anywhere WRITES `since` — every dated row in `manual.ts` was typed by hand
- **decided, not yet built — a rebind is one action, not three edits** (dima, 2026-09-20). moving
  an app to a new chord drops the old row, claims the new one and names what it opens in a single
  step, writing the old row's end and the new row's `since` so the counts split at the right
  moment. today it is three independent field edits and nothing writes `since`
- **planned, and first** — a route rendering the `hotkeys:top` stats. it is the glancing half of
  the loop, so it comes before the editing half rather than after it (dima, 2026-09-20)

## Brand Commitments

the name is **chords**, on every layer — directory, route, tab title, script family. the favicon
is ⌨️. the repo's own prose is lowercase.

the look is inherited from the `map.html` page this app replaced, and dima has asked for it to be
**refined, never redesigned** — he likes the current one.

**voice** — confirmed by dima, 2026-09-20:

- **lowercase everywhere.** headings and buttons too, not only prose. an exclamation mark never
- **an empty state is a bare fact** — «nothing on this layer», «no notes yet». never an
  instruction, never an apology
- **it names the mechanism and never says «you»** — «saved to `hotkeys/notes.json`, never written
  into any app», not «your notes are safe». the footer names `pnpm hotkeys:scan` as the thing
  that filled the page
- a status is one lowercase word with no punctuation — «saved», «copied»
- no personality, no second person. the page does not talk about itself
- file paths and commands appear literally, in mono, never paraphrased into a description

## Evidence on Hand

real data only, all of it measured on this mac: 90 bindings from the live scan, a month of press
logs (197 distinct chords, `cmd+tab` the most pressed at 2275), and `hotkeys/notes.json`.

the app has never shown a number it did not measure, and it must not start. there are no users,
no testimonials, no benchmarks and no third-party data to draw on, and inventing any would be
inventing facts about dima's own keyboard.

## Product Principles

1. **a press belongs to what it invoked, not to the keycap it landed on.** this is the hard one
   and the one the product turns on
2. **one source per fact** — `manual.ts` for the sealed apps, their own config files for the
   rest, the log for the counts. never a second list, never a cache
3. **measured, never estimated.** every number on screen came from a file on this machine, and an
   absent number says so rather than showing a zero
4. **the two jobs are one loop.** glancing at the counts is how a rebind gets decided, so the
   deciding surface and the editing surface have to be good at the same time
5. **recording a change must beat skipping it.** the sealed apps guarantee the reconciliation is
   manual; the moment it feels like paperwork, the counts start lying

## Accessibility & Inclusion

one known user, no assistive-technology requirement stated. the repo's own interface floor
applies: text no smaller than 14px, dense data no smaller than 12px, 4.5:1 contrast on text, and
every control reachable from the keyboard — which matters more than usual here, since the user
reaches for the mouse rarely by disposition.

📌 the ported page does not meet that floor today: the press counts and the action labels were
carried over below the minimum size. that is recorded debt, not a decision.
