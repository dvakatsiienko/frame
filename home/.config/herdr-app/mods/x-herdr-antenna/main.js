// x-herdr-antenna (FRM-618): every thread once, in his order, grouped under its space or not, each row its name and a
// still status dot; the look is herdr's own agents list, calmer: no spinner, no sort, no sound

import { TextView, h_flex, v_flex } from 'gpui-base';
import { View, div, svg } from 'gpui-kit';
import {
    agents,
    exec,
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

import { activityShown, rowDetails } from './details.js';
import { createListDrag } from './drag-view.js';
import { heirs, movedInGroup, nextOrder } from './order.js';
import { antennaRows, stopOf, tabStops } from './rows.js';
import { antennaSettings, antennaSettingsText } from './settings.js';
import { POPUP_HEIGHT, POPUP_WIDTH, settingsPopup } from './settings-view.js';
import { createTabMember } from './tab-loop.js';
import {
    NAMES,
    publishNames,
    publishOrder,
    readNames,
    sessionName,
} from './thread-names.js';

/** @typedef {Record<string, import('gpui-kit').Color> & import('./drag-view.js').DragTheme} Theme */
/** @typedef {import('gpui-kit').Context} Context */
/** a dragged row: its thread, and its group's addresses in drawn order, so a drop lands in that group
 * @typedef {{ address: string, pane: string, group: string, members: string[] }} Dragged */

// a thread row holds the keyboard: Tab and shift-Tab walk the one Tab loop, Enter opens the thread
const ROW_TAB = 'x_herdr_antenna_row_tab';
const ROW_BACK = 'x_herdr_antenna_row_back';
const ROW_OPEN = 'x_herdr_antenna_row_open';
const ROW_KEYS = 64;

// the old list's saved order, in herdr's store for its mod: read once, so his order comes over by address
const OLD_STORE = `${home()}/.config/herdr-app/data/x-herdr-agents/store.json`;
const SETTINGS = `${home()}/.claude/shelf/herdr-settings/settings.json`;
// the knobs live: the popup writes them here as it saves, so antenna and the tab bar redraw at once
export const SETTINGS_KEY = 'antenna.settings';

/** antenna's knobs as last saved, the defaults before the first read */
const settingsNow = () =>
    /** @type {Record<string, unknown>} */ (
        shared(SETTINGS_KEY) ?? antennaSettings(null)
    );

/** @param {string} text */
function isJson(text) {
    try {
        JSON.parse(text);
        return true;
    } catch {
        return false;
    }
}

/** a knob's change saved beside every other row: the write holds only against the text it read, so one retry @param {string} key @param {unknown} value */
async function saveSetting(key, value) {
    await exec('mkdir', ['-p', SETTINGS.slice(0, SETTINGS.lastIndexOf('/'))]);
    for (const _ of [1, 2]) {
        const text = await readTextFile(SETTINGS);
        // a file that does not parse holds his other rows: antenna never writes over it
        if (text !== null && !isJson(text)) return;
        const next = antennaSettingsText(text, { [key]: value });
        try {
            await writeTextFile(SETTINGS, next, text);
            setShared(SETTINGS_KEY, antennaSettings(next));
            return;
        } catch {}
    }
}

// the deck reads each thread's state file and publishes its facts by pid; antenna reads them here
const THREADS_KEY = 'x-herdr-deck.threads';
// a 🔥 press is the deck's to write: antenna asks it here, {at, on, sid} (x-herdr-deck orbit.js HOT_ASK)
const HOT_ASK = 'x-herdr-deck.hot';
// a press shows at once and holds as long as the deck waits on the thread (its PENDING_MS, 20 s) and one redraw more
const HOT_PENDING_MS = 21_000;

/** @typedef {{ activity: import('./details.js').Activity | null, context: number | null, isHot: boolean, model: string | null, sid: string | null, wait: string | null }} Facts */

/** @param {number | null | undefined} pid @returns {Facts | null} */
function factsOf(pid) {
    const deck = /** @type {{ threads?: Record<string, any> } | null} */ (
        shared(THREADS_KEY)
    );
    const f = pid == null ? null : deck?.threads?.[String(pid)];
    return f
        ? {
              activity:
                  ['working', 'waiting', 'idle'].includes(f.state) &&
                  typeof f.since === 'number'
                      ? { since: f.since, state: f.state }
                      : null,
              context: typeof f.context === 'number' ? f.context : null,
              isHot: f.isHot === true,
              model: typeof f.model === 'string' ? f.model : null,
              sid: typeof f.sid === 'string' ? f.sid : null,
              wait: typeof f.wait === 'string' ? f.wait : null,
          }
        : null;
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
        cx.bind_keys([
            { action: ROW_TAB, context: 'XAntennaRow', keystroke: 'tab' },
            {
                action: ROW_BACK,
                context: 'XAntennaRow',
                keystroke: 'shift-tab',
            },
            { action: ROW_OPEN, context: 'XAntennaRow', keystroke: 'enter' },
        ]);
        this.tab = createTabMember('x-herdr-antenna', {
            layout,
            setShared,
            shared,
        });
        /** @type {Map<string, import('gpui-kit').FocusHandle>} each thread row's keyboard handle */
        this.rowKeys = new Map();
        // a handle cannot be made while drawing, so a pool made here hands one to each new row; past it, a row has none
        this.spareKeys = Array.from({ length: ROW_KEYS }, () =>
            cx.focus_handle(),
        );
        /** @type {Map<string, { at: number, on: boolean }>} his 🔥 presses by sid, shown until the deck reads them */
        this.hotPressed = new Map();
        /** @type {string | null} the stop that held the keyboard at the last draw */
        this.heldStop = null;
        // one drag; it lives on the view, so a status redraw mid-drag keeps it (FRM-664)
        this.listKeys = cx.focus_handle();
        this.drag = createListDrag({
            axis: 'y',
            focus: () => this.listKeys,
            onClick: (/** @type {Dragged} */ item) =>
                run('pane.focus', { pane: item.pane }),
            onMove: (/** @type {Dragged} */ item, _from, to) => {
                const target = item.members[to];
                if (target)
                    this.setOrder(
                        movedInGroup(
                            this.order,
                            item.members,
                            item.address,
                            target,
                        ),
                    );
            },
        });
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
        /** his order came over from the old list; until then antenna publishes no order, so his never gets wiped */
        this.isSeeded = stored('seeded', false) === true;
        const names = (/** @type {import('gpui-kit').Context} */ cx) =>
            cx.spawn(async (cx) => {
                await readNames(agents());
                publishNames();
                if (!this.isSeeded) await this.seed();
                cx.notify();
            });
        names(cx);
        cx.timer.every(5000, names);
    }

    // his order before antenna came: the old list's own saved addresses, read once, a thread it never saw at the end
    async seed() {
        const text = await readTextFile(OLD_STORE).catch(
            () => /** @type {null} */ (null),
        );
        /** @type {unknown} */
        let old = null;
        try {
            old = JSON.parse(JSON.parse(text ?? 'null')?.order ?? 'null');
        } catch {}
        const seeded = Array.isArray(old)
            ? old.filter((a) => typeof a === 'string')
            : [];
        this.setOrder([
            ...seeded,
            ...agents()
                .map((a) => a.address)
                .filter((a) => !seeded.includes(a)),
        ]);
        this.isSeeded = true;
        localStorage.setItem('seeded', 'true');
    }

    /** @param {string[]} order */
    setOrder(order) {
        this.order = order;
        localStorage.setItem('order', JSON.stringify(order));
    }

    /** @param {import('herdr').AgentInfo[]} list */
    keepOrder(list) {
        if (!this.isSeeded) return list.map((a) => a.address);
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

    /** a still dot: blocked asks for him, working and unread fill, idle is a ring; the rail has no room for the pill, so
     * blocked is a dot in its own colour there @param {Theme} t @param {string} status @param {boolean} [isRail] */
    dot(t, status, isRail = false) {
        if (status === 'blocked' && !isRail)
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
        // working breathes, a calm pulse in place, never a spin (dima, 16:23: «slightly more alive»); waiting holds still
        // in its own colour, so a thread that only waits never reads active (FRM-618 slice D)
        return div()
            .size(7)
            .mx(3)
            .flex_none()
            .rounded(4)
            .bg((status === 'waiting' ? t.done : t[status]) ?? t.dim)
            .when(status === 'working', (el) =>
                el.loop('opacity', { from: 0.3, period: 2000, to: 1 }),
            );
    }

    /** keep hot for a row's thread, the deck's own 🔥: filled while on; its press is the deck's to write
     * @param {Theme} t @param {Facts} f */
    hotButton(t, f) {
        const own = this.hotPressed.get(f.sid);
        const isPending =
            own != null &&
            own.on !== f.isHot &&
            Date.now() - own.at < HOT_PENDING_MS;
        const isOn = isPending ? own.on : f.isHot;
        return div()
            .id(`hot-${f.sid}`)
            .size(20)
            .flex_none()
            .flex()
            .items_center()
            .justify_center()
            .rounded(10)
            .border_1()
            .border_color(isOn ? t.solid : t.border)
            .bg(isOn ? t.solid : t.surface)
            .text_size(11)
            .cursor_pointer()
            .hover((s) => s.opacity(0.85))
            .tooltip(isOn ? 'keep hot: on' : 'keep hot')
            .on_mouse_down('left', (_e, cx) => cx.stop_propagation())
            .on_click((_e, cx) => {
                cx.stop_propagation();
                const at = Date.now();
                this.hotPressed.set(f.sid, { at, on: !isOn });
                setShared(HOT_ASK, { at, on: !isOn, sid: f.sid });
            })
            .child('🔥');
    }

    /** @param {string} address @returns {import('gpui-kit').FocusHandle | null} */
    rowKey(address) {
        const kept = this.rowKeys.get(address);
        if (kept) return kept;
        const made = this.spareKeys.pop() ?? null;
        if (made) this.rowKeys.set(address, made);
        return made;
    }

    /** a handle of a row no longer drawn goes back to the pool @param {string[]} addresses */
    freeRowKeys(addresses) {
        const drawn = new Set(addresses);
        // a handle still holding the keyboard waits: handed to a new row, Enter there would open a thread he never picked
        for (const [a, key] of this.rowKeys)
            if (!drawn.has(a) && !key.is_focused()) {
                this.rowKeys.delete(a);
                this.spareKeys.push(key);
            }
    }

    /** the Tab loop's turn: publish this draw's stops, take the stop it names, and keep the hold in step with focus
     * @param {string[]} addresses the thread rows in drawn order @param {string[]} stops the ones that are Tab stops
     * @param {Context} cx */
    joinTabLoop(addresses, stops, cx) {
        /** @param {() => void} run */
        const later = (run) => cx.timer.after(0, run);
        const to = this.tab.draw(stops, later);
        const toAddress = to && addresses.find((a) => stopOf(a) === to);
        // a focus move redraws nothing by itself: without the notify the ring waited for the next shared write, so
        // every other Tab drew none (dima, 18:18)
        if (toAddress)
            cx.timer.after(0, (after) => {
                this.rowKey(toAddress)?.focus();
                after.notify();
            });
        const holding = addresses.find((a) =>
            this.rowKeys.get(a)?.is_focused(),
        );
        const now = holding ? stopOf(holding) : null;
        if (now === this.heldStop) return;
        const was = this.heldStop;
        this.heldStop = now;
        if (was) this.tab.left(was, later);
        if (now) later(() => this.tab.held(now));
    }

    /** @param {Context} cx */
    render(cx) {
        const t = /** @type {Theme} */ (theme());
        const knobs = settingsNow();
        if (this.isPopup) return settingsPopup(t, knobs, saveSetting);
        const isNarrow = narrow();
        const list = agents();
        const now = Date.now();
        const order = this.keepOrder(list);
        setAgentOrder(order.filter((a) => list.some((x) => x.address === a)));
        if (this.isSeeded)
            publishOrder(
                order,
                list.map((a) => a.address),
            );
        const byAddress = new Map(list.map((a) => [a.address, a]));
        const names = Object.fromEntries(
            list.map((a) => [a.address, sessionName(a.address) ?? a.title]),
        );
        const rows = antennaRows(list, {
            isGrouped: !isNarrow && knobs['antenna.groupBySpace'] === true,
            names,
            order,
        });
        // each thread row's group, in drawn order: a drag moves a row within its group, so a space header never sits
        // between a row and its slot, and the slots stay one row tall
        /** @type {Map<string, { group: string, members: string[] }>} */
        const groupOf = new Map();
        let group = { group: 'all', members: /** @type {string[]} */ ([]) };
        for (const r of rows)
            if (r.kind === 'space') group = { group: r.space, members: [] };
            else {
                group.members.push(r.address);
                groupOf.set(r.address, group);
            }
        const addresses = rows.flatMap((r) =>
            r.kind === 'thread' ? [r.address] : [],
        );
        this.freeRowKeys(addresses);
        this.joinTabLoop(
            addresses,
            tabStops(addresses, {
                hasKey: (a) => Boolean(this.rowKey(a)),
                isNarrow,
            }),
            cx,
        );
        const isCompact = knobs['antenna.rowHeight'] === 'compact';
        // with the wait line on every row is two lines tall, so a drag's slots match the rows
        const rowHeight =
            (isCompact ? 26 : 30) + (knobs['antenna.details.wait'] ? 14 : 0);
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
            const state = factsOf(NAMES.get(r.address)?.pid);
            // the dot and the time come from the thread's state file, herdr's own status only for a permission prompt
            const shown = activityShown(r.dot, state?.activity ?? null, now);
            n += 1;
            if (isNarrow)
                return h_flex()
                    .id(`an-${r.address}`)
                    .flex_none()
                    .items_center()
                    .cursor_pointer()
                    .hover((s) => s.bg(t.hover))
                    .on_click(() => run('pane.focus', { pane: a.pane }))
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
                            .child(this.dot(t, shown.dot, true)),
                    );
            const isQuiet = shown.dot === 'idle' && !a.focused;
            const more = rowDetails(knobs, {
                context: state?.context ?? null,
                model: state?.model ?? null,
                time: shown.time,
                wait: state?.wait ?? null,
            });
            const { group, members } = groupOf.get(r.address);
            const at = members.indexOf(r.address);
            const key = this.rowKey(r.address);
            const isHeld = key?.is_focused() ?? false;
            return this.drag
                .item(
                    h_flex(),
                    {
                        from: at,
                        item: {
                            address: r.address,
                            group,
                            members,
                            pane: a.pane,
                        },
                        key: r.address,
                        label: r.name,
                        places: members.length,
                        targetFor: (/** @type {Dragged} */ held) =>
                            held.group === group ? at : null,
                    },
                    t,
                )
                .id(`an-${r.address}`)
                .flex_none()
                .items_center()
                .cursor_pointer()
                .hover((s) => s.bg(t.hover))
                .when(Boolean(key), (el) => el.track_focus(key))
                .key_context('XAntennaRow')
                .on_action(ROW_TAB, () =>
                    this.tab.ask(stopOf(r.address), false),
                )
                .on_action(ROW_BACK, () =>
                    this.tab.ask(stopOf(r.address), true),
                )
                .on_action(ROW_OPEN, () => run('pane.focus', { pane: a.pane }))
                .border_1()
                .border_color(isHeld ? t.accent : '#00000000')
                .h(rowHeight)
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
                            // markdown, so a fleet name keeps its bold (W41); one line, clipped
                            el.child(
                                div()
                                    .h(14)
                                    .overflow_hidden()
                                    .child(
                                        TextView.markdown(
                                            `an-wait-${r.address}`,
                                            more.wait ?? '',
                                        )
                                            // herdr's UI font ships one face, so bold drew flat in it
                                            .font_family('.AppleSystemUIFont')
                                            .text_size(11)
                                            .text_color(t.dim),
                                    ),
                            ),
                        ),
                )
                .when(Boolean(more.model), (el) =>
                    el.child(
                        div()
                            .flex_none()
                            .text_size(11)
                            .text_color(t.dim)
                            .child(more.model ?? ''),
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
                .when(
                    knobs['antenna.details.hot'] === true &&
                        Boolean(state?.sid),
                    (el) => el.child(this.hotButton(t, state)),
                )
                .child(this.dot(t, shown.dot));
        });
        // empty space keeps the arrow: with no cursor of its own the block showed the I-beam (dima, 17:57); a row's
        // pointer and a drag's grab set their own
        return v_flex()
            .id('x-herdr-antenna')
            .cursor_default()
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
                this.drag
                    .zone(v_flex().id('an-zone').relative().flex_1().min_h(0))
                    .child(
                        v_flex()
                            .id('an-list')
                            .flex_1()
                            .min_h(0)
                            .px(isNarrow ? 0 : 8)
                            .overflow_y_scrollbar()
                            .children(drawn),
                    )
                    .children([this.drag.ghost(t)].filter(Boolean)),
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
