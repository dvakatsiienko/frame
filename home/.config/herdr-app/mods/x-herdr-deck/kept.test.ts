import { describe, expect, test, vi } from 'vitest';

// herdr's one JavaScript runtime, by its source (0.1.18 vendor/gpui-kit/crates/shell engine/quickjs scheduler.rs, scope.rs):
// `localStorage` is the store of the copy whose call is on the stack; a native call keeps the copy it was made under and
// its answer runs there; but what `init` left queued runs inside the next call, whichever mod's
const at = vi.hoisted(() => ({
    files: new Map<string, string>(),
    /** native calls and timers on their way */
    inFlight: 0,
    isFolderDown: false,
    psCodes: [] as number[],
    scope: 'deck',
    stores: { deck: {}, other: {} } as Record<string, Record<string, string>>,
}));
const native = <T>(answer: () => T) => {
    const made = at.scope;
    at.inFlight += 1;
    return new Promise<T>((done, fail) =>
        setTimeout(() => {
            at.inFlight -= 1;
            at.scope = made;
            try {
                done(answer());
            } catch (err) {
                fail(err);
            }
        }, 0),
    );
};
type Handler = (e: unknown, cx: unknown) => void;
const boxes: { on: Map<string, Handler>; value: () => string }[] = [];

vi.mock('herdr', () => ({
    agents: () => [],
    appHome: () => '/app',
    exec: () =>
        native(() => ({
            code: at.psCodes.shift() ?? 0,
            stderr: '',
            stdout: '7 Wed Nov 25 10:00:00 2026\n8 Wed Nov 25 10:00:00 2026',
        })),
    home: () => '/Users/me',
    layout: () => null,
    nextCommand: () => new Promise(() => {}),
    notify: vi.fn(),
    props: () => null,
    readTextFile: (path: string) => native(() => at.files.get(path) ?? null),
    run: vi.fn(),
    setShared: vi.fn(),
    shared: () => null,
    theme: () => ({}),
    watchFolder: () => new Promise(() => {}),
    writeTextFile: vi.fn(),
}));
vi.mock('fs/promises', () => ({
    readdir: () =>
        native(() => {
            if (at.isFolderDown) throw new Error('EMFILE');
            return ['a.json'];
        }),
    unlink: async () => {},
}));
vi.mock('gpui-kit', () => ({ View: class {}, div: vi.fn() }));
vi.mock('gpui-base', () => ({
    InputState: {
        new: ({ value }: { value: string }) => {
            const made = at.scope;
            let text = value;
            const on = new Map<string, Handler>();
            const box = {
                on: (name: string, handler: Handler) =>
                    on.set(name, (e, cx) => {
                        at.scope = made;
                        handler(e, cx);
                    }),
                set_value: (next: string) => {
                    text = next;
                },
                value: () => text,
            };
            boxes.push({ on, value: () => text });
            return box;
        },
    },
}));
vi.stubGlobal('localStorage', {
    getItem: (key: string) => at.stores[at.scope]?.[key] ?? null,
    key: (i: number) => Object.keys(at.stores[at.scope] ?? {})[i] ?? null,
    get length() {
        return Object.keys(at.stores[at.scope] ?? {}).length;
    },
    removeItem: (key: string) => delete at.stores[at.scope]?.[key],
    setItem: (key: string, value: string) => {
        at.stores[at.scope] = { ...at.stores[at.scope], [key]: value };
    },
});

const { default: Deck } = await import('./main.js');

const cx: Record<string, unknown> = {
    bind_keys: () => {},
    notify: () => {},
    on_action: () => {},
    spawn: (run: (c: unknown) => Promise<void>) => void run(cx),
    timer: {
        after: (ms: number, run: (c: unknown) => void) => {
            const made = at.scope;
            // a retry seconds away is not waited for
            const weight = ms <= 100 ? 1 : 0;
            at.inFlight += weight;
            let isOver = false;
            const end = () => {
                if (!isOver) at.inFlight -= weight;
                isOver = true;
            };
            const id = setTimeout(() => {
                end();
                at.scope = made;
                run(cx);
            }, ms);
            return {
                cancel: () => {
                    clearTimeout(id);
                    end();
                },
            };
        },
        every: () => ({ cancel() {} }),
    },
};

/** every read asked for has answered, and what its answer asked for too, however slow the mac */
async function settled() {
    for (let calm = 0; calm < 5; calm = at.inFlight ? 0 : calm + 1)
        await new Promise((done) => setTimeout(done, 0));
}

/** a deck landed over what the last one kept */
function landed(plan: string[] = []) {
    const shelf = '/Users/me/.claude/shelf';
    at.files.set(
        `${shelf}/threads.json`,
        JSON.stringify({
            threads: [{ name: 'clio', pid: 7, sessionId: 'a' }],
        }),
    );
    at.files.set(
        `${shelf}/herdr-state/a.json`,
        JSON.stringify({
            asks: [{ id: 'o1', pick: 'yes', text: 'look: the card' }],
            at: 1,
            pid: 7,
            plan: { lines: plan },
            sid: 'a',
        }),
    );
    at.stores = { deck: {}, other: {} };
    at.stores.deck = {
        seen: JSON.stringify({ 'a:o1': 'look: the card\nyes' }),
        'steer-files:a:o1': '["/tmp/shot.png"]',
        'steer:a:o1': 'my unsent words',
        'steer:a:plan': 'my phases words',
        updated: JSON.stringify(['a:o1']),
    };
    const deck = new Deck() as unknown as {
        init: (props: unknown, cx: unknown) => void;
        rows: { asks: unknown[]; phases: string[] }[];
        steers: Map<string, { value: () => string }>;
        updated: Set<string> | null;
    };
    deck.init({}, cx);
    return deck;
}

