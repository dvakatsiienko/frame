// x-herdr-antenna (FRM-618): every thread once, in his order, grouped under its space or not, each row its name and a
// still status dot; the look is herdr's own agents list, calmer: no spinner, no sort, no sound

import { readdir } from 'fs/promises';
import { h_flex, v_flex } from 'gpui-base';
import { View, div, svg } from 'gpui-kit';
import {
    agents,
    home,
    layout,
    openOverlay,
    props,
    readTextFile,
    run,
    setAgentOrder,
    setShared,
    shared,
    terminals,
    theme,
    window,
    writeTextFile,
} from 'herdr';

import { rowDetails } from './details.js';
import { heirs, nextOrder } from './order.js';
import { antennaRows } from './rows.js';
import { antennaSettings, antennaSettingsText } from './settings.js';
import { POPUP_HEIGHT, POPUP_WIDTH, settingsPopup } from './settings-view.js';
import {
    NAMES,
    ORDER_KEY,
    publishNames,
    publishOrder,
    readNames,
    sessionName,
} from './thread-names.js';

/** @typedef {Record<string, import('gpui-kit').Color>} Theme */

const SETTINGS = `${home()}/.claude/shelf/herdr-settings/settings.json`;
// the knobs live: the popup writes them here as it saves, so antenna and the tab bar redraw at once
export const SETTINGS_KEY = 'antenna.settings';
const STATES = `${home()}/.claude/shelf/herdr-state`;

/** antenna's knobs as last saved, the defaults before the first read */
const settingsNow = () =>
    /** @type {Record<string, unknown>} */ (
        shared(SETTINGS_KEY) ?? antennaSettings(null)
    );

/** a knob's change saved beside every other row: the write holds only against the text it read, so one retry @param {string} key @param {unknown} value */
async function saveSetting(key, value) {
    for (const _ of [1, 2]) {
        const text = await readTextFile(SETTINGS);
        const next = antennaSettingsText(text, { [key]: value });
        try {
            await writeTextFile(SETTINGS, next, text);
            setShared(SETTINGS_KEY, antennaSettings(next));
            return;
        } catch {}
    }
}

/** each live thread's context fill and wait line by pid, from the state files cc's mods write for herdr */
async function readStates() {
    /** @type {Map<number, { context: number | null, wait: string | null }>} */
    const byPid = new Map();
    for (const f of await readdir(STATES).catch(
        () => /** @type {string[]} */ ([]),
    )) {
        if (!f.endsWith('.json')) continue;
        try {
            const s = JSON.parse(
                (await readTextFile(`${STATES}/${f}`)) ?? 'null',
            );
            if (typeof s?.pid !== 'number') continue;
            byPid.set(s.pid, {
                context: typeof s.ctx === 'number' ? s.ctx : null,
                wait: typeof s.wait === 'string' ? s.wait : null,
            });
        } catch {}
    }
    return byPid;
}

/** @param {any} node @param {string} id @returns {any} */
function find(node, id) {
    if (node?.id === id) return node;
    for (const child of node?.children ?? []) {
        const found = find(child, id);
        if (found) return found;
    }
    return null;
}

// the sidebar's rail goes by its width, not a flag: dragging its edge narrows it too
const narrow = () => (find(layout(), 'sidebar')?.size?.px ?? Infinity) < 160;

function toggleSidebar() {
    const width = find(layout(), 'sidebar')?.size?.px;
    if (!narrow()) setShared('sidebar.width', width);
    setShared('sidebar.collapsed', !narrow());
    run('layout.resize', {
        id: 'sidebar',
        px: narrow()
            ? (shared('sidebar.width') ?? 268)
            : window()?.platform === 'macos'
              ? 76
              : 44,
    });
}

/** @param {string} key @param {unknown} fallback */
function stored(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback;
    } catch {
        return fallback;
    }
}

export default class Antenna extends View {
    /** @param {unknown} _props @param {import('gpui-kit').Context} cx */
    init(_props, cx) {
        this.isPopup = Boolean(props()?.settings);
        if (this.isPopup) return;
        // each thread's last status and when it changed (ms), kept across restarts: the idle time
        /** @type {Record<string, { s: string, at: number }>} */
        this.changed = stored('changed', {});
        /** @type {Map<number, { context: number | null, wait: string | null }>} */
        this.states = new Map();
        cx.spawn(async (cx) => {
            const values = antennaSettings(await readTextFile(SETTINGS));
            if (JSON.stringify(shared(SETTINGS_KEY)) !== JSON.stringify(values))
                setShared(SETTINGS_KEY, values);
            cx.notify();
        });
        /** @type {string[]} his order of addresses, antenna's own; empty until it is seeded once */
        this.order = stored('order', []);
        /** @type {Record<string, string>} each ordered address's thread name, kept after its terminal goes */
        this.orderNames = stored('orderNames', {});
        const names = (/** @type {import('gpui-kit').Context} */ cx) =>
            cx.spawn(async (cx) => {
                await readNames(agents());
                publishNames();
                if (this.order.length === 0) this.seed();
                const knobs = settingsNow();
                if (
                    knobs['antenna.details.context'] ||
                    knobs['antenna.details.wait']
                )
                    this.states = await readStates();
                cx.notify();
            });
        names(cx);
        cx.timer.every(5000, names);
    }

