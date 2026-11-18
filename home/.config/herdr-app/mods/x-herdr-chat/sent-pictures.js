// the pictures a message carries, as files under the app dir that image() can draw (FRM-638 slice 5): an inline one is
// written once from its bytes, and each gets a sharp square thumb. one owner for each picture's files.

export const SENT_DIR = 'data/x-herdr-chat/sent';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_AT = new Map([...B64].map((c, i) => [c, i]));

/** herdr has no atob: base64 to bytes, padding and line breaks skipped @param {string} text */
export function decodeBase64(text) {
    const clean = text.replace(/[^A-Za-z0-9+/]/g, '');
    const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
    let bits = 0;
    let held = 0;
    let n = 0;
    for (const c of clean) {
        held = (held << 6) | (B64_AT.get(c) ?? 0);
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            out[n++] = (held >> bits) & 0xff;
        }
    }
    return out.subarray(0, n);
}

/** @param {string | null} media */
const extOf = (media) =>
    ({ 'image/gif': 'gif', 'image/jpeg': 'jpg', 'image/webp': 'webp' })[
        media ?? ''
    ] ?? 'png';

/** @param {import('./row-model.js').Picture} picture */
export const sentName = (picture) =>
    `${picture.id.replace(/[^\w-]/g, '_')}.${extOf(picture.media)}`;

/**
 * @typedef {object} SentIo
 * @property {() => Promise<string[]>} list the names already in SENT_DIR
 * @property {(rel: string, bytes: Uint8Array) => Promise<boolean>} write
 * @property {(path: string) => Promise<string | null>} thumb a picture's square under the app dir, by its path
 * @property {string} home the app dir
 */

/** @param {SentIo} io */
export function createSentPictures(io) {
    /** @type {Map<string, string>} picture id → its square under the app dir */
    const ready = new Map();
    /** @type {Map<string, string>} an inline picture's id → its whole file */
    const whole = new Map();
    /** @type {Set<string>} */
    const making = new Set();
    /** @type {Promise<Set<string>> | null} */
    let written = null;

    /** @param {import('./row-model.js').Picture} picture @returns {Promise<string | null>} the whole picture's path */
    async function wholeOf(picture) {
        if (picture.path) return picture.path;
        if (!picture.data) return null;
        const name = sentName(picture);
        const rel = `${SENT_DIR}/${name}`;
        written ??= io.list().then((names) => new Set(names));
        const isThere =
            (await written).has(name) ||
            (await io.write(rel, decodeBase64(picture.data)));
        return isThere ? `${io.home}/${rel}` : null;
    }

    return {
        /**
         * makes each picture's file once
         * @param {readonly import('./row-model.js').Picture[]} pictures
         * @returns {Promise<boolean>} whether one became ready
         */
        async make(pictures) {
            const todo = pictures.filter(
                (p) => !ready.has(p.id) && !making.has(p.id),
            );
            for (const p of todo) making.add(p.id);
            let isNew = false;
            for (const picture of todo) {
                const path = await wholeOf(picture).catch(() => null);
                if (path && !picture.path) whole.set(picture.id, path);
                const rel = path && (await io.thumb(path).catch(() => null));
                making.delete(picture.id);
                if (rel) {
                    ready.set(picture.id, rel);
                    isNew = true;
                }
            }
            return isNew;
        },
        /** the whole picture, for the viewer and the desktop app @param {import('./row-model.js').Picture} picture */
        pathOf: (picture) => picture.path ?? whole.get(picture.id) ?? null,
        /** a picture's square, null until it is made @param {import('./row-model.js').Picture} picture */
        relOf: (picture) => ready.get(picture.id) ?? null,
    };
}
