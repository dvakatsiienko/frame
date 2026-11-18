// every settings row as data: key, title, a one-line why, a control, a default. a herdr mod cannot import a sibling
// mod's file, so this chat holds every page its window shows; settings-store.js keeps their values, settings-window.js
// draws them. a row joins only once its mod acts on it

/** @typedef {{ kind: 'toggle' } | { kind: 'choice', options: { value: unknown, label: string }[] } | { kind: 'checks', options: { value: string, label: string, isLocked?: boolean }[] } | { kind: 'stepper', min: number, max: number, step: number, unit: string } | { kind: 'text', needs: string[] }} Control */
/** @typedef {{ key: string, title: string, why: string, control: Control, default: unknown }} Row */
/** @typedef {{ heading: string, rows: Row[] }} Group */
/** @typedef {{ id: string, icon: string, title: string, about: string, groups: Group[] }} Page */

// the words a second wind note must keep, or a thread may never compact: the op's name and the handoff step
const WIND_WORDS = ['second-wind', 'handoff'];

/** @type {Page[]} */
export const pages = [
    {
        about: 'the chat view: its band and its meters',
        groups: [
            {
                heading: 'meters',
                rows: [
                    {
                        control: {
                            kind: 'stepper',
                            max: 95,
                            min: 30,
                            step: 5,
                            unit: '%',
                        },
                        default: 60,
                        key: 'chatter.meter.ctx.warn',
                        title: '🧠 ctx turns amber at',
                        why: 'how full a thread’s context gets before its bar warns you',
                    },
                    {
                        control: {
                            kind: 'stepper',
                            max: 95,
                            min: 30,
                            step: 5,
                            unit: '%',
                        },
                        default: 80,
                        key: 'chatter.meter.week.warn',
                        title: '🫙 week turns amber at',
                        why: 'how much of the weekly usage is spent before its bar warns you',
                    },
                ],
            },
            {
                heading: 'send',
                rows: [
                    {
                        control: {
                            kind: 'stepper',
                            max: 500,
                            min: 50,
                            step: 50,
                            unit: 'ms',
                        },
                        default: 100,
                        key: 'chatter.send.holdDelay',
                        title: 'Hold starts after',
                        why: 'how long send or Enter is held before its disc starts filling; a quicker let-go joins',
                    },
                    {
                        control: {
                            kind: 'stepper',
                            max: 3000,
                            min: 500,
                            step: 250,
                            unit: 'ms',
                        },
                        default: 1000,
                        key: 'chatter.send.holdPush',
                        title: 'Hold to send',
                        why: 'how long the disc fills before the message sends at once instead of joining',
                    },
                ],
            },
            {
                heading: 'replies',
                rows: [
                    {
                        control: { kind: 'toggle' },
                        default: true,
                        key: 'chatter.showMore',
                        title: 'Show more',
                        why: 'a long reply of an earlier turn shows its first lines and a Show more; off, every reply reads whole',
                    },
                ],
            },
            {
                heading: 'pictures',
                rows: [
                    {
                        // a boolean in the file, as the old chat reads it: true is CleanShot
                        control: {
                            kind: 'choice',
                            options: [
                                { label: 'CleanShot', value: true },
                                { label: 'macOS Preview', value: false },
                            ],
                        },
                        default: true,
                        key: 'chatter.pictures.cleanshot',
                        title: 'Open pictures in',
                        why: 'the app a picture’s open button starts: CleanShot X’s annotate, or Preview',
                    },
                ],
            },
            {
                heading: 'measure',
                rows: [
                    {
                        control: { kind: 'toggle' },
                        default: false,
                        key: 'chatter.metalHud',
                        title: 'Metal HUD',
                        why: 'Apple’s frame-rate meter over herdr, for measuring a scroll or a redraw',
                    },
                ],
            },
        ],
        icon: '💬',
        id: 'chatter',
        title: 'Chat',
    },
    {
        about: 'x-mod-stash inside every Claude Code thread; its own 🎛️ pane keeps working as your fallback',
        groups: [
            {
                heading: '🐦‍🔥 second wind',
                rows: [
                    {
                        control: { kind: 'toggle' },
                        default: true,
                        key: 'stash.second-wind',
                        title: 'Second wind',
                        why: 'Threads can refresh their context. Off: 🐦‍🔥 is gone everywhere.',
                    },
                    {
                        control: { kind: 'toggle' },
                        default: true,
                        key: 'stash.second-wind-auto',
                        title: 'Auto second wind',
                        why: 'Threads get the two messages below by themselves. A thread’s 🍃 opts it out.',
                    },
                    {
                        control: {
                            kind: 'stepper',
                            max: 85,
                            min: 40,
                            step: 5,
                            unit: '%',
                        },
                        default: 55,
                        key: 'stash.wind.notice',
                        title: 'Heads-up at',
                        why: 'How full a thread’s context is when it gets the heads-up.',
                    },
                    {
                        control: {
                            kind: 'stepper',
                            max: 90,
                            min: 45,
                            step: 5,
                            unit: '%',
                        },
                        default: 65,
                        key: 'stash.wind.must',
                        title: 'Second wind at',
                        why: 'How full it is when the thread must take its second wind.',
                    },
                    {
                        control: { kind: 'text', needs: WIND_WORDS },
                        default: '',
                        key: 'stash.wind.text.notice',
                        title: 'At {at:stash.wind.notice} % context: the heads-up',
                        why: 'What the thread reads then. {fill} = its context now, {wind} = the {at:stash.wind.must} % line.',
                    },
                    {
                        control: { kind: 'text', needs: WIND_WORDS },
                        default: '',
                        key: 'stash.wind.text.at',
                        title: 'At {at:stash.wind.must} % context: the must',
                        why: 'What the thread reads then. Clio’s threads read it too.',
                    },
                    {
                        control: { kind: 'text', needs: WIND_WORDS },
                        default: '',
                        key: 'stash.wind.text.at.coordinator',
                        title: 'At {at:stash.wind.must} % context: the must, for Clio',
                        why: 'What Clio’s threads read then, in place of the must above.',
                    },
                    {
                        control: { kind: 'text', needs: [] },
                        default: '',
                        key: 'stash.wind.text.propose',
                        title: 'Past {at:stash.wind.must} % with a thread’s 🍃 off',
                        why: 'What the thread reads then: it proposes the wind to you. {fill} = its context now, {wind} = the {at:stash.wind.must} % line.',
                    },
                    {
                        control: { kind: 'text', needs: WIND_WORDS },
                        default: '',
                        key: 'stash.wind.text.press',
                        title: 'When you press 🐦‍🔥',
                        why: 'What the thread reads then. Clio’s threads read it too.',
                    },
                ],
            },
            {
                heading: '🪐 orbit',
                rows: [
                    {
                        control: { kind: 'text', needs: [] },
                        default: '',
                        key: 'stash.orbit.text.tick',
                        title: 'When you tick or steer an ask',
                        why: 'What the thread reads after «orbit: dima marked N asks.» {n} = how many asks, {tool} = the orbit tool.',
                    },
                    {
                        control: { kind: 'text', needs: [] },
                        default: '',
                        key: 'stash.orbit.text.plan-stale',
                        title: 'When a thread’s plan goes stale',
                        why: 'What the thread reads once, after «plan set N turns ago». {n} = the turns.',
                    },
                    {
                        control: { kind: 'text', needs: [] },
                        default: '',
                        key: 'stash.orbit.text.lane-stale',
                        title: 'When a lane goes stale',
                        why: 'What its coordinator reads once. {id} = the lane, {title} = its name, {n} = the turns, {tool} = the orbit tool.',
                    },
                ],
            },
            {
                heading: 'lanes',
                rows: [
                    {
                        control: {
                            kind: 'stepper',
                            max: 60,
                            min: 5,
                            step: 5,
                            unit: 'min',
                        },
                        default: 10,
                        key: 'stash.park.after',
                        title: 'Lane idle alarm after',
                        why: 'how long every member of a lane sits idle before its coordinator hears about it',
                    },
                ],
            },
        ],
        icon: '🧩',
        id: 'cc',
        title: 'Claude Code mods',
    },
    {
        about: 'every x-herdr key, written into herdr’s keys.json beside herdr’s own',
        groups: [],
        icon: '⌨️',
        id: 'keys',
        title: 'Keys',
    },
];

