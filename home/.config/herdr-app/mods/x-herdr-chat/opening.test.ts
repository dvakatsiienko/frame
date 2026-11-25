import { beforeEach, describe, expect, test, vi } from 'vitest';

// FRM-620:W84: a thread he switches to is opening until it can be written to, and his caret waits where he left it
const at = vi.hoisted(() => ({
    isPsDown: false,
    isReadDown: false,
    notified: 0,
    /** each terminal's Claude, as its environment names it */
    pids: new Map<number, string>(),
    sessions: new Map<string, string>(),
}));
vi.mock('gpui-kit', () => ({ View: class {}, div: () => null }));
vi.mock('gpui-base', () => ({
    Textarea: {},
    TextareaState: {
        new: () => {
            let range = { end: 0, start: 0 };
            let text = '';
            return {
                on: () => {},
                selected_range: () => range,
                set_auto_grow: () => {},
                set_selected_range: (next: typeof range) => {
                    range = next;
                },
                set_value: (next: string) => {
                    text = next;
                },
                value: () => text,
            };
        },
    },
    VirtualListScrollHandle: {},
    h_flex: () => null,
    v_flex: () => null,
}));
vi.mock('fs/promises', () => ({
    readdir: async () => [...at.pids.keys()].map((pid) => `${pid}.json`),
}));
vi.mock('herdr', () => ({
    appHome: () => '/app',
    exec: async (_program: string, args: string[]) => {
        if (at.isPsDown) throw new Error('ps');
        const asked = (args.at(-1) ?? '').split(',').map(Number);
        return {
            code: 0,
            stdout: asked
                .map(
                    (pid) =>
                        `${pid} 01:00 claude HC_TERMINAL_ID=${at.pids.get(pid)}`,
                )
                .join('\n'),
        };
    },
    home: () => '/h',
    readTextFile: async (path: string) => {
        if (at.isReadDown) throw new Error('read');
        return at.sessions.get(path.split('/').at(-1) ?? '') ?? null;
    },
    watchFolder: () =>
        Object.assign(new Promise(() => {}), { cancel: () => {} }),
}));
vi.stubGlobal('localStorage', {
    getItem: () => null,
    key: () => null,
    length: 0,
    removeItem: () => {},
    setItem: () => {},
});
const { createThreadFeed } = await import('./thread-feed.js');
const { createQuill } = await import('./quill-view.js');

const quiet = (): unknown =>
    new Proxy(() => undefined, { apply: () => quiet(), get: () => quiet() });
const settle = async () => {
    for (let i = 0; i < 60; i++) await Promise.resolve();
};
const cx = {
    bind_keys: () => {},
    focus_handle: () => quiet(),
    notify: () => {
        at.notified += 1;
    },
    spawn: (job: (c: unknown) => unknown) => job(cx),
    timer: {
        after: (_ms: number, run: (c: unknown) => void) => run(cx),
        every: () => {},
    },
};

beforeEach(() => {
    at.isPsDown = false;
    at.isReadDown = false;
    at.pids = new Map([
        [11, 't1'],
        [22, 't2'],
        [33, 't3'],
    ]);
    at.sessions = new Map(
        [11, 22].map((pid) => [
            `${pid}.json`,
            JSON.stringify({ cwd: '/w', sessionId: `s-${pid}` }),
        ]),
    );
});

describe('a thread he switches to is opening', () => {
    const feed = () => {
        const made = createThreadFeed({
            ...(quiet() as object),
            ...Object.fromEntries(
                ['clearShown', 'look'].map((k) => [k, () => undefined]),
            ),
            band: quiet(),
            findBar: quiet(),
            heights: quiet(),
            links: quiet(),
            list: quiet(),
            model: quiet(),
            pickers: quiet(),
            quill: quiet(),
            rows: quiet(),
            sendPath: quiet(),
            sent: quiet(),
        } as never);
        made.start(cx as never);
        return made;
    };

    test('until its transcript is found', async () => {
        const made = feed();
        made.follow('t1', cx as never);
        expect(made.isOpening()).toBe(true);
        await settle();
        expect([made.isOpening(), Boolean(made.file())]).toEqual([false, true]);
    });

    test.each([
        ['a tab with no Claude', null],
        ['a terminal no session names', 't9'],
        ['a Claude with no session file', 't3'],
    ])('never for good: %s', async (_what, address) => {
        const made = feed();
        made.follow('t1', cx as never);
        await settle();
        made.follow(address, cx as never);
        await settle();
        expect(made.isOpening()).toBe(false);
    });

    test('not for good once its session file cannot be read', async () => {
        const made = feed();
        at.isReadDown = true;
        made.follow('t1', cx as never);
        await settle();
        expect([made.isOpening(), made.file()]).toEqual([false, null]);
    });

    test('still, while its Claude cannot be looked up', async () => {
        const made = feed();
        at.isPsDown = true;
        made.follow('t1', cx as never);
        await settle();
        expect(made.isOpening()).toBe(true);
    });

    test('an opening he switched away from says nothing of the next one', async () => {
        const made = feed();
        made.follow('t1', cx as never);
        // t1's Claude is found, its file not read yet
        while (!made.pid()) await Promise.resolve();
        at.isPsDown = true;
        made.follow('t2', cx as never);
        await settle();
        expect(made.isOpening()).toBe(true);
    });

    test('there and back before it opened', async () => {
        const made = feed();
        made.follow('t1', cx as never);
        await settle();
        made.follow('t2', cx as never);
        made.follow('t1', cx as never);
        const drawn = at.notified;
        await settle();
        expect(made.isOpening()).toBe(false);
        // and the chat draws again, or its quill never hears of it
        expect(at.notified).toBeGreaterThan(drawn);
    });
});

test('his caret is where he left it in each thread’s draft, at its end in one not seen', () => {
    let file: string | null = '/t/a.jsonl';
    const quill = createQuill({
        ...Object.fromEntries(
            [
                'column',
                'flash',
                'leave',
                'messages',
                'pickersView',
                'pressEscape',
                'say',
                'sendPath',
                'showPictures',
            ].map((k) => [k, () => undefined]),
        ),
        shownFile: () => file,
        tab: quiet(),
    } as never);
    quill.start({ ...cx, spawn: () => {} } as never);
    const box = quill.box() as never as {
        selected_range: () => object;
        set_selected_range: (r: object) => void;
    };
    const go = (to: string | null) => {
        file = to;
        quill.showDraft();
    };
    go('/t/a.jsonl');
    quill.quills.apply(file, { text: 'one two three', type: 'typed' });
    box.set_selected_range({ end: 7, start: 4 });
    // a switch shows no thread first, then the next one
    go(null);
    quill.quills.apply('/t/b.jsonl', { text: 'four five', type: 'typed' });
    go('/t/b.jsonl');
    expect(box.selected_range()).toEqual({ end: 9, start: 9 });
    go(null);
    go('/t/a.jsonl');
    expect(box.selected_range()).toEqual({ end: 7, start: 4 });
    // what a turn took meanwhile shortens it
    go('/t/b.jsonl');
    quill.quills.apply('/t/a.jsonl', { text: 'one', type: 'typed' });
    go('/t/a.jsonl');
    expect(box.selected_range()).toEqual({ end: 3, start: 3 });
});
