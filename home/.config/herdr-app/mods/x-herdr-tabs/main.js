// x-herdr-tabs: herdr's `tabs` (0.1.9, by way of zoo's my-tabs), each agent tab named by its Claude Code session name,
// emoji and all, as the agents list and the deck name it. kept from my-tabs: + opens herdr's `new-menu`, props
// { buttons: false } leaves out the window buttons, a right-click on an agent tab opens the zoo's agent menu, and the ×
// on an agent tab asks first.

import { h_flex } from 'gpui-base';
import { View, div, image, svg } from 'gpui-kit';
import {
    agents,
    focused,
    knownAgents,
    layout,
    openOverlay,
    panes,
    props,
    run,
    setShared,
    settings,
    shared,
    spaces,
    terminals,
    theme,
    window,
} from 'herdr';

// the agents list reads each session name and publishes it here (address → name); one reader, one naming rule
const NAMES_KEY = 'x-herdr-agents.names';

// A tab Herdr named after its program ("Claude Code", or an automatic "tbN") shows the agent's
// own title instead, as the agents list does (`title` in zoo-agents): unless that title is
// only a path, a user@host, or the program's name again. A tab someone renamed keeps its name.
// "Named after its program" = the pane's program name, or any + menu entry's (`LAUNCHERS`): a
// "Claude (dev container)" tab runs a pane whose program reports "Claude Code" (seen 2026-11-05).
const clean = (s) => (s ?? '').replace(/^[^\p{L}\p{N}]+/u, '').trim();
const LAUNCHERS = new Set();
function loadLaunchers(cx) {
    cx.spawn(async () => {
        for (const k of await knownAgents()) LAUNCHERS.add(k.name);
    });
}
function tabName(c, lead) {
    const prog = lead?.program?.name;
    const live = clean(lead?.title);
    const telling =
        live &&
        live !== prog &&
        !/^[~/]|^[A-Za-z]:\\/.test(live) &&
        !live.includes('@') &&
        live.toLowerCase() !== lead?.program?.key;
    const auto = /^tb\d+$/.test(c.name);
    if ((auto || c.name === prog || LAUNCHERS.has(c.name)) && telling)
        return live;
    return auto ? (prog ?? 'Terminal') : c.name;
}

// Unread vs done: shared "zoo.turns" = { address: "run" | "seen" }; Herdr's done = unread until
// the agent is shown with the window active (the Chat view hides the terminal, so Herdr never
// sees you read it), idle after a turn = done. Copied from zoo-agents (the why is there): keep them in step.
const machineOf = (addr) => (addr.includes('/') ? addr.split('/')[0] : '');
function trackTurns(list, all) {
    const was = shared('zoo.turns') ?? {};
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
    const heard = new Set(all.map((k) => machineOf(k.address)));
    const live = new Set(
        all.filter((k) => k.state === 'live').map((k) => k.address),
    );
    for (const k of Object.keys(next ?? was))
        if (heard.has(machineOf(k)) && !live.has(k)) {
            next ??= { ...was };
            delete next[k];
        }
    if (next) setShared('zoo.turns', next);
}
function shownStatus(a) {
    const v = shared('zoo.turns')?.[a.address];
    if (a.status === 'done') return v === 'seen' ? 'done' : 'unread';
    if (a.status === 'idle') return v ? 'done' : 'idle';
    return a.status;
}
const RANK = { blocked: 5, done: 2, idle: 1, unread: 4, working: 3 };

function find(node, id) {
    if (node?.id === id) return node;
    for (const child of node?.children ?? []) {
        const found = find(child, id);
        if (found) return found;
    }
    return null;
}

export default class Tabs extends View {
    init(_props, cx) {
        this.pressed = null;
        loadLaunchers(cx);
        this.panels = JSON.parse(localStorage.getItem('panels') ?? '{}');
    }

    // The side panel is remembered per space: switching shows that space's choice
    // (closed if it never had one), and opening or closing it records it.
    syncPanel(space, panel, body, enabled) {
        if (!space || !panel) return;
        const now = panel.hidden ? null : (body?.active ?? null);
        if (space.id !== this.space) {
            const first = this.space === undefined;
            this.space = space.id;
            this.pending = null;
            if (!(first && !(space.id in this.panels))) {
                const stored = this.panels[space.id] ?? null,
                    want = enabled.includes(stored) ? stored : null;
                if (want !== now) {
                    this.pending = { until: Date.now() + 1000, want };
                    if (want) {
                        run('layout.select', {
                            child: want,
                            stack: 'panel-body',
                        });
                        run('layout.show', { id: 'panel' });
                    } else run('layout.hide', { id: 'panel' });
                    return;
                }
            }
        }
        // Until the restore lands (or something else won), the old state isn't a choice.
        if (this.pending) {
            if (this.pending.want !== now && Date.now() < this.pending.until)
                return;
            this.pending = null;
        }
        if (this.panels[space.id] === now) return;
        this.panels[space.id] = now;
        localStorage.setItem('panels', JSON.stringify(this.panels));
    }

