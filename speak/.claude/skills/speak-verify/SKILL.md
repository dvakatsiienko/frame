---
name: speak-verify
description: Load BEFORE you verify a change to speak, the voice admin — «verify speak», «check the voice admin», a coder or verifier round on `speak/`, an ftr line under speak to flip.
---

# speak-verify

run the app with `speak-run`, copy config.json aside, then run each check below at 1280 wide. every check reads
the page AND the state behind it: a drag or a save is proven by the ranks the page renders and by the file.

## checks

1. **order** — the en column's cards read elevenlabs, kokoro, macOS voice, then the dashed cards
2. **↓** — ↓ on the first card makes it second; focus stays on its ↓; save enables
3. **mouse drag** — `agent-browser mouse` down on elevenlabs's handle, eight moves to the macOS voice card's
   bottom, up: the ranks read kokoro#1, macOS voice#2, elevenlabs#3
4. **keyboard drag** — focus the handle, space, ArrowDown, space: elevenlabs is #2. again with esc instead of the
   last space: the order is back
5. **save** — after one change, save: the status line reads «saved · the daemon loaded it», `git diff` on
   config.json shows exactly that one change, and `npx biome format schedule/jobs/x-speak/config.json` fixes
   nothing. move it back, save, `cmp` against the copy
6. **reject** — `PUT /api/config` with an unknown engine name answers the daemon's «unknown name «…»» line
7. **preview** — ▶ on the kokoro card: the status line reads «▶ kokoro · en» and the daemon log gets a
   `first audio: kokoro` line
8. **gain «i»** — focusing the «i» makes its tooltip visible with the one-line explanation
9. **favicons** — `/speak-32.png` answers 200 image/png; `/../package.json` answers 404

## essentials

`x:browser-headless` essentials and the tab walk at 1280 and 390. baseline: `covered` flags the page-level sticky
save bar (the checker skips sticky chrome only inside a scroll box); everything else passes, the tab walk flags
nothing.

## evidence

- the check lines above, one each, and `errors: 0` from the console
- `essentials: <n> pass · <m> fail`, the baseline fail named as baseline
- `pnpm --filter speak typecheck` and `pnpm speak:admin-build`, read by exit code
- config.json back byte-for-byte
