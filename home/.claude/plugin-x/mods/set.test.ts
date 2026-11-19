import { spawn, spawnSync } from 'node:child_process';
import {
    chmodSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readlinkSync,
    realpathSync,
    statSync,
    symlinkSync,
    utimesSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';

import {
    changeStore,
    clioIdOf,
    dropStaleLock,
    numberSetting,
    partKeysOf,
    windTextRefusal,
    withAutoWind,
    withHot,
    withPace,
    withPart,
    withWindText,
} from './set.ts';
import { windPairRefusal } from './x-mod-stash/hooks/pace.ts';

test('a switch flips one key and keeps the rest of the store', () => {
    expect(
        withPart({ other: 1, shown: { 'stash.a': true } }, 'stash.b', false),
    ).toEqual({ other: 1, shown: { 'stash.a': true, 'stash.b': false } });
});

test('a switch writes into a store with no shown yet', () => {
    expect(withPart({}, 'stash.a', true)).toEqual({
        shown: { 'stash.a': true },
    });
});

test('the switch list reads the keys of the real parts list', () => {
    const source = readFileSync(
        new URL('./x-mod-stash/hooks/settings-store.ts', import.meta.url),
        'utf8',
    );
    expect(partKeysOf(source)).toContain('stash.pace-watch');
});

test('a shift over a key never written ends with no key, so a seat default fills it', () => {
    const on = withPace({ waker: { on: false } }, 's1', 'on', 5);
    expect([on, withPace(on, 's1', 'end', 6)]).toEqual([
        { 'pace:s1': { since: 5 }, waker: { on: false } },
        { waker: { on: false } },
    ]);
});

test('a shift over a default-on clio ends on', () => {
    const on = withPace({ 'pace:s1': { on: true } }, 's1', 'on', 5);
    expect(withPace(on, 's1', 'end', 6)).toEqual({ 'pace:s1': { on: true } });
});

test('a second start keeps what the first found', () => {
    const one = withPace({ 'pace:s1': { off: true } }, 's1', 'on', 5);
    const two = withPace(one, 's1', 'on', 6);
    expect([two, withPace(two, 's1', 'end', 7)]).toEqual([
        { 'pace:s1': { since: 6, was: { off: true } } },
        { 'pace:s1': { off: true } },
    ]);
});

test('off is a written off, a running shift or not', () => {
    const shift = withPace({ 'pace:s1': { on: true } }, 's1', 'on', 5);
    expect(withPace(shift, 's1', 'off', 6)).toEqual({
        'pace:s1': { off: true },
    });
});

test('end with no shift running changes nothing, so an expired shift leaves the watch on', () => {
    const store = { 'pace:s1': { on: true } };
    expect(withPace(store, 's1', 'end', 5)).toEqual(store);
});

test('a number takes only a known key inside its range', () => {
    expect([
        numberSetting('pace-over', '7'),
        numberSetting('pace-over', '0'),
        numberSetting('pace-over', 'x'),
        numberSetting('nope', '7'),
        numberSetting('constructor', '5'),
        numberSetting('__proto__', '5'),
    ]).toEqual([7, undefined, undefined, undefined, undefined, undefined]);
});

// FRM-579: the coordinator is the live thread whose claim is clio; a record still launching has no pid, a wing is no main
test('the coordinator is the live thread x answers as clio', () => {
    expect(
        clioIdOf([
            { role: 'coordinator', sessionId: 'launching' },
            { pid: 2, role: 'wing', sessionId: 'wing' },
            { pid: 3, sessionId: 'named-clio-no-claim' },
            { pid: 4, role: 'coordinator', sessionId: 'main' },
        ]),
    ).toBe('main');
});

// FRM-505: the two second wind lines, 40–90, the notice below the wind
test('a wind line outside 40–90 is refused', () => {
    expect(
        [
            ['wind-at', '30'],
            ['wind-at', '91'],
            ['wind-notice', '39'],
            ['wind-at', '65'],
        ].map(([k, v]) => numberSetting(k as string, v as string)),
    ).toEqual([undefined, undefined, undefined, 65]);
});

test('a notice at or above the wind line is refused, either way round', () => {
    expect([
        windPairRefusal({ 'wind-at': 65 }, 'wind-notice', 65),
        windPairRefusal({ 'wind-notice': 55 }, 'wind-at', 50),
        windPairRefusal({}, 'wind-notice', 70),
        windPairRefusal({}, 'wind-at', 60),
        windPairRefusal({}, 'pace-park', 99),
    ]).toEqual([
        expect.stringContaining('below'),
        expect.stringContaining('below'),
        expect.stringContaining('below'),
        undefined,
        undefined,
    ]);
});

test("the hot door writes any session's 🔥 the way its chip does", () => {
    const on = withHot({ other: 1 }, 's1', 'on', 5);
    expect([on, withHot(on, 's1', 'off', 6)]).toEqual([
        { 'hot:s1': { since: 5 }, other: 1 },
        { 'hot:s1': { off: true }, other: 1 },
    ]);
});

test("the second-wind-auto door writes any session's 🍃 the way its band button does", () => {
    const off = withAutoWind({ other: 1 }, 's1', 'off', 5);
    expect([off, withAutoWind(off, 's1', 'on', 6)]).toEqual([
        { other: 1, 'second-wind-auto:s1': { at: 5, on: false } },
        { other: 1, 'second-wind-auto:s1': { at: 6, on: true } },
    ]);
});

test("a 🍃 turned off through the door takes back the mod's pending ask, and keeps one dima pressed", () => {
    const off = (wind: Record<string, unknown>) =>
        'wind:s1' in withAutoWind({ 'wind:s1': wind }, 's1', 'off', 5);
    expect([
        off({ at: 1, by: 'mod', state: 'asked' }),
        off({ at: 1, by: 'mod', state: 'writing' }),
        off({ at: 1, by: 'mod', state: 'refreshing' }),
        off({ at: 1, state: 'asked' }),
    ]).toEqual([false, false, true, true]);
});

test('the second-wind-text door leaves an edit for the next poll', () => {
    const once = withWindText({ hot: 1 }, 'stash.wind.text.press', 'mine');
    expect(withWindText(once, 'stash.wind.text.at', '')).toEqual({
        hot: 1,
        'wind-text-edits': {
            'stash.wind.text.at': '',
            'stash.wind.text.press': 'mine',
        },
    });
});

test('the second-wind-text door refuses a text over the cap and a row it does not know', () => {
    expect([
        windTextRefusal('stash.wind.text.press', 'x'.repeat(4000)),
        windTextRefusal('stash.wind.text.press', 'x'.repeat(4001)),
        windTextRefusal('stash.wind.text.nope', 'x')?.slice(0, 33),
    ]).toEqual([
        undefined,
        'the text is 4001 chars, over the cap of 4000',
        'no such row: stash.wind.text.nope',
    ]);
});

test('the door run with a text over the cap exits 2 with one line naming the cap', () => {
    const run = spawnSync(
        process.execPath,
        [
            new URL('./set.ts', import.meta.url).pathname,
            'second-wind-text',
            'stash.wind.text.at',
            'x'.repeat(4001),
        ],
        {
            encoding: 'utf8',
            env: {
                ...process.env,
                HOME: mkdtempSync(join(tmpdir(), 'set-home.')),
            },
            timeout: 10_000,
        },
    );
    expect([run.status, run.stderr]).toEqual([
        2,
        'refused: the text is 4001 chars, over the cap of 4000\n',
    ]);
});

test("a dead writer's lock is taken over, and the write lands", () => {
    const path = join(mkdtempSync(join(tmpdir(), 'set-stale.')), 'store.json');
    writeFileSync(path, '{}');
    writeFileSync(`${path}.lock`, '1');
    utimesSync(`${path}.lock`, 0, 0);
    changeStore(path, (s) => ({ ...s, hot: 1 }));
    expect([
        JSON.parse(readFileSync(path, 'utf8')),
        existsSync(`${path}.lock`),
    ]).toEqual([{ hot: 1 }, false]);
});

test('a waiter that saw a stale lock leaves the fresh lock another waiter took meanwhile', () => {
    const lock = join(mkdtempSync(join(tmpdir(), 'set-fresh.')), 'store.lock');
    writeFileSync(lock, '1');
    dropStaleLock(lock);
    expect(existsSync(lock)).toBe(true);
});

test('a takeover another waiter is in the middle of is left to it', () => {
    const lock = join(mkdtempSync(join(tmpdir(), 'set-guard.')), 'store.lock');
    writeFileSync(lock, '1');
    utimesSync(lock, 0, 0);
    writeFileSync(`${lock}.takeover`, '2');
    dropStaleLock(lock);
    expect(existsSync(lock)).toBe(true);
});

test('a guard file a dead takeover left goes too, so the stale lock is still taken over and the write lands', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'set-dead.')), 'store.json');
    writeFileSync(path, '{}');
    for (const left of [`${path}.lock`, `${path}.lock.takeover`]) {
        writeFileSync(left, '1');
        utimesSync(left, 0, 0);
    }
    changeStore(path, (s) => ({ ...s, hot: 1 }));
    expect([
        JSON.parse(readFileSync(path, 'utf8')),
        existsSync(`${path}.lock.takeover`),
    ]).toEqual([{ hot: 1 }, false]);
});

