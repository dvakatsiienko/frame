# state: one owner, named states, events

code that holds state a person sees, or that steers behaviour, keeps it one way, in herdr and the cc mods alike, with no library:

- **one owner per fact**: a fact lives in one record, and only its owner writes it; everyone else reads it or sends it an event
- **named states, never pairs of flags**: `phase: 'local' | 'written' | 'read'`, never `isSent` beside `isRead`; a state carries only its own data
- **changes only through events named for what happened**: `writeOk`, `keyReleased`, `turnTook`, never `setDone(true)`
- **transitions are pure**: `next(state, event) → state`, no clock, no I/O, so a test drives every edge with no timer
- **a timer belongs to a state and dies when the state is left**: armed on entry, cancelled on exit, and its end is an event into the machine that lands in a visible state («no answer»), never a silent revert
- **what is drawn derives from the one owned state**: the view never merges sources at draw time with priority rules

code that waits on time or reads events (keys, watchers, polls) also reads [review-lessons.md](review-lessons.md) first: settle on an answer never a timeout, a fake-clock row per timing window.

borrowing from another codebase (shepherdr and the like): reimplement the shape on these rules; copy only a small pure function, with its license credit in the file.
