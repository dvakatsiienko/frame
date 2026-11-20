// the band and the bottom bar: the thread's meters and the band's buttons (🍃 auto wind, 🚦 the deck, the override)
// over the quill, its state line, turn clock and Stop under it. the rules live in band.js; this file draws them and
// owns the facts they read: the stash's state, the presses, the override, each thread's 🍃

import { h_flex, v_flex } from 'gpui-base';
import { div, svg } from 'gpui-kit';
import {
    agents,
    exec,
    hc,
    home,
    layout,
    notify,
    openOverlay,
    readTextFile,
    run as runCommand,
    shared,
    terminals,
    watchFolder,
    writeTextFile,
} from 'herdr';

import {
    AUTO_WIND_DOOR,
    DECK_BLOCK,
    OVERRIDE_STORE,
    THREADS_KEY,
    autoWind,
    autoWindAfterRead,
    autoWindFlipped,
    bandButtons,
    bandOf,
    meterCells,
    meterTip,
    overrideOf,
    pendingOf,
    pressesWaiting,
    stateLine,
    stateParts,
    turnClock,
} from './band.js';
import {
    PRESS_DIR,
    PRESS_FILE,
    pressLine,
    withBandPress,
} from './band-press.js';
import { settingsOverlay } from './chat-asks.js';

/** @typedef {import('./chat-types.js').Color} Color */
/** @typedef {import('./chat-types.js').Context} Context */
/** @typedef {import('./chat-types.js').Theme} Theme */

// a meter's cells, as the old chat drew them
const METER_CELLS = 48;
const CHIP_SIZE = 26;
// his quill's two cards sit one layer under it, a little narrower, flush against it (the old chat's PK-384 pick)
const NEST_INSET = 14;
// a 🍃 pressed on the cc band reaches no file herdr watches: the shown thread's key is asked again this often, and a
// read that failed this soon, never a minute of grey; a door that hangs (a lock, a prompt) ends at its timeout
const AUTO_WIND_MS = 60 * 1000;
const AUTO_WIND_RETRY_MS = 10 * 1000;
const AUTO_WIND_DOOR_MS = 10 * 1000;

/** one of the quill's two cards, above or under it @param {Theme} t @param {'top' | 'bottom'} side */
export const nestedCard = (t, side) => {
    const card = v_flex()
        .px(12)
        .bg(t.raised)
        .border_color(t.border)
        .border_l(1)
        .border_r(1);
    return side === 'top'
        ? card.pt(8).pb(8).rounded_t(12).border_t(1)
        : card.pt(6).pb(6).rounded_b(12).border_b(1);
};

/**
 * @param {{
 *   shownAddress: () => string | null,
 *   pid: () => number | null,
 *   turnStart: () => number | null,
 *   column: () => number,
 * }} deps the shown thread's terminal and Claude, when its turn started, the chat's column width
 */
