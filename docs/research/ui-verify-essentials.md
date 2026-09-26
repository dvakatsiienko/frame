---
dies-when: distilled into `x:browser-headless` essentials, `x:guide-ui-ux` and `x:guide-react` lines
---

Ticket: FRM-244

# ui verify essentials — automated checks every web verify pass runs

Three lanes: an opus agent reading package sources, two `parallel-cli` core runs. Grades in `docs/vet/parallel.md`.

## checks, in-page (agent-browser eval)

- **axe-core 4.13.0** via `https://cdn.jsdelivr.net/npm/axe-core@4.13.0/axe.min.js` (cdnjs 404s for 4.13.0), or `agent-browser --init-script node_modules/axe-core/axe.min.js` offline / under CSP. `axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa','wcag22aa','best-practice'] }, rules: { 'target-size': { enabled: true } } })` — `target-size` (2.5.8, 24 px) ships `enabled: false`; without the override it never runs
- **overflow at 390 px**: `scrollWidth > innerWidth`, then the outermost elements whose right edge passes the viewport
- **clipped ring**: rect grown by outline width + offset (and box-shadow spread for tailwind rings) vs every ancestor whose overflow is not visible; fix = `ring-inset`, negative offset, or padding on the scroll box. proven on atelier's first take row (`top -4.0`)
- **truncation**: ellipsis / line-clamp elements with `scrollWidth > clientWidth` and no `title` or full accessible text
- **focus ring**: after a real Tab, `:focus-visible` element has an outline or a box-shadow
- **console + page errors**: `agent-browser console` / `errors`, cleared before the pass
- **broken images**: `complete && naturalWidth === 0`
- **cursor**: enabled interactive roles whose computed cursor is `auto` / `default`
- empty / loading / error states: no generic detector — forced per surface (stub, empty data, throw) and screenshotted

## tab navigation

- a synthetic KeyboardEvent does not move focus: the walk is real `agent-browser press Tab` + an eval of `document.activeElement`, until focus cycles, cap 200
- flag: zero size, invisible, inside `aria-hidden`/`inert`, a repeat before the cycle ends, no visible ring, a jump against reading order, more than one stop inside one composite
- base-ui 1.8.0 `ToggleGroup`, `RadioGroup`, `Tabs.List`, `Toolbar` rove natively (`useCompositeItem`: `tabIndex: isHighlighted ? 0 : -1`); a slider thumb is its own stop, correct per apg
- apg window splitter: a resizable separator IS a tab stop by design (arrows resize). react-resizable-panels 4.13.3 spreads user props before `tabIndex: disabled ? undefined : 0` and omits `tabIndex` from the type — only `disabled` removes the stop, and it also stops resizing. inferred, unprobed: an `elementRef` + layout effect setting `tabIndex = -1`. dropping it leaves no keyboard resize (wcag 2.1.1) unless another path exists (collapse buttons, F6 pane cycling)

## cursor

- tailwind 4 preflight: buttons use `cursor: default` (upgrade guide); restore in `@layer base` for `button:not(:disabled), [role=button]:not(:disabled)` and extend to links, tabs, menu items, options, switches, checkboxes, radios, selects
- not pointer: text inputs (`text`), disabled (`not-allowed`), splitters (rrp sets `col-resize`/`row-resize` itself), panning canvases (`grab`/`grabbing`)
- slider: two readings — thumb `grab`/`grabbing` + track `pointer` (parallel q2), or pointer on the whole slider (opus). base-ui thumbs set no cursor

## error boundaries

- no boundary → react removes the whole tree on a render error
- not caught: event handlers, async code, ssr, the boundary's own errors; `startTransition` errors are caught. route handler / effect errors with `showBoundary(e)`
- react-error-boundary 6.1.6: `fallback | FallbackComponent | fallbackRender`, `onError`, `onReset({ reason })`, `resetKeys`; `error` is `unknown` (narrow, or `getErrorMessage`); `useErrorBoundary()` → `showBoundary`, `resetBoundary`
- react 19 `createRoot` options `onCaughtError`, `onUncaughtError`, `onRecoverableError` — reporting, not fallbacks
- a good fallback stays inside its section's box, names what failed, offers retry, resets on `resetKeys`, keeps detail behind a dev disclosure
- proof: a dev-only `?crash=<section>` throws in that section; the other sections still render and answer a click

## installable tools

- worth it: `pa11y` 10.0.0 (adds the HTML_CodeSniffer runner), `lighthouse` 13.5.0 / `unlighthouse` 0.18.1 (perf, layout shift, whole-site), `odiff-bin` 4.5.0 / `pixelmatch` 7.2.0 for screenshot diffs
- skip: `@axe-core/cli` (selenium, adds nothing over in-page axe), `backstopjs` 6.3.25 (stale since 2024-09), `@lhci/cli` 0.15.1 (slowing), percy (saas)
