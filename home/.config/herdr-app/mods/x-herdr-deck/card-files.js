// an orbit card's files, drawn (FRM-676): a picture previews from a scaled copy under the app dir (image() reads only
// there) and a click opens the chat's viewer, a file is a row that opens it, a missing one says «not found»; the
// rules live in pictures.js

import { mkdir, unlink } from 'fs/promises';
import { h_flex, v_flex } from 'gpui-base';
import { div, image } from 'gpui-kit';
import { appHome, exec, home, layout, run, setShared } from 'herdr';

import { CHAT_VIEW, chatSelectArgs } from './chat-asks.js';
import { SIZE } from './look.js';
import {
    attachmentsOf,
    cardFiles,
    isPictureName,
    pressPicture,
    previewSize,
} from './pictures.js';

const PREVIEW_DIR = 'data/x-herdr-deck/previews';
// a preview is drawn at most 104 points tall: three pixels a point keep it sharp on a retina screen
const COPY_PX = 480;
// the card's inner width before it is measured
const ROOM_GUESS = 240;

/** a copy's name no other path shares @param {string} path */
function copyName(path) {
    let h = 0;
    let f = 0x811c9dc5;
    for (const c of path) {
        const code = c.codePointAt(0) ?? 0;
        h = (h * 31 + code) >>> 0;
        f = Math.imul(f ^ code, 0x01000193) >>> 0;
    }
    return `${h.toString(36)}-${f.toString(36)}.png`;
}

/** @param {string[]} args @returns {Promise<string | null>} */
const sips = async (args) => {
    const r = await exec('sips', args).catch(/** @returns {null} */ () => null);
    return r?.code === 0 ? r.stdout : null;
};

/**
 * a picture's preview copy, the whole picture scaled down; named by its change time too, so a picture shot again at
 * the same path gets a new copy (herdr's image() keeps a file it drew by its name); a file sips can't read is a plain
 * file, its row, never «not found»
 * @param {string} path @param {string} time
 */
async function previewCopy(path, time) {
    const rel = `${PREVIEW_DIR}/${copyName(`${path}@${time}`)}`;
    const out = `${appHome()}/${rel}`;
    await mkdir(`${appHome()}/${PREVIEW_DIR}`, { recursive: true });
    const made = await sips([
        '-Z',
        String(COPY_PX),
        '-s',
        'format',
        'png',
        path,
        '--out',
        out,
    ]);
    if (made === null) return true;
    const size = await sips(['-g', 'pixelWidth', '-g', 'pixelHeight', out]);
    const w = Number(/pixelWidth: (\d+)/.exec(size ?? '')?.[1]);
    const h = Number(/pixelHeight: (\d+)/.exec(size ?? '')?.[1]);
    return w && h ? { h, rel, w } : true;
}

/** removes a copy this deck made, never anything outside its own folder @param {unknown} got */
async function dropCopy(got) {
    const rel = /** @type {{ rel?: unknown }} */ (got)?.rel;
    if (typeof rel === 'string' && rel.startsWith(`${PREVIEW_DIR}/`))
        await unlink(`${appHome()}/${rel}`).catch(() => {});
}

/**
 * each path's change time, by path; a path that does not exist is absent
 * @param {string[]} paths @returns {Promise<Map<string, string>>}
 */
async function changeTimes(paths) {
    const r = await exec('stat', ['-f', '%m\t%N', ...paths]).catch(
        /** @returns {null} */ () => null,
    );
    const times = new Map();
    for (const line of (r?.stdout ?? '').split('\n')) {
        const tab = line.indexOf('\t');
        if (tab > 0) times.set(line.slice(tab + 1), line.slice(0, tab));
    }
    return times;
}

const chatDoors = {
    askView: (/** @type {unknown} */ ask) => setShared(CHAT_VIEW, ask),
    selectChat: () => {
        const chat = chatSelectArgs(layout());
        if (chat) run('layout.select', chat);
    },
};

