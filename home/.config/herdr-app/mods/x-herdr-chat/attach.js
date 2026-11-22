// Files attached to the quill: picked with the + button or dropped on it, sent as their paths after
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

// the picture types Claude Code reads from a path in a prompt: a dropped one shows its preview, like a paste
/** @param {string} path */
export const isImagePath = (path) => /[^/]\.(png|jpe?g|gif|webp)$/i.test(path);

/**
 * `open`'s arguments for a picture: CleanShot X's annotate on it, or macOS Preview (FRM-587 W1, the setting
 * `chatter.pictures.cleanshot`)
 * @param {string} path @param {boolean} isCleanShot
 */
export const pictureOpenArgs = (path, isCleanShot) =>
    isCleanShot
        ? [`cleanshot://open-annotate?filepath=${encodeURIComponent(path)}`]
        : ['-a', 'Preview', path];

/** @param {string} path */
export const fileName = (path) => path.split('/').filter(Boolean).pop() ?? path;

/** a path the way a file dropped on a terminal types it, spaces escaped @param {string} path */
export const promptPath = (path) =>
    path.replace(/([\s()'"[\]&$;|<>*?!#`{}\\])/g, '\\$1');

/** a message as it leaves: the words, then each file's path on its own line @param {string} text @param {string[]} files */
export const withPaths = (text, files) =>
    [text, ...files.map(promptPath)].filter(Boolean).join('\n');