export function createBand({ shownAddress, pid, turnStart, column }) {
    /** how full a meter gets before it warns: his two settings rows, their defaults until read */
    let meterWarn = { ctx: 60, week: 80 };
    /** the shown thread's band facts, as the stash wrote them @type {(import('./band.js').ThreadState & { sid: string }) | null} */
    let bandThread = null;
    /** the fleet's afk and waker, as the stash wrote them @type {import('./band.js').FleetState | null} */
    let fleet = null;
    /** the band press file, which the deck's presses reach too @type {string | null} */
    let pressText = null;
    /** this band's own presses, until the state reads them @type {import('./band.js').Pending} */
    let pressed = {};
    /** @type {import('./band.js').Override} */
    let override = { isOn: false };
    /** the band as last drawn: a tick that finds it changed draws again */
    let bandKey = '';
    let isPressWatched = false;
    /** Stop was pressed and the turn still works: a background task Esc cannot stop */
    let isStuck = false;
    /** each thread's 🍃 as the stash's door last read it, by session @type {Map<string, import('./band.js').AutoWind>} */
    let autoWinds = new Map();
    /** one flip and one read in flight per thread: a click during a read still flips */
    const autoWindFlipping = new Set();
    const autoWindReading = new Set();
    /** auto second wind on for the fleet: his settings row; off, 🍃 leaves the band */
    let hasAutoWind = true;

    /** the band and the bottom bar as they draw now @param {number} now */
    function drawnNow(now) {
        const band = bandNow(now);
        return { band, bar: barNow(now, band.meters.wait) };
    }

    /**
     * the bottom bar as it draws now: a spinner or an idle ring, what the turn does, its clock, and Stop
     * @param {number} now
     * @param {string | null} wait what the idle thread waits on, as the deck read it
     */
    function barNow(now, wait) {
        const status =
            agents().find((agent) => agent.address === shownAddress())
                ?.status ?? 'idle';
        const isWorking = status === 'working';
        const turnAt = turnStart();
        const parts = stateParts({
            hasTurnAt: turnAt !== null,
            isStuck: isStuck,
            status,
        });
        const report = isWorking
            ? terminals().find(
                  (terminal) => terminal.address === shownAddress(),
              )?.report
            : null;
        return {
            clock:
                parts.hasClock && turnAt !== null
                    ? turnClock(now - turnAt)
                    : null,
            hasStop: parts.hasStop && shownAddress() !== null,
            isWorking,
            line: stateLine({
                isBlocked: status === 'blocked',
                isStuck: isWorking && isStuck,
                isWorking,
                msg: typeof report === 'object' ? report?.msg : null,
                wait,
            }),
            mark: parts.mark,
        };
    }

    /**
     * the band as it draws now: its buttons, the thread's meters, and whether the deck still reads the thread
     * @param {number} now
     */
    function bandNow(now) {
        const state = {
            fleet,
            isDeckShown: isDeckShown(),
            override,
            thread: bandThread,
        };
        const pending = pressesWaiting(
            pressed,
            pendingOf(pressText, bandThread?.sid, now),
            bandButtons(state),
            now,
        );
        return {
            buttons: bandButtons({
                ...state,
                autoWind: autoWinds.get(bandThread?.sid ?? '')?.on ?? null,
                hasAutoWind: hasAutoWind,
                pending,
            }),
            meters: bandOf(shared(THREADS_KEY), pid(), now),
        };
    }

    /**
     * the facts that age with no event: the override's store is read again, and the band draws again once a stale
     * deck, a press past its wait or the override changed what it shows
     * @param {Context} cx
     */
    function ageBand(cx) {
        watchPresses(cx);
        // 🍃 asks a program, so it runs beside the file reads and never holds them
        cx.spawn((cx) => readAutoWind(cx));
        pressed = pressesWaiting(
            pressed,
            {},
            bandButtons({
                fleet: fleet,
                isDeckShown: true,
                override: override,
                thread: bandThread,
            }),
            Date.now(),
        );
        cx.spawn(async (cx) => {
            const text = await readTextFile(
                `${home()}/${OVERRIDE_STORE}`,
            ).catch(() => null);
            let store = null;
            try {
                store = JSON.parse(text ?? 'null');
            } catch {}
            override = overrideOf(store, Date.now());
            if (JSON.stringify(drawnNow(Date.now())) !== bandKey) cx.notify();
        });
    }

    /** the shown thread's 🍃 as the door reads it: asked on a new thread, then every AUTO_WIND_MS @param {Context} cx */
    async function readAutoWind(cx) {
        const sid = bandThread?.sid;
        if (!sid || !hasAutoWind || autoWindReading.has(sid)) return;
        const last = autoWinds.get(sid);
        const wait = last?.on === null ? AUTO_WIND_RETRY_MS : AUTO_WIND_MS;
        if (last && Date.now() - last.at < wait) return;
        autoWindReading.add(sid);
        const flips = last?.flips ?? 0;
        try {
            /** @type {boolean | null} */
            let on = null;
            try {
                on = await autoWind(autoWindDoor, sid);
            } catch (error) {
                console.log(
                    `second wind auto: the door did not answer: ${error}`,
                );
            }
            autoWinds = autoWindAfterRead(
                autoWinds,
                sid,
                on,
                flips,
                Date.now(),
            );
            cx.notify();
        } finally {
            autoWindReading.delete(sid);
        }
    }

    /** 🍃 flips through the stash's door, and shows what the door then reads, never the click's own guess @param {import('./band.js').BandButton} btn @param {Context} cx */
    function flipAutoWind(btn, cx) {
        const sid = bandThread?.sid;
        if (!sid || autoWindFlipping.has(sid)) return;
        autoWindFlipping.add(sid);
        cx.spawn(async (cx) => {
            try {
                const on = await autoWind(autoWindDoor, sid, !btn.isOn);
                autoWinds = autoWindFlipped(autoWinds, sid, on, Date.now());
            } catch (error) {
                notify({
                    body: String(error),
                    level: 'error',
                    title: 'second wind auto: the flip was not written',
                });
            } finally {
                autoWindFlipping.delete(sid);
            }
            cx.notify();
        });
    }

    /** a press on the deck or another band shows here at once; a folder not made yet is watched from the next tick @param {Context} cx */
    function watchPresses(cx) {
        if (isPressWatched) return;
        isPressWatched = true;
        cx.spawn(async (cx) => {
            try {
                for (;;) {
                    const watch = watchFolder(`${home()}/${PRESS_DIR}`);
                    pressText = await readTextFile(
                        `${home()}/${PRESS_FILE}`,
                    ).catch(() => null);
                    cx.notify();
                    await watch;
                }
            } catch {
                isPressWatched = false;
            }
        });
    }

    /**
     * the card over the quill: the context and week meters, their numbers beside them
     * @param {ReturnType<typeof bandNow>} now
     * @param {Theme} t
     */
    function band({ meters }, t) {
        /** @param {string} name @param {number | null} pct @param {number} warnAt */
        const meter = (name, pct, warnAt) =>
            h_flex()
                .id(`chat-meter-${name}`)
                .gap(8)
                .items_center()
                .tooltip(
                    meters.isStale
                        ? 'The deck has not read this thread for over 2 minutes'
                        : meterTip(name, pct),
                )
                .child(
                    div()
                        .w(20)
                        .flex_none()
                        .text_size(12)
                        .text_color(t.dim)
                        .child(name === 'ctx' ? '🧠' : '🫙'),
                )
                .child(
                    div()
                        .flex_1()
                        .child(
                            meterBar(
                                t,
                                pct,
                                meters.isStale
                                    ? t.dim
                                    : pct != null && pct >= warnAt
                                      ? t.blocked
                                      : t.accent,
                            ),
                        ),
                )
                .child(
                    div()
                        .w(36)
                        .flex_none()
                        .flex()
                        .justify_end()
                        .text_size(12)
                        .text_color(t.dim)
                        .child(pct == null ? '—' : `${Math.round(pct)}%`),
                );
        return nestedRow(
            'chat-band-row',
            nestedCard(t, 'top')
                .gap(3)
                // ctx above week (dima: «move ctx meter over the week»)
                .child(meter('ctx', meters.context, meterWarn.ctx))
                .child(meter('week', meters.week, meterWarn.week)),
        );
    }

    /**
     * a card nested under the quill, in the list's column, as wide as the quill less its inset
     * @param {string} id @param {ReturnType<typeof v_flex>} card
     */
    function nestedRow(id, card) {
        return h_flex()
            .id(id)
            .w_full()
            .flex_none()
            .justify_center()
            .px(18)
            .on_mouse_down('left', (_event, cx) => cx.stop_propagation())
            .child(
                v_flex().w_full().max_w(column()).px(NEST_INSET).child(card),
            );
    }

    /**
     * one chip: plain off, the accent's edge and tint on, 🔓 on loud red; a button whose press herdr cannot prove is
     * greyed, and a live one is a click, never a key (a keyed command is any shell's)
     * @param {import('./band.js').BandButton} btn
     * @param {Theme} t
     */
    function bandChip(btn, t) {
        const isOverride = btn.key === 'override';
        const edge = btn.isOn ? (isOverride ? t.blocked : t.accent) : t.border;
        return div()
            .id(`chat-band-${btn.key}`)
            .size(CHIP_SIZE)
            .flex_none()
            .flex()
            .items_center()
            .justify_center()
            .rounded(6)
            .border(1)
            .border_color(edge)
            .bg(btn.isOn ? (isOverride ? t.blocked : t.selected) : t.background)
            .text_size(13)
            .tooltip(btn.tip)
            .when(!btn.isLive, (el) => el.opacity(0.4).cursor_not_allowed())
            .when(btn.isLive, (el) =>
                el
                    .cursor_pointer()
                    .hover((style) =>
                        style.border_color(btn.isOn ? edge : t.muted),
                    )
                    .on_click((_event, cx) => pressBand(btn, cx)),
            )
            .child(btn.emoji);
    }

    /**
     * the card under the quill: the thread's state, its turn clock and Stop, which stays pressable while the line
     * truncates in a narrow window, then the band's buttons on the right
     * @param {ReturnType<typeof barNow>} now
     * @param {ReturnType<typeof bandNow>['buttons']} buttons
     * @param {Theme} t
     */
    function bar({ clock, hasStop, isWorking, line, mark }, buttons, t) {
        return nestedRow(
            'chat-bar-row',
            nestedCard(t, 'bottom')
                .flex_row()
                .px(8)
                .gap(6)
                .items_center()
                .child(
                    h_flex()
                        .flex_1()
                        .min_w(0)
                        .h(26)
                        .gap(8)
                        .items_center()
                        .text_size(12)
                        .text_color(t.muted)
                        .child(
                            mark === 'spinner'
                                ? div()
                                      .size(7)
                                      .mx(1.5)
                                      .flex_none()
                                      .rounded_full()
                                      .bg(t.muted)
                                      .loop('opacity', {
                                          from: 0.3,
                                          period: 2000,
                                          to: 1,
                                      })
                                : div()
                                      .size(10)
                                      .flex_none()
                                      .rounded_full()
                                      .border(1)
                                      .border_color(t.dim),
                        )
                        .child(
                            div()
                                .id('chat-bar-line')
                                .flex_1()
                                .min_w(0)
                                .truncate()
                                .text_color(isWorking ? t.foreground : t.muted)
                                .tooltip(line)
                                .child(line),
                        )
                        .when(clock !== null, (el) =>
                            el.child(
                                div()
                                    .flex_none()
                                    .text_color(t.dim)
                                    .child(clock ?? ''),
                            ),
                        )
                        .when(hasStop, (el) =>
                            el.child(
                                div()
                                    .id('chat-stop')
                                    .flex_none()
                                    .px(10)
                                    .py(3)
                                    .rounded(6)
                                    .bg(t.raised)
                                    .text_color(t.foreground)
                                    .cursor_pointer()
                                    .hover((style) => style.bg(t.border))
                                    .tooltip("Stop Claude's turn")
                                    .child('Stop')
                                    .on_click((_event, cx) => stop(cx)),
                            ),
                        ),
                )
                .child(
                    h_flex()
                        .flex_none()
                        .gap(4)
                        .children(buttons.map((btn) => bandChip(btn, t))),
                ),
        ).pb(10);
    }

    /**
     * Stop presses Esc in the thread, never `hc interrupt`: that presses Ctrl+C, and a second one quits Claude. a turn
     * still working 3 s later runs a background task Esc cannot stop, and the bar says so for a while
     * @param {Context} cx
     */
    function stop(cx) {
        const address = shownAddress();
        if (!address) return;
        cx.spawn(async () => {
            await hc(['keys', address, 'esc']);
        });
        cx.timer.after(3000, (later) => {
            const isStill =
                agents().find((agent) => agent.address === address)?.status ===
                'working';
            if (!isStill || shownAddress() !== address) return;
            isStuck = true;
            later.notify();
            later.timer.after(8000, (after) => {
                isStuck = false;
                after.notify();
            });
        });
    }

    /**
     * 🚦 and 🎛️ act at once; wind, hot, waker, AFK and 🔓 write a press the stash answers, the state it asks for
     * shown until then
     * @param {import('./band.js').BandButton} btn
     * @param {Context} cx
     */
    function pressBand(btn, cx) {
        if (btn.key === 'board') {
            runCommand('layout.toggle', { id: DECK_BLOCK });
            cx.notify();
            return;
        }
        if (btn.key === 'settings') {
            openOverlay(settingsOverlay('dock'));
            return;
        }
        if (btn.key === 'auto') {
            flipAutoWind(btn, cx);
            return;
        }
        const key = /** @type {import('./band-press.js').PressKey} */ (btn.key);
        if (!['wind', 'hot', 'waker', 'afk', 'override'].includes(key)) return;
        const sid = bandThread?.sid ?? null;
        if ((key === 'wind' || key === 'hot') && !sid) return;
        const at = Date.now();
        const on = !btn.isOn;
        pressed = { ...pressed, [key]: { at, on } };
        cx.notify();
        cx.spawn(async (cx) => {
            try {
                await appendPress(pressLine(key, on, sid, at));
            } catch (error) {
                const { [key]: _dropped, ...rest } = pressed;
                pressed = rest;
                notify({
                    body: String(error),
                    level: 'error',
                    title: `${btn.word}: the press was not written`,
                });
            }
            cx.notify();
        });
    }

    return {
        age: ageBand,
        /** his settings rows the band reads @param {Record<string, unknown>} values */
        applySettings(values) {
            meterWarn = {
                ctx: Number(values['chatter.meter.ctx.warn']),
                week: Number(values['chatter.meter.week.warn']),
            };
            hasAutoWind = values['stash.second-wind-auto'] === true;
        },
        bar,
        /** a new thread is shown: no button shows or presses a thread no longer on screen; the fleet's facts stay */
        clear() {
            bandThread = null;
            pressed = {};
            isStuck = false;
        },
        /** the band and the bar as they draw now, kept so a tick that finds them changed draws again @param {number} now */
        drawn(now) {
            const drawn = drawnNow(now);
            bandKey = JSON.stringify(drawn);
            return drawn;
        },
        readAutoWind,
        /**
         * the stash's facts for the shown thread and the fleet; a change asks its 🍃 now, not at the next tick
         * @param {{ fleet: import('./band.js').FleetState | null, thread: (import('./band.js').ThreadState & { sid: string }) | null }} next
         * @returns {boolean} whether the band's facts changed
         */
        takeState(next) {
            if (
                JSON.stringify(next) ===
                JSON.stringify({ fleet, thread: bandThread })
            )
                return false;
            fleet = next.fleet;
            bandThread = next.thread;
            return true;
        },
        view: band,
    };
}

