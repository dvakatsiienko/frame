// the files a text names, by path: the chat's reply rows (FRM-587) and orbit's cards (FRM-676) find them here

// a path a text names starts at his home or a system root, never a relative one
const ROOT = String.raw`(?:~|\/(?:Users|private|tmp|Volumes|opt))\/`;
// a bare path ends at a space, a quote or a bracket; a backslash-escaped space is part of it
const BARE_PATH = new RegExp(
    String.raw`(?:^|[\s\`(«])(${ROOT}(?:\\ |[^\s\`'"<>()[\]«»])+)`,
    'g',
);
// a quoted path keeps its spaces
const QUOTED_PATH = new RegExp(String.raw`["'«](${ROOT}[^"'«»\n]+?)["'»]`, 'g');
export const FILE_LINK =
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
 * the files a text names, each once, in order of kind (links, quoted paths, bare paths), never inside a fenced block
 * @param {string} text the markdown
 * @param {string} home his home, for a `~` path
 * @returns {{ label: string, path: string }[]}
 */
export function fileLinks(text, home) {
    const unfenced = text.replace(/^(```|~~~)[\s\S]*?^\1/gm, '');
    const prose = unfenced.replace(/`[^`\n]*`/g, '');
    /** @type {Map<string, string>} */
    const found = new Map();
    // a row is named by its file, never a link's label: the label could hide what a click opens
    /** @param {string} path */
    const add = (path) => {
        const full = path.replace(/^~(?=\/)/, home);
        if (!found.has(full)) found.set(full, full.split('/').pop() || full);
    };
    for (const m of prose.matchAll(FILE_LINK)) {
        const path = filePath(m[2] ?? m[3] ?? '');
        if (path) add(path);
    }
    for (const m of unfenced.matchAll(QUOTED_PATH)) {
        const path = m[1] ?? '';
        if (HAS_EXTENSION.test(path)) add(path);
    }
    for (const m of unfenced.matchAll(BARE_PATH)) {
        // a sentence's last mark, and a `path:line` reference's line, are not part of the path
        const path = (m[1] ?? '')
            .replace(/[.,;:!?]+$/, '')
            .replace(/(?::\d+)+(?:-\d+)?$/, '')
            .replace(/\\ /g, ' ');
        if (HAS_EXTENSION.test(path)) add(path);
    }
    return [...found].map(([path, label]) => ({ label, path }));
}

/** a file macOS Preview shows as a picture @param {string} path */
export const isPicture = (path) => /\.(?:png|jpe?g|gif|webp|heic)$/i.test(path);
