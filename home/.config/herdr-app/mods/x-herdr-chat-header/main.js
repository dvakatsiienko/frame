// x-herdr-chat-header: a thread's top row, one mod for both views. above the chat (layout props { view: 'chat', stack,
// other }) it shows the thread the chat shows; as a Terminal pane's header (herdr's props { pane, terminal }, the
// layout's { view: 'terminal', stack, other }) it shows that pane. `tabButtons: true` draws + Files Changes, for a
// layout with no tab bar of its own. its rules live in header-model.js, drawn here
import { h_flex } from 'gpui-base';
import { View, div, image, svg } from 'gpui-kit';
import {
    home,
    layout,
    openOverlay,
    panes,
    props,
    run,
    setShared,
    shared,
    theme,
} from 'herdr';

import { CHAT_ASK, CHAT_SHOWN, chatShownOf } from './chat-asks.js';
import {
    hasNode,
    headerOf,
    panelsEnabled,
    pressOf,
    shownPanelIn,
} from './header-model.js';

/** @typedef {import('gpui-kit').Color} Color */
/** @typedef {Record<'background' | 'blocked' | 'border' | 'dim' | 'done' | 'foreground' | 'hover' | 'selected' | 'surface', Color>} Theme */
/** @typedef {import('./header-model.js').PaneLike & { tab: string, program: import('herdr').Program }} Pane */
/** @typedef {import('./header-model.js').Control} Control */
/** @typedef {import('./header-model.js').PressKind} PressKind */

export default class ChatHeader extends View {
    init() {
        this.isHovered = false;
    }

    /** the pane this row is about: its own in the Terminal view, the chat's thread above the chat @returns {Pane | null} */
    thread() {
        const p = props() ?? {};
        const all = /** @type {Pane[]} */ (panes());
        if (p.view === 'chat') {
            const { address } = chatShownOf(shared(CHAT_SHOWN));
            return all.find((x) => address && x.terminal === address) ?? null;
        }
        return all.find((x) => x.pane === p.pane) ?? null;
    }

    /** @param {PressKind} kind @param {Pane} pane @param {boolean} isFindOpen */
    press(kind, pane, isFindOpen) {
        const { stack, other } = props() ?? {};
        const effects = pressOf(kind, {
            isFindOpen,
            other,
            pane,
            shownPanel: shownPanelIn(layout()),
            stack,
        });
        for (const e of effects) {
            if ('run' in e) run(...e.run);
            else if ('overlay' in e) openOverlay(e.overlay);
            else setShared(CHAT_ASK[e.ask], Date.now());
        }
    }

    render() {
        const t = /** @type {Theme} */ (theme());
        const { view = 'terminal', stack, tabButtons } = props() ?? {};
        const row = h_flex()
            .id('chat-header')
            .size_full()
            .px(10)
            .gap(8)
            .items_center()
            .bg(t.background)
            .border_b(1)
            .border_color(t.border)
            .text_size(12);
        const pane = this.thread();
        // no thread yet: the bare row keeps its height, so nothing under it moves when one comes
        if (!pane) return row;
        const tree = layout();
        const { isFindOpen } = chatShownOf(shared(CHAT_SHOWN));
        const head = headerOf({
            hasTabButtons: tabButtons === true,
            hasViews: hasNode(tree, stack),
            home: home(),
            isFindOpen,
            isFirstOfTab:
                panes().find((x) => x.tab === pane.tab)?.pane === pane.pane,
            pane,
            panels: panelsEnabled(shared('workspace.panels')),
            shownPanel: shownPanelIn(tree),
            view,
        });
        const shown = head.controls.filter(
            (c) => !c.isHoverOnly || this.isHovered,
        );
        /** @param {PressKind} kind */
        const onPress =
            (kind) => (/** @type {any} */ _e, /** @type {any} */ cx) => {
                cx.stop_propagation();
                this.press(kind, pane, isFindOpen);
            };
        return row
            .on_hover((isHovered, cx) => {
                this.isHovered = isHovered;
                cx.notify();
            })
            .when(view === 'terminal', (el) =>
                el.on_click(() => run('pane.focus', { pane: pane.pane })),
            )
            .when(Boolean(pane.program.icon), (el) =>
                el.child(programIcon(t, pane.program)),
            )
            .child(
                div()
                    .flex_none()
                    .max_w(320)
                    .truncate()
                    .font_medium()
                    .text_color(t.foreground)
                    .child(head.name),
            )
            .child(
                div()
                    .flex_1()
                    .min_w(0)
                    .truncate()
                    .text_color(t.dim)
                    .child(head.place),
            )
            .when(head.status !== null, (el) =>
                el.child(statusMark(t, head.status)),
            )
            .children(
                shown.map((c) =>
                    controlButton(t, c, pane.pane, onPress(c.kind)),
                ),
            )
            .when(head.hasSwitch, (el) =>
                el.child(
                    viewSwitch(
                        t,
                        view === 'chat' ? 'chat' : 'terminal',
                        pane.pane,
                        onPress('switch'),
                    ),
                ),
            );
    }
}

