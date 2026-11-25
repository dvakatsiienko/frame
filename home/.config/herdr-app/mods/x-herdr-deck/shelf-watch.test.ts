import { beforeEach, describe, expect, test, vi } from 'vitest';

const herdr = vi.hoisted(() => {
    /** each pending watch, answered by a test with the changed list herdr would name */
    const watches: ((changed: string[]) => void)[] = [];
    return {
        watchFolder: vi.fn(
            () => new Promise<string[]>((done) => watches.push(done)),
        ),
        watches,
    };
});
vi.mock('herdr', () => ({
    exec: vi.fn(),
    home: () => '/Users/me',
    readTextFile: vi.fn(),
    watchFolder: herdr.watchFolder,
}));

const { LANES, USAGE, onShelfWrite } = await import('./shelf.js');

// `~/.claude/shelf` is a link into frame, and herdr names a change by the real path behind it (FRM-620:W58)
const REAL = '/Users/me/frame/home/.claude/shelf';
const LINKED = '/Users/me/.claude/shelf';

const settle = () => new Promise((done) => setTimeout(done, 0));

/** how often the watch's act ran after each changed list, in turn */
async function actsAfter(file: string, ...lists: string[][]) {
    let acts = 0;
    const cx = {
        spawn: (run: (cx: unknown) => Promise<void>) => void run(cx),
        timer: { after: vi.fn() },
    };
    onShelfWrite(cx as never, file, () => acts++);
    const seen: number[] = [];
    for (const changed of lists) {
        herdr.watches.shift()?.(changed);
        await settle();
        seen.push(acts);
    }
    return seen;
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
        expect(await actsAfter(file, [changed])).toEqual([1]);
    });

    test('a rename names its temp file beside it', async () => {
        expect(
            await actsAfter(file, [`${REAL}/${name}.tmp-1`, `${REAL}/${name}`]),
        ).toEqual([1]);
    });

    test('a second write, after the watch was armed again', async () => {
        expect(
            await actsAfter(file, [`${REAL}/${name}`], [`${REAL}/${name}`]),
        ).toEqual([1, 2]);
    });

    test('a watch herdr let go, its list empty', async () => {
        expect(await actsAfter(file, [])).toEqual([1]);
    });

    test('another shelf file redraws nothing, one nested under the same name either', async () => {
        expect(
            await actsAfter(file, [
                `${REAL}/threads.json`,
                `${REAL}/herdr-state/${name}`,
                `${REAL}/not-${name}`,
            ]),
        ).toEqual([0]);
    });
});

test('a watch that fails reads again after its wait', async () => {
    let acts = 0;
    const cx = {
        spawn: (run: (cx: unknown) => Promise<void>) => void run(cx),
        timer: {
            after: (ms: number, fire: () => void) => {
                expect(ms).toBe(5000);
                fire();
            },
        },
    };
    herdr.watchFolder.mockImplementationOnce(() =>
        Promise.reject(new Error('too many watches')),
    );
    onShelfWrite(cx as never, LANES, () => acts++);
    await settle();
    expect(acts).toBe(1);
});
