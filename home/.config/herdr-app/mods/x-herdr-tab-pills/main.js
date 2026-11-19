// x-herdr-tab-pills: the top bar's tabs as pills, a clone of herdr's `terminals-bar` (0.1.16). a pill shows its tab's
// program tile with a status dot, the thread's own name (as the agents list publishes it) or the tab's, and its folder;
// the space chip opens herdr's picker. changed from the original: every colour comes from theme() (the layout's
// `colors` block sets `chrome`, `selected` and `input` for the tray, the shown pill and its edge), a × that asks before
// it ends something, no window buttons, no palette button, no + (it lives in x-herdr-chat-header).

import { h_flex } from 'gpui-base';
import { View, div, image, svg } from 'gpui-kit';
import {
    hc,
    home,
    openOverlay,
    panes,
    readTextFile,
    run,
    shared,
    spaces,
    theme,
    watchFolder,
    window as win,
} from 'herdr';

import { createListDrag } from './drag-view.js';
import { closeAsks, closeWords, leadPane, pillName, swallow } from './pills.js';
import { tabDrops } from './tab-drops.js';
import { SETTINGS_DIR, SETTINGS_FILE, tabStatusIn } from './tab-status.js';

// the agents list reads each session name and publishes it here (address → name); one reader, one naming rule
const NAMES_KEY = 'x-herdr-agents.names';

/** @typedef {import('gpui-kit').Color} Color */
/** @typedef {Record<string, Color>} Theme */
/** @typedef {import('herdr').PaneInfo} PaneInfo */

/** @param {string | null | undefined} cwd */
function folder(cwd) {
    if (!cwd) return '';
    const h = home();
    return cwd === h
        ? '~'
        : cwd.startsWith(`${h}/`)
          ? `~${cwd.slice(h.length)}`
          : cwd;
}

// The program's tile from the app's table: its color, its glyph (or logo) on it; the dot says working, blocked or done.
/** @param {Theme} t @param {PaneInfo | undefined} p */
function tile(t, p) {
    const g = p?.program;
    const dot = p?.status && p.status !== 'idle' ? t[p.status] : null;
    return div()
        .relative()
        .flex_none()
        .w(26)
        .h(26)
        .rounded(7)
        .border_1()
        .border_color(t.border)
        .bg(/** @type {Color | null} */ (g?.tile) ?? t.raised)
        .flex()
        .items_center()
        .justify_center()
        .when(Boolean(g?.icon), (el) =>
            el.child(
                g.tint
                    ? svg(g.icon)
                          .size(15)
                          .text_color(
                              /** @type {Color | null} */ (g.color) ??
                                  t.foreground,
                          )
                    : image(g.icon).w(15).h(15),
            ),
        )
        .when(Boolean(dot), (el) =>
            el.child(
                div()
                    .absolute()
                    .top(-4)
                    .right(-4)
                    .w(11)
                    .h(11)
                    .rounded_full()
                    .border_2()
                    .border_color(t.chrome)
                    .bg(dot),
            ),
        );
}

// A control in the draggable bar: the press is its own, never the window's (a drag on a pill must not move the
// window, and a right press there would open the system's window menu).
/** @param {ReturnType<typeof div>} el */
function own(el) {
    return el.on_mouse_down('left', swallow).on_mouse_down('right', swallow);
}

