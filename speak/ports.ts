// the one port pair for speak, imported by both sides so they cannot drift: the admin server (dist plus
// the api) and vite's dev server, which proxies /api back to it. the env overrides stand a second pair
// up beside the running one, for a verifier or a worktree.
export const speakPort = Number(process.env.SPEAK_PORT ?? 7386);
export const speakDevPort = Number(process.env.SPEAK_DEV_PORT ?? 7387);
