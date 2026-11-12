// x-herdr-agents: agents in dima's own order (one flat list, a row moves only by his drag) or grouped by space, each by
// its Claude Code session name. Unread = Herdr's done; done = finished and seen (x-herdr.turns).

import { readdir } from 'fs/promises';
import { h_flex, v_flex } from 'gpui-base';
import { View, div, image, svg } from 'gpui-kit';
import {
    agents,
    closeOverlay,
    focused,
    hc,
    home,
    knownAgents,
    layout,
    openOverlay,
    panes,
    props,
    readTextFile,
    run,
    setAgentOrder,
    setShared,
    shared,
    spaces,
    terminals,
    theme,
    window,
} from 'herdr';

import { SOUNDS_ON, isSoundOn, startJobs } from './jobs.js';
import { threadName } from './name.js';
import { heirs, inOrder, moved, nextOrder } from './order.js';

function find(node, id) {
    if (node?.id === id) return node;
    for (const child of node?.children ?? []) {
        const found = find(child, id);
        if (found) return found;
    }
    return null;
}

// The sidebar's rail goes by its width, not a flag: dragging its edge narrows it too.
const narrow = () => (find(layout(), 'sidebar')?.size?.px ?? Infinity) < 160;

// To the rail (on macOS wide enough for the traffic lights), or back to the width it had.
function toggleSidebar() {
    const width = find(layout(), 'sidebar')?.size?.px;
    if (!narrow()) setShared('sidebar.width', width);
    // Mods edited before the rail went by width still read the flag.
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

const clean = (s) => (s ?? '').replace(/^[^\p{L}\p{N}]+/u, '').trim();

function lead(tab, all = panes()) {
    const mine = all.filter((p) => p.tab === tab.id && p.terminal);
    return (
        mine.find((p) => p.program?.agent) ??
        mine.find((p) => p.focused) ??
        mine[0]
    );
}

// A tab named after its program (the pane's, or a + menu entry's, `LAUNCHERS`: a "Claude (dev
// container)" tab's pane reports "Claude Code") shows the agent's title. Copied in x-herdr-tabs.
const LAUNCHERS = new Set();
function loadLaunchers(cx) {
    cx.spawn(async () => {
        for (const k of await knownAgents()) LAUNCHERS.add(k.name);
    });
}
function title(tab, l) {
    const prog = l?.program?.name;
    const live = clean(l?.title);
    const telling =
        live &&
        live !== prog &&
        !/^[~/]|^[A-Za-z]:\\/.test(live) &&
        !live.includes('@') &&
        live.toLowerCase() !== l?.program?.key;
    return (tab.name === prog || LAUNCHERS.has(tab.name)) && telling
        ? live
        : tab.name;
}
// Unread vs done. Herdr's "done" = finished while you weren't looking, and it turns "idle" once
// you look, so a finished agent you've read looked like one that never did anything. Worse, Herdr
// only counts looking at the terminal: with the Chat view in front an agent stays "done" while you
// read it. So shared "x-herdr.turns" = { address: "run" | "seen" }: "run" once it works (a turn is on
// or its result is unread), "seen" when it's done and the agent shown (focused().agent) with the
// window active. Shown: done + seen, or idle after any turn = "done"; Herdr's done otherwise =
// "unread"; idle with no turn yet = "idle". Copied in x-herdr-tabs: keep them in step.
const machineOf = (addr) => (addr.includes('/') ? addr.split('/')[0] : '');
function trackTurns(list, all) {
    const was = shared('x-herdr.turns') ?? {};
    let next = null;
    const set = (k, v) => {
        if (was[k] === v) return;
        next ??= { ...was };
        next[k] = v;
    };
    const looking = window()?.active ? focused()?.agent : null;
    for (const a of list) {
        if (a.status === 'working' || a.status === 'blocked')
            set(a.address, 'run');
        else if (a.status === 'done' && a.address === looking)
            set(a.address, 'seen');
    }
    // Ended terminals go, but only on machines heard from (none are listed right after a start).
    const heard = new Set(all.map((k) => machineOf(k.address)));
    const live = new Set(
        all.filter((k) => k.state === 'live').map((k) => k.address),
    );
    for (const k of Object.keys(next ?? was))
        if (heard.has(machineOf(k)) && !live.has(k)) {
            next ??= { ...was };
            delete next[k];
        }
    if (next) setShared('x-herdr.turns', next);
}
// The status shown: unread / done (seen) / Herdr's other words.
function shownStatus(a) {
    const v = shared('x-herdr.turns')?.[a.address];
    if (a.status === 'done') return v === 'seen' ? 'done' : 'unread';
    if (a.status === 'idle') return v ? 'done' : 'idle';
    return a.status;
}
const tone = (t, s) => (s === 'unread' ? t.accent : t[s]);

const RANK = { blocked: 5, done: 2, idle: 1, unread: 4, working: 3 };
// A sub-agent without a pane isn't in agents(): its raw word, error counting as
// blocked. It's never done: it reports to its parent, and the parent's done is the news.
const kidStatus = (k, listed) => {
    const s = listed.get(k.address) ?? k.status;
    return s === 'error' ? 'blocked' : s === 'done' ? 'idle' : s;
};
const SORTS = [
    { icon: 'square-pen', id: 'yours', label: 'Your order' },
    { icon: 'layers', id: 'grouped', label: 'Grouped by space' },
];
const sortOf = () =>
    SORTS.find((s) => s.id === shared('agents.sort')) ?? SORTS[0];

function duration(ms) {
    const m = Math.floor(ms / 60000);
    if (m < 1) return '<1m';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

// The agent's icon from the app's program table: a one-color glyph or a picture.
function icon(p, size, color) {
    if (!p?.icon) return null;
    return p.tint
        ? svg(p.icon).size(size).flex_none().text_color(color)
        : image(p.icon).w(size).h(size).flex_none();
}

// Our naming rule: an agent in herdr is called by its Claude Code session name (`claude -n`, or /rename), read from
// x's thread store (~/.claude/shelf/threads.json) by the pid herdr's core reports; a name changes on /rename, so it is read again every 30 s.
const NAMES = new Map();
function sessionName(address) {
    return NAMES.get(address)?.name ?? null;
}
// a `claude --bg` thread shows in herdr as `claude attach <job id>`: the terminal's pid is the attach client's, so its
// session is the registry file carrying that job id
async function sessionOf(term) {
    const dir = `${home()}/.claude/sessions`;
    /** @param {string} path */
    const read = async (path) => {
        try {
            return JSON.parse((await readTextFile(path)) ?? 'null');
        } catch {
            return null;
        }
    };
    // one rule, one reader (FRM-570 rule 8): a thread's name by its pid is x's thread store's; cc's registry stays the
    // door only for a bg thread's job id, which the store does not carry
    const store = term.pid
        ? await read(`${home()}/.claude/shelf/threads.json`)
        : null;
    const own = Array.isArray(store?.threads)
        ? store.threads.find((t) => t?.pid === term.pid)
        : null;
    if (own) return own;
    const job = term.argv?.[1] === 'attach' ? term.argv[2] : null;
    if (!job) return null;
    for (const f of await readdir(dir).catch(() => [])) {
        const s = f.endsWith('.json') ? await read(`${dir}/${f}`) : null;
        if (s?.jobId === job) return s;
    }
    return null;
}

async function readNames(list) {
    for (const a of list) {
        const kept = NAMES.get(a.address);
        if (kept && Date.now() - kept.at < 30000) continue;
        NAMES.set(a.address, {
            at: Date.now(),
            name: kept?.name ?? null,
            pid: kept?.pid ?? null,
        });
        const got = await hc(['get', a.address, '--json']).catch(() => null);
        const term = got?.code === 0 ? JSON.parse(got.stdout) : null;
        const session = term ? await sessionOf(term) : null;
        NAMES.set(a.address, {
            at: Date.now(),
            name: threadName(session),
            pid: session?.pid ?? null,
        });
    }
}

// the names go out through herdr's shared state, so the tab bar shows the same name and never reads them a second way;
// setShared re-renders every mod, so an unchanged map is not written
const NAMES_KEY = 'x-herdr-agents.names';
function publishNames() {
    /** @type {Record<string, string>} */
    const next = {};
    for (const [address, { name }] of [...NAMES].sort(([a], [b]) =>
        a.localeCompare(b),
    ))
        if (name) next[address] = name;
    if (JSON.stringify(shared(NAMES_KEY) ?? {}) !== JSON.stringify(next))
        setShared(NAMES_KEY, next);
}

// the pids in the order the list shows them: the deck orders its sessions and orbit by it (dima, 20:20: «The order in
// the agents list is the true source for the order in Orbit for threads»); written only on a change
const ORDER_KEY = 'x-herdr-agents.order';
function publishOrder(addresses) {
    const pids = addresses
        .map((a) => NAMES.get(a)?.pid)
        .filter((pid) => typeof pid === 'number');
    if (JSON.stringify(shared(ORDER_KEY) ?? []) !== JSON.stringify(pids))
        setShared(ORDER_KEY, pids);
}

export default class Agents extends View {
    init(_props, cx) {
        if (props()?.sortMenu) return;
        loadLaunchers(cx);
        this.folded = new Set();
        // Each agent's last state and when it changed (ms), kept across restarts.
        this.changed = JSON.parse(localStorage.getItem('changed') ?? '{}');
        this.pins = JSON.parse(localStorage.getItem('pins') ?? '[]');
        this.order = JSON.parse(localStorage.getItem('order') ?? '[]');
        // each ordered address's thread name, kept after its terminal goes, so a restarted thread finds its place
        this.orderNames = JSON.parse(
            localStorage.getItem('orderNames') ?? '{}',
        );
        cx.timer.every(30000, (cx) => cx.notify());
        // the ♪ sounds when an agent needs him or finishes (jobs.js)
        startJobs(cx);
        const names = (cx) =>
            cx.spawn(async (cx) => {
                await readNames(agents());
                publishNames();
                cx.notify();
            });
        names(cx);
        cx.timer.every(5000, names);
    }

    // Stamps agents whose state changed. Done and idle count as one: looking at a
    // finished agent turns done into idle, and looking isn't the agent doing anything.
    track(list, now) {
        let dirty = false;
        for (const a of list) {
            const s = a.status === 'done' ? 'idle' : a.status;
            if (this.changed[a.address]?.s === s) continue;
            this.changed[a.address] = { at: now, s };
            dirty = true;
        }
        if (!dirty) return;
        // Gone and old: the list alone is empty right after a start.
        const listed = new Set(list.map((a) => a.address));
        for (const [k, c] of Object.entries(this.changed))
            if (!listed.has(k) && now - c.at > 30 * 86400000)
                delete this.changed[k];
        localStorage.setItem('changed', JSON.stringify(this.changed));
    }

    since(a) {
        return this.changed[a.address]?.at ?? 0;
    }

    setOrder(order) {
        this.order = order;
        localStorage.setItem('order', JSON.stringify(order));
    }

    /**
     * the listed threads' names joined to the kept ones; a name for an address no longer ordered leaves
     * @param {{ address: string }[]} list
     * @returns {Record<string, string>}
     */
    keepNames(list) {
        /** @type {Record<string, string>} */
        const next = { ...this.orderNames };
        for (const a of list) {
            const name = sessionName(a.address);
            if (name) next[a.address] = name;
        }
        const ordered = new Set([...this.order, ...list.map((a) => a.address)]);
        for (const k of Object.keys(next)) if (!ordered.has(k)) delete next[k];
        if (JSON.stringify(next) !== JSON.stringify(this.orderNames)) {
            this.orderNames = next;
            localStorage.setItem('orderNames', JSON.stringify(next));
        }
        return next;
    }

    setPins(pins) {
        this.pins = pins;
        localStorage.setItem('pins', JSON.stringify(pins));
    }

    // Drops pins of agents that ended. Only for machines the list has heard from:
    // right after a start, or while a machine connects, its agents aren't listed yet.
    prunePins(all) {
        const machine = (addr) =>
            addr.includes('/') ? addr.split('/')[0] : '';
        const heard = new Set(all.map((k) => machine(k.address)));
        const live = new Set(
            all.filter((k) => k.state === 'live').map((k) => k.address),
        );
        const kept = this.pins.filter(
            (p) => !heard.has(machine(p)) || live.has(p),
        );
        if (kept.length !== this.pins.length) this.setPins(kept);
    }

    sortMenu(t) {
        const on = sortOf().id;
        return v_flex()
            .w_full()
            .p(5)
            .bg(t.popover)
            .text_size(12.8)
            .child(
                div()
                    .px(8)
                    .pt(4)
                    .pb(6)
                    .text_size(11)
                    .text_color(t.dim)
                    .child('Sort agents'),
            )
            .children(
                SORTS.map((s) =>
                    h_flex()
                        .id(`sort-${s.id}`)
                        .h(31)
                        .px(8)
                        .gap(9)
                        .rounded(7)
                        .items_center()
                        .text_color(t.foreground)
                        .hover((el) => el.bg(t.hover))
                        .on_click(() => {
                            setShared('agents.sort', s.id);
                            closeOverlay(props().overlay);
                        })
                        .child(
                            svg(`mods/workspace-chrome/${s.icon}.svg`)
                                .size(14)
                                .flex_none()
                                .text_color(t.muted),
                        )
                        .child(div().flex_1().child(s.label))
                        .when(s.id === on, (el) =>
                            el.child(
                                svg('mods/workspace-chrome/check.svg')
                                    .size(14)
                                    .flex_none()
                                    .text_color(t.foreground),
                            ),
                        ),
                ),
            );
    }

    peek(addr) {
        run('terminal.peek', { terminal: addr });
    }

    // Drag to reorder, as Herdr's spaces list does it (press, move, release; no drag API).
    // `key` names this element; `me` is what pressing it drags ({kind, pos, ...}) or null;
    // `aim(drag)` is where that drag lands with the pointer here ({key, pos, drop}) or null.
    // The accent line is drawn on the landing element, under it when moving down.
    dnd(el, t, key, me, aim) {
        const d = this.drag;
        const o = this.over;
        return el
            .relative()
            .when(Boolean(d && d.key === key && o && o.key !== key), (el) =>
                el.opacity(0.5),
            )
            .when(Boolean(d && o && o.key === key && d.key !== key), (el) =>
                el.child(
                    div()
                        .absolute()
                        .left(0)
                        .right(0)
                        .h(2)
                        .rounded(1)
                        .bg(t.accent)
                        .when(d.pos < o.pos, (line) => line.bottom(0))
                        .when(d.pos > o.pos, (line) => line.top(0)),
                ),
            )
            .when(Boolean(me), (el) =>
                el.on_mouse_down('left', () => {
                    this.drag = { key, ...me };
                    this.over = null;
                }),
            )
            .on_mouse_move((_e, cx) => {
                if (!this.drag) return;
                const over = aim(this.drag);
                if ((over?.key ?? null) !== (this.over?.key ?? null)) {
                    this.over = over;
                    cx.notify();
                }
            })
            .on_mouse_up('left', (_e, cx) => {
                const from = this.drag;
                const over = from && aim(from);
                this.drag = null;
                this.over = null;
                if (over && over.key !== from.key) over.drop(from);
                cx.notify();
            });
    }

    endDrag(cx) {
        if (!this.drag && !this.over) return;
        this.drag = null;
        this.over = null;
        cx.notify();
    }

    // Where a dragged space header lands with the pointer on space `id`'s header or rows:
    // spaces move only within their machine (space.move).
    spaceAim(id) {
        return (d) => {
            if (d.kind !== 'space') return null;
            const sp = spaces();
            const i = sp.findIndex((s) => s.id === id);
            if (i < 0 || (sp[i].machine ?? null) !== d.machine) return null;
            return {
                drop: (d) => run('space.move', { id: d.id, index: i + 1 }),
                key: `sp-${id}`,
                pos: i,
            };
        };
    }

    // Live sub-agents of `addr`, depth first, each with the tree lines in front of it.
    tree(all, addr, lead = []) {
        const kids = all.filter((k) => k.parent === addr && k.state === 'live');
        return kids.flatMap((k, i) => {
            const last = i === kids.length - 1;
            return [
                { lines: [...lead, last ? '└' : '├'], t: k },
                ...this.tree(all, k.address, [...lead, last ? '' : '│']),
            ];
        });
    }

    subRow(t, s, shown, compact) {
        const k = s.t;
        const st = kidStatus(k, this.listed);
        const pic = icon(k.program, 14, t.foreground);
        const on = k.address === shown;
        return h_flex()
            .id(`sub-${k.address}`)
            .pl(39)
            .pr(8)
            .rounded(8)
            .h(26)
            .flex_none()
            .gap(0)
            .items_center()
            .text_size(12.5)
            .when(on, (el) => el.bg(t.raised))
            .hover((s) => s.bg(t.hover))
            .on_click(() => this.peek(k.address))
            .children(
                s.lines.map((l) =>
                    div()
                        .self_start()
                        .mt(-4)
                        .w(9)
                        .h(17)
                        .mr(4)
                        .flex_none()
                        .when(Boolean(l), (el) =>
                            el.border_l(1.5).border_color(t.input),
                        )
                        .when(l === '└' || l === '├', (el) =>
                            el.border_b(1.5).rounded_bl(6),
                        ),
                ),
            )
            .when(Boolean(pic), (el) => el.child(div().mr(8).child(pic)))
            .child(
                div()
                    .flex_1()
                    .truncate()
                    .text_color(on ? t.foreground : t.muted)
                    .child(
                        k.name || k.template || k.program?.name || k.address,
                    ),
            )
            .child(this.status(t, { status: st }, compact));
    }

    // compact: a ! for blocked where a header already says "Needs you". `a.status` is a shown status
    // (shownStatus: unread / done are ours).
    status(t, a, compact = false) {
        if (a.status === 'working')
            return svg('mods/workspace-chrome/spinner.svg')
                .size(12)
                .mx(1)
                .flex_none()
                .text_color(t.working)
                .spin(900);
        if (a.status === 'blocked' && compact)
            return div()
                .size(14)
                .flex_none()
                .rounded(4)
                .bg(t.blocked + '26')
                .text_size(10.5)
                .font_bold()
                .text_color(t.blocked)
                .flex()
                .items_center()
                .justify_center()
                .child('!');
        if (a.status === 'blocked')
            return div()
                .flex_none()
                .px(6)
                .h(18)
                .rounded(5)
                .bg(t.blocked + '26')
                .text_size(10.5)
                .font_semibold()
                .text_color(t.blocked)
                .flex()
                .items_center()
                .child('Needs you');
        // Idle: a ring; unread: a dot; done (seen): a tick.
        if (a.status === 'idle')
            return div()
                .size(7)
                .mx(3)
                .flex_none()
                .rounded(4)
                .border(1.5)
                .border_color(t.idle ?? t.dim);
        if (a.status === 'done')
            return svg('mods/workspace-chrome/check.svg')
                .size(12)
                .mx(1)
                .flex_none()
                .text_color(t.done ?? t.dim);
        return div()
            .size(7)
            .mx(3)
            .flex_none()
            .rounded(4)
            .bg(a.status === 'unread' ? tone(t, 'unread') : t.dim + '00');
    }

    render(cx) {
        const t = theme();
        if (props()?.sortMenu) return this.sortMenu(t);
        const collapsed = narrow();
        const sort = sortOf();
        let list = agents();
        this.listed = new Map(list.map((a) => [a.address, a.status]));
        const all = terminals();
        const shown = focused()?.agent;
        const now = Date.now();
        this.track(list, now);
        trackTurns(list, all);
        const isYours = sort.id === 'yours';
        if (isYours) {
            const live = new Set(
                all.filter((k) => k.state === 'live').map((k) => k.address),
            );
            const order = heirs(
                nextOrder(
                    this.order,
                    list.map((a) => a.address),
                    live,
                ),
                this.keepNames(list),
                live,
            );
            if (order.join() !== this.order.join()) this.setOrder(order);
            list = inOrder(list, this.order);
        }
        this.prunePins(all);
        const pinned = this.pins
            .map((p) => list.find((a) => a.address === p))
            .filter(Boolean);
        const rest = list.filter((a) => !this.pins.includes(a.address));
        list = [...pinned, ...rest];
        setAgentOrder(list.map((a) => a.address));
        publishOrder(list.map((a) => a.address));

        // Puts pin `from` where `to` is (after it when moving down); pins not shown keep their place at the end.
        const movePin = (from, to) => {
            const shown = pinned.map((a) => a.address);
            const order = shown.filter((p) => p !== from);
            order.splice(shown.indexOf(to), 0, from);
            this.setPins([
                ...order,
                ...this.pins.filter((p) => !shown.includes(p)),
            ]);
        };

        const withKids = (a, i) => {
            const subs = collapsed ? [] : this.tree(all, a.address);
            const r = row(a, i, subs);
            if (this.folded.has(a.address)) return [r];
            return [r, ...subs.map((s) => this.subRow(t, s, shown, isYours))];
        };

        // The fold chevron; folded, the count too, colored by the most urgent one.
        const fold = (a, subs) => {
            const sts = subs.map((s) => kidStatus(s.t, this.listed));
            const top = sts.reduce(
                (m, s) => ((RANK[s] ?? 0) > (RANK[m] ?? 0) ? s : m),
                null,
            );
            const open = !this.folded.has(a.address);
            return div()
                .id(`fold-${a.address}`)
                .h(18)
                .px(3)
                .gap(3)
                .flex()
                .items_center()
                .rounded(4)
                .text_size(11)
                .text_color(open ? t.dim : (t[top] ?? t.dim))
                .cursor_pointer()
                .hover((s) => s.bg(t.hover).text_color(t.foreground))
                .on_click((_e, cx) => {
                    cx.stop_propagation();
                    open
                        ? this.folded.add(a.address)
                        : this.folded.delete(a.address);
                    cx.notify();
                })
                .child(
                    svg(
                        `mods/workspace-chrome/chevron-${open ? 'down' : 'right'}.svg`,
                    )
                        .size(11)
                        .flex_none(),
                )
                .when(!open, (el) => el.child(String(subs.length)));
        };

        // A row reads "space \u00b7 detail": the detail is a tab someone named or the
        // agent's own title, never an automatic tab number unless two rows would
        // otherwise read the same.
        const tabs = spaces().flatMap((s) => s.tabs);
        const label = (a) => {
            const tab = tabs.find((tab) => tab.id === a.tab);
            return tab
                ? title(tab, lead(tab))
                : a.title || a.program?.name || '';
        };
        const detail = new Map(
            list.map((a) => [
                a.address,
                /^\d+$/.test(label(a)) ? null : label(a),
            ]),
        );
        const seen = {};
        for (const a of list) {
            const k = `${a.space_name}\u0000${detail.get(a.address) ?? ''}`;
            seen[k] = (seen[k] ?? 0) + 1;
        }
        for (const a of list) {
            if (
                detail.get(a.address) == null &&
                seen[`${a.space_name}\u0000`] > 1
            )
                detail.set(a.address, label(a));
        }

        const row = (a, i, subs = []) => {
            // the name alone, no picture: its status already shows at the row's right end
            const pic = null;
            const more = detail.get(a.address);
            // An agent on another machine (`vps/t7`) says which.
            const machine = a.address.includes('/')
                ? a.address.split('/')[0]
                : null;
            if (collapsed) {
                return h_flex()
                    .id(`ag-${a.address}`)
                    .h(26)
                    .px(8)
                    .flex_none()
                    .items_center()
                    .gap(4)
                    .hover((s) => s.bg(t.hover))
                    .on_click(() => run('pane.focus', { pane: a.pane }))
                    .child(
                        div()
                            .flex_1()
                            .min_w(0)
                            .whitespace_nowrap()
                            .text_right()
                            .text_color(t.muted)
                            .child(String(i + 1)),
                    )
                    .child(
                        h_flex()
                            .w(14)
                            .flex_none()
                            .items_center()
                            .justify_center()
                            .child(
                                this.status(
                                    t,
                                    { status: shownStatus(a) },
                                    true,
                                ),
                            ),
                    );
            }
            const when = this.since(a);
            const idle = a.status === 'idle' && !a.focused;
            const isPinned = this.pins.includes(a.address);
            const pin = div()
                .id(`pin-${a.address}`)
                .flex_none()
                .p(2)
                .rounded(4)
                .text_color(t.dim)
                .cursor_pointer()
                .hover((s) => s.bg(t.hover).text_color(t.foreground))
                .tooltip(isPinned ? 'Unpin' : 'Pin to the top')
                .on_click((_e, cx) => {
                    cx.stop_propagation();
                    this.setPins(
                        isPinned
                            ? this.pins.filter((p) => p !== a.address)
                            : [...this.pins, a.address],
                    );
                    // The row moves away from under the pointer, and no hover-out comes.
                    this.hovered = null;
                    cx.notify();
                })
                .child(
                    svg(
                        `mods/workspace-chrome/${isPinned ? 'pin-off' : 'pin'}.svg`,
                    ).size(13),
                );
            // An automatic tab number says nothing. No row names its space: the name repeats on every row and
            // wastes the line (dima, 19:59 and 00:13: «redundant … not needed»).
            const full = isYours || isPinned;
            const both = full && Boolean(more) && Boolean(a.space_name);
            const name =
                sessionName(a.address) ??
                (both
                    ? more
                    : full
                      ? a.space_name || label(a)
                      : (more ??
                        (/^\d+$/.test(label(a))
                            ? a.program?.name || label(a)
                            : label(a))));
            // Dragging: pinned rows reorder the pins; in his order a row takes the place it is dropped on;
            // under a space header a row moves its tab within the space (the tab bar follows).
            const pinAt = pinned.indexOf(a);
            const spaceTabs =
                spaces().find((s) => s.id === a.space)?.tabs ?? [];
            const tabAt = spaceTabs.findIndex((x) => x.id === a.tab);
            const mineAt = this.order.indexOf(a.address);
            const me = isPinned
                ? { kind: 'pin', pos: pinAt }
                : isYours
                  ? { kind: 'mine', pos: mineAt }
                  : tabAt >= 0
                    ? { kind: 'tab', pos: tabAt, space: a.space, tab: a.tab }
                    : null;
            const onSpace = this.spaceAim(a.space);
            const aim = (d) => {
                if (d.kind === 'pin' && isPinned)
                    return {
                        drop: (d) => movePin(d.key, a.address),
                        key: a.address,
                        pos: pinAt,
                    };
                if (d.kind === 'mine' && isYours && !isPinned)
                    return {
                        drop: (d) =>
                            this.setOrder(moved(this.order, d.key, a.address)),
                        key: a.address,
                        pos: mineAt,
                    };
                if (
                    d.kind === 'tab' &&
                    !isPinned &&
                    !isYours &&
                    d.space === a.space &&
                    d.tab !== a.tab &&
                    tabAt >= 0
                ) {
                    return {
                        drop: (d) =>
                            run('tab.move', { id: d.tab, index: tabAt + 1 }),
                        key: a.address,
                        pos: tabAt,
                    };
                }
                return !isPinned && !isYours ? onSpace(d) : null;
            };
            return this.dnd(h_flex(), t, a.address, me, aim)
                .id(`ag-${a.address}`)
                .px(8)
                .h(30)
                .flex_none()
                .rounded(8)
                .items_center()
                .gap(9)
                .when(a.focused, (el) => el.bg(t.selected))
                .cursor_pointer()
                .hover((s) => s.bg(t.hover))
                .on_hover((on, cx) => {
                    if (on) this.hovered = a.address;
                    else if (this.hovered === a.address) this.hovered = null;
                    cx.notify();
                })
                .on_click(() => run('pane.focus', { pane: a.pane }))
                .when(Boolean(pic), (el) =>
                    el.child(
                        div()
                            .id(`agent-fold-${a.address}`)
                            .when(subs.length > 0, (el) =>
                                el.on_click((_e, cx) => {
                                    cx.stop_propagation();
                                    this.folded.has(a.address)
                                        ? this.folded.delete(a.address)
                                        : this.folded.add(a.address);
                                    cx.notify();
                                }),
                            )
                            .child(pic),
                    ),
                )
                .child(
                    h_flex()
                        .flex_1()
                        .min_w(0)
                        .gap(5)
                        .items_center()
                        .child(
                            div()
                                .id(`ag-name-${a.address}`)
                                .when(both, (el) => el.min_w(0))
                                .when(!both, (el) => el.min_w(0).max_w(200))
                                .truncate()
                                .tooltip(String(name))
                                .text_color(idle ? t.muted : t.foreground)
                                .child(name),
                        ),
                )
                .when(Boolean(machine), (el) =>
                    el.child(
                        div().text_size(10).text_color(t.dim).child(machine),
                    ),
                )
                .when(subs.length > 0, (el) => el.child(fold(a, subs)))
                .when(this.hovered === a.address, (el) => el.child(pin))
                .when(this.hovered !== a.address && Boolean(when), (el) =>
                    el.child(
                        div()
                            .flex_none()
                            .text_size(11)
                            .text_color(t.dim)
                            .child(duration(now - when)),
                    ),
                )
                .child(
                    this.status(
                        t,
                        { status: shownStatus(a) },
                        isYours && !isPinned,
                    ),
                );
        };

        // Groups in list order: spaces (grouped), or one headless group in his order. Agents of a
        // space are next to each other in agents(), so neighbours make a group.
        const groups = pinned.length
            ? [{ id: 'pinned', label: 'Pinned', members: pinned, status: null }]
            : [];
        for (const a of rest) {
            const id = isYours ? 'yours' : `sp-${a.space}`;
            if (groups.at(-1)?.id === id) groups.at(-1).members.push(a);
            else
                groups.push({
                    id,
                    label: isYours ? '' : a.space_name || '',
                    members: [a],
                    space: isYours ? null : a.space,
                    status: null,
                });
        }

        // A group's header; it folds the group. Folded, it says how many and the most urgent state.
        // A space's header drags to reorder the spaces; right-click renames the space.
        const header = (g) => {
            const open = !this.folded.has(g.id);
            const top = g.members
                .map(shownStatus)
                .reduce(
                    (m, s) => ((RANK[s] ?? 0) > (RANK[m] ?? 0) ? s : m),
                    null,
                );
            const sp = g.space ? spaces() : [];
            const at = sp.findIndex((s) => s.id === g.space);
            const el =
                g.space && at >= 0
                    ? this.dnd(
                          h_flex(),
                          t,
                          g.id,
                          {
                              id: g.space,
                              kind: 'space',
                              machine: sp[at].machine ?? null,
                              pos: at,
                          },
                          this.spaceAim(g.space),
                      ).on_mouse_down('right', () =>
                          run('space.rename', { id: g.space }),
                      )
                    : h_flex();
            return el
                .id(g.id)
                .px(8)
                .pt(8)
                .h(30)
                .flex_none()
                .gap(6)
                .items_center()
                .text_size(11)
                .font_medium()
                .cursor_pointer()
                .hover((s) => s.text_color(t.foreground))
                .on_click((_e, cx) => {
                    open ? this.folded.add(g.id) : this.folded.delete(g.id);
                    cx.notify();
                })
                .child(
                    div()
                        .truncate()
                        .text_color(tone(t, g.status) ?? t.dim)
                        .child(g.label),
                )
                .when(!open, (el) =>
                    el.child(
                        div().text_color(t.dim).child(String(g.members.length)),
                    ),
                )
                .child(div().flex_1())
                .when(!open, (el) =>
                    el
                        .when(top && top !== 'idle', (el) =>
                            el.child(this.status(t, { status: top }, true)),
                        )
                        .child(
                            svg('mods/workspace-chrome/chevron-right.svg')
                                .size(11)
                                .flex_none()
                                .text_color(t.dim),
                        ),
                );
        };
        const rows = collapsed
            ? list.flatMap(withKids)
            : groups.flatMap((g) => [
                  ...(g.id === 'yours' ? [] : [header(g)]),
                  ...(this.folded.has(g.id) ? [] : g.members.flatMap(withKids)),
              ]);

        return v_flex()
            .size_full()
            .min_h(0)
            .bg(t.chrome)
            .border_t(1)
            .border_color(t.border)
            .text_size(13)
            .when(!collapsed, (el) =>
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
                                .child('Agents'),
                        )
                        .child(
                            h_flex()
                                .gap(4)
                                .items_center()
                                .mr(-8)
                                .child(
                                    div()
                                        .id('ag-sort')
                                        .text_size(11)
                                        .text_color(t.dim)
                                        .hover((s) =>
                                            s.text_color(t.foreground),
                                        )
                                        .on_click(() =>
                                            openOverlay({
                                                height: 140,
                                                kind: 'popup',
                                                mod: 'x-herdr-agents',
                                                props: { sortMenu: true },
                                                width: 200,
                                            }),
                                        )
                                        .tooltip(`Sort agents: ${sort.label}`)
                                        .child(
                                            svg(
                                                `mods/workspace-chrome/${sort.icon}.svg`,
                                            ).size(14),
                                        ),
                                )
                                // the sounds switch: off by default, his own sounds come later
                                .child(
                                    div()
                                        .id('ag-sounds')
                                        .px(8)
                                        .py(4)
                                        .rounded(6)
                                        .text_size(14)
                                        .text_color(
                                            isSoundOn() ? t.foreground : t.dim,
                                        )
                                        .when(!isSoundOn(), (el) =>
                                            el.line_through(),
                                        )
                                        .cursor_pointer()
                                        .hover((s) =>
                                            s
                                                .bg(t.hover)
                                                .text_color(t.foreground),
                                        )
                                        .tooltip(
                                            isSoundOn()
                                                ? 'Sounds when an agent needs you or finishes: on'
                                                : 'Sounds when an agent needs you or finishes: off',
                                        )
                                        .on_click((_e, cx) => {
                                            try {
                                                localStorage.setItem(
                                                    SOUNDS_ON,
                                                    isSoundOn() ? 'off' : 'on',
                                                );
                                            } catch {}
                                            cx.notify();
                                        })
                                        .child('♪'),
                                ),
                        ),
                ),
            )
            .when(list.length === 0 && !collapsed, (el) =>
                el.child(
                    div()
                        .px(12)
                        .text_size(12)
                        .text_color(t.dim)
                        .child(
                            'No agent status yet. Agents show up here when they report their status. Older versions and agents inside tmux may not.',
                        ),
                ),
            )
            .child(
                v_flex()
                    .id('ag-list')
                    .flex_1()
                    .min_h(0)
                    .px(collapsed ? 0 : 8)
                    .overflow_y_scrollbar()
                    .mode('always')
                    // A drag ends on any release, and when the pointer leaves the list (a release out there never arrives).
                    .on_mouse_up('left', (_e, cx) => this.endDrag(cx))
                    .on_hover((on, cx) => {
                        if (!on) this.endDrag(cx);
                    })
                    .children(rows),
            )
            .child(
                h_flex()
                    .h(28)
                    .px(12)
                    .items_center()
                    .justify_end()
                    .when(collapsed, (el) => el.justify_center().px(0))
                    .child(
                        div()
                            .id('collapse')
                            .text_size(13)
                            .text_color(t.dim)
                            .hover((s) => s.text_color(t.foreground))
                            .on_click(toggleSidebar)
                            .child(collapsed ? '»' : ''),
                    ),
            );
    }
}
