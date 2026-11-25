// plan usage: the saved file and its words, and its popup. the last read stays on the bar (main.js), which draws it too

import { mkdir, readFile } from 'fs/promises';
import { h_flex, v_flex } from 'gpui-base';
import { div } from 'gpui-kit';
import { appHome, openOverlay, watchFolder } from 'herdr';

/** @typedef {import('./status-types.js').Context} Context */
/** @typedef {import('./status-types.js').AsyncContext} AsyncContext */
/** @typedef {import('./status-types.js').Theme} Theme */
/** @typedef {import('./status-types.js').Anchor} Anchor */
/** @typedef {import('./status-types.js').UsageWindow} UsageWindow */
/** @typedef {import('./status-types.js').Usage} Usage */

// Plan usage (the 5-hour and weekly limits, as /usage shows them). Claude Code hands them to its
// status line command, and statusline.cjs (set up in ~/.claude/settings.json) saves them here,
// so they're as fresh as the last running Claude's status line.
const USAGE_DIR = () => `${appHome()}/data/x-herdr-status`;
const USAGE_POPUP_W = 320;

// { at, rate_limits: { five_hour: { used_percentage, resets_at (Unix s) }, seven_day: … } } | null
/** @returns {Promise<Usage | null>} */
async function readUsageFile() {
    try {
        return JSON.parse(await readFile(`${USAGE_DIR()}/usage.json`, 'utf8'));
    } catch {
        return null;
    }
}

