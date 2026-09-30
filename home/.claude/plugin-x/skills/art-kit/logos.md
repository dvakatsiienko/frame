# logos — a product's own mark, fetched into the store

a product logo (vite, linear, cursor, chrome — a readme stack row, an app's icon column) is the
brand's official file, fetched: the same file every run, fresh on every refresh. a mark drawn in
our own style happens only when dima asks for one.

## the store

every mark lives in one **logo store** per repo, never in an app: frame's is the `@frame/logos`
workspace package (`logos/`). the marks and their `logos.json` sit in `logos/marks/`; the package
exports `logoOf(name, theme)` (an inline data url), `hasLogo`, `appLogo(bundleId)` and a `LogoName`
union. an app adds `"@frame/logos": "workspace:*"` and keeps only its own aliases — the names it
prints mapped to a `LogoName` (`'google chrome': 'chrome'`).

## fetch

```sh
node ~/frame/home/.claude/plugin-x/skills/art-kit/scripts/logo.ts <name> [--dark] [--wordmark] [--mono]
node ~/frame/home/.claude/plugin-x/skills/art-kit/scripts/logo.ts --app <bundle id> [--size <px>]
node ~/frame/home/.claude/plugin-x/skills/art-kit/scripts/logo.ts --refresh
```

- the store defaults to the repo's `logos/marks`; `--store <dir>` points elsewhere. a write adds the
  `logos.json` entry and reruns the package's `build.ts` — nothing to copy by hand.
- svgl first: color, light/dark, wordmarks, ~670 products. then simple-icons: one color, ~3,400
  brands. `<name>` is svgl's title (`chrome`, `next.js`, `claude ai`) or a simple-icons slug
  (`nextdotjs`).
- a stderr line says when svgl matched a different title than the name asked — «calendar» is
  google calendar there, not apple's. read it before keeping the mark.
- `--dark` adds the dark-background file, and writes nothing when svgl ships one file for both.
- `--mono` skips svgl: a one-color mark. `build.ts` draws it black for light and white for dark,
  since an `<img>` draws `currentColor` black and the mark vanishes on a dark page.
- `--app <bundle id>` — an installed mac app's own icon as a png (32 px for a 16 px slot), for the
  apps neither catalogue carries (cleanshot, finder, wispr flow). machine-local: `--refresh` prints
  `✗` once the app is gone from this mac.
- `--refresh` re-fetches every entry: `=` same, `~` changed, `+` new, `✗` gone. a `~` is a rebrand,
  and it lands in every app at once — look at it before the commit.

## use

- `<img src={logoOf(name, theme)}>` — every mark is an inline data url, so no page waits on a file
  request (chords' daemon holds its server during `/api/stats`, and a fetched file drew blank).
- theme: when `logoOf(name, 'light') !== logoOf(name, 'dark')`, render both and let the app's
  theme css show one.
- frame's biome lints `.svg`: `!logos/marks` is the one exclusion, never one per app.
- a TSX component is wanted only when a mark takes `currentColor` or a `size` prop:
  `pnpm dlx @svgr/cli@8.1.0 --typescript --no-svgo --out-dir <dir> -- logos/marks`. `--no-svgo`
  keeps the `viewBox`; strip the `fill` / `fill-opacity` declarations from svgl's `style` first
  (display-p3 fallbacks become duplicate `fill` keys and tsc fails).

**done when** every mark in the job came from `logo.ts` into the store, the app reads it through
`@frame/logos`, and the reply names each mark's source (svgl, simple-icons, or `--app`).
