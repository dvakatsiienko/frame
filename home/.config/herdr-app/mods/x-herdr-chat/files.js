// the files a reply names, each to open in one click from a row under it (FRM-587). a link in the text can't be
// pressed while herdr-app#894 is open (a handler inside a lazy-list row), so every file gets a row of its own.
// ported from x-herdr-chatter's rows.js `fileLinks`, which stays with the old chat.

// a path the chat opens starts at his home or a system root, never a relative one
const ROOT = String.raw`(?:~|\/(?:Users|private|tmp|Volumes|opt))\/`;
// a bare path ends at a space, a quote or a bracket; a backslash-escaped space is part of it
const BARE_PATH = new RegExp(
    String.raw`(?:^|[\s\`(«])(${ROOT}(?:\\ |[^\s\`'"<>()[\]«»])+)`,
    'g',
);
// a quoted path keeps its spaces
const QUOTED_PATH = new RegExp(String.raw`["'«](${ROOT}[^"'«»\n]+?)["'»]`, 'g');
const FILE_LINK =
    /\[([^\]\n]*)\]\(<?(file:\/\/[^\s)>]+)>?(?:\s+"[^"]*")?\)|<(file:\/\/[^\s>]+)>/g;
const HAS_EXTENSION = /\.[A-Za-z0-9]{1,10}$/;

/** the path a file:// url names, null for any other url or a broken escape @param {string} url */
function filePath(url) {
    const m = /^file:\/\/(?:localhost)?(\/.*)$/.exec(url);
    if (!m?.[1]) return null;
    try {
        return decodeURIComponent(m[1]);
    } catch {
        return null;
    }
}

/**
 * the files a reply names, each once, in order of kind (links, quoted paths, bare paths), never inside a fenced block
 * @param {string} text the reply's markdown
 * @param {string} home his home, for a `~` path
 * @returns {{ label: string, path: string }[]}
 */
export function fileLinks(text, home) {
    const unfenced = text.replace(/^(```|~~~)[\s\S]*?^\1/gm, '');
    const prose = unfenced.replace(/`[^`\n]*`/g, '');
    /** @type {Map<string, string>} */
    const found = new Map();
    /** @param {string} path @param {string} [label] */
    const add = (path, label) => {
        const full = path.replace(/^~(?=\/)/, home);
        if (found.has(full)) return;
        found.set(full, label || full.split('/').pop() || full);
    };
    for (const m of prose.matchAll(FILE_LINK)) {
        const path = filePath(m[2] ?? m[3] ?? '');
        if (path) add(path, m[1]?.trim());
    }
    for (const m of unfenced.matchAll(QUOTED_PATH)) {
        const path = m[1] ?? '';
        if (HAS_EXTENSION.test(path)) add(path);
    }
    for (const m of unfenced.matchAll(BARE_PATH)) {
        const path = (m[1] ?? '')
            .replace(/[.,;:!?]+$/, '')
            .replace(/\\ /g, ' ');
        if (HAS_EXTENSION.test(path)) add(path);
    }
    return [...found].map(([path, label]) => ({ label, path }));
}

/** a file macOS Preview shows as a picture @param {string} path */
export const isPicture = (path) => /\.(?:png|jpe?g|gif|webp|heic)$/i.test(path);

/**
 * a reply's markdown with each file:// link drawn as plain text: a press on it does nothing in a lazy-list row
 * (herdr-app#894), so it never looks pressable; the row under the reply opens it. code stays as written
 * @param {string} text
 */
export const unlinkFiles = (text) =>
    text
        .split(/(^(?:```|~~~)[\s\S]*?^(?:```|~~~)|`[^`\n]*`)/m)
        .map((part, i) =>
            i % 2
                ? part
                : part.replace(
                      FILE_LINK,
                      (_, label, url, auto) =>
                          label ??
                          (auto ?? url).split('/').filter(Boolean).pop(),
                  ),
        )
        .join('');
