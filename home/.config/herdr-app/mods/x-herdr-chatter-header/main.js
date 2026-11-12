// x-herdr-chatter-header: a thread pane's top row in the Terminal view (x-herdr-chatter draws the same row in the Chat
// view, from the same chatter-header.js); a clone of herdr's `pane` 0.1.10.
// Shows the program's icon, the agent's name or the terminal's title, the folder and the agent's status; on hover,
// buttons split, zoom and close this pane. Props from the app: { pane, terminal }; from the layout { stack, other }
// (the Chat / Terminal stack), and then a Claude agent's row ends in the Chat | Terminal switch. Click: focus the pane.
import { h_flex } from 'gpui-base';
import { View, div, image, svg } from 'gpui-kit';
import { home, panes, props, run, theme } from 'herdr';

import { viewSwitch } from './chatter-header.js';

/** @param {any} p @param {number} size @param {any} color */
function icon(p, size, color) {
    if (!p?.icon) return null;
    return p.tint
        ? svg(p.icon).size(size).flex_none().text_color(color)
        : image(p.icon).w(size).h(size).flex_none();
}

/** @param {string | undefined} cwd */
function folder(cwd) {
    if (!cwd) return '';
    const h = home();
    return cwd === h
        ? '~'
        : cwd.startsWith(`${h}/`)
          ? `~${cwd.slice(h.length)}`
          : cwd;
}

export default class ChatterHeader extends View {
    init() {
        this.isHovered = false;
    }

    me() {
        return panes().find((p) => p.pane === props()?.pane);
    }

    /** @param {any} t @param {string} id @param {string} name @param {string} command @param {Record<string, unknown>} args */
    button(t, id, name, command, args) {
        return div()
            .id(id)
            .p(3)
            .rounded(4)
            .text_color(t.dim)
            .hover((s) => s.bg(t.hover).text_color(t.foreground))
            .on_click((_e, cx) => {
                cx.stop_propagation();
                run(command, args);
            })
            .child(svg(`mods/pane/${name}.svg`).size(14)); // herdr's shipped pane icons
    }

    render() {
        // herdr's theme colours are hex strings; gpui-kit's style setters want its Color
        const t = /** @type {Record<string, import('gpui-kit').Color>} */ (
            theme()
        );
        const p = this.me();
        if (!p) return div();
        const name =
            ((p.program?.agent || p.program?.shell) && p.program.name) ||
            p.title ||
            p.program?.name ||
            'shell';
        const pic = icon(p.program, 14, t.dim);
        const st = p.status;
        const pane = p.pane;
        return (
            h_flex()
                .id(`pane-head-${pane}`)
                .size_full()
                .px(10)
                .gap(8)
                .items_center()
                .bg(t.background)
                .border_b(1)
                .border_color(t.border)
                .text_size(12)
                .on_hover((isHovered, cx) => {
                    this.isHovered = isHovered;
                    cx.notify();
                })
                .on_click(() => run('pane.focus', { pane }))
                .when(Boolean(pic), (el) => el.child(pic))
                .child(
                    div()
                        .flex_none()
                        .truncate()
                        .max_w(260)
                        .font_medium()
                        .text_color(t.foreground)
                        .child(name),
                )
                .child(
                    div()
                        .flex_1()
                        .truncate()
                        .text_color(t.dim)
                        .child(folder(p.cwd)),
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
                .when(st === 'blocked', (el) =>
                    el.child(
                        div()
                            .flex_none()
                            .px(6)
                            .h(18)
                            .flex()
                            .items_center()
                            .rounded(5)
                            .bg(`${t.blocked}26`)
                            .text_size(10.5)
                            .font_semibold()
                            .text_color(t.blocked)
                            .child('Needs you'),
                    ),
                )
                .when(st === 'done', (el) =>
                    el.child(div().size(7).flex_none().rounded(4).bg(t.done)),
                )
                .when(this.isHovered, (el) =>
                    el
                        .child(
                            this.button(
                                t,
                                `ph-r-${pane}`,
                                'split-right',
                                'pane.split',
                                {
                                    direction: 'right',
                                    pane,
                                },
                            ),
                        )
                        .child(
                            this.button(
                                t,
                                `ph-d-${pane}`,
                                'split-down',
                                'pane.split',
                                {
                                    direction: 'down',
                                    pane,
                                },
                            ),
                        )
                        .child(
                            this.button(
                                t,
                                `ph-z-${pane}`,
                                p.zoomed ? 'unzoom' : 'zoom',
                                'pane.zoom',
                                { pane },
                            ),
                        )
                        .child(
                            this.button(
                                t,
                                `ph-x-${pane}`,
                                'close',
                                'pane.close',
                                {
                                    pane,
                                },
                            ),
                        ),
                )
                // the chat shows the tab's focused Claude: focus this one first
                .when(
                    Boolean(props()?.stack) && p.app === 'claude-code',
                    (el) =>
                        el.child(
                            viewSwitch(t, 'terminal', () => {
                                run('pane.focus', { pane });
                                run('layout.select', {
                                    child: props().other,
                                    stack: props().stack,
                                });
                            }),
                        ),
                )
        );
    }
}