    // The × on a tab: one with an agent asks first (the shipped `confirm` dialog), since a closed
    // tab can't be reopened. Other tabs close at once, as in Herdr's own `tabs`.
    close(c, name, space) {
        const mine = agents().filter((a) => a.tab === c.id);
        if (!mine.length) return run('tab.close', { id: c.id });
        const state = mine.some((a) => a.status === 'working')
            ? 'is still working'
            : mine.some((a) => a.status === 'blocked')
              ? 'is waiting for you'
              : null;
        const who = mine.length > 1 ? `${mine.length} agents` : 'its agent';
        openOverlay({
            height: 180,
            kind: 'dialog',
            mod: 'confirm',
            props: {
                command: { args: { id: c.id }, name: 'tab.close' },
                detail: `${space.name} · ${name}${state ? ` ${state}` : ''}. Closing the tab ends ${who} and it can't be reopened here. A Claude conversation stays saved: claude --resume brings it back.`,
                title: `Close ${name}?`,
            },
            width: 440,
        });
    }

    render() {
        const t = theme();
        const space = spaces().find((p) => p.active);
        const shown = space?.tabs ?? [];
        const stop = (_e, cx) => cx.stop_propagation();
        trackTurns(agents(), terminals());
        const button = (id, label, action) =>
            div()
                .id(id)
                .size(26)
                .flex_none()
                .flex()
                .items_center()
                .justify_center()
                .rounded(6)
                .text_color(t.dim)
                .hover((s) => s.bg(t.hover).text_color(t.foreground))
                .on_mouse_down('left', stop)
                .on_click(action)
                .child(label);
        const item = (c, i) => {
            const lead =
                panes().find((p) => p.tab === c.id && p.program?.agent) ??
                panes().find((p) => p.tab === c.id);
            const program = lead?.program;
            const mine = agents().filter((a) => a.tab === c.id),
                agent = mine.find((a) => a.focused) ?? mine[0];
            const name =
                (agent && shared(NAMES_KEY)?.[agent.address]) ||
                tabName(c, lead);
            // The tab's status: its most urgent agent's shown one (terminal-only tabs: Herdr's).
            const st = mine.length
                ? mine
                      .map(shownStatus)
                      .reduce((m, s) =>
                          (RANK[s] ?? 0) > (RANK[m] ?? 0) ? s : m,
                      )
                : c.status === 'done'
                  ? 'unread'
                  : c.status;
            // Chrome-style: a tab is as wide as its content (up to 200, active 240) and the others
            // shrink together as tabs are added, down to its status; the active one keeps its name.
            return (
                h_flex()
                    .id(`tab-${c.id}`)
                    .h(29)
                    .px(8)
                    .gap(6)
                    .rounded(7)
                    .items_center()
                    .overflow_hidden()
                    .max_w(c.active ? 240 : 200)
                    .flex_shrink(c.active ? 0 : 1)
                    .min_w(c.active ? 0 : 60)
                    .text_size(12.8)
                    .tooltip(name)
                    .border(1)
                    .border_color(c.active ? t.border : t.chrome)
                    .bg(c.active ? t.raised : t.chrome)
                    .text_color(c.active ? t.foreground : t.muted)
                    .hover((s) => s.bg(t.hover))
                    .on_mouse_down('left', (e, cx) => {
                        cx.stop_propagation();
                        this.pressed = i;
                        if (e.click_count === 2)
                            run('tab.rename', { id: c.id });
                    })
                    .on_mouse_up('left', () => {
                        const from = this.pressed;
                        this.pressed = null;
                        if (from !== null && from !== i)
                            run('tab.move', {
                                id: shown[from].id,
                                index:
                                    space.tabs.findIndex((x) => x.id === c.id) +
                                    1,
                            });
                        else run('tab.select', { id: c.id });
                    })
                    .on_mouse_down('right', () => {
                        const mine = agents().filter((a) => a.tab === c.id);
                        const a = mine.find((a) => a.focused) ?? mine[0];
                        if (a)
                            openOverlay({
                                height: 205,
                                kind: 'popup',
                                mod: 'zoo',
                                props: {
                                    menu: a.address,
                                    title: `${space.name} · ${name}`,
                                },
                                width: 220,
                            });
                        else
                            openOverlay({
                                kind: 'popup',
                                mod: 'menu',
                                props: {
                                    tab: 'tab',
                                    target: { id: c.id, space: space.id },
                                },
                                width: 200,
                            });
                    })
                    .when(!agent && Boolean(program?.icon), (el) =>
                        el.child(
                            program.tint
                                ? svg(program.icon)
                                      .size(14)
                                      .flex_none()
                                      .text_color(t.muted)
                                : image(program.icon).size(14).flex_none(),
                        ),
                    )
                    .child(
                        div()
                            .flex_1()
                            .min_w(0)
                            .truncate()
                            .child(c.zoomed ? `${name} Z` : name),
                    )
                    .when(st === 'working', (el) =>
                        el.child(
                            svg('mods/workspace-chrome/spinner.svg')
                                .size(12)
                                .flex_none()
                                .text_color(t.working)
                                .spin(900),
                        ),
                    )
                    // Blocked and unread: a dot; finished and read: a gray tick.
                    .when(st === 'blocked' || st === 'unread', (el) =>
                        el.child(
                            div()
                                .size(6)
                                .flex_none()
                                .rounded(3)
                                .bg(st === 'unread' ? t.accent : t.blocked),
                        ),
                    )
                    .when(st === 'done', (el) =>
                        el.child(
                            svg('mods/workspace-chrome/check.svg')
                                .size(11)
                                .flex_none()
                                .text_color(t.done ?? t.dim),
                        ),
                    )
                    .when(c.active, (el) =>
                        el.child(
                            div()
                                .id(`close-${c.id}`)
                                .text_color(t.dim)
                                .on_mouse_down('left', stop)
                                .on_click((_e, cx) => {
                                    cx.stop_propagation();
                                    this.close(c, name, space);
                                })
                                .child(svg('mods/pane/close.svg').size(12)),
                        ),
                    )
            );
        };
        const root = layout(),
            sidebar = find(root, 'sidebar'),
            w = window();
        // Old saved rails and a dragged-narrow sidebar can be smaller than the window buttons.
        const lightsPadding =
            w?.platform === 'macos' &&
            w.titlebar === 'none' &&
            !w.fullscreen &&
            root?.traffic_lights
                ? Math.max(
                      10,
                      (root.traffic_lights[0] + 64) / settings().zoom -
                          (sidebar?.hidden ? 0 : (sidebar?.size?.px ?? 0)),
                  )
                : 10;
        const panel = find(root, 'panel'),
            body = find(root, 'panel-body');
        const enabled = shared('workspace.panels') ?? ['files', 'changes'];
        this.syncPanel(space, panel, body, enabled);
        const panelButton = (id, label, icon) => {
            const on = panel && !panel.hidden && body?.active === id;
            return h_flex()
                .id(`panel-${id}`)
                .h(26)
                .px(8)
                .gap(5)
                .flex_none()
                .items_center()
                .rounded(6)
                .text_size(12)
                .bg(on ? t.selected : t.chrome)
                .text_color(on ? t.foreground : t.muted)
                .hover((s) => s.bg(t.hover))
                .on_mouse_down('left', stop)
                .on_click(() => {
                    if (on) run('layout.hide', { id: 'panel' });
                    else {
                        run('layout.select', {
                            child: id,
                            stack: 'panel-body',
                        });
                        run('layout.show', { id: 'panel' });
                    }
                })
                .child(svg(icon).size(14))
                .child(label);
        };
        return h_flex()
            .size_full()
            .min_w(0)
            .px(10)
            .pl(lightsPadding)
            .gap(3)
            .items_center()
            .bg(t.chrome)
            .border_b(1)
            .border_color(t.border)
            .on_mouse_up('left', () => {
                this.pressed = null;
            })
            .on_scroll_wheel((e) => {
                if (Math.abs(e.delta.y) >= 1)
                    run(e.delta.y > 0 ? 'tab.prev' : 'tab.next');
            })
            .child(
                h_flex()
                    .id('tab-scroll')
                    .flex_1()
                    .min_w(0)
                    .h_full()
                    .items_center()
                    .gap(3)
                    .overflow_hidden()
                    .children(shown.map(item)),
            )
            .child(
                button('tab-new', '+', () =>
                    openOverlay({
                        height: 512,
                        kind: 'popup',
                        mod: 'new-menu',
                        width: 250,
                    }),
                ),
            )
            .when(enabled.includes('files'), (el) =>
                el.child(panelButton('files', 'Files', 'mods/files/file.svg')),
            )
            .when(enabled.includes('changes'), (el) =>
                el.child(
                    panelButton(
                        'changes',
                        'Changes',
                        'mods/changes/changes.svg',
                    ),
                ),
            )
            .when(window()?.buttons && props()?.buttons !== false, (el) =>
                el
                    .child(
                        button('minimize', '−', () => run('window.minimize')),
                    )
                    .child(
                        button('maximize', '□', () => run('window.maximize')),
                    )
                    .child(
                        button(
                            'close-window',
                            svg('mods/pane/close.svg').size(13),
                            () => run('window.close'),
                        ),
                    ),
            );
    }
}
