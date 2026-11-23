import type { On } from 'claude-code';
import { type Engine, test as hostTest } from 'claude-code/testing';

// a test file takes the whole kit from here, so its own `test` is never the one that boots the mod per row
export { type Engine, expect, mock } from 'claude-code/testing';

// the rows of one test file share one host boot: the first row boots the mod and runs every row in turn, each with hooks,
// `$.state` and timers of its own; a quit between two rows gives the module variables back (session-reset.ts). each row
// stays a test of its own that reads its verdict, so a red names its row. a row with no `$` never boots and runs as is
const PLUGIN = 'x-mod-redact';

// twin shared-boot — every mod's tests/ holds a copy, the mod's name above it alone its own
// the kit's own bound on a row, which a shared row keeps
const ROW_MS = 5_000;
const FILE_MS = 280_000;
// every event a row may hook: a host hook cannot be added once the mod runs, so each is hooked at the boot
const DOORS = [
    'classic.Stop',
    'clock.after',
    'clock.every',
    'clock.now',
    'clock.sleep',
    'command.list',
    'command.register',
    'command.run',
    'env.get',
    'fs.exists',
    'fs.list',
    'fs.read',
    'fs.stat',
    'fs.write',
    'process.run',
    'prompt.submit',
    'session.append',
    'session.attach',
    'session.compact',
    'session.cwd',
    'session.detach',
    'session.end',
    'session.id',
    'session.measure',
    'session.receive',
    'session.repo',
    'session.root',
    'session.send',
    'session.start',
    'session.usage',
    'settings.read',
    'skill.prompt',
    'state.get',
    'state.set',
    'store.delete',
    'store.get',
    'store.keys',
    'store.set',
    'tool.call',
    'tool.register',
    'turn.abort',
    'turn.complete',
    'turn.start',
    'ui.close',
    'ui.log',
    'ui.notify',
    'ui.open',
    'ui.panes',
    'ui.render',
    'ui.toast',
];
// the one event whose hook streams
const STEP = 'turn.step';
// a timer stays open past its row: the row's own clock holds it, and that clock moves no more
const TIMERS = new Set(['clock.after', 'clock.every', 'clock.sleep']);
// the kit runs real timers and types none
const { clearTimeout, setTimeout } = globalThis as never as Timers;
// what the host answers the quit between two rows, when no row's hooks do; a door not named here is refused
const BETWEEN: Record<string, unknown> = {
    'clock.now': { value: 0 },
    'env.get': { value: undefined },
    'fs.exists': { value: false },
    'process.run': {
        value: {
            exitCode: 1,
            isStderrTruncated: false,
            isStdoutTruncated: false,
            stderr: '',
            stdout: '',
        },
    },
    'session.id': { value: 'row' },
    'store.delete': { value: undefined },
    'store.get': { value: undefined },
    'store.keys': { value: [] },
    'store.set': { value: undefined },
};
const rows: Row[] = [];

export function test(name: string, ...rest: [Body] | [Options, Body]) {
    const body = rest.at(-1) as Body;
    const options = rest.length > 1 ? (rest[0] as Options) : {};
    if (!body.length) return hostTest(name, options, body as never);
    const row: Row = { body, ms: options.timeoutMs ?? ROW_MS };
    rows.push(row);
    const verdict = () => {
        if (!row.isOver) throw new Error('the shared boot never ran this row');
        if (row.failure) throw row.failure.error;
    };
    if (rows.length > 1) return hostTest(name, verdict);
    hostTest(name, { timeoutMs: FILE_MS }, async ($, on) => {
        await runRows($, on);
        verdict();
    });
}

async function runRows($: Engine, on: On) {
    const world = hookDoors(on);
    for (const row of rows) {
        const rowOn = world.begin();
        const { engine, unmountAll } = withMounts($);
        try {
            await bounded(Promise.resolve(row.body(engine, rowOn)), row.ms);
        } catch (error) {
            row.failure = { error };
        }
        row.isOver = true;
        await unmountAll();
        await world.settle();
        world.between();
        await quit($);
        await world.settle();
    }
}

