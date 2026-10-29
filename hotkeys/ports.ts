// The one port pair for chords, imported by both sides so they cannot drift: the daemon's
// server (dist plus the api) and vite's dev server, which proxies /api back to it.
//
// The env overrides are for standing a second daemon up beside the running one — sixth sense or
// a bisect needs its own pair, and editing this file to get one dirties the tree it is judging.
//
// 📌 The number is also written literally in two places a human reads rather than imports:
// `hotkeys:map` in package.json and the plist's own description block. Neither honours the env
// override, which is correct — a second daemon is sixth sense's tool, not a thing dima opens.
export const chordsPort = Number(process.env.CHORDS_PORT ?? 7373);
export const chordsDevPort = Number(process.env.CHORDS_DEV_PORT ?? 7374);
