// Files attached to the box: picked with the + button or dropped on it, sent as their paths after
// the text (Claude Code reads a path in a prompt as a file, an image path as an image).
import { exec } from 'herdr';

// macOS's own file picker, several at once, over the window in front: each path on its line, nothing
// when cancelled. AppleScript from shepherdr's mods/chat/attach.js (MIT).
const MAC_PICK = [
    'on run argv',
    '  try',
    '    tell application (path to frontmost application as text) to set fs to choose file with prompt (item 1 of argv) with multiple selections allowed',
    '  on error number -128',
    '    return ""',
    '  end try',
    '  set out to {}',
    '  repeat with f in fs',
    '    set end of out to POSIX path of f',
    '  end repeat',
    "  set AppleScript's text item delimiters to linefeed",
    '  return out as text',
    'end run',
];

/** @param {string} stdout @returns {string[]} */
export const pickedPaths = (stdout) =>
    stdout
        .split('\n')
        .map((l) => l.replace(/\r$/, ''))
        .filter(Boolean);

/** @returns {Promise<string[]>} the chosen paths; none when he cancels */
export async function pickFiles() {
    const r = await exec('osascript', [
        ...MAC_PICK.flatMap((l) => ['-e', l]),
        'Attach files',
    ]).catch(() => null);
    return r?.code === 0 ? pickedPaths(r.stdout) : [];
}

/** a list with new paths added once each, in the order he gave them @param {string[]} list @param {string[]} added */
export const withFiles = (list, added) => [
    ...list,
    ...added.filter((p, i) => !list.includes(p) && added.indexOf(p) === i),
];

/** @param {string} path */
export const fileName = (path) => path.split('/').filter(Boolean).pop() ?? path;

/** a path the way a file dropped on a terminal types it, spaces escaped @param {string} path */
export const promptPath = (path) => path.replace(/([ ()'"])/g, '\\$1');