// what an orbit note box shows while its row is empty: x-mod-stash's built-in line, copied here since that mod writes
// no file of defaults for these three; an empty row always means the mod's own text, whatever this copy says
/** @type {Record<string, string>} */
export const orbitNoteDefaults = {
    'stash.orbit.text.lane-stale':
        'lane {id} «{title}» moved nothing for {n} of your turns, stale: step it or end it through {tool} op glide.',
    'stash.orbit.text.plan-stale': 'stale: set it again',
    'stash.orbit.text.tick':
        'answer each in this reply, then call {tool}: resolve the answered ids, or follow one that needs another round.',
};

/** @type {Row[]} */
export const settingRows = pages.flatMap((p) =>
    p.groups.flatMap((g) => g.rows),
);

/**
 * a row's title and one-line why as he reads them: `{at:<key>}` becomes that row's value now, so a title can say
 * «At 55 % context» and follow its stepper
 * @param {Row} row
 * @param {Record<string, unknown>} values the stored values by key
 * @returns {{ title: string, why: string }}
 */
export function rowWords(row, values) {
    const rows = pages.flatMap((page) => page.groups.flatMap((g) => g.rows));
    /** @param {string} text */
    const fill = (text) =>
        text.replace(/\{at:([\w.-]+)\}/g, (_all, key) =>
            String(
                values[key] ?? rows.find((r) => r.key === key)?.default ?? '?',
            ),
        );
    return { title: fill(row.title), why: fill(row.why) };
}
