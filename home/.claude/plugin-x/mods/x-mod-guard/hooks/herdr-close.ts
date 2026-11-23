import type { EngineInterface } from 'claude-code';

import { commandsDeep } from './rules/command.ts';
import {
    type HerdrClose,
    herdrCloseKey,
    herdrCloseOf,
    isClioSeat,
    isHerdrTabNew,
} from './rules/herdr-close.ts';

// the herdr closes on the line that end no live seat: herdr names every terminal each one ends, and none carries a
// `seat=` label or runs a claude agent this seat did not start; a terminal that finished ends nothing. a close herdr
// cannot answer for stays out, so it is refused (dima's o53). a clio seat ends any seat but a clio's, and a lead the seat
// it labelled `lead=<its own HC_TERMINAL_ID>` (FRM-574 decided 1; the id herdr set, never a registry name a seat can
// write); a clio seat is ended by none
export async function herdrSafeOf(
    $: EngineInterface,
    command: string,
    cwd: string,
) {
    const safe = new Set<string>();
    const closes = commandsDeep(command, cwd).flatMap((c) => {
        const close = herdrCloseOf(c);
        return close?.target &&
            !close.target.includes('$') &&
            ['overlay', 'pane', 'space', 'tab', 'terminal'].includes(
                close.scope,
            )
            ? [close]
            : [];
    });
    if (!closes.length) return safe;
    // an overlay close is safe on what herdr lists open; a mod toggle on a mod not open opens it
    const status = closes.some((c) => c.scope === 'overlay')
        ? await herdrJson($, ['herdr-app', 'status'])
        : undefined;
    const open: unknown[] = Array.isArray(status?.overlays)
        ? status.overlays
        : [];
    for (const close of closes.filter((c) => c.scope === 'overlay'))
        if (
            status &&
            (close.verb === 'herdr-app do mod.open' ||
                open.some(
                    (o) =>
                        o === close.target ||
                        (typeof o === 'object' &&
                            o !== null &&
                            ((o as { id?: unknown }).id === close.target ||
                                (o as { name?: unknown }).name ===
                                    close.target)),
                ))
        )
            safe.add(herdrCloseKey(close));
    const self = await $.env.get('HC_TERMINAL_ID').catch(() => undefined);
    const isClio = await isClioCaller($, self);
    const window = closes.some((c) => c.scope !== 'terminal')
        ? await herdrJson($, ['herdr-app', 'ls'])
        : undefined;
    const { value: made = [] } = await $.state
        .get(TABS_MADE)
        .catch(() => ({ value: [] }));
    for (const close of closes.filter((c) => c.scope !== 'overlay')) {
        const terminals = terminalsOf(close, window, made);
        if (!terminals) continue;
        let isSafe = true;
        for (const t of terminals) {
            const got = await herdrJson($, ['hc', 'get', t, '--json']);
            if (!got) {
                isSafe = false;
                continue;
            }
            if (got.state !== 'live') continue;
            const seat = got.labels?.seat;
            if (isClioSeat(seat)) {
                isSafe = false;
                continue;
            }
            if (isClio || (self !== undefined && got.labels?.lead === self))
                continue;
            if (
                typeof seat === 'string' ||
                (/claude/.test(
                    `${got.status?.app ?? ''} ${got.argv?.[0] ?? ''}`,
                ) &&
                    got.parent !== self)
            )
                isSafe = false;
        }
        if (isSafe) safe.add(herdrCloseKey(close));
    }
    return safe;
}
// this seat's own terminal, as herdr labels it; an env with no terminal, or one herdr cannot read, is no clio
async function isClioCaller($: EngineInterface, self: string | undefined) {
    if (!self) return false;
    const got = await herdrJson($, ['hc', 'get', self, '--json']);
    return got?.state === 'live' && isClioSeat(got.labels?.seat);
}
// the tabs this seat's own tab.new printed (r1, sixth sense's spec read: a mod-only tab closes on its owner's command
// only, so one of dima's mod panels in a tab of its own stays his); a line that echoes a tab id beside a tab.new can
// still claim one, a local guard's limit
const TABS_MADE = { key: 'tabsMade', plugin: 'x-mod-guard' } as const;
export async function keepTabsMade(
    $: EngineInterface,
    command: string,
    cwd: string,
    text: unknown,
) {
    if (typeof text !== 'string') return;
    if (!commandsDeep(command, cwd).some(isHerdrTabNew)) return;
    const ids = [...text.matchAll(/"tab":\s*"(tb[0-9a-f]+)"/g)].flatMap((m) =>
        m[1] ? [m[1]] : [],
    );
    if (!ids.length) return;
    const { value: made = [] } = await $.state.get(TABS_MADE);
    await $.state.set(TABS_MADE, [...made, ...ids].slice(-50));
}
type HerdrWindow = {
    spaces?: {
        id?: string;
        tabs?: {
            id?: string;
            terminals?: { pane?: string; terminal?: string }[];
        }[];
    }[];
};
// the terminals a close ends, as the window lists them; undefined when its target is not there
function terminalsOf(
    close: HerdrClose,
    window: HerdrWindow | undefined,
    made: string[] = [],
) {
    if (close.scope === 'terminal')
        return close.target ? [close.target] : undefined;
    const spaces = window?.spaces ?? [];
    const tabs = spaces
        .flatMap((s) =>
            close.scope === 'space' && s.id !== close.target
                ? []
                : (s.tabs ?? []),
        )
        .filter((t) => close.scope !== 'tab' || t.id === close.target);
    const terminals = tabs
        .flatMap((t) => t.terminals ?? [])
        .filter((t) => close.scope !== 'pane' || t.pane === close.target)
        .flatMap((t) => (t.terminal ? [t.terminal] : []));
    // a tab herdr lists with no terminal holds only mods, so its close ends none, the seat's own tab.new tab alone (r1: a
    // pin-probe tab); a pane herdr never lists a mod's, so an empty pane or space stays unnamed
    // only a whole listing counts: a tab with no `terminals` array, or an entry with no terminal id, is unread
    const isWhole = tabs.every(
        (t) =>
            Array.isArray(t.terminals) &&
            t.terminals.every((x) => typeof x.terminal === 'string'),
    );
    const isNamed =
        isWhole &&
        close.scope === 'tab' &&
        tabs.length > 0 &&
        made.includes(close.target ?? '');
    return terminals.length || isNamed ? terminals : undefined;
}
async function herdrJson($: EngineInterface, argv: string[]) {
    const run = await $.process
        .run(argv, { timeoutMs: 3000 })
        .catch(() => undefined);
    if (run?.exitCode !== 0) return undefined;
    try {
        return JSON.parse(run.stdout);
    } catch {
        return undefined;
    }
}