export function createCardFiles() {
    /** what each path was found as: a tile copy, true for a file, false for none @type {Map<string, unknown>} */
    const found = new Map();
    /** each path's change time when it was looked at @type {Map<string, string>} */
    const seen = new Map();
    let room = ROOM_GUESS;
    /** a look runs alone: one asked meanwhile runs after it, with the newest rows */
    let isLooking = false;
    /** @type {[Rows, string[]] | null} */
    let queued = null;

    /** @param {Rows} rows @param {string[]} steered the files waiting in steer boxes, a picture's thumb drawn from its copy */
    async function lookOnce(rows, steered) {
        /** @type {Map<string, boolean>} each path, and whether it is a picture */
        const named = new Map([
            ...rows
                .flatMap((r) => r.asks)
                .flatMap((a) => attachmentsOf(a, home()))
                .map(
                    (f) =>
                        /** @type {[string, boolean]} */ ([
                            f.path,
                            f.isPicture,
                        ]),
                ),
            ...steered.map(
                (p) => /** @type {[string, boolean]} */ ([p, isPictureName(p)]),
            ),
        ]);
        if (!named.size) return false;
        const times = await changeTimes([...named.keys()]);
        let isChanged = false;
        for (const [path, isPicture] of named) {
            const time = times.get(path);
            if (found.has(path) && seen.get(path) === time) continue;
            const got = !time
                ? false
                : isPicture
                  ? await previewCopy(path, time)
                  : true;
            await dropCopy(found.get(path));
            found.set(path, got);
            if (time) seen.set(path, time);
            else seen.delete(path);
            isChanged = true;
        }
        return isChanged;
    }

    /**
     * looks again at the files the asks name and the steer boxes hold, a copy redone when its file changed: whether
     * any changed
     * @param {Rows} rows @param {string[]} [steered]
     */
    async function look(rows, steered = []) {
        if (isLooking) {
            queued = [rows, steered];
            return false;
        }
        isLooking = true;
        try {
            let isChanged = await lookOnce(rows, steered);
            while (queued) {
                const next = queued;
                queued = null;
                isChanged = (await lookOnce(...next)) || isChanged;
            }
            return isChanged;
        } finally {
            isLooking = false;
        }
    }

    /**
     * the card's file lines, or none
     * @param {import('./main.js').Theme} t @param {{ text: string, link: string | null }} ask @param {string} key
     */
    function view(t, ask, key) {
        const shown = cardFiles(attachmentsOf(ask, home()), found);
        if (!shown.length) return [];
        const pictures = shown.filter(
            (f) =>
                f.kind === 'picture' ||
                (f.kind === 'reading' && isPictureName(f.name)),
        );
        const rest = shown.filter((f) => !pictures.includes(f));
        /** @param {import('./pictures.js').CardFile} f @param {number} i */
        const tile = (f, i) => {
            const size =
                f.kind === 'picture'
                    ? previewSize(f.w, f.h, room)
                    : { h: 104, w: 104 };
            const frame = div()
                .id(`tile-${key}-${i}`)
                .tab_stop(false)
                .w(size.w)
                .h(size.h)
                .flex_none()
                .rounded(8)
                .overflow_hidden()
                .border_1()
                .border_color(t.border)
                .bg(t.background);
            if (f.kind !== 'picture') return frame;
            return frame
                .cursor_pointer()
                .hover((st) => st.border_color(t.accent))
                .tooltip(`view ${f.name}, ⌘-click opens your app`)
                .on_click((e, _cx) =>
                    pressPicture(
                        shown,
                        f.path,
                        Boolean(e.modifiers.platform),
                        Date.now(),
                        chatDoors,
                    ),
                )
                .child(image(f.rel).size_full());
        };
        /** @param {import('./pictures.js').CardFile} f @param {number} i */
        const chip = (f, i) => {
            const id = `chip-${key}-${i}`;
            const base = h_flex()
                .id(id)
                .tab_stop(false)
                .gap(6)
                .items_center()
                .px(10)
                .py(4)
                .rounded(8)
                .border_1()
                .border_color(t.border)
                .bg(t.background)
                .text_size(SIZE.secondary);
            if (f.kind === 'file')
                return base
                    .text_color(t.foreground)
                    .cursor_pointer()
                    .hover((st) => st.border_color(t.accent))
                    .on_click(() => {
                        exec('open', [f.path]).catch(() => {});
                    })
                    .child('📄')
                    .child(f.name);
            return base
                .text_color(t.dim)
                .child(
                    f.kind === 'missing'
                        ? `not found: ${f.name}`
                        : `reading ${f.name}…`,
                );
        };
        return [
            v_flex()
                .gap(8)
                .w_full()
                .on_size_change((size, cx) => {
                    const next = Math.round(size.width);
                    if (next > 0 && next !== room) {
                        room = next;
                        cx.notify();
                    }
                })
                .when(pictures.length > 0, (el) =>
                    el.child(
                        h_flex()
                            .flex_wrap()
                            .gap(8)
                            .children(pictures.map(tile)),
                    ),
                )
                .when(rest.length > 0, (el) =>
                    el.child(
                        h_flex().flex_wrap().gap(6).children(rest.map(chip)),
                    ),
                ),
        ];
    }

    /** a picture's preview copy under the app dir, once looked at @param {string} path @returns {string | null} */
    function previewOf(path) {
        const got = /** @type {{ rel?: unknown } | undefined} */ (
            found.get(path)
        );
        return typeof got?.rel === 'string' ? got.rel : null;
    }

    /** a steer box's picture opens in the chat's viewer, the box's other pictures a step away @param {string[]} pictures @param {string} path */
    function openPicture(pictures, path) {
        chatDoors.selectChat();
        chatDoors.askView({
            at: Math.max(0, pictures.indexOf(path)),
            files: pictures,
            isDesktop: false,
            time: Date.now(),
        });
    }

    return { look, openPicture, previewOf, view };
}

/* Types */

/** @typedef {{ asks: { text: string, link: string | null }[] }[]} Rows */
