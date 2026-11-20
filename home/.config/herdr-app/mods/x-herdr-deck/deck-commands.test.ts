import { describe, expect, test } from 'vitest';

import { isDeckShown, takeCommands, tickAsker } from './deck-commands.js';

const askers = [
    { pid: 1, sid: 'a', takes: 2 },
    { pid: 2, sid: 'b', takes: 1 },
    { pid: 3, sid: 'c', takes: 0 },
];
const nobody = { hovered: null, picked: null };

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

    test('a press ticks the thread the chat shows, once, through its one handler', async () => {
        const pressed: string[] = [];
        const tick = () => {
            const sid = tickAsker(askers, { ...nobody, isShown: true, pid: 2 });
            if (sid) pressed.push(sid);
        };
        takeCommands(commandsOf('tickall'), { tickall: tick });
        await settle();
        expect(pressed).toEqual(['b']);
    });

    test('with the deck hidden ⌘⇧K ticks nothing', () => {
        expect(tickAsker(askers, { ...nobody, isShown: false, pid: 2 })).toBe(
            null,
        );
    });

    test('the asker under the pointer wins over the chat’s thread', () => {
        expect(
            tickAsker(askers, {
                ...nobody,
                hovered: 'a',
                isShown: true,
                pid: 2,
            }),
        ).toBe('a');
    });

    test('a thread with nothing to take is passed over', () => {
        expect(tickAsker(askers, { ...nobody, isShown: true, pid: 3 })).toBe(
            null,
        );
    });

    test('the deck reads as shown only while its own block is in the layout and not hidden', () => {
        const deck = (hidden: boolean) => ({
            root: {
                children: [
                    {
                        content: {
                            mod: 'x-herdr-deck',
                            props: { view: 'glide' },
                        },
                    },
                    { content: { mod: 'x-herdr-deck' }, hidden },
                ],
            },
        });
        expect(isDeckShown(deck(false))).toBe(true);
        expect(isDeckShown(deck(true))).toBe(false);
        expect(isDeckShown({ root: { children: [] } })).toBe(false);
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