export default class TabPills extends View {
    /** @param {unknown} _props @param {import('gpui-kit').Context} cx */
    init(_props, cx) {
        // a press lifts a pill, a drag reorders the tabs, a click selects (FRM-664)
        this.tabKeys = cx.focus_handle();
        // his «general › tab status» from the settings window's file, read again on each change to it (FRM-664:W6)
        /** @type {import('./tab-status.js').TabStatus} */
        this.tabStatus = 'visible';
        cx.spawn(async (cx) => {
            for (;;) {
                const text = await readTextFile(
                    `${home()}/${SETTINGS_FILE}`,
                ).catch(() => /** @type {string | null} */ (null));
                const status = tabStatusIn(text);
                if (status !== this.tabStatus) {
                    this.tabStatus = status;
                    cx.notify();
                }
                // a folder not made yet is asked again later, so its first write is still read
                await watchFolder(`${home()}/${SETTINGS_DIR}`).catch(
                    () =>
                        new Promise((done) =>
                            cx.timer.after(5000, () => done(null)),
                        ),
                );
            }
        });
        this.drag = createListDrag({
            axis: 'x',
            focus: () => this.tabKeys,
            gap: 3,
            ...tabDrops,
        });
        /** @type {string | null} the pill under the pointer: its × shows */
        this.hovered = null;
    }

    // The ×: a tab that would end an agent or a running program asks first (herdr's `confirm`); an idle shell's tab
    // closes at once. A read that fails asks: the safe side.
    /** @param {{ id: string }} tab @param {string} name @param {string} spaceName @param {import('gpui-kit').Context} cx */
    closeTab(tab, name, spaceName, cx) {
        const mine = panes().filter((p) => p.tab === tab.id);
        const agentCount = mine.filter((p) => p.program?.agent).length;
        this.hovered = null;
        cx.spawn(async () => {
            let isAsking = false;
            for (const p of mine) {
                if (isAsking) break;
                const got =
                    p.terminal && !p.program?.agent
                        ? await hc(['get', p.terminal, '--json']).catch(
                              () => /** @type {null} */ (null),
                          )
                        : null;
                isAsking = closeAsks(p.program, p.terminal, got);
            }
            if (!isAsking) {
                run('tab.close', { id: tab.id });
                return;
            }
            openOverlay({
                height: 180,
                kind: 'dialog',
                mod: 'confirm',
                props: {
                    command: { args: { id: tab.id }, name: 'tab.close' },
                    ...closeWords(name, spaceName, agentCount),
                },
                width: 440,
            });
        });
    }

