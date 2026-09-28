# chords is a local vite + react app, served by the hotkey daemon

chords draws this mac's bindings and this mac's press log, so it runs where that data lives and
nowhere else. it is a vite + react + tailwind single page, built to `dist/` and served by the
always-on `x-monitor-hotkey-live` daemon (`hotkeys/serve.ts`), which already watches the press
log and the config sources. there is no deploy target.

- data: `@tanstack/react-query` over the daemon's routes; the press stream arrives from the same
  server, so the page holds no state of its own beyond the ui
- the rebind board: `@dnd-kit` for drag between keys
- the aurora header: `vgpu` on webgpu — a look, not a function; the page works without it
- type: ibm plex mono + sans, self-hosted through `@fontsource`

## considered options

a hosted build (vercel, like the bytes apps) was never an option: the page has nothing to show
without this mac's log and configs, and its writes (notes, rebinds) must reach local files. the
writing routes accept loopback only; reads stay open on the wi-fi so dima's phone can look.
