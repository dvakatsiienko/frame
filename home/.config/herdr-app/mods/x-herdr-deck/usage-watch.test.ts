import { expect, test, vi } from 'vitest';

const herdr = vi.hoisted(() => ({
    files: new Map<string, string>(),
    shelfWatch: null as ((changed: string[]) => void) | null,
}));
vi.mock('herdr', () => ({
    agents: () => [],
    appHome: () => '/app',
    exec: async () => ({ code: 1, stdout: '' }),
    home: () => '/Users/me',
    layout: () => null,
    nextCommand: () => new Promise(() => {}),
    notify: vi.fn(),
    props: () => null,
    readTextFile: async (path: string) => herdr.files.get(path) ?? null,
    run: vi.fn(),
    setShared: vi.fn(),
    shared: () => null,
    theme: () => ({}),
    watchFolder: (dir: string) =>
        new Promise<string[]>((done) => {
            if (dir.endsWith('/.claude/shelf')) herdr.shelfWatch = done;
        }),
    writeTextFile: vi.fn(),
}));
vi.mock('gpui-base', () => ({}));
vi.mock('gpui-kit', () => ({ View: class {}, div: vi.fn() }));

vi.stubGlobal('localStorage', {
    getItem: () => null,
    key: () => null,
    length: 0,
    removeItem: () => {},
    setItem: () => {},
});

const { default: Deck } = await import('./main.js');

const USAGE = '/Users/me/.claude/shelf/cc-usage-window.json';
const REAL = '/Users/me/frame/home/.claude/shelf/cc-usage-window.json';
const settle = () => new Promise((done) => setTimeout(done, 20));

const cx: Record<string, unknown> = {
    bind_keys: () => {},
    notify: () => {},
    on_action: () => {},
    spawn: (run: (c: unknown) => Promise<void>) => void run(cx),
    timer: {
        after: (ms: number, run: (c: unknown) => void) => {
            if (ms === 0) run(cx);
            return { cancel() {} };
        },
        every: () => ({ cancel() {} }),
    },
};

// FRM-620 exit 2: the week number follows its file live, and a read half-written keeps it
test('a written usage file moves the week, a half-written one keeps it', async () => {
    const deck = new Deck() as unknown as {
        init: (props: unknown, cx: unknown) => void;
        week: number | null;
    };
    const write = async (body: string) => {
        herdr.files.set(USAGE, body);
        herdr.shelfWatch?.([REAL]);
        await settle();
        return deck.week;
    };
    const body = (week: number) =>
        JSON.stringify({
            rate_limits: { seven_day: { used_percentage: week } },
        });
    herdr.files.set(USAGE, body(41));
    deck.init({}, cx);
    await settle();
    expect(deck.week).toBe(41);
    expect(await write(body(77))).toBe(77);
    expect(await write('{"rate_limits":')).toBe(77);
    expect(await write(body(13))).toBe(13);
});
