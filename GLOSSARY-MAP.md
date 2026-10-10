# context map

nine contexts live in this repo:

- **repo** — `GLOSSARY.md` (root) + `docs/adr/` (`ADR-nnnn`) — the frame codebase itself
- **chords** — `hotkeys/chords/GLOSSARY.md` — the hotkey map app: bindings, presses, rebinds; its feature ledger is `hotkeys/chords/FTR.md`
  - contract: none yet
- **tracker** — `docs/tracker/GLOSSARY.md` + `docs/tracker/adr/` (`TRK-nnnn`) — the linear workspace domain (teams DOT/BYT)
  - contract: none yet
- **speak** — `speak/GLOSSARY.md` — the read-aloud daemon: engines, chains, voices
  - contract: none yet
- **x** — `x/GLOSSARY.md` — the fleet cli: verbs, families, the envelope
  - contract: `x/go/registry.json`
- **x-mod-guard** — `home/.claude/plugin-x/mods/x-mod-guard/GLOSSARY.md` — the mod that stops a hazardous Bash call or fork before it runs
  - contract: none yet
- **x-mod-redact** — `home/.claude/plugin-x/mods/x-mod-redact/GLOSSARY.md` — the mod that keeps secrets out of transcripts
  - contract: none yet
- **x-mod-stash** — `home/.claude/plugin-x/mods/x-mod-stash/GLOSSARY.md` — the shared command-center row above the prompt
  - contract: none yet
- **rules-lazy** — `home/.claude/rules-lazy/GLOSSARY.md` — rules that load only when their work starts
  - contract: none yet

a context's `contract:` line names the files its glossary defines: `x lane gate` refuses a commit that changes one
without the context's glossary or adr, unless the message says «glossary: unchanged — <why>». «none yet» nudges on a
touch; no line keeps the context quiet (the repo context: every commit touches it).

adr ids are context-prefixed; never bare numbers across contexts. normative split: tracker glossary + decisions live here, operational recipes stay in `x:pm` (`references/workspace.md` points at this context, never restates it).
