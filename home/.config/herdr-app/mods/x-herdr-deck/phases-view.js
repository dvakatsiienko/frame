// the phases as drawn: each thread's plan pinned under orbit, its header with «tick» and a steer box, and the press that
// ticks a plan. it owns the lines' widths and the presses being written; the rest comes through `deps`

import { h_flex, v_flex } from 'gpui-base';
import { div } from 'gpui-kit';
import { exec, readTextFile, writeTextFile } from 'herdr';

import { SIZE, line, prose } from './look.js';
import { phaseParts, planPress, pressLabel, savePress } from './orbit.js';
import { pressButton } from './press-button.js';
import { TICKS } from './shelf.js';
import { LOCKED_TIP } from './steer-kit.js';

/** @typedef {import('./deck-types.js').Context} Context */
/** @typedef {import('./deck-types.js').Theme} Theme */
/** @typedef {import('./shelf.js').Row} Row */

/**
 * @typedef {object} PhasesViewDeps
 * @property {() => Map<string, number>} planSent
 * @property {() => Map<string, string>} planTicked
 * @property {() => Row[]} rows
 * @property {(error: string | null) => void} setPressError
 * @property {(t: Theme, key: string, tabIndex: number, isLocked: boolean) => ReturnType<typeof import('./steer-kit.js').steerBox>} steerOf
 * @property {(key: string) => string} steerSent
 * @property {() => Map<string, import('gpui-base').InputState>} steers
 * @property {() => Map<string, number>} tabAt
 * @property {ReturnType<typeof import('./orbit.js').createTurns>} turns
 */

