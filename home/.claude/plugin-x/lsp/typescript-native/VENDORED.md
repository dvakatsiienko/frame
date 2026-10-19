vendored from https://github.com/rubberduck-studio/typescript-native-lsp at c04b3e5a8ef4a5bd920e6bd86ba082f45e9dc405 (v1.1.3), read in full 2026-09-30 (v1.1.2); the v1.1.2 → v1.1.3 diff read 2026-10-19 (document sync and the diagnostics bridge stop trusting what claude code advertises).
no network, no file writes; only stats and reads files claude code opened. update = re-copy at a newer sha after a read.
drop it when anthropics/claude-plugins-official#4492 lands (the gh watch (boot digest)).
