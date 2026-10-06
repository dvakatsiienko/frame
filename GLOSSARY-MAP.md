# context map

nine contexts live in this repo:

- **repo** — `GLOSSARY.md` (root) + `docs/adr/` (`ADR-nnnn`) — the frame codebase itself
- **chords** — `hotkeys/chords/GLOSSARY.md` — the hotkey map app: bindings, presses, rebinds; its feature ledger is `hotkeys/chords/FTR.md`
- **tracker** — `docs/tracker/GLOSSARY.md` + `docs/tracker/adr/` (`TRK-nnnn`) — the linear workspace domain (teams DOT/BYT)
- **speak** — `speak/GLOSSARY.md` — the read-aloud daemon: engines, chains, voices
- **x** — `x/GLOSSARY.md` — the fleet cli: verbs, families, the envelope
- **guard** — `home/.claude/plugin-x/mods/guard/GLOSSARY.md` — the mod that stops a hazardous Bash call or fork before it runs
- **redact** — `home/.claude/plugin-x/mods/redact/GLOSSARY.md` — the mod that keeps secrets out of transcripts
- **stash** — `home/.claude/plugin-x/mods/stash/GLOSSARY.md` — the shared command-center row above the prompt
- **rules-lazy** — `home/.claude/rules-lazy/GLOSSARY.md` — rules that load only when their work starts

adr ids are context-prefixed; never bare numbers across contexts. normative split: tracker glossary + decisions live here, operational recipes stay in `x:pm` (`references/workspace.md` points at this context, never restates it).
