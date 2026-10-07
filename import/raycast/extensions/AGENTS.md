# raycast extensions — every dir here is one private extension (x-ray, …)

- **keep raycast in dev mode while you code**: run `pnpm dev` (`ray develop`) in the extension dir
  and leave it running for the whole job — every save rebuilds and reloads the command in raycast,
  so dima sees each change live. stop it only at the end. a `ray build` alone registers nothing new.
  📌 first check whether one already runs — dima may have started it on his side: `ps -eo pid,command | grep 'ray develop' | grep -v -E 'grep|eval|zsh -c'` (your own shell's argv carries the pattern; the bracket trick alone matches yourself); a live one means you start nothing and stop nothing.
- **the type gate is `pnpm typecheck`**, never `ray build` — ray bundles with esbuild and prints
  success over type errors (typescript 7 is the native port; ray finds no compiler api).
- each extension is a member of the frame pnpm workspace: no own lockfile, no own typescript;
  `pnpm install` from the repo root; esbuild's build script is allowed in the root
  `pnpm-workspace.yaml`.
- biome only (root `biome.jsonc` re-includes this path); no eslint, no prettier, no `ray lint`.
- icons: 512×512 png, rounded-square tile (~22 % radius), transparent outside the tile; an emoji
  string is a valid raycast image source — flags and glyphs need no png.
- a hotkey command that acts and vanishes closes with `popToRootType: PopToRootType.Immediate`, or the next press re-enters the warm view
- everything a user reads is lowercase: the extension title, command titles, action titles, section headers, placeholders, toasts. identifiers, urls, currency codes and acronyms inside names («US dollar») keep their case.
- a new extension registers only through one `ray develop`; raycast caches extension titles and icons until a relaunch
- a `pnpm install` inside a non-workspace-member subdir climbs to the root and rewrites the root
  lockfile — a member joins `pnpm-workspace.yaml` or carries its own
