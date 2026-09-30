# logos — a product's own mark, fetched

a product logo (vite, linear, cursor, chrome — a readme stack row, an app's icon column) is the
brand's official file, fetched: the same file every run, fresh on every refresh. a mark drawn in
our own style happens only when dima asks for one.

## fetch

```sh
node ~/frame/home/.claude/plugin-x/skills/art-kit/scripts/logo.ts <name> [--dark] [--wordmark] [--mono] --out <dir>
```

- svgl first: color, light/dark, wordmarks, ~670 products. then simple-icons: one color, ~3,400 brands.
- the default is the variant for a **light background**; `--dark` for a dark one (svgl's naming).
- `--mono` skips svgl: a one-color mark for `currentColor` theming.
- `<name>` is svgl's title (`chrome`, `next.js`, `claude ai`) or a simple-icons slug (`nextdotjs`).
  a stderr line says when svgl missed and the mark fell back to mono — a color mark wanted →
  rerun with a title from its match list.
- each run prints the file, its source url and its manifest entry.

## vendor

- the `.svg` files live in the consumer — one dir per app (`src/svg/logos/`) with `logos.json`
  beside them: `{ "<file>.svg": <the printed entry> }`. the `.svg` is the single source; a README
  points `<img>` at the same file.
- react: `<img src>` for a multicolor mark in a list (cached, fills intact); a TSX component when
  the mark takes `currentColor` or a `size` prop, generated with
  `pnpm dlx @svgr/cli@8.1.0 --typescript --no-svgo --out-dir <dir> -- <svg dir>` and left as
  generated. in a next.js server component an svg component ships no js.
  - `--no-svgo` keeps the `viewBox` — svgo's default preset strips it and the mark stops scaling
  - svgl files carry display-p3 fallbacks in `style` (`fill:#hex;fill:color(display-p3 …)`);
    in TSX they become duplicate `fill` keys and tsc fails. strip the `fill` / `fill-opacity`
    declarations from `style` before svgr (the `fill` attribute keeps the hex), keep the rest —
    `mask-type:alpha` draws the mark
  - bytes cv's `ViteSVG.tsx` is the worked example: a `--template` emitting `TSvgProps` + `size`
- refresh: `logo.ts --manifest <logos.json>` re-fetches every entry and prints `=` same, `~`
  changed, `+` new, `✗` gone per file. a `~` is a rebrand — look at it before the commit.

**done when** every logo in the job came from `logo.ts`, its entry sits in `logos.json`, and the
reply names each logo's source.