test('a store lock held past the wait refuses the door in one line, exit 1, never a stack or a spin', () => {
    const home = mkdtempSync(join(tmpdir(), 'set-held.'));
    const dir = join(home, '.claude/plugins/store');
    const store = join(dir, 'x-mod-stash_inline-test.json');
    mkdirSync(dir, { recursive: true });
    writeFileSync(store, '{}');
    writeFileSync(`${store}.lock`, '1');
    utimesSync(`${store}.lock`, 0, 0);
    // a dir without write leave keeps even a stale lock where it is
    chmodSync(dir, 0o500);
    const started = Date.now();
    const run = spawnSync(
        process.execPath,
        [new URL('./set.ts', import.meta.url).pathname, 'hot', 'sid', 'on'],
        {
            encoding: 'utf8',
            env: { ...process.env, HOME: home },
            timeout: 20_000,
        },
    );
    chmodSync(dir, 0o700);
    expect([
        run.status,
        run.stderr,
        Date.now() - started >= 5000,
        readFileSync(store, 'utf8'),
    ]).toEqual([
        1,
        `refused: the store is locked by another writer: ${realpathSync(store)}.lock\n`,
        true,
        '{}',
    ]);
}, 30_000);

test('a store written through the door keeps its mode', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'set-mode.')), 'store.json');
    writeFileSync(path, '{}', { mode: 0o600 });
    changeStore(path, (s) => ({ ...s, hot: 1 }));
    expect(statSync(path).mode & 0o777).toBe(0o600);
});

