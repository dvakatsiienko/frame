// cc's session registry stores a zero-width joiner as a space: «🐦‍⬛ crow» comes back as «🐦 ⬛ crow»
const JOINED = ['🐦‍⬛', '🐦‍🔥', '🙋‍♂️'];
/** @param {string} name */
const rejoin = (name) =>
    JOINED.reduce((n, j) => n.replaceAll(j.replace('‍', ' '), j), name);

// a live session's registry name never changes, so the pretty name x draws from its record wins (PK-378)
/** @param {{ name?: string, display?: string } | null} session */
export const threadName = (session) =>
    session?.display && session.display !== 'unknown'
        ? session.display
        : session?.name
          ? rejoin(session.name)
          : null;