/** @param {string} key */
function limitName(key) {
    if (key === 'five_hour') return '5-hour limit';
    if (key === 'seven_day') return 'Weekly limit';
    if (key === 'spend_limit') return 'Spend limit';
    const m = /^seven_day_(.+)$/.exec(key);
    if (m)
        return `Weekly limit · ${/** @type {string} */ (m[1]).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())}`;
    return key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

// Each window: { key, name, short, pct, resets (ms) | null, reset (true once resets has passed:
// the saved % is then the old window's, so it shows 0), spend ("$x / $y …") }.
/** @param {Usage | null} usage @returns {UsageWindow[]} */
export function usageWindows(usage) {
    return Object.entries(usage?.rate_limits ?? {})
        .filter(([, w]) => w && typeof w.used_percentage === 'number')
        .map(([key, w]) => {
            const r = w.resets_at;
            const resets =
                typeof r === 'number'
                    ? r < 1e12
                        ? r * 1000
                        : r
                    : typeof r === 'string'
                      ? Date.parse(r) || null
                      : null;
            const reset = Boolean(resets && resets <= Date.now());
            const short =
                key === 'five_hour' ? '5h' : key === 'seven_day' ? 'wk' : null;
            const spend =
                typeof w.used_usd === 'number' &&
                typeof w.limit_usd === 'number'
                    ? `$${w.used_usd.toFixed(2)} / $${w.limit_usd.toFixed(2)}${w.period ? ` this ${w.period}` : ''}`
                    : null;
            return {
                key,
                name: limitName(key),
                pct: reset
                    ? 0
                    : Math.max(
                          0,
                          Math.min(
                              100,
                              Math.round(
                                  /** @type {number} */ (w.used_percentage),
                              ),
                          ),
                      ),
                reset,
                resets,
                short,
                spend,
            };
        })
        .sort((a, b) =>
            a.key === 'five_hour'
                ? -1
                : b.key === 'five_hour'
                  ? 1
                  : a.key.localeCompare(b.key),
        );
}

// "3:10 PM", with the weekday when it isn't today ("Mon 9:00 AM").
/** @param {number} ms */
function clock(ms) {
    const d = new Date(ms),
        now = new Date();
    const h = d.getHours(),
        m = String(d.getMinutes()).padStart(2, '0');
    const time = `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
    return d.toDateString() === now.toDateString()
        ? time
        : `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]} ${time}`;
}

/** @param {number} ms */
export function ago(ms) {
    const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    return `${Math.round(s / 86400)} days ago`;
}

/** @param {UsageWindow} w */
export const resetText = (w) =>
    w.reset
        ? `Reset at ${clock(/** @type {number} */ (w.resets))}`
        : w.resets
          ? `Resets at ${clock(w.resets)}`
          : '';

/**
 * @typedef {object} UsageViewDeps
 * @property {(usage: Usage | null) => void} setUsage
 * @property {() => Usage | null} usage
 */

/** @param {UsageViewDeps} deps */
export function createUsageView(deps) {
    /** @type {string} */
    let usageSig;

    // Plan usage from statusline.cjs's file. The bar watches the folder and redraws only when a
    // number changes (or a window resets: it then shows 0 with no new payload); the popup rereads
    // every 5 s so its "updated … ago" moves on.
    /** @param {Context} cx @param {boolean} watch */
    function initUsage(cx, watch) {
        /** @type {Usage | null} */
        deps.setUsage(null);
        /** @type {string} */
        usageSig = '';
        /** @param {Context | AsyncContext} cx */
        const check = (cx) => {
            const s = JSON.stringify(
                usageWindows(deps.usage()).map((w) => [
                    w.key,
                    w.pct,
                    w.reset,
                    w.resets,
                    w.spend,
                ]),
            );
            if (s !== usageSig) {
                usageSig = s;
                cx.notify();
            }
        };
        /** @param {Context | AsyncContext} cx */
        const read = (cx) =>
            cx.spawn(async (cx) => {
                deps.setUsage(await readUsageFile());
                check(cx);
            });
        read(cx);
        if (watch) {
            cx.spawn(async (cx) => {
                await mkdir(USAGE_DIR(), { recursive: true }).catch(() => {});
                for (;;) {
                    try {
                        await watchFolder(USAGE_DIR());
                    } catch {
                        await cx.sleep(60000);
                    }
                    read(cx);
                }
            });
            cx.timer.every(30000, check);
        } else
            cx.timer.every(5000, (cx) => {
                read(cx);
                cx.notify();
            });
    }

    /** @param {Anchor} anchor */
    function openUsage(anchor) {
        const n = Math.max(1, usageWindows(deps.usage()).length);
        const height = 34 + n * 58 + 30 + 10;
        openOverlay({
            at: {
                x: Math.max(4, anchor.x - USAGE_POPUP_W + 60),
                y: Math.max(4, anchor.y - height),
            },
            height,
            kind: 'popup',
            mod: 'x-herdr-status',
            props: { usage: true },
            width: USAGE_POPUP_W,
        });
    }

    // Each limit: name, % used, a bar, when it resets; then how fresh the numbers are.
    /** @param {Theme} t */
    function usagePopup(t) {
        const uw = usageWindows(deps.usage());
        const W = USAGE_POPUP_W - 10 - 16; // the bar's width: the popup less its padding
        /** @param {number} pct */
        const tone = (pct) => (pct >= 90 ? t.blocked : t.accent);
        return v_flex()
            .w_full()
            .p(5)
            .bg(t.popover)
            .text_size(12.8)
            .child(
                h_flex()
                    .h(30)
                    .flex_none()
                    .px(8)
                    .items_center()
                    .text_size(11)
                    .text_color(t.dim)
                    .child(div().flex_1().child('Plan usage'))
                    .child(
                        div()
                            .id('usage-page')
                            .cursor_pointer()
                            .hover((s) => s.text_color(t.foreground))
                            .tooltip("Open claude.ai's usage page")
                            .on_click((_e, cx) =>
                                cx.open_url('https://claude.ai/settings/usage'),
                            )
                            .child('claude.ai ›'),
                    ),
            )
            .when(!uw.length, (el) =>
                el.child(
                    div()
                        .h(58)
                        .px(8)
                        .flex()
                        .items_center()
                        .text_color(t.muted)
                        .child(
                            "No usage yet: it comes from a running Claude's status line.",
                        ),
                ),
            )
            .children(
                uw.map((w) =>
                    v_flex()
                        .h(58)
                        .flex_none()
                        .px(8)
                        .py(6)
                        .gap(6)
                        .child(
                            h_flex()
                                .items_center()
                                .child(
                                    div()
                                        .flex_1()
                                        .truncate()
                                        .text_color(t.foreground)
                                        .child(w.name),
                                )
                                .child(
                                    div()
                                        .flex_none()
                                        .text_color(
                                            w.pct >= 90 ? t.blocked : t.muted,
                                        )
                                        .child(`${w.pct}% used`),
                                ),
                        )
                        .child(
                            div()
                                .h(6)
                                .w(W)
                                .flex_none()
                                .rounded(3)
                                .bg(t.hover)
                                .child(
                                    div()
                                        .h(6)
                                        .w(Math.round((W * w.pct) / 100))
                                        .rounded(3)
                                        .bg(tone(w.pct)),
                                ),
                        )
                        .child(
                            div()
                                .text_size(11)
                                .text_color(t.dim)
                                .child(
                                    [resetText(w), w.spend]
                                        .filter(Boolean)
                                        .join(' · '),
                                ),
                        ),
                ),
            )
            .child(
                div()
                    .h(30)
                    .flex_none()
                    .px(8)
                    .flex()
                    .items_center()
                    .text_size(11)
                    .text_color(t.dim)
                    .child(
                        deps.usage()?.at
                            ? `Updated ${ago(/** @type {Usage & { at: number }} */ (deps.usage()).at)}, from Claude's status line`
                            : '',
                    ),
            );
    }

    const view = { initUsage, openUsage, usagePopup };
    return view;
}
