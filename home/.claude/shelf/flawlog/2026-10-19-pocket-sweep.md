# flawlog 2026-10-19 · pocket-sweep

- `node script/skill-memory-sync-mirror.ts --help` ran the render instead of printing help (rewrote the shelf mirror, no tracked change) · cost: none this time · lesson: the bare `--help` probe rule bit again on our own script — a guard candidate: x-mod-guard hint on `<script>.ts --help` for scripts with no help flag
- a crawled page slugged «agents» became `agents.md`, which macOS case-folds to `AGENTS.md`; the loader hook offered scraped web text as instructions · cost: none (the helper skipped it) · lesson: any file written from fetched content gets a prefix (`page-…`), never a bare slug — a guard candidate: the loader hook could skip an AGENTS.md that is not exactly that case
