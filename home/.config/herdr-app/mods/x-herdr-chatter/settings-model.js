// every settings row as data: key, title, a one-line why, a control, a default. a herdr mod cannot import a sibling
// mod's file, so the chatter holds every page; settings-store.js keeps their values, settings-window.js draws them.
// a row joins only once its mod acts on it

/** @typedef {{ kind: 'toggle' } | { kind: 'checks', options: { value: string, label: string, isLocked?: boolean }[] } | { kind: 'stepper', min: number, max: number, step: number, unit: string } | { kind: 'text', needs: string[] }} Control */
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
                        title: '🗓 week turns amber at',
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
        groups: [
            {
                heading: '🐦‍🔥 second wind',
                rows: [
                    {
                        control: { kind: 'toggle' },
                        default: true,
                        key: 'stash.second-wind',
                        title: 'Second wind',
                        why: 'a thread can refresh its context onto its own handoff; off, 🐦‍🔥 is gone everywhere',
                    },
                    {
                        control: { kind: 'toggle' },
                        default: true,
                        key: 'stash.second-wind-auto',
                        title: 'Auto second wind',
                        why: 'threads are told and asked by themselves at the two lines below; each thread’s 🍃 can still opt out',
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
                        title: 'Notice at',
                        why: 'how full a thread’s context gets before it hears a second wind is coming',
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
                        title: 'Wind at',
                        why: 'how full it gets before the thread is asked for its second wind',
                    },
                    {
                        control: { kind: 'text', needs: WIND_WORDS },
                        default: '',
                        key: 'stash.wind.text.press',
                        title: 'When I press 🐦‍🔥',
                        why: 'what a thread reads when you press its 🐦‍🔥; the auto path never uses it, and written here the coordinator reads it too',
                    },
                    {
                        control: { kind: 'text', needs: WIND_WORDS },
                        default: '',
                        key: 'stash.wind.text.notice',
                        title: 'Auto: at the notice line',
                        why: 'what a thread reads by itself when it crosses «Notice at»; {fill} and {wind} become its numbers',
                    },
                    {
                        control: { kind: 'text', needs: WIND_WORDS },
                        default: '',
                        key: 'stash.wind.text.at',
                        title: 'Auto: at the wind line, the ask',
                        why: 'what a thread reads by itself when it crosses «Wind at»; written here, the coordinator reads it too, in place of her own',
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

/** @type {Row[]} */
export const settingRows = pages.flatMap((p) =>
    p.groups.flatMap((g) => g.rows),
);