/**
 * one press appended to the band press file with herdr's compare-and-swap write: a file changed since the read is read
 * again, so no other press is lost
 * @param {import('./band-press.js').PressLine} line
 */
async function appendPress(line) {
    const made = await exec('mkdir', ['-p', `${home()}/${PRESS_DIR}`]);
    if (made.code !== 0) throw new Error(made.stderr.trim() || 'mkdir failed');
    const path = `${home()}/${PRESS_FILE}`;
    for (let tries = 2; ; tries--) {
        const text = await readTextFile(path).catch(() => null);
        try {
            return await writeTextFile(
                path,
                withBandPress(text, line, line.at),
                text,
            );
        } catch (error) {
            if (tries <= 1) throw error;
        }
    }
}

/** x-mod-stash's door for a session's 🍃, run in frame where `pnpm mods:set` lives @param {string[]} args */
async function autoWindDoor(args) {
    const out = await exec('pnpm', [...AUTO_WIND_DOOR, ...args], {
        cwd: `${home()}/frame`,
        timeout: AUTO_WIND_DOOR_MS,
    });
    if (out.code !== 0)
        throw new Error(
            out.stderr.trim() || out.stdout.trim() || 'mods:set failed',
        );
    return out.stdout;
}

/** whether his layout shows the deck's block; a layout without it reads as shown, so 🚦 offers a hide */
function isDeckShown() {
    /** @param {any} node @returns {any} */
    const find = (node) => {
        if (node?.id === DECK_BLOCK) return node;
        for (const child of node?.children ?? []) {
            const found = find(child);
            if (found) return found;
        }
        return null;
    };
    return !find(layout())?.hidden;
}

/**
 * a meter as a row of matte cells in a recessed rail, the lit ones in one colour (the old chat's, PK-384)
 * @param {Theme} t @param {number | null} pct @param {Color} fill
 */
const meterBar = (t, pct, fill) => {
    const lit = meterCells(pct, METER_CELLS);
    return h_flex()
        .h(9)
        .p(2)
        .gap(2)
        .rounded(4)
        .bg(t.background)
        .border(1)
        .border_color(t.border)
        .children(
            Array.from({ length: METER_CELLS }, (_, i) =>
                div()
                    .flex_1()
                    .h_full()
                    .rounded(1)
                    .bg(i < lit ? fill : t.border),
            ),
        );
};
