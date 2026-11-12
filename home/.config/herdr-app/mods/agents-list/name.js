import { rejoin } from './joined.js';

// a live session's registry name never changes, so the pretty name x draws from its record wins (PK-378)
/** @param {{ name?: string, display?: string } | null} session */
export const threadName = (session) =>
    session?.display && session.display !== 'unknown'
        ? session.display
        : session?.name
          ? rejoin(session.name)
          : null;
