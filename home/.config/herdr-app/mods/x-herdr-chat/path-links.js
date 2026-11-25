// the paths a reply names that are on disk, each drawn as a link he clicks (FRM-620, his o6 24 Nov). a path that is not
// there, or a file:// link to one, reads as its words

/** @typedef {import('./row-model.js').Row} Row */

// a network volume is left out: a look at a lost one never answers
const ROOT = String.raw`(?:~|\/(?:Users|private|tmp|opt))\/`;
// a fence (one still being written too, or quoted), an indented line of code, a link's definition, a link whose label may
// hold code, a code span, a bare link, a bare path; the first that matches takes its words, so a path inside one is
// never linked again. a bare path that stops at a sign no path holds («<slug>», «(a)») names nothing on disk
const TOKEN = new RegExp(
    [
        String.raw`(?<fence>^[ \t>]*(?<mark>\`{3,}(?=[^\`\n]*$)|~{3,})(?:[\s\S]*?^[ \t>]*\k<mark>|[\s\S]*))`,
        String.raw`(?<indented>^(?: {4,}|\t)(?![ \t]*(?:[-*+]|\d+[.)])\s)[^\n]*)`,
        String.raw`(?<definition>^ {0,3}\[[^\]\n]+\]:[^\n]*)`,
        String.raw`(?<link>!?\[(?<label>(?:\`[^\`\n]*\`|[^[\]\n\`])*)\]\(<?(?<url>[^\s)>]+)>?(?:\s+"[^"]*")?\))`,
        String.raw`(?<code>(?<!\`)(?<ticks>\`+)(?!\`)[^\n]*?(?<!\`)\k<ticks>(?!\`))`,
        String.raw`<(?<auto>file:\/\/[^\s<>]+)>`,
        String.raw`(?<=^|[\s(«*])(?<bare>${ROOT}[^\s\`'"<>()[\]{}«»\\*]+)(?=[\s)»"*]|$)`,
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
        const { auto, bare, code, label, link, ticks, url } =
            /** @type {Record<string, string | undefined>} */ (rest.at(-1));
        if (link) {
            if (whole.startsWith('!')) return whole;
            const path = filePath(url ?? '');
            if (path) return draw(path, label ?? '', label ?? '');
            return WHOLE_PATH.test(url ?? '')
                ? draw(lineless(url ?? ''), label ?? '', label ?? '')
                : whole;
        }
        if (code) {
            const inside = code.slice(1, -1);
            return ticks === '`' && WHOLE_PATH.test(inside)
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

// a link of `linkPaths`, its words as TOKEN's label reads them
const PATH_LINK = /\[((?:`[^`\n]*`|[^[\]\n`])*)\]\(path:\d+\)/g;

/**
 * a markdown with each link of `linkPaths` read as its words, and where a range of it stands then
 * @param {string} source @param {{ start: number, end: number } | null} range
 */
export function withoutPathLinks(source, range) {
    /** what each link loses: its `[`, then its `](path:n)` @type {{ at: number, size: number }[]} */
    const cuts = [...source.matchAll(PATH_LINK)].flatMap((link) => {
        const [whole, words = ''] = link;
        return [
            { at: link.index, size: 1 },
            {
                at: link.index + 1 + words.length,
                size: whole.length - words.length - 1,
            },
        ];
    });
    /** @param {number} at */
    const moved = (at) =>
        cuts.reduce(
            (to, cut) => to - Math.max(0, Math.min(at - cut.at, cut.size)),
            at,
        );
    return {
        range: range && { end: moved(range.end), start: moved(range.start) },
        source: source.replace(PATH_LINK, '$1'),
    };
}

/** the path a link of `linkPaths` names, null for any other link @param {string} url @param {Row} row @param {string} home */
export function pathOf(url, row, home) {
    const at = LINK.exec(url)?.[1];
    const path = at ? row.links?.[Number(at)] : null;
    return path ? path.replace(/^~(?=\/)/, home) : null;
}

// a reply this near the end may name a file it is about to write: a path that was not there is looked for again
const NEWEST = 12;

/** @param {{ home: () => string, onDisk: (paths: string[]) => Promise<boolean[]> }} disk */
export function createPathLinks({ home, onDisk }) {
    /** the text each row's links were read from, and whether a path of it was not there @type {WeakMap<Row, { isAnyMissing: boolean, text: string }>} */
    const read = new WeakMap();
    return {
        /**
         * each reply learns which of its paths are there; one that gains a link is drawn anew
         * @param {readonly Row[]} rows @returns {Promise<boolean>} whether one did
         */
        async learn(rows) {
            const todo = rows.flatMap((row, i) => {
                if (row.kind !== 'reply') return [];
                const had = read.get(row);
                const isAgain = had?.isAnyMissing && i >= rows.length - NEWEST;
                if (had?.text === row.text && !isAgain) return [];
                const { text } = row;
                const named = pathsNamed(text);
                read.set(row, { isAnyMissing: named.length > 0, text });
                return named.length ? [{ named, row, text }] : [];
            });
            const asked = [...new Set(todo.flatMap(({ named }) => named))];
            const said = await onDisk(
                asked.map((path) => path.replace(/^~(?=\/)/, home())),
            );
            const there = new Set(asked.filter((_path, i) => said[i]));
            let isNew = false;
            for (const { named, row, text } of todo) {
                // the reply grew while the disk answered: its longer text is asked for on its own
                if (row.text !== text) continue;
                const links = named.filter((path) => there.has(path));
                read.set(row, {
                    isAnyMissing: links.length < named.length,
                    text,
                });
                if (links.join('\n') === (row.links ?? []).join('\n')) continue;
                row.links = links;
                row.version += 1;
                isNew = true;
            }
            return isNew;
        },
    };
}