/** @param {Theme} t @param {import('herdr').Program} program */
function programIcon(t, program) {
    const path = program.icon ?? '';
    return program.tint
        ? svg(path).size(14).flex_none().text_color(t.dim)
        : image(path).w(14).h(14).flex_none();
}

/** blocked asks for him, done is a dot until he looks @param {Theme} t @param {'blocked' | 'done' | null} status */
function statusMark(t, status) {
    if (status === 'blocked')
        return div()
            .flex_none()
            .px(6)
            .h(18)
            .flex()
            .items_center()
            .rounded(5)
            .bg(/** @type {Color} */ (`${t.blocked}26`))
            .text_size(11)
            .font_semibold()
            .text_color(t.blocked)
            .child('Needs you');
    return div().size(7).flex_none().rounded(4).bg(t.done);
}

/**
 * an icon button, or an icon with its word for a side panel; on shows as selected
 * @param {Theme} t @param {Control} c @param {string} paneId @param {(e: any, cx: any) => void} onClick
 */
function controlButton(t, c, paneId, onClick) {
    return (
        h_flex()
            .id(`head-${c.kind}-${paneId}`)
            .h(24)
            .when(c.hasText, (el) => el.px(7).gap(5))
            .when(!c.hasText, (el) => el.w(24).justify_center())
            .flex_none()
            .items_center()
            .rounded(6)
            .cursor_pointer()
            .text_color(c.isOn ? t.foreground : t.dim)
            .when(c.isOn, (el) => el.bg(t.selected))
            .hover((s) =>
                s.bg(c.isOn ? t.selected : t.hover).text_color(t.foreground),
            )
            .when(!c.hasText, (el) => el.tooltip(c.label))
            // search acts on the press, while the chat's find, closing on that same press outside it, still reads open:
            // a click would land after the close and open it again
            .when(c.kind === 'search', (el) =>
                el.on_mouse_down('left', onClick),
            )
            .when(c.kind !== 'search', (el) => el.on_click(onClick))
            .child(svg(c.icon).size(14))
            .when(c.hasText, (el) => el.child(c.label))
    );
}

/**
 * the Chat | Terminal switch: the view shown reads selected, the other one is the press
 * @param {Theme} t @param {'chat' | 'terminal'} here @param {string} paneId @param {(e: any, cx: any) => void} onFlip
 */
function viewSwitch(t, here, paneId, onFlip) {
    /** @param {'chat' | 'terminal'} id @param {string} label */
    const seg = (id, label) =>
        div()
            .id(`head-view-${id}-${paneId}`)
            .px(8)
            .h(20)
            .flex()
            .items_center()
            .rounded(5)
            .text_size(12)
            .font_medium()
            .when(id === here, (el) =>
                el.bg(t.selected).text_color(t.foreground),
            )
            .when(id !== here, (el) =>
                el
                    .text_color(t.dim)
                    .cursor_pointer()
                    .hover((s) => s.text_color(t.foreground))
                    .on_click(onFlip),
            )
            .child(label);
    return h_flex()
        .flex_none()
        .p(2)
        .gap(2)
        .rounded(7)
        .bg(t.surface)
        .border(1)
        .border_color(t.border)
        .child(seg('chat', 'Chat'))
        .child(seg('terminal', 'Terminal'));
}
