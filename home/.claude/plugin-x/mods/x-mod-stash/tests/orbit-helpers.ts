import type { On } from 'claude-code';
import type { Engine } from 'claude-code/testing';

import {
    type Board,
    SID,
    add,
    board,
    endTurn,
    orbit,
    say,
    start,
    type world,
} from './orbit-world.ts';

// the steer as the session's published asks hold it, the store mirror every board reads
export const savedSteer = (store: Map<string, unknown>) =>
    (store.get(`asks:${SID}`) as { items: { steer?: string }[] } | undefined)
        ?.items[0]?.steer;

export const texts = async (ui: Board) =>
    (await ui.findAll({ type: 'Text' })).map((t) => t.text ?? '').join('\n');

export const SETTINGS = '/home/.claude/shelf/herdr-settings/settings.json';

export const typed = (rows: Record<string, string>) => ({
    [SETTINGS]: JSON.stringify({ rows, v: 1 }),
});

export const mobile = ($: Engine, args = '') =>
    $.skill.prompt({
        skill: 'x:mobile-mode',
        text: `# mobile-mode${args ? `\n\nARGUMENTS: ${args}` : ''}`,
    });

export const lastContext = (contexts: string[][]) =>
    (contexts.at(-1) ?? []).join('\n');

export const assume = ($: Engine, ...texts: string[]) =>
    orbit($, { op: 'assume', texts });

export const press = (p: Record<string, unknown>) => `${JSON.stringify(p)}\n`;

export const lines = (w: { contexts: string[][] }) =>
    (w.contexts.at(-1) ?? []).join('\n');

// the session's $.state as a map the test can wipe, as a new process starts with none
export function stateOf(on: On) {
    const state = new Map<string, unknown>();
    on('state.get', (_$, e) => ({
        value: { value: state.get(e.key), version: state.has(e.key) ? 1 : 0 },
    }));
    on('state.set', (_$, e) => {
        state.set(e.key, e.value);
        return { value: { isSet: true, version: 2 } };
    });
    on('session.end', (_$, e) => ({ sessionId: e.sessionId }));
    return state;
}

export function keptState(on: On, state: Record<string, unknown> = {}) {
    let version = 0;
    on('state.get', (_$, e) => ({
        value: { value: state[e.key], version: e.key in state ? ++version : 0 },
    }));
    on('state.set', (_$, e) => {
        state[e.key] = e.value;
        return { value: { isSet: true, version: ++version } };
    });
    return state;
}

export async function reload(
    $: Engine,
    ui: Board,
    state: Record<string, unknown>,
    card: string,
) {
    const left = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    await ui.press({ key: `fold:${card}` });
    await ui.press({ key: `fold:${card}` });
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, left);
    await start($);
    await ui.redraw();
}

export const LANES = '/home/.claude/shelf/lanes.json';

export const glide = (members: Record<string, string> = {}, id = 'l9') => ({
    [LANES]: JSON.stringify({
        lanes: [
            {
                current: 0,
                history: [],
                id,
                items: [
                    { isDone: false, text: 'a' },
                    { isDone: false, text: 'b' },
                ],
                members,
                movedAt: 0,
                title: 'reload lane',
            },
        ],
    }),
});

export const boxValue = async (ui: Board, key: string) =>
    (await ui.find({ key, type: 'Input' }))?.props.value;

export function pressRace(on: On) {
    const race = {
        frozen: undefined as unknown,
        frozenTicks: undefined as unknown,
        last: undefined as unknown,
        lastTicks: undefined as unknown,
        onLock: undefined as (() => void) | undefined,
        onWrite: undefined as (() => void) | undefined,
        orbit: undefined as
            | { asks: { id: string; isLocked?: boolean; mark?: string }[] }
            | undefined,
        ticks: [] as { id: string }[],
    };
    on('state.get', async (_$, e, next) => {
        const isOrbit = e.key === 'orbit';
        if (!isOrbit && e.key !== 'ticks') return next(e as never);
        const held = isOrbit ? race.frozen : race.frozenTicks;
        if (held) return { value: held } as never;
        const r = (await next(e as never)) as { value?: unknown };
        if (isOrbit) race.last = r.value;
        else race.lastTicks = r.value;
        return r as never;
    });
    on('state.set', async (_$, e, next) => {
        if (e.key === 'orbit') {
            const value = e.value as NonNullable<typeof race.orbit>;
            const onLock = value.asks.some((a) => a.isLocked)
                ? race.onLock
                : undefined;
            const onRace = onLock ?? race.onWrite;
            if (onRace) {
                race.onLock = undefined;
                race.onWrite = undefined;
                onRace();
                for (let i = 0; i < 2000; i++) await Promise.resolve();
            }
            race.orbit = value;
        }
        if (e.key === 'ticks') race.ticks = e.value as typeof race.ticks;
        return next(e);
    });
    return race;
}

export const askOf = (race: ReturnType<typeof pressRace>, id: string) =>
    race.orbit?.asks.find((a) => a.id === id);

// FRM-552: herdr's board writes one press per line of the session's ticks file, and stash keeps how far it read
export const HERDR_FILE = `/home/.claude/shelf/orbit-ticks/${SID}.jsonl`;

// a press herdr's board appends to this session's ticks file
export const herdrPress = (
    w: { files: Record<string, string> },
    id: string,
    p: Record<string, unknown>,
) => {
    w.files[HERDR_FILE] = `${w.files[HERDR_FILE] ?? ''}${press({ id, ...p })}`;
};

// FRM-427: dima's 🛎️ press is his word — the tick record lives in this mod's $.state, written by the press alone
export function tickLog(on: On) {
    const writes: unknown[] = [];
    on('state.set', (_$, e, next) => {
        if (e.plugin === 'x-mod-stash' && e.key === 'ticks')
            writes.push(e.value);
        return next(e);
    });
    return writes;
}

export const addLinked = ($: Engine, link: string) =>
    orbit($, {
        asks: [
            { link, pick: 'read it', text: 'the proposal for the catch kinds' },
        ],
        op: 'add',
    }) as Promise<{ deny?: string }>;

// PK-204: a resolve on a ticked ask says what shipped — «as ticked», or «changed: <what>» beside a new round
export const ticked = async ($: Engine, w: ReturnType<typeof world>) => {
    const ui = await board($);
    await add($, ['name the band', 'breathing bars']);
    await say($, 'go');
    await ui.press({ key: 'orbit:accepted:o1' });
    await w.clock.advance(5_000);
    await $.tool.call({ command: 'true', tool: 'Bash' });
    return ui;
};

export const partOff = (w: { store: Map<string, unknown> }, key: string) =>
    w.store.set('shown', { [key]: false });

export const hrefs = async (ui: {
    findAll: (q: {
        type: string;
    }) => Promise<{ props: Record<string, unknown> }[]>;
}) => (await ui.findAll({ type: 'Link' })).map((n) => n.props.href);

export const orbitNote = (w: { contexts: string[][] }) =>
    (w.contexts.at(-1) ?? []).filter((c) => c.startsWith('orbit holds'));

export const nextPrompt = async ($: Engine) => {
    await endTurn($);
    await say($, 'more');
};
