// the doors of the join files and of the notes in herdr: a mkdir lock dir, its age from macOS stat, a write over the text
// it read, a transcript's lines by a search, the trial's record

import { exec, home, readTextFile, writeTextFile } from 'herdr';

/** @type {import('./joins.js').JoinIo} */
export const joinIo = {
    lock: async (path) =>
        (await exec('mkdir', [path]).catch(() => null))?.code === 0,
    lockAge: async (path) => {
        const out = await exec('stat', ['-f', '%m', path]).catch(() => null);
        const at = Number(out?.stdout.trim());
        return out?.code === 0 && at ? Date.now() - at * 1000 : null;
    },
    now: () => Date.now(),
    read: (path) => readTextFile(path),
    sleep: async (ms) => {
        await exec('sleep', [String(ms / 1000)]);
    },
    unlock: async (path) => {
        await exec('rmdir', [path]);
    },
    write: (path, body, expected) => writeTextFile(path, body, expected),
};

/** the lines of a transcript that hold the words: a search, for a whole long one is past what herdr reads @param {string} path @param {string} words */
export async function linesWith(path, words) {
    const out = await exec('grep', ['-F', '--', words, path]).catch(() => null);
    return out?.code === 0 ? out.stdout.split('\n').filter(Boolean) : [];
}

// outside the shelf: frame is public, and what stands under the shelf is tracked
const TRIAL_DIR = '.local/state/x/herdr-notes';

/** @param {string} line */
export function logTrial(line) {
    exec('/bin/sh', [
        '-c',
        'mkdir -p "$1" && printf "%s\\n" "$2" >> "$1/trial.jsonl"',
        'sh',
        `${home()}/${TRIAL_DIR}`,
        line,
    ]).catch(() => {});
}

export const newId = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) =>
        (c === 'x'
            ? Math.floor(Math.random() * 16)
            : Math.floor(Math.random() * 4) + 8
        ).toString(16),
    );
