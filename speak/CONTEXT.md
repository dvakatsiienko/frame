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
- **no quota** — an engine whose provider refused a request as over its credit quota; benched for an hour and shown as such until its next success
- **x-speak** — the resident daemon (`schedule/jobs/x-speak`) that owns the hotkey, the engines and config.json