    render() {
        // herdr's theme colours are hex strings; gpui-kit's style setters want its Color
        const t = /** @type {Theme} */ (theme());
        // hidden leaves more room for the names
        const isStatusShown = this.tabStatus === 'visible';
        const dragTheme = /** @type {import('./drag-view.js').DragTheme} */ (t);
        const space = spaces().find((p) => p.active);
        if (!space) return div();
        const all = panes();
        const w = win();
        const names = /** @type {Record<string, string> | null} */ (
            shared(NAMES_KEY)
        );

        /** @param {(typeof space.tabs)[number]} c @param {number} i */
        const pill = (c, i) => {
            const p = leadPane(all, c.id);
            const where = folder(p?.cwd);
            const others = all
                .filter((x) => x.tab === c.id && x !== p)
                .map((x) => x.terminal);
            const name = pillName(c, [p?.terminal, ...others], names);
            const isCloseShown = c.active || this.hovered === c.id;
            const words = () =>
                h_flex()
                    .flex_1()
                    .min_w(0)
                    .gap(6)
                    .truncate()
                    .child(
                        div()
                            .flex_shrink(1)
                            .min_w(0)
                            .truncate()
                            .text_color(c.active ? t.foreground : t.muted)
                            .child(name.label),
                    )
                    .when(Boolean(where) && !name.isThread, (el) =>
                        el.child(
                            div().truncate().text_color(t.dim).child(where),
                        ),
                    );
            return this.drag
                .item(
                    own(h_flex()),
                    {
                        from: i,
                        item: { id: c.id },
                        key: `pill-${c.id}`,
                        label: name.label,
                        look: () =>
                            h_flex()
                                .size_full()
                                .min_w(0)
                                .pl(5)
                                .pr(6)
                                .gap(9)
                                .items_center()
                                .text_size(13)
                                .when(isStatusShown, (el) =>
                                    el.child(tile(t, p)),
                                )
                                .child(words()),
                        places: space.tabs.length,
                        targetFor: () => i,
                    },
                    dragTheme,
                )
                .id(`pill-${c.id}`)
                .flex_shrink(1)
                .w(260)
                .min_w(0)
                .h_full()
                .pl(5)
                .pr(6)
                .gap(9)
                .items_center()
                .rounded(13)
                .border_1()
                .cursor_pointer()
                .text_size(13)
                .when(this.drag.isIdle(), (el) => el.tooltip(name.full))
                .when(c.active, (el) => el.bg(t.selected).border_color(t.input))
                .when(!c.active, (el) =>
                    el.border_color(t.chrome).hover((s) => s.bg(t.hover)),
                )
                .on_hover((isHovered, cx) => {
                    if (isHovered) this.hovered = c.id;
                    else if (this.hovered === c.id) this.hovered = null;
                    cx.notify();
                })
                .on_mouse_down('right', () =>
                    openOverlay({
                        kind: 'popup',
                        mod: 'menu',
                        props: {
                            tab: 'tab',
                            target: { id: c.id, space: space.id },
                        },
                        width: 200,
                    }),
                )
                .when(isStatusShown, (el) => el.child(tile(t, p)))
                .child(words())
                .child(
                    div()
                        .id(`pill-close-${c.id}`)
                        .size(20)
                        .flex()
                        .flex_none()
                        .items_center()
                        .justify_center()
                        .rounded(6)
                        .text_color(t.dim)
                        .cursor_pointer()
                        .opacity(isCloseShown ? 1 : 0)
                        .hover((s) => s.bg(t.hover).text_color(t.foreground))
                        .when(this.drag.isIdle(), (el) =>
                            el.tooltip('Close tab'),
                        )
                        // a hidden × takes no click: a press there selects the pill
                        // a shown × owns its press, so it never lifts the pill and leaves no drag armed
                        .when(isCloseShown, (el) =>
                            el
                                .on_mouse_down('left', swallow)
                                .on_click((_e, cx) => {
                                    cx.stop_propagation();
                                    this.closeTab(
                                        c,
                                        name.label,
                                        space.name,
                                        cx,
                                    );
                                }),
                        )
                        .child(
                            svg('mods/x-herdr-tab-pills/close.svg').size(12),
                        ),
                );
        };

        return (
            h_flex()
                .size_full()
                .gap(8)
                .items_center()
                // a wheel or a swipe over the bar is swallowed here: it never switches a tab
                .on_scroll_wheel(swallow)
                // macOS: the window buttons sit here (the layout's traffic_lights)
                .when(
                    w?.platform === 'macos' &&
                        w.titlebar === 'none' &&
                        !w.fullscreen,
                    (el) => el.pl(72),
                )
                .child(
                    own(h_flex())
                        .id('pills-space')
                        .flex_none()
                        .h(30)
                        .pl(10)
                        .pr(12)
                        .gap(8)
                        .items_center()
                        .rounded_full()
                        .bg(t.raised)
                        .cursor_pointer()
                        .text_size(13)
                        .text_color(t.dim)
                        .hover((s) => s.text_color(t.foreground))
                        .tooltip('Go to a tab in any space')
                        // herdr's own picker, as cmd-p opens it
                        .on_click(() => run('mod.open', { name: 'picker' }))
                        .child(svg('mods/x-herdr-tab-pills/stack.svg').size(15))
                        .child(
                            div()
                                .max_w(160)
                                .truncate()
                                .text_color(t.foreground)
                                .child(space.name),
                        ),
                )
                .child(
                    // the drag's zone: leaving the tray springs a dragged pill home
                    this.drag
                        .zone(
                            h_flex()
                                .id('pills-tray')
                                .relative()
                                .flex_shrink(1)
                                .min_w(0)
                                .h(36)
                                .p(3)
                                .gap(3)
                                .rounded(16)
                                .bg(t.chrome),
                        )
                        .children(space.tabs.map(pill))
                        .children([this.drag.ghost(dragTheme)].filter(Boolean)),
                )
                .child(div().flex_1())
        );
    }
}
