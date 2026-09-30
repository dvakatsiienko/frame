# speak — glossary

- **engine** — a way to turn text into speech: elevenlabs, kokoro, fish, gemini, or the macOS voice
- **chain** — one language's engines in the order the daemon tries them; a failing engine hands the line to the next
- **voice** — the speaker an engine uses, chosen per language
- **favourite** — a voice marked ♥ for an engine; favourites sort first in that engine's list, and only the admin reads them
- **speed** — playback rate, pitch kept; 1 is the engine's own pace
- **gain** — loudness multiplier on an engine's audio; 1 is as sent
- **sample line** — the text ▶ speaks for a column; it is never saved
- **preview** — the daemon speaking a sample line with a card's unsaved settings
- **first audio budget** — how long a cloud engine may take to start speaking before the chain moves on
- **benched** — an engine the daemon skips for a while after a quota, auth or network failure
- **no quota** — an engine its provider reports out of credits, found by the daemon's quota probe (at start, on a status older than 10 min, right after a refused request); benched until the provider's refill date (elevenlabs) or for an hour (fish's api balance), and cleared when the probe sees credits again or the engine next succeeds
- **x-speak** — the resident daemon (`schedule/jobs/x-speak`) that owns the hotkeys (F4 reads, or pauses / resumes with nothing selected; ⇧F4 pauses / resumes; F5 stops), the engines and config.json
- **pill** — the small floating window x-speak shows while it speaks: its wave, ⏸ / ▶, ■, stick and close; it keeps its spot per display
- **pill glide** — how long the pill's bars take to reach a new level, in ms (`meterGlideMs`)
- **pill flow** — how long the pill's wave holds before moving one bar outward, in ms (`meterFlowMs`)