    // his order before antenna came: the old list's pids under ORDER_KEY, read once, a thread it never saw at the end
    seed() {
        const pids = shared(ORDER_KEY);
        const byPid = new Map(
            [...NAMES].map(([address, { pid }]) => [pid, address]),
        );
        const seeded = Array.isArray(pids)
            ? pids.map((pid) => byPid.get(pid)).filter(Boolean)
            : [];
        this.setOrder([
            ...seeded,
            ...agents()
                .map((a) => a.address)
                .filter((a) => !seeded.includes(a)),
        ]);
    }

    /** stamps each thread whose status changed; done and idle count as one, a look turns done into idle
     * @param {import('herdr').AgentInfo[]} list @param {number} now */
    track(list, now) {
        let isChanged = false;
        for (const a of list) {
            const s = a.status === 'done' ? 'idle' : a.status;
            if (this.changed[a.address]?.s === s) continue;
            this.changed[a.address] = { at: now, s };
            isChanged = true;
        }
        if (!isChanged) return;
        const listed = new Set(list.map((a) => a.address));
        for (const [k, c] of Object.entries(this.changed))
            if (!listed.has(k) && now - c.at > 30 * 86400000)
                delete this.changed[k];
        localStorage.setItem('changed', JSON.stringify(this.changed));
    }

    /** @param {string[]} order */
    setOrder(order) {
        this.order = order;
        localStorage.setItem('order', JSON.stringify(order));
    }

    /** @param {import('herdr').AgentInfo[]} list */
    keepOrder(list) {
        if (this.order.length === 0) return list.map((a) => a.address);
        const live = new Set(
            terminals()
                .filter((t) => t.state === 'live')
                .map((t) => t.address),
        );
        let isNamed = false;
        for (const a of list) {
            const name = sessionName(a.address);
            if (!name || this.orderNames[a.address] === name) continue;
            this.orderNames[a.address] = name;
            isNamed = true;
        }
        if (isNamed)
            localStorage.setItem('orderNames', JSON.stringify(this.orderNames));
        const order = heirs(
            nextOrder(
                this.order,
                list.map((a) => a.address),
                live,
            ),
            this.orderNames,
            live,
        );
        if (JSON.stringify(order) !== JSON.stringify(this.order))
            this.setOrder(order);
        return order;
    }

    /** a still dot: blocked asks for him, working and unread fill, idle is a ring @param {Theme} t @param {string} status */
    dot(t, status) {
        if (status === 'blocked')
            return div()
                .flex_none()
                .px(6)
                .h(18)
                .rounded(5)
                .bg(/** @type {import('gpui-kit').Color} */ (`${t.blocked}26`))
                .text_size(10.5)
                .font_semibold()
                .text_color(t.blocked)
                .flex()
                .items_center()
                .child('Needs you');
        if (status === 'idle')
            return div()
                .size(7)
                .mx(3)
                .flex_none()
                .rounded(4)
                .border(1.5)
                .border_color(t.idle ?? t.dim);
        return div()
            .size(7)
            .mx(3)
            .flex_none()
            .rounded(4)
            .bg(t[status] ?? t.dim);
    }

