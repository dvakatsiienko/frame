import type { On } from 'claude-code';

import { type Engine, expect, mock, test } from './shared-boot.ts';

// the rows of one file share one boot (FRM-678): each pair leaves something behind, and the second meets none of it
const TOOL = 'mcp__x-mod-stash__orbit';
const left = { polls: 0 };

function world(on: On, count = () => {}) {
    const clock = mock.clock(on);
    mock.store(on);
    on('session.id', () => {
        count();
        return { value: 'a1a1a1a1-0000' };
    });
    on('env.get', () => ({ value: '/home' }));
    on('session.repo', () => ({ value: null }));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('tool.register', (_$, e) => ({
        value: { tool: `mcp__x-mod-stash__${e.name}` },
    }));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    return clock;
}
const start = ($: Engine) =>
    $.session.start({ cwd: '/tmp', isInteractive: true, surface: 'terminal' });
async function askAdded($: Engine) {
    const r = await $.tool.call({
        asks: [
            { area: 'mods', pick: 'yes', text: 'ship it', why: 'a test ask' },
        ],
        op: 'add',
        tool: TOOL,
    } as never);
    return JSON.stringify(r).match(/\bo\d+\b/)?.[0];
}

for (const row of ['a row', 'the next row'])
    test(`${row} adds its first ask, kept in $.state, as o1`, async ($, on) => {
        world(on);
        await start($);
        expect(await askAdded($)).toBe('o1');
    });

test('a module variable of the row before is back at its load value', async ($, on) => {
    world(on);
    expect(await askAdded($)).toBe('o1');
});

test('a row leaves its poll running', async ($, on) => {
    const clock = world(on, () => {
        left.polls += 1;
    });
    await start($);
    await clock.advance(20_000);
    expect(left.polls).toBeGreaterThan(0);
    left.polls = 0;
});

test("the next row's clock runs no poll of the row before", async (_$, on) => {
    const clock = world(on, () => {
        left.polls += 1;
    });
    await clock.advance(60_000);
    expect(left.polls).toBe(0);
});

test('a row hooks a command and leaves', async ($, on) => {
    world(on);
    on('command.run', () => ({ text: 'of the row before' }));
    const r = await $.command.run({ args: '', command: 'x' } as never);
    expect(r.text).toBe('of the row before');
});

test('the next row runs none of its hooks', async ($, on) => {
    world(on);
    const r = await $.command
        .run({ args: '', command: 'x' } as never)
        .catch(() => undefined);
    expect(r?.text).not.toBe('of the row before');
});

test('a hook with a match answers its own event alone', async ($, on) => {
    world(on);
    on('command.run', { command: 'y' }, () => ({ text: 'y alone' }));
    on('command.run', () => ({ text: 'any' }));
    const r = await $.command.run({ args: '', command: 'x' } as never);
    expect(r.text).toBe('any');
});

// work a row leaves behind, its own timer still to fire
const { setTimeout } = globalThis as never as {
    setTimeout: (job: (value?: unknown) => void, ms: number) => number;
};
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('a row adds an ask past its end', async ($, on) => {
    world(on);
    await start($);
    void wait(30).then(() => askAdded($));
});

test('the next row meets no ask of it', async ($, on) => {
    world(on);
    await start($);
    await wait(60);
    expect(await askAdded($)).toBe('o1');
});

test('a match on anything but a plain value is refused', (_$, on) => {
    expect(() =>
        on('command.run', { command: /x/ } as never, () => ({ text: '' })),
    ).toThrow('on a plain value alone');
});
