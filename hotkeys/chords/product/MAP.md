# chords — the map

- 🧭 asked, not built yet (a new ask, an experiment) · ⬜ built, not checked yet · 🐞 built, its check fails · ✅ passes in the app's verify recipe · 🔎 dima used it and it holds
- given/when/then lines are the verifier's exit lines
- makes: lines name what a feature leaves behind — a file, a take, a clipboard item
- decision: lines record a choice and its reason

## every page — the frame

- ⬜ board / stats tabs switch the page, back button included
- ⬜ hovering the stats tab warms the stats numbers
- ⬜ footer names where the bindings and the notes come from

## / — board

- ⬜ summary line: bindings count, scan time, never-pressed count, last press time
- ⬜ app legend: one coloured dot per app bound on the layer
- ⬜ layer tabs, each with its binding count
- ⬜ layer dial: a click steps to the next layer, the wheel turns either way
- ⬜ keycaps show the action, the press count and the owning app's colour
- ⬜ a bound key never pressed carries a ring
- ⬜ a press on the real keyboard sinks its cap and moves its count, live
- ⬜ aurora strip wakes on a layer turn, a drag or a rebind landing
- ⬜ led rails sweep once when a rebind lands
- ⬜ the board reloads by itself when a config source changes
- ⬜ a `?layer=&key=` link opens the board on that key selected
- ⬜ selected key: clicking a cap shows its chord and its bindings
- ⬜ rebind by drag: a hand-kept binding dragged onto a free cap
- ⬜ press to rebind: the next chord pressed on the keyboard is the new one, a taken chord is refused with its owner
- ⬜ a rebind carries the key's note to the new chord
- ⬜ note on a key: save, clear, cmd+enter saves
- ⬜ a noted key carries a dot on its cap
- ⬜ copy notes: every note as markdown to the clipboard
- ⬜ notes list, filtered by chord or text
- ⬜ free keys on this layer
- ⬜ all bindings on this layer
- ⬜ no-data notice with retry when the scan cannot be read

## /stats — stats

- ⬜ window tabs all / month / week, with the span the log really covers
- ⬜ tiles: presses, chords, switches, never pressed of bound
- ⬜ chords, ranked; a row opens the board on that key
- ⬜ chords per app, ranked
- ⬜ switches per app, ranked
- ⬜ never pressed, lifetime; a chord opens the board on that key
- ⬜ long tables fold at 20 rows, show all is remembered per table
- ⬜ the numbers refresh live as presses arrive
- ⬜ a failed refresh keeps the numbers and says they stopped refreshing