// each door answers through the hooks of the row that runs now, newest last; beneath them `$.state` starts empty each row
function hookDoors(on: On) {
    let hooks = new Map<string, Hooked[]>();
    let state = new Map<string, { value: unknown; version: number }>();
    let inFlight = 0;
    const hookAny = on as never as (event: string, hook: unknown) => void;
    for (const event of DOORS)
        hookAny(event, (host: unknown, e: Input, next: Next) => {
            const mine = hooksOf(event, e);
            const base = isBetween
                ? between(event)
                : beneath(event, next, state);
            const at = (i: number, input: Input): unknown => {
                const hook = mine[i];
                if (!hook) return base(input);
                const below = (n: Input) => at(i + 1, n);
                const { origin, signal, to } = next;
                return hook(
                    host,
                    input,
                    Object.assign(below, { origin, signal, to }),
                );
            };
            const answer = at(0, e);
            if (TIMERS.has(event) || !(answer instanceof Promise))
                return answer;
            inFlight += 1;
            return answer.finally(() => {
                inFlight -= 1;
            });
        });
    hookAny(
        STEP,
        async function* (host: unknown, e: Input, next: Next): Stream {
            const hook = hooksOf(STEP, e)[0] as Streams | undefined;
            return yield* hook ? hook(host, e, next) : (next(e) as Stream);
        },
    );
    function hooksOf(event: string, e: Input) {
        return (hooks.get(event) ?? [])
            .filter(
                ({ match }) =>
                    !match ||
                    Object.entries(match).every(([k, v]) => e[k] === v),
            )
            .map(({ hook }) => hook);
    }
    let isBetween = false;
    const begin = () => {
        const here = new Map<string, Hooked[]>();
        hooks = here;
        state = new Map();
        isBetween = false;
        const rowOn = (event: string, ...rest: unknown[]) => {
            if (event !== STEP && !DOORS.includes(event))
                throw new Error(`shared-boot.ts has no door for ${event}`);
            const hook = rest.at(-1) as Hook;
            const match = rest.length > 1 ? (rest[0] as Input) : undefined;
            here.set(event, [...(here.get(event) ?? []), { hook, match }]);
        };
        return rowOn as never as On;
    };
    return {
        begin,
        between: () => {
            begin();
            isBetween = true;
        },
        // the row's own work runs out: no door call open over two turns of the event loop, or forty turns
        settle: async () => {
            for (let quiet = 0, n = 0; quiet < 4 && n < 40; n++) {
                await new Promise((resolve) => setTimeout(resolve, 0));
                quiet = inFlight ? 0 : quiet + 1;
            }
        },
    };
}

function between(event: string) {
    return (e: Input): unknown =>
        event === 'session.end'
            ? { sessionId: e.sessionId }
            : (BETWEEN[event] ?? { deny: 'no row runs' });
}

// what the host answers past the row's hooks: `$.state` is the row's own and still redraws
function beneath(
    event: string,
    next: Next,
    state: Map<string, { value: unknown; version: number }>,
) {
    return (e: Input): unknown => {
        if (e.plugin !== PLUGIN) return next(e);
        const key = String(e.key);
        const { value, version } = state.get(key) ?? {
            value: undefined,
            version: 0,
        };
        if (event === 'state.get')
            return Promise.resolve(next(e)).then(() => ({
                value: { value, version },
            }));
        if (event !== 'state.set') return next(e);
        const { ifVersion, ...plain } = e;
        if (ifVersion !== undefined && ifVersion !== version)
            return { value: { isSet: false, version } };
        state.set(key, { value: e.value, version: version + 1 });
        return Promise.resolve(next(plain)).then(() => ({
            value: { isSet: true, version: version + 1 },
        }));
    };
}

function quit($: Engine) {
    return $.session
        .end({ reason: 'other', resume: {}, sessionId: 'row' } as never)
        .catch(() => undefined);
}

// the row's engine, each drawing it mounts taken down with it
function withMounts($: Engine) {
    const mounted: { unmount: () => Promise<unknown> }[] = [];
    const ui = {
        ...copyOf($.ui),
        mount: async (what: never) => {
            const drawing = await $.ui.mount(what);
            mounted.push(drawing as never);
            return drawing;
        },
    };
    return {
        engine: { ...copyOf($), ui } as never as Engine,
        unmountAll: async () => {
            for (const drawing of mounted)
                await drawing.unmount().catch(() => undefined);
        },
    };
}
const copyOf = (nouns: object) =>
    Object.fromEntries(Object.keys(nouns).map((k) => [k, (nouns as Input)[k]]));

function bounded(work: Promise<unknown>, ms: number) {
    let timer = 0;
    const late = new Promise((_, reject) => {
        timer = setTimeout(
            () => reject(new Error(`timed out after ${ms} ms`)),
            ms,
        );
    });
    return Promise.race([work, late]).finally(() => clearTimeout(timer));
}

/* Types */
type Body = ($: Engine, on: On) => unknown;
type Options = { timeoutMs?: number };
type Row = {
    body: Body;
    failure?: { error: unknown };
    isOver?: boolean;
    ms: number;
};
type Timers = {
    clearTimeout: (timer: number) => void;
    setTimeout: (job: (value?: unknown) => void, ms: number) => number;
};
type Input = Record<string, unknown>;
type Next = ((e: Input) => unknown) & {
    origin?: unknown;
    signal?: unknown;
    to?: unknown;
};
type Hook = (host: unknown, e: Input, next: Next) => unknown;
type Hooked = { hook: Hook; match?: Input };
type Stream = AsyncGenerator<unknown, unknown, unknown>;
type Streams = (host: unknown, e: Input, next: Next) => Stream;
// twin end
