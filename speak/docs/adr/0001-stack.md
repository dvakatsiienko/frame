# speak's voice admin is a local vite + react app, served by its own node server

the admin edits x-speak's config.json and previews through the running daemon, so it runs where both live and
nowhere else. it is a vite + react + tailwind single page, built to `dist/` and served with its api by
`speak/server.ts` on 127.0.0.1:7386 (`pnpm speak:admin`). no deploy target.

- data: `@tanstack/react-query` over the server's routes; the status poll stops with the tab
- reorder: `@dnd-kit` (dima's pick), react owning the order through the drag with `move()` on every drag-over
- sections: `react-error-boundary` around each language column and the root
- the server reaches the daemon only through its unix control socket; config.json is written in biome's format

## considered options

- the first admin was one html file with vanilla js (2026-09-29). it grew past what one file carries once
  favourites were asked for, so it moved to the chords shape
- serving it from the swift daemon: the daemon would carry an http server and the page's assets; a node server
  beside the page is the frame way and keeps the daemon to speech