    render() {
        const t = /** @type {Theme} */ (theme());
        const knobs = settingsNow();
        if (this.isPopup) return settingsPopup(t, knobs, saveSetting);
        const isNarrow = narrow();
        const list = agents();
        const now = Date.now();
        this.track(list, now);
        const order = this.keepOrder(list);
        setAgentOrder(order.filter((a) => list.some((x) => x.address === a)));
        publishOrder(order);
        const byAddress = new Map(list.map((a) => [a.address, a]));
        const names = Object.fromEntries(
            list.map((a) => [a.address, sessionName(a.address) ?? a.title]),
        );
        const rows = antennaRows(list, {
            isGrouped: !isNarrow && knobs['antenna.groupBySpace'] === true,
            names,
            order,
        });
        let n = 0;
        const drawn = rows.map((r) => {
            if (r.kind === 'space')
                return h_flex()
                    .id(`sp-${r.space}`)
                    .px(8)
                    .pt(8)
                    .h(30)
                    .flex_none()
                    .items_center()
                    .text_size(11)
                    .font_medium()
                    .text_color(t.dim)
                    .child(div().truncate().child(r.name));
            const a = byAddress.get(r.address);
            n += 1;
            const base = h_flex()
                .id(`an-${r.address}`)
                .flex_none()
                .items_center()
                .cursor_pointer()
                .hover((s) => s.bg(t.hover))
                .on_click(() => run('pane.focus', { pane: a.pane }));
            if (isNarrow)
                return base
                    .h(26)
                    .px(8)
                    .gap(4)
                    .when(a.focused, (el) => el.bg(t.selected))
                    .child(
                        div()
                            .flex_1()
                            .min_w(0)
                            .text_right()
                            .text_color(t.muted)
                            .child(String(n)),
                    )
                    .child(
                        h_flex()
                            .w(14)
                            .flex_none()
                            .justify_center()
                            .child(
                                this.dot(
                                    t,
                                    r.dot === 'blocked' ? 'done' : r.dot,
                                ),
                            ),
                    );
            const isQuiet = r.dot === 'idle' && !a.focused;
            const pid = NAMES.get(r.address)?.pid;
            const state = pid ? this.states.get(pid) : null;
            const more = rowDetails(
                knobs,
                {
                    context: state?.context ?? null,
                    // a working thread's time says nothing: idle time is for one that waits
                    since:
                        r.dot === 'working'
                            ? 0
                            : (this.changed[r.address]?.at ?? 0),
                    wait: state?.wait ?? null,
                },
                now,
            );
            const isCompact = knobs['antenna.rowHeight'] === 'compact';
            return base
                .min_h(isCompact ? 26 : 30)
                .py(more.wait ? 4 : 0)
                .px(8)
                .gap(9)
                .rounded(8)
                .when(a.focused, (el) => el.bg(t.selected))
                .child(
                    v_flex()
                        .flex_1()
                        .min_w(0)
                        .child(
                            div()
                                .truncate()
                                .text_color(isQuiet ? t.muted : t.foreground)
                                .child(r.name),
                        )
                        .when(Boolean(more.wait), (el) =>
                            el.child(
                                div()
                                    .truncate()
                                    .text_size(11)
                                    .text_color(t.dim)
                                    .child(more.wait ?? ''),
                            ),
                        ),
                )
                .when(Boolean(more.context), (el) =>
                    el.child(
                        div()
                            .flex_none()
                            .text_size(11)
                            .text_color(t.dim)
                            .child(more.context ?? ''),
                    ),
                )
                .when(Boolean(more.idle), (el) =>
                    el.child(
                        div()
                            .flex_none()
                            .text_size(11)
                            .text_color(t.dim)
                            .child(more.idle ?? ''),
                    ),
                )
                .child(this.dot(t, r.dot));
        });
        return v_flex()
            .size_full()
            .min_h(0)
            .bg(t.chrome)
            .border_t(1)
            .border_color(t.border)
            .text_size(13)
            .when(!isNarrow, (el) =>
                el.child(
                    h_flex()
                        .px(16)
                        .h(41)
                        .pt(14)
                        .pb(5)
                        .flex_none()
                        .items_center()
                        .justify_between()
                        .child(
                            div()
                                .text_size(11.5)
                                .font_medium()
                                .text_color(t.dim)
                                .child('Antenna'),
                        )
                        .child(
                            div()
                                .id('an-settings')
                                .mr(-4)
                                .p(4)
                                .rounded(5)
                                .text_color(t.dim)
                                .cursor_pointer()
                                .hover((s) =>
                                    s.bg(t.hover).text_color(t.foreground),
                                )
                                .tooltip('Antenna settings')
                                .on_click(() =>
                                    openOverlay({
                                        height: POPUP_HEIGHT,
                                        kind: 'popup',
                                        mod: 'x-herdr-antenna',
                                        props: { settings: true },
                                        width: POPUP_WIDTH,
                                    }),
                                )
                                .child(
                                    svg(
                                        'mods/workspace-chrome/settings.svg',
                                    ).size(14),
                                ),
                        ),
                ),
            )
            .when(list.length === 0 && !isNarrow, (el) =>
                el.child(
                    div()
                        .px(16)
                        .text_size(12)
                        .text_color(t.dim)
                        .child(
                            'No threads yet. A thread shows here once it reports its status.',
                        ),
                ),
            )
            .child(
                v_flex()
                    .id('an-list')
                    .flex_1()
                    .min_h(0)
                    .px(isNarrow ? 0 : 8)
                    .overflow_y_scrollbar()
                    .children(drawn),
            )
            .when(isNarrow, (el) =>
                el.child(
                    h_flex()
                        .h(28)
                        .items_center()
                        .justify_center()
                        .child(
                            div()
                                .id('an-widen')
                                .text_size(13)
                                .text_color(t.dim)
                                .cursor_pointer()
                                .hover((s) => s.text_color(t.foreground))
                                .tooltip('Widen the sidebar')
                                .on_click(toggleSidebar)
                                .child('»'),
                        ),
                ),
            );
    }
}
