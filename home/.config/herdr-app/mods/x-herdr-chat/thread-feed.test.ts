import { beforeEach, expect, test, vi } from 'vitest';

// FRM-585 A2: a note of the thread shown hears of its thread's state and of its line landing, and of no other thread's
const at = vi.hoisted(() => ({
    joined: null as string | null,
    joinedText: '',
    lines: [] as { id: string; isWaiting?: boolean; text: string }[],
    place: null as { id: string; offset: number } | null,
    /** the text of the row he reads before an older page joins it, and after */
    readText: '',
    state: null as object | string | null,
    /** resolves the pending wait for a change of each folder */
    touch: new Map<string, () => void>(),
}));
vi.mock('gpui-kit', () => ({ View: class {}, div: () => null }));
vi.mock('gpui-base', () => ({
    Textarea: {},
    TextareaState: {},
    VirtualListScrollHandle: {},
    h_flex: () => null,
    v_flex: () => null,
}));
vi.mock('fs/promises', () => ({ readdir: async () => ['11.json', '22.json'] }));
vi.mock('herdr', () => ({
    appHome: () => '/app',
    exec: async () => ({
        code: 0,
        stdout: '11 01:00 claude HC_TERMINAL_ID=t1\n22 01:00 claude HC_TERMINAL_ID=t2',
    }),
    home: () => '/h',
    readTextFile: async (path: string) => {
        const pid = /sessions\/(\d+)\.json$/.exec(path)?.[1];
        if (pid) return JSON.stringify({ cwd: '/w', sessionId: `s-${pid}` });
        if (path.endsWith('fleet.json')) return null;
        if (at.state instanceof Error) throw at.state;
        return typeof at.state === 'string'
            ? at.state
            : JSON.stringify(at.state);
    },
    watchFolder: (dir: string) =>
        Object.assign(
            new Promise((done) => at.touch.set(dir, () => done([dir]))),
            { cancel: () => {} },
        ),
}));
vi.stubGlobal('localStorage', { getItem: () => null });
vi.mock('./reader.js', () => ({
    createReader: () => ({
        readNew: async () => ({
            isRestart: false,
            lines: at.lines.splice(0),
        }),
    }),
}));
vi.mock('./pages.js', () => ({
    createPages: () => ({
        close: () => {},
        next: async () => ['a page'],
    }),
}));
const { createThreadFeed } = await import('./thread-feed.js');

const quiet = (): unknown =>
    new Proxy(() => undefined, { apply: () => quiet(), get: () => quiet() });
const tick = async () => {
    for (let i = 0; i < 80; i++) await Promise.resolve();
};
const cx = {
    notify: () => {},
    spawn: (job: (c: unknown) => unknown) => job(cx),
    timer: {
        after: (_ms: number, run: (c: unknown) => void) => run(cx),
        every: () => {},
    },
};
const STATE_DIR = '/h/.claude/shelf/herdr-state';

function world() {
    const said = {
        arrived: [] as [string, readonly { text: string }[]][],
        changed: 0,
        restored: [] as unknown[][],
        settled: [] as [string, unknown][],
    };
    const answer = { arrived: true, settle: async () => true };
    let joins: unknown = null;
    const rows: object[] = [];
    const feed: ReturnType<typeof createThreadFeed> = createThreadFeed({
        ...(Object.fromEntries(
            [
                'band',
                'findBar',
                'heights',
                'links',
                'pickers',
                'quill',
                'rows',
                'sent',
            ].map((k) => [k, quiet()]),
        ) as object),
        clearShown: () => {
            joins = null;
        },
        list: {
            land: () => {},
            placeNow: () => ({ height: 300, place: at.place }),
            reset: () => {},
            restore: (...to: unknown[]) => said.restored.push(to),
        },
        look: () => undefined,
        model: {
            add: (lines: object[]) => {
                for (const line of lines) rows.push({ kind: 'mine', ...line });
                return {
                    changed: (lines as { id: string }[]).map((l) => l.id),
                    removed: 0,
                };
            },
            // the page's last reply takes the first row in
            addEarlier: () => {
                at.joined = 'page';
            },
            indexOf: (id: string) => (id === 'l2' ? 0 : -1),
            get rows() {
                if (at.joined) return [{ id: at.joined, text: at.joinedText }];
                return at.readText ? [{ id: 'l2', text: at.readText }] : rows;
            },
        },
        notes: {
            arrived: (file: string, rows: readonly { text: string }[]) => {
                said.arrived.push([file, rows]);
                return answer.arrived;
            },
            settle: (file: string) => {
                said.settled.push([file, feed.joinsOf(file)]);
                return answer.settle();
            },
        },
        notesChanged: () => {
            said.changed += 1;
        },
        sendPath: {
            joins: () => joins,
            magic: { arrived: () => null },
            settle: () => {},
            showSettled: () => {},
            takeJoins: (next: unknown) => {
                joins = next;
            },
        },
    } as never);
    feed.start(cx as never);
    return { answer, feed, said };
}
const open = async (w: ReturnType<typeof world>, address: string) => {
    w.feed.follow(address, cx as never);
    await tick();
};

