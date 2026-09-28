# chords

the hotkey map: what is bound on this mac's keyboard, and what is actually pressed. the words
below are the ones the map (`product/MAP.md`), the ui labels and the code use.

## the keyboard

**Chord**:
A key plus the modifiers held with it, spelled `mods+key` in a fixed modifier order (`hyper+a`, `shift+cmd+4`).
_Avoid_: shortcut, combo, hotkey (for the keys themselves)

**Hyper**:
The caps key held as one modifier; a chord on it is spelled `hyper+<key>`.
_Avoid_: caps, meh

**Layer**:
Every chord sharing one set of modifiers; `no modifier` is the layer of bare keys.
_Avoid_: mode, modifier group

**Cap**:
One key as the board draws it.
_Avoid_: keycap button, tile

**Free key**:
A non-modifier key with no binding on the current layer.
_Avoid_: empty key, unbound cap

## what is bound

**Binding**:
One chord meaning one action in one app.
_Avoid_: hotkey, shortcut, mapping

**Config source**:
An app's own settings file that the scan reads bindings out of.
_Avoid_: provider, integration

**Hand-kept binding**:
A binding typed into `manual.ts` because the scan cannot read its app's shortcuts; the only kind the page can move.
_Avoid_: manual hotkey, custom binding

**Scan**:
One read of every config source into the full list of bindings.
_Avoid_: sync, import

**Rebind**:
Moving a hand-kept binding to another chord: the old row ends, a new row starts on the new chord.
_Avoid_: remap, move, reassign

**Since row**:
A binding row dated with the day it started; the rows before it carry the day they ended. Press counts split at that date.
_Avoid_: history entry, version

**Note**:
Free text dima files under a chord for the next rebind session, kept in `notes.json`.
_Avoid_: comment, annotation, memo

## what is pressed

**Press**:
One chord fired on the real keyboard, recorded by the daemon.
_Avoid_: hit, keystroke, use

**Press log**:
The daemon's record of every press and every switch; it never leaves the mac.
_Avoid_: history, event log

**Switch**:
The frontmost app changing, as the press log records it.
_Avoid_: app switch event, activation, focus change

**Never pressed**:
A binding with no press in the whole press log — a rebind candidate.
_Avoid_: cold, unused, dead

**Window**:
The stretch of the press log the stats count: all, month or week.
_Avoid_: range, period, filter

**Span**:
The days the press log really covers inside the chosen window.
_Avoid_: coverage, duration

## the board's regions

regions with no visible label on the page; these code names are their names.

**Layer dial**:
The round knob in the board's top row that turns the layer.
_Avoid_: knob, volume knob, wheel

**Aurora strip**:
The moving band across the top of the board that wakes on a layer turn, a drag or a rebind landing.
_Avoid_: header strip, glow

**Led rails**:
The two columns of lights on the board's sides that sweep once when a rebind lands.
_Avoid_: side lights, leds

**Selected key**:
The one cap the page is showing details for, with its chord, its bindings and its note.
_Avoid_: focused key, active key, current key