/** @param {PhasesViewDeps} deps */
export function createPhasesView(deps) {
    /** @type {Map<string, { box: number, full: number }>} each phase line's box and its uncut text's width */
    const phaseW = new Map();
    /** the threads whose plan press is being written, so a second press waits for the first @type {Set<string>} */
    const planWriting = new Set();

    /**
     * the phases' header with «tick» and its steer box, as an ask's (rider 4d, his 18:09 shot): the box is the Tab stop
     * after orbit's, Enter ticks or unticks, no replay
     * @param {Theme} t @param {any} head @param {string} key `<sid>:plan`
     */
    function planHead(t, head, key) {
        const sid = key.slice(0, -':plan'.length);
        const plan = deps
            .rows()
            .find((r) => r.sid === sid)
            ?.phases.join('\n');
        const isTicked = deps.planTicked().get(sid) === plan;
        return head
            .flex()
            .items_center()
            .gap(8)
            .child(div().flex_1())
            .child(
                pressButton(t, {
                    id: `plan-tick-${sid}`,
                    label: pressLabel(isTicked ? 'ticked' : 'open', null).tick,
                    lockedTip: LOCKED_TIP,
                    onClick: (cx) => cx.spawn((cx) => view.pressPlan(cx, key)),
                    tip: isTicked
                        ? 'queued for its next turn: click to take it back'
                        : 'tick: agree with the plan',
                    variant: 'primary',
                }),
            )
            .child(
                div()
                    .w(200)
                    .flex_none()
                    .flex()
                    .child(
                        deps.steerOf(
                            t,
                            key,
                            deps.tabAt().get(`steer-${key}`) ?? 0,
                            false,
                        ),
                    ),
            );
    }

    // the phases' tick (rider 4d): a press naming the whole plan into the thread's ticks file; a second press unticks
    /** @param {Context} cx @param {string} key `<sid>:plan` */
    async function pressPlan(cx, key) {
        const sid = key.slice(0, -':plan'.length);
        const s = deps.rows().find((r) => r.sid === sid);
        if (!s || planWriting.has(sid)) return;
        // a tick belongs to the plan it ticked: a new plan reads open again
        const plan = s.phases.join('\n');
        const was = deps.planTicked().get(sid);
        const isTick = was !== plan;
        if (isTick) deps.planTicked().set(sid, plan);
        else deps.planTicked().delete(sid);
        planWriting.add(sid);
        const at = Date.now();
        cx.notify();
        try {
            const made = await exec('mkdir', ['-p', TICKS]);
            if (made.code !== 0)
                throw new Error(
                    made.stderr.trim() || `mkdir exited ${made.code}`,
                );
            await deps.turns(() =>
                savePress(
                    { read: readTextFile, write: writeTextFile },
                    `${TICKS}/${sid}.jsonl`,
                    planPress(
                        s.phases,
                        isTick ? 'tick' : 'untick',
                        at,
                        deps.steerSent(key),
                    ),
                    s.taken,
                ),
            );
            if (isTick) deps.planSent().set(sid, at);
            else deps.planSent().delete(sid);
            deps.setPressError(null);
        } catch (err) {
            if (was === undefined) deps.planTicked().delete(sid);
            else deps.planTicked().set(sid, was);
            deps.setPressError(
                `phases not ticked: ${err instanceof Error ? err.message : err}`,
            );
        }
        planWriting.delete(sid);
        cx.notify();
    }

    /**
     * every thread's phases, pinned under orbit and glide: a group per thread under its name; past its height it scrolls
     * on its own, and the scroll part above keeps at least 120 px, so orbit never vanishes
     * @param {Theme} t @param {import('./deck-parts.js').PhaseGroup[]} groups @param {(text: string) => any} header
     */
    function phasesBlock(t, groups, header) {
        const planKey = groups.length === 1 ? `${groups[0]?.sid}:plan` : null;
        // one thread's plan carries no name: antenna and the tabs already say which (dima, 19:26); several keep a name each
        const isOne = groups.length === 1;
        const head = header('🌔 phases');
        return v_flex()
            .id('x-herdr-deck-phases')
            .flex_none()
            .max_h(320)
            .overflow_y_scroll()
            .pb(8)
            .child(
                planKey && deps.steers().has(planKey)
                    ? view.planHead(t, head, planKey)
                    : head,
            )
            .children(
                groups.map((g, i) =>
                    v_flex()
                        .px(12)
                        .py(4)
                        .gap(2)
                        .when(!isOne, (el) =>
                            el.child(
                                line(t.foreground, SIZE.secondary)
                                    .font_semibold()
                                    .child(g.name),
                            ),
                        )
                        .children(
                            g.phases.map((phase, j) => {
                                // the moon fills by nearness, the later lines dim, only the first lead green (the
                                // stash board's look, dima's 66d)
                                const p = phaseParts(phase, j);
                                const color = j > 1 ? t.muted : t.foreground;
                                // one entry per drawn line: its uncut copy measures again whenever its text changes width
                                const key = `${i}-${j}`;
                                const w = phaseW.get(key);
                                const isCut = Boolean(
                                    w && w.full > w.box + 0.5,
                                );
                                /** @param {'box' | 'full'} side @param {number} px @param {Context} cx */
                                const measured = (side, px, cx) => {
                                    const was = phaseW.get(key) ?? {
                                        box: 0,
                                        full: 0,
                                    };
                                    if (Math.abs(was[side] - px) < 0.5) return;
                                    phaseW.set(key, {
                                        ...was,
                                        [side]: px,
                                    });
                                    cx.notify();
                                };
                                // one line, cut with «…» at the card's edge so the card never grows; the full line
                                // shows on hover only while it is cut, measured again on every resize (rider 4e)
                                return h_flex()
                                    .pl(8)
                                    .gap(6)
                                    .items_center()
                                    .text_size(SIZE.secondary)
                                    .child(div().flex_none().child(p.moon))
                                    .when(Boolean(p.lead), (el) =>
                                        el.child(
                                            div()
                                                .flex_none()
                                                .font_semibold()
                                                .text_color(
                                                    j === 0 ? t.ansi2 : color,
                                                )
                                                .child(p.lead),
                                        ),
                                    )
                                    .child(
                                        div()
                                            .id(`phase-${i}-${j}`)
                                            .relative()
                                            .flex_1()
                                            .min_w(0)
                                            // one line tall whatever the text view does, so the card never grows
                                            .h(20)
                                            .overflow_hidden()
                                            .on_size_change((size, cx) =>
                                                measured('box', size.width, cx),
                                            )
                                            .when(isCut, (el) =>
                                                el.tooltip(phase),
                                            )
                                            // a text view, so he can select a phase to copy or read aloud (F4, 18:51)
                                            .child(
                                                prose(
                                                    `phase-text-${i}-${j}`,
                                                    p.text,
                                                    color,
                                                    SIZE.secondary,
                                                )
                                                    .whitespace_nowrap()
                                                    .overflow_hidden()
                                                    .text_ellipsis(),
                                            )
                                            .child(
                                                div()
                                                    .id(`phase-full-${i}-${j}`)
                                                    .absolute()
                                                    .top(0)
                                                    .left(0)
                                                    .h(0)
                                                    .overflow_hidden()
                                                    .whitespace_nowrap()
                                                    .text_color('#00000000')
                                                    .on_size_change(
                                                        (size, cx) =>
                                                            measured(
                                                                'full',
                                                                size.width,
                                                                cx,
                                                            ),
                                                    )
                                                    .child(p.text),
                                            ),
                                    );
                            }),
                        ),
                ),
            );
    }

    const view = { phasesBlock, planHead, pressPlan };
    return view;
}