const SET = new URL('./set.ts', import.meta.url).href;

// one door writer in its own process: `count` changes, each a new key under `prefix`
function writer(path: string, prefix: string, count: number) {
    const child = spawn(process.execPath, [
        '--input-type=module',
        '-e',
        `const { changeStore } = await import(${JSON.stringify(SET)});
for (let i = 0; i < ${count}; i++) changeStore(${JSON.stringify(path)}, (s) => ({ ...s, ['${prefix}' + i]: i }));`,
    ]);
    return new Promise<number | null>((done) => child.on('close', done));
}

test('two door writers at once lose no change, and a reader never meets a half file', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'set-store.')), 'store.json');
    // big enough that a plain write is seen half done
    writeFileSync(path, JSON.stringify({ pad: 'x'.repeat(4_000_000) }));
    let isWriting = true;
    const exits = Promise.all([
        writer(path, 'a', 25),
        writer(path, 'b', 25),
    ]).finally(() => {
        isWriting = false;
    });
    let halves = 0;
    while (isWriting) {
        try {
            JSON.parse(readFileSync(path, 'utf8'));
        } catch {
            halves++;
        }
        await new Promise((r) => setTimeout(r, 1));
    }
    const { pad: _pad, ...rows } = JSON.parse(readFileSync(path, 'utf8'));
    expect([await exits, halves, Object.keys(rows).length]).toEqual([
        [0, 0],
        0,
        50,
    ]);
});

test('a store reached through a link stays a link after a write', () => {
    const dir = mkdtempSync(join(tmpdir(), 'set-link.'));
    writeFileSync(join(dir, 'real.json'), '{}');
    symlinkSync(join(dir, 'real.json'), join(dir, 'store.json'));
    changeStore(join(dir, 'store.json'), (s) => ({ ...s, hot: 1 }));
    expect([
        readlinkSync(join(dir, 'store.json')),
        JSON.parse(readFileSync(join(dir, 'real.json'), 'utf8')),
    ]).toEqual([join(dir, 'real.json'), { hot: 1 }]);
});
