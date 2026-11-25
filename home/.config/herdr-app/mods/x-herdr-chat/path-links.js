// the paths a reply names that are on disk, each drawn as a link he clicks (FRM-620, his o6 24 Nov). a path that is not
// there, or a file:// link to one, reads as its words

/** @typedef {import('./row-model.js').Row} Row */

const ROOT = String.raw`(?:~|\/(?:Users|private|tmp|Volumes|opt))\/`;
// a fenced block (one still being written too), a link whose label may hold code, a code span, a bare link, a bare path;
// the first that matches takes its words, so a path inside a link or a fence is never linked again
const TOKEN = new RegExp(
    [
        String.raw`(?<fence>^[ \t]*(?<mark>\`\`\`|~~~)(?:[\s\S]*?^[ \t]*\k<mark>|[\s\S]*))`,
        String.raw`(?<link>!?\[(?<label>(?:\`[^\`\n]*\`|[^[\]\n\`])*)\]\(<?(?<url>[^\s)>]+)>?(?:\s+"[^"]*")?\))`,
        String.raw`(?<code>\`[^\`\n]*\`)`,
        String.raw`<(?<auto>file:\/\/[^\s<>]+)>`,
        String.raw`(?<=^|[\s(«])(?<bare>${ROOT}[^\s\`'"<>()[\]«»\\]+)`,
    ].join('|'),
    'gm',
);
const WHOLE_PATH = new RegExp(String.raw`^${ROOT}[^\`\n]*$`);
const LINK = /^path:(\d+)$/;

/** a path less the line a «path:line» names @param {string} text */
const lineless = (text) => text.replace(/(?::\d+)+(?:-\d+)?$/, '');

/** the path a file:// url names, null for any other url or a broken escape @param {string} url */
function filePath(url) {
    const path = /^file:\/\/(?:localhost)?(\/.*)$/.exec(url)?.[1];
    if (!path) return null;
    try {
        return decodeURIComponent(path);
    } catch {
        return null;
    }
}

/**
 * a reply's markdown, each path in it handed to `draw`, which answers with what stands in its place
 * @param {string} text
 * @param {(path: string, words: string, plain: string) => string} draw `words` as written, `plain` when it is no link
 */
const eachPath = (text, draw) =>
    text.replace(TOKEN, (whole, ...rest) => {
        const { auto, bare, code, label, link, url } =
            /** @type {Record<string, string | undefined>} */ (rest.at(-1));
        if (link) {
            if (whole.startsWith('!')) return whole;
            const path = filePath(url ?? '');
            if (path) return draw(path, label ?? '', label ?? '');
            return WHOLE_PATH.test(url ?? '')
                ? draw(lineless(url ?? ''), label ?? '', whole)
                : whole;
        }
        if (code) {
            const inside = code.slice(1, -1);
            return WHOLE_PATH.test(inside)
                ? draw(lineless(inside), code, code)
                : code;
        }
        if (auto) {
            const path = filePath(auto);
            const name = auto.split('/').filter(Boolean).pop() ?? auto;
            return path ? draw(path, name, name) : name;
        }
        if (!bare) return whole;
        // a sentence's last mark is not part of the path
        const words = bare.replace(/[.,;:!?…]+$/, '');
        const after = bare.slice(words.length);
        return `${draw(lineless(words), words, words)}${after}`;
    });

/** the paths a reply names, each once, as it writes them @param {string} text */
export function pathsNamed(text) {
    /** @type {Set<string>} */
    const paths = new Set();
    eachPath(text, (path, _words, plain) => {
        paths.add(path);
        return plain;
    });
    return [...paths];
}

/** a reply's markdown with each path in `paths` a link to its place there @param {string} text @param {readonly string[]} paths */
export const linkPaths = (text, paths) =>
    eachPath(text, (path, words, plain) => {
        const at = paths.indexOf(path);
        return at < 0 ? plain : `[${words}](path:${at})`;
    });

/** the path a link of `linkPaths` names, null for any other link @param {string} url @param {Row} row @param {string} home */
export function pathOf(url, row, home) {
    const at = LINK.exec(url)?.[1];
    const path = at ? row.links?.[Number(at)] : null;
    return path ? path.replace(/^~(?=\/)/, home) : null;
}

/** @param {{ exists: (path: string) => Promise<boolean>, home: () => string }} disk */
export function createPathLinks({ exists, home }) {
    /** the text each row's links were read from @type {WeakMap<Row, string>} */
    const read = new WeakMap();
    return {
        /**
         * each reply learns which of its paths are there; one that gains a link is drawn anew
         * @param {readonly Row[]} rows @returns {Promise<boolean>} whether one did
         */
        async learn(rows) {
            const todo = rows.filter(
                (r) => r.kind === 'reply' && read.get(r) !== r.text,
            );
            const changed = await Promise.all(
                todo.map(async (row) => {
                    const { text } = row;
                    read.set(row, text);
                    const named = pathsNamed(text);
                    const isThere = await Promise.all(
                        named.map((path) =>
                            exists(path.replace(/^~(?=\/)/, home())).catch(
                                () => false,
                            ),
                        ),
                    );
                    const links = named.filter((_path, i) => isThere[i]);
                    // the reply grew while the disk answered: its longer text is asked for on its own
                    if (row.text !== text) return false;
                    if (links.join('\n') === (row.links ?? []).join('\n'))
                        return false;
                    row.links = links;
                    row.version += 1;
                    return true;
                }),
            );
            return changed.includes(true);
        },
    };
}
