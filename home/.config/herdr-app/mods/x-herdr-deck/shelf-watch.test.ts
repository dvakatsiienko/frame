import { beforeEach, describe, expect, test, vi } from 'vitest';

const herdr = vi.hoisted(() => {
    /** each pending watch, answered by a test with the changed list herdr would name */
    const watches: ((changed: string[]) => void)[] = [];
    return {
        readTextFile: vi.fn(),
        watchFolder: vi.fn(
            () => new Promise<string[]>((done) => watches.push(done)),
        ),
        watches,
    };
});
vi.mock('herdr', () => ({
    exec: vi.fn(),
    home: () => '/Users/me',
    readTextFile: herdr.readTextFile,
    run: vi.fn(),
    theme: vi.fn(),
    watchFolder: herdr.watchFolder,
}));
vi.mock('gpui-base', () => ({ h_flex: vi.fn(), v_flex: vi.fn() }));
vi.mock('gpui-kit', () => ({ div: vi.fn() }));

const { LANES, USAGE, onShelfWrite } = await import('./shelf.js');
const { createGlide } = await import('./glide-view.js');

// `~/.claude/shelf` is a link into frame, and herdr names a change by the real path behind it (FRM-620:W58)
const REAL = '/Users/me/frame/home/.claude/shelf';
const LINKED = '/Users/me/.claude/shelf';

const settle = () => new Promise((done) => setTimeout(done, 0));

/** how often the watch's act ran after each changed list, in turn; it runs once at the start */
async function actsAfter(file: string, ...lists: string[][]) {
    let acts = 0;
    onShelfWrite(fakeCx() as never, file, () => acts++);
    const seen = [acts];
    for (const changed of lists) {
        herdr.watches.shift()?.(changed);
        await settle();
        seen.push(acts);
    }
    return seen;
}

/** a view's context whose timers fire at once, their waits kept */
function fakeCx(waits: number[] = []) {
    return {
        spawn: (run: (cx: unknown) => Promise<void>) => void run(fakeCx(waits)),
        timer: {
            after: (ms: number, fire: () => void) => {
                waits.push(ms);
                fire();
            },
        },
    };
}

beforeEach(() => {
    herdr.watches.length = 0;
});

describe.each([
    ['glide', LANES, 'lanes.json'],
    ['the usage meter', USAGE, 'cc-usage-window.json'],
])('%s redraws when its shelf file is written', (_what, file, name) => {
    test.each([
        ['the real path behind the link', `${REAL}/${name}`],
        ['the linked path', `${LINKED}/${name}`],
        ['the real folder: refresh everything', REAL],
        ['the linked folder', LINKED],
    ])('a changed list naming %s', async (_path, changed) => {
        expect(await actsAfter(file, [changed])).toEqual([1, 2]);
    });

    test('a rename names its temp file beside it', async () => {
        expect(
            await actsAfter(file, [`${REAL}/${name}.tmp-1`, `${REAL}/${name}`]),
        ).toEqual([1, 2]);
    });

    test('a second write, after the watch was armed again', async () => {
        expect(
            await actsAfter(file, [`${REAL}/${name}`], [`${REAL}/${name}`]),
        ).toEqual([1, 2, 3]);
    });

    test('a watch herdr let go, its list empty', async () => {
        expect(await actsAfter(file, [])).toEqual([1, 2]);
    });

    test('another shelf file redraws nothing, one nested under the same name either', async () => {
        expect(
            await actsAfter(file, [
                `${REAL}/threads.json`,
                `${REAL}/herdr-state/${name}`,
                `${REAL}/not-${name}`,
            ]),
        ).toEqual([1, 1]);
    });
});

test.each([
    ['refused', () => Promise.reject(new Error('too many watches'))],
    ['let go', () => Promise.resolve([])],
])('a watch that is %s reads again after one pause', async (_how, answer) => {
    const waits: number[] = [];
    let acts = 0;
    herdr.watchFolder.mockImplementationOnce(answer);
    onShelfWrite(fakeCx(waits) as never, LANES, () => acts++);
    await settle();
    expect({ acts, waits }).toEqual({ acts: 2, waits: [5000] });
});

test('the next watch is armed before the write is read, so one in between still wakes it', async () => {
    const pending: number[] = [];
    onShelfWrite(fakeCx() as never, LANES, () =>
        pending.push(herdr.watches.length),
    );
    herdr.watches.shift()?.([`${REAL}/lanes.json`]);
    await settle();
    expect(pending).toEqual([1, 1]);
});

// the glide copy itself: a written lanes.json redraws it, one read half-written keeps its cards and redraws nothing
test('glide redraws at each write of lanes.json, a half-written read kept out', async () => {
    let redraws = 0;
    const cx = {
        notify: () => redraws++,
        spawn: (run: (cx: unknown) => Promise<void>) => void run(cx),
        timer: { after: vi.fn() },
    };
    const seen: number[] = [];
    const write = async (body: string) => {
        herdr.readTextFile.mockResolvedValue(body);
        herdr.watches.shift()?.([`${REAL}/lanes.json`]);
        await settle();
        seen.push(redraws);
    };
    herdr.readTextFile.mockResolvedValue('{"lanes":[]}');
    createGlide('glide').init(cx as never);
    await settle();
    seen.push(redraws);
    await write('{"lanes":[{"id":"l1","title":"a"}]}');
    await write('{"lanes":[{"id":"l1",');
    await write('{"lanes":[]}');
    expect(seen).toEqual([1, 2, 2, 3]);
});

test('a glide read that answers late never draws over a newer one', async () => {
    let redraws = 0;
    const cx = { ...fakeCx(), notify: () => redraws++ };
    cx.spawn = (run) => void run(cx);
    const answers: ((body: string) => void)[] = [];
    herdr.readTextFile.mockImplementation(
        () => new Promise((done) => answers.push(done)),
    );
    createGlide('glide').init(cx as never);
    herdr.watches.shift()?.([`${REAL}/lanes.json`]);
    await settle();
    answers[1]?.('{"lanes":[]}');
    await settle();
    answers[0]?.('{"lanes":[{"id":"old","title":"old"}]}');
    await settle();
    expect(redraws).toBe(1);
});
