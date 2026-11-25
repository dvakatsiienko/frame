import { expect, test, vi } from 'vitest';

const herdr = vi.hoisted(() => ({
    commands: [] as string[],
    ran: [] as unknown[],
    wrote: [] as unknown[],
}));
vi.mock('herdr', () => ({
    exec: vi.fn(),
    layout: () => ({
        root: {
            children: [{ content: { mod: 'x-herdr-deck' }, id: 'orbit' }],
            id: 'root',
            type: 'row',
        },
    }),
    nextCommand: () =>
        herdr.commands.length
            ? Promise.resolve(herdr.commands.shift())
            : new Promise(() => {}),
    openOverlay: vi.fn(),
    run: (...args: unknown[]) => herdr.ran.push(args),
    setShared: (...args: unknown[]) => herdr.wrote.push(args),
}));

const { DECK_TOGGLED } = await import('../_shared/chat-asks.js');
const { takeCommands } = await import('./commands.js');

// FRM-620:W61: herdr tells the deck no leave of a hidden element, so it forgets a hover made before this time
test('⌘E toggles the deck and writes when', async () => {
    const before = Date.now();
    herdr.commands.push('deck');
    takeCommands();
    await new Promise((done) => setTimeout(done, 0));
    expect(herdr.ran).toEqual([['layout.toggle', { id: 'orbit' }]]);
    expect(herdr.wrote).toEqual([[DECK_TOGGLED, expect.any(Number)]]);
    expect((herdr.wrote[0] as [string, number])[1]).toBeGreaterThanOrEqual(
        before,
    );
});
