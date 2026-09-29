# speak — feature map

- 🧭 asked, not built yet · ⬜ built, not checked yet · 🐞 built, its check fails · ✅ passes in `speak-verify` · 🔎 dima used it and it holds
- given/when/then lines are the verifier's exit lines
- makes: lines name what a feature leaves behind
- decision: lines record a choice and its reason

## / — voices

- ✅ one column per language, in the order english, українська, русский
  - decision: the order is dima's; it lives in an array so a key sort cannot reorder it
- ✅ a chain card per engine, in the order the daemon tries them
  - given a language's chain in config.json
  - when the page loads
  - then its cards show in that order, ranked 1…n, and the engines outside the chain follow as dashed cards
- ✅ a toggle puts an engine in or out of a chain
  - given an engine outside the en chain
  - when the user ticks «in the en chain»
  - then its card joins the end of the chain with its voice, speed and gain controls
- ✅ ↑ / ↓ move a card one place
  - when the user presses ↓ on the first card
  - then it becomes the second card, and focus stays on its ↓
- ✅ a card drags to a new place in its chain
  - given the chain elevenlabs, kokoro, macOS voice
  - when the user drags elevenlabs's handle onto the macOS voice card
  - then the chain reads kokoro, macOS voice, elevenlabs
  - decision: the handle is also a keyboard drag (space, arrows, space; esc cancels); ↑ / ↓ stay for one-press moves
- ✅ a voice per engine and language
  - given the macOS voice card
  - then its list holds only installed female voices of that language, «Spoken Content voice (Siri)» for en, «best installed» for uk and ru
- ✅ a ♥ on each voice marks it a favourite, per engine
  - makes: a `favourites` list per engine in config.json
  - given the voice list of a card is open
  - when the user presses ♡ beside a voice
  - then it turns ♥ and the voice moves to the top of that engine's list in every language
- ✅ «only ♥ favourites» filters a voice list to the favourites
  - given an engine with at least one favourite
  - when the user ticks «only ♥ favourites»
  - then only the favourites stay in the list; with none, the filter is disabled
- ✅ a voice list opens as a popover and closes on a pick, on Esc, or on a click outside
  - then focus returns to the voice button, which shows ♥ before a favourite
- ✅ speed and gain sliders per engine, shared by every language
  - decision: the macOS voice has no gain — its synthesizer cannot go above its own level
- ✅ an «i» beside gain explains it in one line
  - when the user hovers or focuses the «i»
  - then «loudness: 1 is the voice as the engine sends it, 2 is twice as loud» shows
- ✅ ▶ previews a card through the daemon
  - given x-speak is running
  - when the user presses ▶ on a card
  - then the daemon speaks the column's sample line with that card's unsaved settings, and the status line reads «▶ <engine> · <lang>»
- ✅ a sample line per language, editable
- ✅ a status badge per engine: live, benched until a time, or no key
- ✅ the header shows the daemon's accessibility state and whether it is speaking
- ✅ ■ stop ends any speech
- ✅ the first audio budget, in ms

## save

- ✅ save writes config.json
  - makes: `schedule/jobs/x-speak/config.json`, in biome's own format
  - given an unsaved change
  - when the user presses save
  - then the file changes by exactly that edit, and the status line reads «saved · the daemon loaded it»
- ✅ a rejected save shows the daemon's own line
  - given a config the daemon cannot read
  - when it is saved
  - then the status line reads «rejected — config.json: unknown name «…» …» and the daemon keeps its last good config

## scripts

- ✅ `pnpm speak:admin` serves the built page and the api on 127.0.0.1:7386
- ✅ `pnpm speak:admin-dev` runs vite on 7387, proxying /api to 7386
- ✅ `pnpm speak:admin-build` builds `dist/`