// dima's board, 2026-11-25: after a deck landing a steer drew empty (13:44) and a 🆕 was gone (14:08), both still kept
test('a deck landed again draws the steer and the 🆕 it kept, and keeps what he types next', async () => {
    const deck = landed();
    // init's own call is over: the next one to run is another mod's
    at.scope = 'other';
    await settled();

    expect(deck.steers.get('a:o1')?.value()).toBe('my unsent words');
    expect([...(deck.updated ?? [])]).toEqual(['a:o1']);
    expect(at.stores.other).toEqual({});

    const box = boxes.at(-1);
    at.stores.deck['steer:a:o1'] = '';
    box?.on.get('change')?.({}, cx);
    expect(at.stores.deck['steer:a:o1']).toBe('my unsent words');
});

// sixth sense, round 1: a landing whose first ps failed wiped every 🆕
test('a first read that fails wipes nothing the deck kept', async () => {
    at.scope = 'deck';
    at.psCodes = [2];
    const deck = landed();
    await settled();
    expect(deck.updated).toBe(null);
    expect(at.stores.deck).toMatchObject({
        seen: JSON.stringify({ 'a:o1': 'look: the card\nyes' }),
        'steer:a:o1': 'my unsent words',
        updated: JSON.stringify(['a:o1']),
    });

    const again = deck as unknown as { reload: (c: unknown) => void };
    again.reload(cx);
    await settled();
    expect([...(deck.updated ?? [])]).toEqual(['a:o1']);
    expect(deck.steers.get('a:o1')?.value()).toBe('my unsent words');
});

// sixth sense, round 2: a state file read half-written took every ask of its thread as left, his typed steer with it
describe.each([
    ['half-written', true],
    ['in a folder that did not answer', false],
])('a state file %s', (_what, isHalf) => {
    const STATE = '/Users/me/.claude/shelf/herdr-state/a.json';
    const readAgain = async (deck: unknown) => {
        (deck as { reload: (c: unknown) => void }).reload(cx);
        await settled();
    };
    const breakIt = (isBroken: boolean, whole: string) => {
        if (isHalf) at.files.set(STATE, isBroken ? whole.slice(0, 20) : whole);
        else at.isFolderDown = isBroken;
    };

    test('wipes nothing kept for its thread, its asks and the phases stay drawn', async () => {
        at.scope = 'deck';
        const deck = landed(['step one']);
        await settled();
        expect(deck.steers.get('a:plan')?.value()).toBe('my phases words');
        const whole = at.files.get(STATE) ?? '';

        breakIt(true, whole);
        await readAgain(deck);
        expect(deck.rows[0]?.asks).toHaveLength(1);
        expect(deck.rows[0]?.phases).toEqual(['step one']);
        breakIt(false, whole);
        await readAgain(deck);

        expect(deck.steers.get('a:o1')?.value()).toBe('my unsent words');
        expect(deck.steers.get('a:plan')?.value()).toBe('my phases words');
        expect([...(deck.updated ?? [])]).toEqual(['a:o1']);
        expect(at.stores.deck).toMatchObject({
            'steer-files:a:o1': '["/tmp/shot.png"]',
            'steer:a:o1': 'my unsent words',
            'steer:a:plan': 'my phases words',
        });
    });

    test('at the landing’s own first read wipes nothing either', async () => {
        at.scope = 'deck';
        const deck = landed(['step one']);
        const whole = at.files.get(STATE) ?? '';
        breakIt(true, whole);
        await settled();
        breakIt(false, whole);
        await readAgain(deck);

        expect(deck.steers.get('a:o1')?.value()).toBe('my unsent words');
        expect(deck.steers.get('a:plan')?.value()).toBe('my phases words');
        expect([...(deck.updated ?? [])]).toEqual(['a:o1']);
        expect(at.stores.deck).toHaveProperty('steer-files:a:o1');
    });
});

test('a thread back under a new pid, its state file half-written, loses no box and no press on its way', async () => {
    at.scope = 'deck';
    const deck = landed(['step one']) as ReturnType<typeof landed> & {
        planSent: Map<string, number>;
        pressMade: (cx: unknown, key: string, act: string, at: number) => void;
        presses: Map<string, unknown>;
        reload: (c: unknown) => void;
    };
    await settled();
    deck.pressMade(cx, 'a:o1', 'tick', Date.now());
    deck.planSent.set('a', Date.now());
    const shelf = '/Users/me/.claude/shelf';
    at.files.set(`${shelf}/herdr-state/a.json`, '{"asks":[{"id":');
    at.files.set(
        `${shelf}/threads.json`,
        JSON.stringify({
            threads: [{ name: 'clio', pid: 8, sessionId: 'a' }],
        }),
    );
    deck.reload(cx);
    await settled();
    expect(deck.steers.get('a:o1')?.value()).toBe('my unsent words');
    expect(deck.steers.get('a:plan')?.value()).toBe('my phases words');
    expect(deck.presses.has('a:o1')).toBe(true);
    expect(deck.planSent.has('a')).toBe(true);
});

test('an ask that left for real takes its steer, its files and its 🆕 with it', async () => {
    at.scope = 'deck';
    const deck = landed([]);
    await settled();
    at.files.set(
        '/Users/me/.claude/shelf/herdr-state/a.json',
        JSON.stringify({ asks: [], at: 2, pid: 7, sid: 'a' }),
    );
    (deck as unknown as { reload: (c: unknown) => void }).reload(cx);
    await settled();
    expect(deck.steers.has('a:o1')).toBe(false);
    expect(at.stores.deck).not.toHaveProperty('steer:a:o1');
    expect([...(deck.updated ?? [])]).toEqual([]);
});
