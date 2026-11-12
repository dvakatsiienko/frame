// the one settings window (FRM-566): a page per mod in the nav, each row a title, a one-line why and one control,
// drawn from settings-model.js; colours come only from theme(), so it follows herdr's theme picker
import { h_flex, v_flex } from 'gpui-base';
import { div } from 'gpui-kit';
import { closeOverlay } from 'herdr';

import { pages } from './settings-model.js';

export const SETTINGS_WINDOW = { height: 500, width: 760 };

/** @typedef {import('./settings-model.js').Row} Row */
/** @typedef {import('./settings-model.js').Page} Page */
/**
 * @typedef {{ page: string, values: Record<string, unknown>, overlay: string | undefined,
 *   keys?: { ours: { key: string, title: string, action: string, takenBy: string | null }[], herdr: [string, string][] },
 *   notes?: Record<string, string>, onPage: (id: string) => void, onChange: (key: string, value: unknown) => void }} WindowState
 */

/** @param {any} t @param {WindowState} w */
export function settingsWindow(t, w) {
    const page = pages.find((p) => p.id === w.page) ?? pages[0];
    return h_flex()
        .size_full()
        .bg(t.background)
        .child(nav(t, w, page.id))
        .child(content(t, w, page));
}

/** @param {any} t @param {WindowState} w @param {string} at */
function nav(t, w, at) {
    return v_flex()
        .w(200)
        .flex_none()
        .h_full()
        .bg(t.chrome)
        .p(12)
        .gap(2)
        .child(
            div()
                .px(8)
                .pt(4)
                .pb(12)
                .text_size(15)
                .font_semibold()
                .text_color(t.foreground)
                .child('Settings'),
        )
        .children(
            pages.map((p) => {
                const isOn = p.id === at;
                const count = p.groups.reduce((n, g) => n + g.rows.length, 0);
                return h_flex()
                    .id(`settings-nav-${p.id}`)
                    .items_center()
                    .gap(8)
                    .px(8)
                    .py(6)
                    .rounded(6)
                    .cursor_pointer()
                    .when(isOn, (s) => s.bg(t.selected))
                    .hover((s) => s.bg(isOn ? t.selected : t.hover))
                    .on_click(() => w.onPage(p.id))
                    .child(div().w(18).flex_none().child(p.icon))
                    .child(
                        div()
                            .flex_1()
                            .text_size(13)
                            .text_color(isOn ? t.foreground : t.muted)
                            .child(p.title),
                    )
                    .child(
                        div()
                            .text_size(11)
                            .text_color(t.dim)
                            .child(count ? String(count) : ''),
                    );
            }),
        )
        .child(div().flex_1())
        .child(
            div()
                .px(8)
                .text_size(11)
                .text_color(t.dim)
                .child('colours follow herdr’s theme picker'),
        );
}

/** @param {any} t @param {WindowState} w @param {Page} page */
function content(t, w, page) {
    const head = h_flex()
        .items_center()
        .child(
            v_flex()
                .flex_1()
                .gap(2)
                .child(
                    div()
                        .text_size(16)
                        .font_semibold()
                        .text_color(t.foreground)
                        .child(`${page.icon}  ${page.title}`),
                )
                .child(
                    div().text_size(12).text_color(t.muted).child(page.about),
                ),
        )
        .when(Boolean(w.overlay), (s) =>
            s.child(
                div()
                    .id('settings-close')
                    .size(26)
                    .flex()
                    .items_center()
                    .justify_center()
                    .rounded(6)
                    .text_color(t.dim)
                    .cursor_pointer()
                    .hover((x) => x.bg(t.hover).text_color(t.foreground))
                    .tooltip('Close · Esc')
                    .on_click(() => closeOverlay(w.overlay))
                    .child('✕'),
            ),
        );
    const body =
        page.id === 'keys' && w.keys
            ? keysPage(t, w.keys)
            : page.groups.length
              ? page.groups.map((g) =>
                    v_flex()
                        .gap(6)
                        .child(
                            div()
                                .text_size(11)
                                .text_color(t.dim)
                                .child(g.heading),
                        )
                        .child(
                            v_flex()
                                .rounded(8)
                                .border_1()
                                .border_color(t.border)
                                .bg(t.surface)
                                .children(
                                    g.rows.map((r, i) => row(t, w, r, i)),
                                ),
                        ),
                )
              : [
                    v_flex()
                        .flex_1()
                        .items_center()
                        .justify_center()
                        .gap(4)
                        .py(60)
                        .child(
                            div()
                                .text_size(13)
                                .text_color(t.muted)
                                .child('No knobs yet'),
                        )
                        .child(
                            div()
                                .text_size(12)
                                .text_color(t.dim)
                                .child(
                                    'a row joins here the day this mod has a choice to make',
                                ),
                        ),
                ];
    return v_flex()
        .id('settings-content')
        .flex_1()
        .min_w(0)
        .h_full()
        .overflow_y_scroll()
        .p(20)
        .gap(18)
        .child(head)
        .children(body);
}

