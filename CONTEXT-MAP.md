# context map

three contexts live in this repo:

- **repo** — `CONTEXT.md` (root) + `docs/adr/` (`ADR-nnnn`) — the frame codebase itself
- **chords** — `hotkeys/chords/CONTEXT.md` — the hotkey map app: bindings, presses, rebinds; its feature ledger is `hotkeys/chords/product/MAP.md`
- **tracker** — `docs/tracker/CONTEXT.md` + `docs/tracker/adr/` (`TRK-nnnn`) — the linear workspace domain (teams DOT/BYT)

adr ids are context-prefixed; never bare numbers across contexts. normative split: tracker glossary + decisions live here, operational recipes stay in `x:pm` (`references/workspace.md` points at this context, never restates it).
