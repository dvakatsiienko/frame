// every settings row as data: key, title, a one-line why, a control, a default. a herdr mod cannot import a sibling
// mod's file, so the chatter holds every page; settings-store.js keeps their values, settings-window.js draws them.
// a row its reader does not read yet carries `isWired: false` and says so in the window

/** @typedef {{ kind: 'toggle' } | { kind: 'checks', options: { value: string, label: string, isLocked?: boolean }[] } | { kind: 'stepper', min: number, max: number, step: number, unit: string }} Control */
/** @typedef {{ key: string, title: string, why: string, control: Control, default: unknown, isWired?: boolean }} Row */
/** @typedef {{ heading: string, rows: Row[] }} Group */
/** @typedef {{ id: string, icon: string, title: string, about: string, groups: Group[] }} Page */

/** @type {Page[]} */
export const pages = [
    {
        about: 'the chat view: its band, its meters, the 🔓 press',
        groups: [
            {
                heading: '🔓 override',
                rows: [
                    {
                        control: {
                            kind: 'checks',
                            options: [
                                {
                                    label: 'every guard refusal, on until you press it off',
                                    value: 'all',
                                },
                                {
                                    isLocked: true,
                                    label: 'rm and the merge brake: these always ask you',
                                    value: 'floor',
                                },
                            ],
                        },
                        default: ['all'],
                        isWired: false,
                        key: 'chatter.override.scopes',
                        title: 'What 🔓 allows',
                        why: 'one press lets every thread past the guard, for when a guard misfires',
                    },
                ],
            },
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
                heading: 'window',
                rows: [
                    {
                        control: { kind: 'toggle' },
                        default: false,
                        key: 'chatter.fps',
                        title: 'FPS meter',
                        why: 'herdr’s own frame-rate meter over the whole window; herdr has no key for it',
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
        groups: [
            {
                heading: 'quiet comms · these push into clio’s turn',
                rows: [
                    {
                        control: { kind: 'toggle' },
                        default: true,
                        isWired: false,
                        key: 'stash.quiet.ask',
                        title: '[ask]',
                        why: 'off: a member’s question waits for clio’s next turn',
                    },
                    {
                        control: { kind: 'toggle' },
                        default: true,
                        isWired: false,
                        key: 'stash.quiet.done',
                        title: '[done]',
                        why: 'off: a finished chunk waits for clio’s next turn',
                    },
                    {
                        control: { kind: 'toggle' },
                        default: true,
                        isWired: false,
                        key: 'stash.quiet.escalate',
                        title: '[escalate]',
                        why: 'off: a stuck member waits for clio’s next turn too',
                    },
                ],
            },
            {
                heading: '🐦‍🔥 second wind',
                rows: [
                    {
                        control: {
                            kind: 'stepper',
                            max: 90,
                            min: 30,
                            step: 5,
                            unit: '%',
                        },
                        default: 55,
                        isWired: false,
                        key: 'stash.wind.notice',
                        title: 'Nudge at',
                        why: 'the context share where a thread is told a second wind is near',
                    },
                    {
                        control: {
                            kind: 'stepper',
                            max: 90,
                            min: 30,
                            step: 5,
                            unit: '%',
                        },
                        default: 65,
                        isWired: false,
                        key: 'stash.wind.must',
                        title: 'Must at',
                        why: 'the context share where the thread winds before its next step',
                    },
                ],
            },
        ],
        icon: '🧩',
        id: 'cc',
        title: 'Claude Code mods',
    },
];

/** @type {Row[]} */
export const settingRows = pages.flatMap((p) =>
    p.groups.flatMap((g) => g.rows),
);
