---
name: speak-verify
description: Load BEFORE you verify a change to speak, the voice admin — «verify speak», «check the voice admin», a coder or verifier round on `speak/`, an ftr line under speak to flip.
---

# speak-verify

run the app with `speak-run`, copy config.json aside, then run each check below at 1280 wide. every check reads
the page AND the state behind it: a drag or a save is proven by the ranks the page renders and by the file.

## checks

1. **order** — each column's cards follow its chain in config.json, labelled «1st / 2nd / … in the <lang> chain»,
   then the dashed cards
2. **↓** — ↓ on the first card makes it second; focus stays on its ↓; save enables
3. **mouse drag** — `agent-browser mouse` down on the first card's handle, eight moves to the last chain card's
   bottom, up: the dragged card's label reads the last rank, every other card moved up one
4. **keyboard drag** — focus the first handle, space, ArrowDown, space: that card reads «2nd in the en chain».
   again with esc instead of the last space: the order is back
5. **save** — after one change, save: the status line reads «saved · the daemon loaded it», `git diff` on
   config.json shows exactly that one change, and `npx biome format schedule/jobs/x-speak/config.json` fixes
   nothing. move it back, save, `cmp` against the copy
6. **reject** — `PUT /api/config` with an unknown engine name answers the daemon's «unknown name «…»» line
7. **preview** — ▶ on the kokoro card: the status line reads «▶ kokoro · en» and the daemon log gets a
   `first audio: kokoro` line
8. **«i»** — every setting has one (budget, glide, flow, speed, gain); focusing it shows its one line; the
   playback panel's open below the «i», clear of the header
9. **favourites** — open elevenlabs's voice list, ♡ Lily: she moves to the top as ♥; tick «only ♥ favourites»:
   only Lily stays; focus her row, Enter: the button reads «♥ Lily» and holds focus; Esc on a reopened list closes
   it with focus back on the button. save: the diff adds `"favourites": [...]` and the daemon logs «config: loaded»
10. **favicons** — `/speak-32.png` answers 200 image/png; `/../package.json` answers 404
11. **no quota** — while elevenlabs is short of credits, a preview longer than the credits left benches it: its
    badges read «no quota» in the muted colour, ▶ is disabled, the badge's title leads «<n> credits left». credits
    back → skip and say so
12. **glide / flow** — type 55 in the pill flow box, save: config.json reads `meterFlowMs` 55 and the slider sits
    at 55; restore the value
13. **infinite waveform** — toggle it on: a window owned by «x-speak» is on screen (`CGWindowListCopyWindowInfo`)
    and a `screencapture -l` of it shows moving bars across two shots; toggle off: the daemon stops feeding it
    (the pill hides unless its pin is on)

## essentials

```bash
~/.claude/plugins/cache/x/x/<version>/skills/browser-headless/essentials/run.sh http://127.0.0.1:7386/ --wait '[data-engine]'
```

one line, both widths; clean on main with no allows (2026-09-29). with a voice list open, «covered» names what the
popover sits on — run `essentials.js` alone for that state and read it as expected.

## evidence

- the check lines above, one each, and `errors: 0` from the console
- `essentials: <n> pass · <m> fail`, the baseline fail named as baseline
- `pnpm --filter speak typecheck` and `pnpm speak:admin-build`, read by exit code
- config.json back byte-for-byte
