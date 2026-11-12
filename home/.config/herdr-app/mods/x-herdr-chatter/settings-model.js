// every settings row as data: key, title, a one-line why, a control, a default. a herdr mod cannot import a sibling
// mod's file, so the chatter holds every page; settings-store.js keeps their values, settings-window.js draws them.
// a row joins only once its mod acts on it

/** @typedef {{ kind: 'toggle' } | { kind: 'checks', options: { value: string, label: string, isLocked?: boolean }[] } | { kind: 'stepper', min: number, max: number, step: number, unit: string }} Control */
/** @typedef {{ key: string, title: string, why: string, control: Control, default: unknown }} Row */
/** @typedef {{ heading: string, rows: Row[] }} Group */
/** @typedef {{ id: string, icon: string, title: string, about: string, groups: Group[] }} Page */

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
                        title: '🗓 week turns amber at',
                        why: 'how much of the weekly usage is spent before its bar warns you',
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
        title: 'Chatter',
    },
    {
        about: 'the fleet board beside your threads',
        groups: [],
        icon: '🚦',
        id: 'deck',
        title: 'Deck',
    },
    {
        about: 'the tab bar on top',
        groups: [],
        icon: '🗂',
        id: 'tabs',
        title: 'Tabs',
    },
    {
        about: 'x-mod-stash inside every Claude Code thread; its own 🎛️ pane keeps working as your fallback',
        groups: [],
        icon: '🧩',
        id: 'cc',
        title: 'Claude Code mods',
    },
];

/** @type {Row[]} */
export const settingRows = pages.flatMap((p) =>
    p.groups.flatMap((g) => g.rows),
);
