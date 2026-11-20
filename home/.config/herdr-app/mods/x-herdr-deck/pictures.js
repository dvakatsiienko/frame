// the files an orbit ask carries (FRM-676): its link when it is a path, then each path its text names; a picture
// previews in the card and opens the chat's viewer, any other file is a row, a missing one says «not found»

import { fileLinks } from './file-links.js';

// the pictures Claude Code reads from a path, the ones a card previews
const PICTURE = /\.(?:png|jpe?g|gif|webp)$/i;
// a preview's height in points: every picture of a card one height, under the spec's 120
const STRIP_H = 104;

/** a file the card previews as a picture, by its name or path @param {string} name */
export const isPictureName = (name) => PICTURE.test(name);

/** @param {string} path */
const nameOf = (path) => path.split('/').filter(Boolean).pop() ?? path;

/**
 * an ask's files, each once: the link first, then the text's paths in the order the chat's rows find them
 * @param {{ text: string, link: string | null }} ask @param {string} home his home, for a `~` path
 * @returns {Attachment[]}
 */
export function attachmentsOf(ask, home) {
    const link = ask.link?.trim() ?? '';
    const linked = /^(\/|~\/)/.test(link)
        ? [link.replace(/^~(?=\/)/, home)]
        : [];
    const paths = [
        ...linked,
        ...fileLinks(ask.text, home).map((f) => f.path),
    ].filter((p, i, all) => all.indexOf(p) === i);
    return paths.map((path) => ({
        isLink: linked.includes(path),
        isPicture: isPictureName(path),
        name: nameOf(path),
        path,
    }));
}

/**
 * an ask's text with each path it names shrunk to the file's name: the file's own button sits under the text
 * @param {string} text @param {string} home his home, for a `~` path
 */
export function askText(text, home) {
    let out = text;
    for (const { path } of fileLinks(text, home)) {
        const name = nameOf(path);
        const tilde = path.startsWith(`${home}/`)
            ? `~${path.slice(home.length)}`
            : null;
        for (const raw of [path, tilde, path.replace(/ /g, '\\ ')])
            if (raw) out = out.split(raw).join(name);
    }
    return out;
}

/**
 * what the card draws for each file, from what the view found on disk: a picture's preview copy, `true` for a file
 * that exists, `false` for one that does not; a file not looked at yet reads
 * @param {Attachment[]} files @param {Map<string, unknown>} found
 * @returns {CardFile[]}
 */
export function cardFiles(files, found) {
    return files.map(({ isLink, isPicture, name, path }) => {
        const got = found.get(path);
        if (got === undefined) return { isLink, kind: 'reading', name, path };
        if (got === false) return { isLink, kind: 'missing', name, path };
        const copy =
            /** @type {{ rel?: unknown, w?: unknown, h?: unknown }} */ (got);
        if (
            isPicture &&
            typeof copy.rel === 'string' &&
            typeof copy.w === 'number' &&
            typeof copy.h === 'number'
        )
            return {
                h: copy.h,
                isLink,
                kind: 'picture',
                name,
                path,
                rel: copy.rel,
                w: copy.w,
            };
        return { isLink, kind: 'file', name, path };
    });
}

/**
 * a preview's size in a card's strip: the whole picture at one height, shrunk further only when it is wider than the
 * card; never blown up past its own pixels
 * @param {number} w @param {number} h the copy's pixels @param {number} room the card's inner width
 */
export function previewSize(w, h, room) {
    const scale = Math.min(STRIP_H / h, room / w, 1);
    return { h: Math.round(h * scale), w: Math.round(w * scale) };
}

/**
 * what a click on a preview asks of the chat's viewer: the ask's pictures, at the one clicked; ⌘ held asks for his
 * desktop app
 * @param {CardFile[]} shown @param {string} path @param {boolean} isDesktop
 * @returns {ViewerAsk}
 */
export function viewerOf(shown, path, isDesktop) {
    const files = shown.flatMap((f) => (f.kind === 'picture' ? [f.path] : []));
    return { at: Math.max(0, files.indexOf(path)), files, isDesktop };
}

/**
 * a press on a preview: the chat comes into view, then its viewer is asked to open the ask's pictures at this one
 * @param {CardFile[]} shown @param {string} path @param {boolean} isCmd ⌘ held @param {number} now
 * @param {{ selectChat: () => void, askView: (ask: ViewerAsk & { time: number }) => void }} doors
 */
export function pressPicture(shown, path, isCmd, now, doors) {
    doors.selectChat();
    doors.askView({ ...viewerOf(shown, path, isCmd), time: now });
}

/* Types */

/** @typedef {{ path: string, name: string, isLink: boolean, isPicture: boolean }} Attachment */
/**
 * @typedef {{ kind: 'picture', path: string, name: string, isLink: boolean, rel: string, w: number, h: number }
 *   | { kind: 'file' | 'missing' | 'reading', path: string, name: string, isLink: boolean }} CardFile
 */
/** @typedef {{ files: string[], at: number, isDesktop: boolean }} ViewerAsk */
