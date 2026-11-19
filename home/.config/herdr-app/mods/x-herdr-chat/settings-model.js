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
        about: 'herdr as a whole, outside any one chat',
        groups: [
            {
                heading: 'tabs',
                rows: [
                    {
                        control: {
                            kind: 'choice',
                            options: [
                                { label: 'visible', value: 'visible' },
                                { label: 'hidden', value: 'hidden' },
                            ],
                        },
                        default: 'visible',
                        key: 'tabs.status',
                        title: 'tab status',
                        why: 'each tab’s program icon and its state dot; hidden leaves more room for the names',
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
                                { label: 'cleanshot', value: true },
                                { label: 'macos preview', value: false },
                            ],
                        },
                        default: true,
                        key: 'chatter.pictures.cleanshot',
                        title: 'open pictures in',
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
                        title: 'metal hud',
                        why: 'apple’s frame-rate meter over herdr, for measuring a scroll or a redraw',
                    },
                ],
            },
        ],
        icon: '⚙️',
        id: 'general',
        title: 'general',
    },
    {
        about: 'the bar under the chat: its meters and how send works',
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
                heading: 'magic send',
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
                        title: 'hold starts after',
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
                        title: 'hold to send',
                        why: 'how long the disc fills before the message sends at once instead of joining',
                    },
                ],
            },
        ],
        icon: '⚓',
        id: 'dock',
        title: 'dock',
    },
    {
        about: 'the chat view: how its replies read',
        groups: [
            {
                heading: 'replies',
                rows: [
                    {
                        control: { kind: 'toggle' },
                        default: true,
                        key: 'chatter.showMore',
                        title: 'show more',
                        why: 'a long reply of an earlier turn shows its first lines and a Show more; off, every reply reads whole',
                    },
                ],
            },
        ],
        icon: '💬',
        id: 'chatter',
        title: 'chat',
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
                        title: 'second wind',
                        why: 'threads can refresh their context. Off: 🐦‍🔥 is gone everywhere.',
                    },
                    {
                        control: { kind: 'toggle' },
                        default: true,
                        key: 'stash.second-wind-auto',
                        title: 'auto second wind',
                        why: 'threads get the two messages below by themselves. A thread’s 🍃 opts it out.',
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
                        title: 'heads-up at',
                        why: 'how full a thread’s context is when it gets the heads-up.',
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
                        title: 'second wind at',
                        why: 'how full it is when the thread must take its second wind.',
                    },
                    {
                        control: { kind: 'text', needs: WIND_WORDS },
                        default: '',
                        key: 'stash.wind.text.notice',
                        title: 'at {at:stash.wind.notice} % context: the heads-up',
                        why: 'what the thread reads then. {fill} = its context now, {wind} = the {at:stash.wind.must} % line.',
                    },
                    {
                        control: { kind: 'text', needs: WIND_WORDS },
                        default: '',
                        key: 'stash.wind.text.at',
                        title: 'at {at:stash.wind.must} % context: the must',
                        why: 'what the thread reads then. Clio’s threads read it too.',
                    },
                    {
                        control: { kind: 'text', needs: WIND_WORDS },
                        default: '',
                        key: 'stash.wind.text.at.coordinator',
                        title: 'at {at:stash.wind.must} % context: the must, for Clio',
                        why: 'what Clio’s threads read then, in place of the must above.',
                    },
                    {
                        control: { kind: 'text', needs: [] },
                        default: '',
                        key: 'stash.wind.text.propose',
                        title: 'past {at:stash.wind.must} % with a thread’s 🍃 off',
                        why: 'what the thread reads then: it proposes the wind to you. {fill} = its context now, {wind} = the {at:stash.wind.must} % line.',
                    },
                    {
                        control: { kind: 'text', needs: WIND_WORDS },
                        default: '',
                        key: 'stash.wind.text.press',
                        title: 'when you press 🐦‍🔥',
                        why: 'what the thread reads then. Clio’s threads read it too.',
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
                        title: 'when you tick or steer an ask',
                        why: 'what the thread reads after «orbit: dima marked N asks.» {n} = how many asks, {tool} = the orbit tool.',
                    },
                    {
                        control: { kind: 'text', needs: [] },
                        default: '',
                        key: 'stash.orbit.text.plan-stale',
                        title: 'when a thread’s plan goes stale',
                        why: 'what the thread reads once, after «plan set N turns ago». {n} = the turns.',
                    },
                    {
                        control: { kind: 'text', needs: [] },
                        default: '',
                        key: 'stash.orbit.text.lane-stale',
                        title: 'when a lane goes stale',
                        why: 'what its coordinator reads once. {id} = the lane, {title} = its name, {n} = the turns, {tool} = the orbit tool.',
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
                        title: 'lane idle alarm after',
                        why: 'how long every member of a lane sits idle before its coordinator hears about it',
                    },
                ],
            },
        ],
        icon: '🧩',
        id: 'cc',
        title: 'claude code mods',
    },
    {
        about: 'every x-herdr key, written into herdr’s keys.json beside herdr’s own',
        groups: [],
        icon: '⌨️',
        id: 'keys',
        title: 'keys',
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