/** @param {any} t @param {WindowState} w @param {Row} r @param {number} i */
function row(t, w, r, i) {
    const title = h_flex()
        .gap(8)
        .items_center()
        .child(div().text_size(13).text_color(t.foreground).child(r.title));
    const label = v_flex()
        .flex_1()
        .min_w(0)
        .gap(2)
        .child(title)
        .child(
            // a row whose effect herdr refused shows why, in place of its why
            w.notes?.[r.key]
                ? div()
                      .text_size(12)
                      .text_color(t.blocked)
                      .child(w.notes[r.key])
                : div().text_size(12).text_color(t.muted).child(r.why),
        );
    // a list of options reads top to bottom under its title; a single control sits at the right
    const isList = r.control.kind === 'checks';
    return (isList ? v_flex().gap(10) : h_flex().items_center().gap(16))
        .px(14)
        .py(10)
        .when(i > 0, (s) => s.border_t_1().border_color(t.border))
        .child(label)
        .child(control(t, w, r));
}

/** @param {any} t @param {WindowState} w @param {Row} r */
function control(t, w, r) {
    const value = w.values[r.key] ?? r.default;
    const c = r.control;
    if (c.kind === 'toggle') {
        const isOn = value === true;
        return div()
            .id(`settings-${r.key}`)
            .w(34)
            .h(20)
            .flex_none()
            .rounded(10)
            .p(2)
            .flex()
            .items_center()
            .when(isOn, (s) => s.justify_end())
            .bg(isOn ? t.accent : t.border)
            .cursor_pointer()
            .tooltip(isOn ? 'On · press to turn off' : 'Off · press to turn on')
            .on_click(() => w.onChange(r.key, !isOn))
            .child(
                div()
                    .size(16)
                    .rounded(8)
                    .bg(isOn ? t.accent_foreground : t.background),
            );
    }
    if (c.kind === 'checks') {
        const picked = /** @type {string[]} */ (value);
        return v_flex()
            .gap(8)
            .children(
                c.options.map((o) => {
                    const isOn = !o.isLocked && picked.includes(o.value);
                    return h_flex()
                        .id(`settings-${r.key}-${o.value}`)
                        .items_center()
                        .gap(8)
                        .when(!o.isLocked, (s) => s.cursor_pointer())
                        .tooltip(
                            o.isLocked
                                ? 'locked: this one never changes'
                                : isOn
                                  ? 'press to leave out'
                                  : 'press to include',
                        )
                        .on_click(() => {
                            if (o.isLocked) return;
                            w.onChange(
                                r.key,
                                isOn
                                    ? picked.filter((v) => v !== o.value)
                                    : [...picked, o.value],
                            );
                        })
                        .child(
                            div()
                                .size(16)
                                .flex_none()
                                .flex()
                                .items_center()
                                .justify_center()
                                .rounded(4)
                                .border_1()
                                .border_color(isOn ? t.accent : t.input)
                                .bg(isOn ? t.accent : t.background)
                                .opacity(o.isLocked ? 0.5 : 1)
                                .text_size(11)
                                .text_color(t.accent_foreground)
                                .child(isOn ? '✓' : ''),
                        )
                        .child(
                            div()
                                .text_size(12)
                                .text_color(o.isLocked ? t.dim : t.foreground)
                                .child(o.label),
                        );
                }),
            );
    }
    const n = /** @type {number} */ (value);
    /** @param {number} d @param {string} id @param {string} label */
    const step = (d, id, label) => {
        const next = n + d * c.step;
        const isOff = next < c.min || next > c.max;
        return div()
            .id(id)
            .w(26)
            .h(24)
            .flex()
            .items_center()
            .justify_center()
            .text_color(isOff ? t.dim : t.muted)
            .when(!isOff, (s) =>
                s
                    .cursor_pointer()
                    .hover((x) => x.bg(t.hover).text_color(t.foreground)),
            )
            .on_click(() => {
                if (!isOff) w.onChange(r.key, next);
            })
            .child(label);
    };
    return h_flex()
        .flex_none()
        .items_center()
        .rounded(6)
        .border_1()
        .border_color(t.border)
        .overflow_hidden()
        .tooltip(`${c.min}–${c.max}${c.unit}, default ${r.default}${c.unit}`)
        .child(step(-1, `settings-${r.key}-down`, '−'))
        .child(
            div()
                .w(44)
                .flex()
                .justify_center()
                .text_size(13)
                .text_color(t.foreground)
                .child(`${n}${c.unit}`),
        )
        .child(step(1, `settings-${r.key}-up`, '+'));
}

