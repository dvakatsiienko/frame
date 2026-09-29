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
  - then its cards show in that order, each labelled «1st / 2nd / … in the <lang> chain», and the engines outside the chain follow as dashed cards
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
  - and it is saved at once, outside the save button: pending edits stay unsaved, and save does not light up
  - decision: a ♥ is a bookmark, not a setting — dima wants it kept the moment he clicks
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
- ✅ while a card plays, its ▶ becomes ⏸ and ■
  - given a card's preview is speaking
  - when the user presses ⏸
  - then the speech pauses and the button reads ▶ (resume); ■ stops it, and the card shows ▶ again
  - the controls also return to ▶ when the speech ends on its own
- ✅ a sample line per language, editable
- ✅ a status badge per engine: live, benched until a time, no key, or no quota
- ✅ an engine out of quota locks its ▶ and says so on the card
  - given elevenlabs refused a request with quota_exceeded
  - when the page shows its cards
  - then each elevenlabs card's badge reads «no quota» in a quiet colour and its ▶ is disabled
  - and hovering the badge shows «<n> credits left — the chain skips it until they return», then the provider's message
  - decision: quiet, not red — the chain already skips it; dima found the red line «a bit too much» (2026-09-29)
  - and the state clears after the engine's next success
  - decision: the chain already falls through on a quota refusal; the card only has to make it visible (dima, 2026-09-29)
- ✅ the header shows the daemon's accessibility state and whether it is speaking
- ✅ «infinite waveform» plays the pill's wave with no voice, to tune glide and flow by eye
  - given the playback panel under the header
  - when the user turns on infinite waveform
  - then the pill shows and animates speech-shaped levels, following the unsaved glide and flow as they change
  - and it stops when turned off, when the tab closes, when a real read starts, or after 5 minutes without an update
- ✅ «pill glide» and «pill flow» tune the pill's wave, each a slider and a number box in ms
  - makes: `meterGlideMs` and `meterFlowMs` in config.json
  - given the settings row under the header
  - when the user types 55 in the pill flow box and saves
  - then config.json reads meterFlowMs 55, the slider moves to 55, and the daemon reloads
  - glide: how long a bar takes to reach a new level (0 jumps). flow: how long the wave holds before moving one bar outward
  - decision: a slider, not a fixed number — dima tuned it by feel over six rounds (70 → 1 ms)
- ✅ ■ stop ends any speech
- ✅ the first audio budget, in ms

## save

- ✅ save writes config.json
  - makes: `schedule/jobs/x-speak/config.json`, in biome's own format with its keys sorted
  - given an unsaved change
  - when the user presses save
  - then the file changes by exactly that edit, and the status line reads «saved · the daemon loaded it»
- ✅ reset drops every unsaved edit
  - given an unsaved change
  - when the user presses reset
  - then the page shows the saved config again, save and reset disable, and nothing is written
- ✅ a rejected save shows the daemon's own line
  - given a config the daemon cannot read
  - when it is saved
  - then the status line reads «rejected — config.json: unknown name «…» …» and the daemon keeps its last good config

## scripts

- ✅ `x-speak-admin` (launchd, always on) serves the built page and the api on 127.0.0.1:7386; `pnpm speak:admin` runs the same server by hand when the job is stopped
- ✅ `pnpm speak:admin-dev` runs vite on 7387, proxying /api to 7386
- ✅ `pnpm speak:admin-build` builds `dist/`
