import { expect, test } from 'claude-code/testing';

import {
    held,
    logOf,
    ping,
    say,
    start,
    stored,
    world,
} from './quiet-helpers.ts';

test("clio cd'd out of ~/frame/_clio still holds a [progress] ping", async ($, on) => {
    const w = world(on, { cwd: '/home/frame/home/.claude/plugin-x/mods' });
    await start($);
    await ping($, '[progress] step 2 landed');
    expect(w.queued).toEqual([]);
});

test('a session the registry names other than clio passes a [progress] ping, even in her dir', async ($, on) => {
    const w = world(on, { name: '☕️ 🔧 codie: mods' });
    await start($);
    await ping($, '[progress] step 2 landed');
    expect(w.queued).toHaveLength(1);
});

test("the held pings reach the store for clio's sessions row", async ($, on) => {
    const w = world(on);
    await start($);
    await ping($, '[progress] a');
    await ping($, '[progress] b');
    expect(stored(w).map((p) => [p.from, p.text])).toEqual([
        ['☕️ 🔧 codie: mods', 'a'],
        ['☕️ 🔧 codie: mods', 'b'],
    ]);
});

/* the envelope */

test('a held list that does not save passes the ping, failed-open, nothing held', async ($, on) => {
    let isBroken = false;
    const w = world(on, {
        refuseSet: (key) => isBroken && key.startsWith('held:'),
    });
    await start($);
    isBroken = true;
    await ping($, '[progress] step 2 landed');
    expect([w.queued.length, logOf(w).map((l) => l.verdict)]).toEqual([
        1,
        ['failed-open'],
    ]);
});

test('a message whose hold did not save is never delivered again', async ($, on) => {
    let isBroken = false;
    const w = world(on, {
        refuseSet: (key) => isBroken && key.startsWith('held:'),
    });
    await start($);
    isBroken = true;
    await ping($, 'once only');
    isBroken = false;
    await say($, 'status?');
    expect(held(w)).toEqual([]);
});

test('a list that will not empty waits, and reaches the prompt after once', async ($, on) => {
    let isBroken = false;
    const w = world(on, {
        refuseSet: (key) => isBroken && key.startsWith('held:'),
    });
    await start($);
    await ping($, 'once only');
    isBroken = true;
    await say($, 'one');
    const during = held(w);
    isBroken = false;
    await say($, 'two');
    const reached = held(w).join('\n');
    await say($, 'three');
    expect([during, reached.includes('once only'), held(w)]).toEqual([
        [],
        true,
        [],
    ]);
});
