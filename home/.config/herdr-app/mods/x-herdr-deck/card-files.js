// an orbit card's files, drawn (FRM-676): a picture previews from a scaled copy under the app dir (image() reads only
// there) and a click opens the chat's viewer, a file is a row that opens it, a missing one says «not found»; the
// rules live in pictures.js

import { exists, mkdir } from 'fs/promises';
import { h_flex, v_flex } from 'gpui-base';
import { div, image } from 'gpui-kit';
import { appHome, exec, home, layout, run, setShared } from 'herdr';

import { CHAT_VIEW, chatSelectArgs } from './chat-asks.js';
import { SIZE } from './look.js';
import {
    attachmentsOf,
    cardFiles,
    pressPicture,
    previewSize,
} from './pictures.js';

const PREVIEW_DIR = 'data/x-herdr-deck/previews';
// a preview is held to 120 points: this many pixels keep it sharp on a retina screen
const PREVIEW_PX = 480;
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

/** a picture's scaled copy and its size, or false when it can't be read @param {string} path */
async function previewCopy(path) {
    const rel = `${PREVIEW_DIR}/${copyName(path)}`;
    const out = `${appHome()}/${rel}`;
    await mkdir(`${appHome()}/${PREVIEW_DIR}`, { recursive: true });
    const made = await exec('sips', [
        '-Z',
        String(PREVIEW_PX),
        '-s',
        'format',
        'png',
        path,
        '--out',
        out,
    ]).catch(/** @returns {null} */ () => null);
    if (made?.code !== 0) return false;
    const size = await exec('sips', [
        '-g',
        'pixelWidth',
        '-g',
        'pixelHeight',
        out,
    ]).catch(/** @returns {null} */ () => null);
    const w = Number(/pixelWidth: (\d+)/.exec(size?.stdout ?? '')?.[1]);
    const h = Number(/pixelHeight: (\d+)/.exec(size?.stdout ?? '')?.[1]);
    return w && h ? { h, rel, w } : false;
}

const chatDoors = {
    askView: (/** @type {unknown} */ ask) => setShared(CHAT_VIEW, ask),
    selectChat: () => {
        const chat = chatSelectArgs(layout());
        if (chat) run('layout.select', chat);
    },
};

export function createCardFiles() {
    /** what each path was found as: a preview copy, true for a file, false for none @type {Map<string, unknown>} */
    const found = new Map();
    let room = ROOM_GUESS;

    /**
     * looks up the files the asks name that are not found yet, a missing one again each time: whether any changed
     * @param {{ asks: { text: string, link: string | null }[] }[]} rows
     */
    async function look(rows) {
        const paths = rows
            .flatMap((r) => r.asks)
            .flatMap((a) => attachmentsOf(a, home()))
            .filter((f) => !found.get(f.path));
        let isChanged = false;
        for (const f of paths) {
            const got = f.isPicture
                ? await previewCopy(f.path)
                : await exists(f.path).catch(() => false);
            if (found.get(f.path) !== got) isChanged = true;
            found.set(f.path, got);
        }
        return isChanged;
    }

    /**
     * the card's file lines, or none
     * @param {import('./main.js').Theme} t @param {{ text: string, link: string | null }} ask @param {string} key
     * @param {(id: string) => any} linkRow the link's own row, which folds a text file open under the ask
     */
    function view(t, ask, key, linkRow) {
        const shown = cardFiles(attachmentsOf(ask, home()), found);
        if (!shown.length) return [];
        return [
            v_flex()
                .gap(6)
                .w_full()
                .on_size_change((size, cx) => {
                    const next = Math.round(size.width);
                    if (next > 0 && next !== room) {
                        room = next;
                        cx.notify();
                    }
                })
                .children(
                    shown.map((f, i) => {
                        const id = `file-${key}-${i}`;
                        if (f.kind === 'picture') {
                            const size = previewSize(f.w, f.h, room);
                            return div()
                                .id(id)
                                .tab_stop(false)
                                .w(size.w)
                                .h(size.h)
                                .rounded(6)
                                .overflow_hidden()
                                .border_1()
                                .border_color(t.border)
                                .cursor_pointer()
                                .hover((st) => st.border_color(t.accent))
                                .tooltip(
                                    `view ${f.name}, ⌘-click opens your app`,
                                )
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
                        }
                        if (f.kind === 'file' && f.isLink) return linkRow(id);
                        if (f.kind === 'file')
                            return h_flex()
                                .id(id)
                                .tab_stop(false)
                                .gap(6)
                                .items_center()
                                .text_size(SIZE.secondary)
                                .text_color(t.accent)
                                .cursor_pointer()
                                .hover((st) => st.underline())
                                .on_click(() => {
                                    exec('open', [f.path]).catch(() => {});
                                })
                                .child('📄')
                                .child(f.name);
                        return div()
                            .text_size(SIZE.secondary)
                            .text_color(t.dim)
                            .child(
                                f.kind === 'missing'
                                    ? `not found: ${f.name}`
                                    : `reading ${f.name}…`,
                            );
                    }),
                ),
        ];
    }

    return { look, view };
}