beforeEach(() => {
    at.joined = null;
    at.lines = [];
    at.state = { joins: { joined: [], taken: ['j1'] } };
    at.touch.clear();
});

test("the thread's notes settle by its state, at its opening and at each change of it", async () => {
    const w = world();
    await open(w, 't1');
    const file = w.feed.file();
    expect(file).toContain('s-11');
    expect(w.said.settled).toEqual([[file, { joined: [], taken: ['j1'] }]]);
    at.state = { joins: { joined: ['j1'], taken: [] } };
    at.touch.get(STATE_DIR)?.();
    await tick();
    expect(w.said.settled.at(-1)).toEqual([
        file,
        { joined: ['j1'], taken: [] },
    ]);
    expect(w.said.changed).toBe(2);
});

test.each([
    ['cannot be read', new Error('busy')],
    ['is half written', '{"joins":'],
])(
    'a state that %s says nothing: what it listed stands',
    async (_how, broken) => {
        const w = world();
        await open(w, 't1');
        const file = w.feed.file() ?? '';
        at.state = broken;
        at.touch.get(STATE_DIR)?.();
        await tick();
        expect([w.said.settled.length, w.feed.joinsOf(file)]).toEqual([
            1,
            { joined: [], taken: ['j1'] },
        ]);
        at.state = { joins: { joined: ['j1'], taken: [] } };
        at.touch.get(STATE_DIR)?.();
        await tick();
        expect(w.said.settled).toHaveLength(2);
    },
);

test('a thread with no state file takes no joins', async () => {
    const w = world();
    at.state = null;
    await open(w, 't1');
    expect(w.feed.joinsOf(w.feed.file() ?? '')).toBeNull();
});

test('a state that moved no note says nothing', async () => {
    const w = world();
    w.answer.settle = async () => false;
    await open(w, 't1');
    expect([w.said.settled.length, w.said.changed]).toEqual([1, 0]);
});

test('what its state lists of its joins is unknown until it is read, and of another thread’s always', async () => {
    const w = world();
    await open(w, 't1');
    const first = w.feed.file() ?? '';
    expect(w.feed.joinsOf(first)).toEqual({ joined: [], taken: ['j1'] });
    w.feed.follow('t2', cx as never);
    while (!w.feed.file()?.includes('s-22')) await Promise.resolve();
    const second = w.feed.file() ?? '';
    expect(w.feed.joinsOf(second)).toBeUndefined();
    await tick();
    expect(w.feed.joinsOf(second)).toEqual({ joined: [], taken: ['j1'] });
    expect(w.feed.joinsOf(first)).toBeUndefined();
});

test('an answer that comes after he left the thread says nothing in the next one', async () => {
    const w = world();
    let done = (_is: boolean) => {};
    w.answer.settle = () =>
        new Promise((resolve) => {
            done = resolve;
        });
    await open(w, 't1');
    w.answer.settle = async () => false;
    await open(w, 't2');
    done(true);
    await tick();
    expect(w.said.changed).toBe(0);
});

test('his messages as they land, words that joined marked, never one still in the queue', async () => {
    const w = world();
    await open(w, 't1');
    const dir = [...at.touch.keys()].find((d) => d !== STATE_DIR) ?? '';
    const changed = w.said.changed;
    at.lines = [
        { id: 'a', isJoin: true, text: 'a line' },
        { id: 'b', isWaiting: true, text: 'queued' },
    ];
    at.touch.get(dir)?.();
    await tick();
    expect(w.said.arrived).toEqual([
        [
            w.feed.file(),
            [expect.objectContaining({ isJoin: true, text: 'a line' })],
        ],
    ]);
    expect(w.said.changed).toBe(changed + 1);
    w.answer.arrived = false;
    at.lines = [{ id: 'c', text: 'another' }];
    at.touch.get(dir)?.();
    await tick();
    expect([w.said.arrived.length, w.said.changed]).toEqual([2, changed + 1]);
});

test.each([
    ['a reply', 'l2', ['page', 0, 260]],
    ['a note under it', 'l2#note-n1', ['page#note-n1', 40]],
    ['a file under it', 'l2#file-0', ['page#file-0', 40]],
    ['a row the page left alone', 'l9', ['l9', 40]],
])(
    'an older page that joins the row he reads keeps his place on %s',
    async (_what, id, to) => {
        const w = world();
        await open(w, 't1');
        at.place = { id, offset: 40 };
        w.feed.loadEarlier(cx as never);
        await tick();
        expect(w.said.restored).toEqual([to]);
    },
);

// the 🔎's round 1 on slice B: the page's own files come first in the joined row
test('an older page that brings a file above the row he reads keeps his place on the same file', async () => {
    const w = world();
    await open(w, 't1');
    at.readText = 'see [a](file:///tmp/a.md)';
    at.joinedText = `see [b](file:///tmp/b.md)\n\n${at.readText}`;
    at.place = { id: 'l2#file-0', offset: 40 };
    w.feed.loadEarlier(cx as never);
    await tick();
    expect(w.said.restored).toEqual([['page#file-1', 40]]);
    at.readText = '';
    at.joinedText = '';
});
