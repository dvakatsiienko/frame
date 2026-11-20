import { describe, expect, test } from 'vitest';

import { takeCommands } from './deck-commands.js';

/** herdr's `nextCommand`, stubbed: the given commands in turn, then a wait that never ends */
function commandsOf(...commands: string[]) {
    return () =>
        commands.length
            ? Promise.resolve(commands.shift() as string)
            : new Promise<string>(() => {});
}

const settle = () => new Promise((done) => setTimeout(done, 0));

// FRM-618 slice C exit 3: ⌘⇧K reaches the deck as its own key command, and one press ticks once
describe("the deck's key commands", () => {
    test('one ⌘⇧K press ticks the shown thread once', async () => {
        let ticks = 0;
        takeCommands(commandsOf('tickall'), { tickall: () => ticks++ });
        await settle();
        expect(ticks).toBe(1);
    });

    test('a command the deck does not know does nothing', async () => {
        let ticks = 0;
        takeCommands(commandsOf('focus', 'tickall'), {
            tickall: () => ticks++,
        });
        await settle();
        expect(ticks).toBe(1);
    });
});
