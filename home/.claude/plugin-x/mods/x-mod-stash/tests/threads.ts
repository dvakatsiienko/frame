// FRM-579: a power read takes a thread's role from the store x writes; a test world plants it here
export const THREADS_FILE = '/home/.claude/shelf/threads.json';

export type ThreadRow = {
    sessionId: string;
    role?: string;
    display?: string;
    roleName?: string;
    pid?: number;
    wing?: number;
};

export const threadsFile = (rows: readonly ThreadRow[]) =>
    JSON.stringify({ threads: rows, v: 1 });

// the record x brief summon writes for a session started under this name: a fixture only, the source never reads a name
export function recordOf(
    name: string | undefined,
): Omit<ThreadRow, 'sessionId'> {
    const wing = name?.match(/^🦉🪽 clio: wing (\d+)$/);
    if (wing) return { display: name, role: 'wing', wing: Number(wing[1]) };
    if (name === '🦉 clio' || name === '🦉 cclio' || name === 'clio')
        return { display: '🦉 clio', role: 'coordinator' };
    if (name?.endsWith('crow'))
        return { display: '🐦‍⬛ crow', role: 'adviser' };
    if (name?.endsWith('helga'))
        return { display: '🎀 helga', role: 'copyist' };
    return {};
}
