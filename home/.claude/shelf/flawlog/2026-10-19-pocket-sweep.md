# flawlog 2026-10-19 · pocket-sweep

- `node script/skill-memory-sync-mirror.ts --help` ran the render instead of printing help (rewrote the shelf mirror, no tracked change) · cost: none this time · lesson: the bare `--help` probe rule bit again on our own script — a guard candidate: x-mod-guard hint on `<script>.ts --help` for scripts with no help flag