// a key as macOS prints it: cmd-shift-k → ⌘⇧K
/** @param {string} key */
const keyLabel = (key) =>
    key
        .split('-')
        .map(
            (p) =>
                ({ alt: '⌥', cmd: '⌘', ctrl: '⌃', shift: '⇧' })[p] ??
                (p.length === 1 ? p.toUpperCase() : p),
        )
        .join('');

/** @param {any} t @param {string} key */
const keyCap = (t, key) =>
    div()
        .flex_none()
        .min_w(44)
        .px(6)
        .h(22)
        .flex()
        .items_center()
        .justify_center()
        .rounded(5)
        .border_1()
        .border_color(t.border)
        .bg(t.background)
        .text_size(12)
        .text_color(t.foreground)
        .child(keyLabel(key));

/** @param {any} t @param {NonNullable<WindowState['keys']>} keys */
function keysPage(t, keys) {
    /** @param {string} heading @param {any[]} rows */
    const group = (heading, rows) =>
        v_flex()
            .gap(6)
            .child(div().text_size(11).text_color(t.dim).child(heading))
            .child(
                v_flex()
                    .rounded(8)
                    .border_1()
                    .border_color(t.border)
                    .bg(t.surface)
                    .children(rows),
            );
    /** @param {number} i */
    const line = (i) =>
        h_flex()
            .px(14)
            .py(8)
            .gap(12)
            .items_center()
            .when(i > 0, (s) => s.border_t_1().border_color(t.border));
    return [
        group(
            'ours',
            keys.ours.map((k, i) =>
                line(i)
                    .child(keyCap(t, k.key))
                    .child(
                        v_flex()
                            .flex_1()
                            .min_w(0)
                            .child(
                                div()
                                    .text_size(13)
                                    .text_color(t.foreground)
                                    .child(k.title),
                            )
                            .when(Boolean(k.takenBy), (s) =>
                                s.child(
                                    div()
                                        .text_size(12)
                                        .text_color(t.blocked)
                                        .child(
                                            `refused: herdr’s «${k.takenBy}» holds this key`,
                                        ),
                                ),
                            ),
                    ),
            ),
        ),
        group(
            'herdr’s own',
            keys.herdr.map(([key, action], i) =>
                line(i)
                    .child(keyCap(t, key))
                    .child(
                        div()
                            .flex_1()
                            .text_size(12)
                            .text_color(t.muted)
                            .child(action),
                    ),
            ),
        ),
    ];
}
