import { describe, expect, test } from 'vitest';

import {
    hoverKept,
    isDeckShown,
    takeCommands,
    tickAsker,
} from './deck-commands.js';

const askers = [
    { pid: 1, sid: 'a', takes: 2 },
    { pid: 2, sid: 'b', takes: 1 },
    { pid: 3, sid: 'c', takes: 0 },
];
/** the deck on screen, no pointer over it, no thread open */
const open = {
    focusedPid: null as number | null,
    hovered: null as string | null,
    isShown: true,
    shownPid: null as number | null,
};

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
            const sid = tickAsker(askers, { ...open, shownPid: 2 });
            if (sid) pressed.push(sid);
        };
        takeCommands(commandsOf('tickall'), { tickall: tick });
        await settle();
        expect(pressed).toEqual(['b']);
    });

    test('with the deck hidden ⌘⇧K ticks nothing', () => {
        expect(
            tickAsker(askers, { ...open, isShown: false, shownPid: 2 }),
        ).toBe(null);
    });

    test('the asker under the pointer wins over the chat’s thread', () => {
        expect(
            tickAsker(askers, {
                ...open,
                hovered: 'a',
                shownPid: 2,
            }),
        ).toBe('a');
    });

    // FRM-620:W61 (dima, 13:37): in clio's thread ⌘⇧K ticked wing 1's asks, whose card he had clicked before
    test('with no hover it ticks the thread open on screen', () => {
        expect(tickAsker(askers, { ...open, shownPid: 2 })).toBe('b');
        // the open thread has nothing left to take: nothing is ticked elsewhere
        expect(tickAsker(askers, { ...open, shownPid: 3 })).toBe(null);
    });

    test('in Terminal view, where no chat is shown, it ticks the thread his keyboard is in', () => {
        expect(tickAsker(askers, { ...open, focusedPid: 1 })).toBe('a');
        // the chat's own word wins while it is shown
        expect(tickAsker(askers, { ...open, focusedPid: 1, shownPid: 2 })).toBe(
            'b',
        );
    });

    test('a hover outlives no asks group: one that left the screen is no hover when it comes back', () => {
        const ask = (text: string) => ({
            id: 'o1',
            isGated: false,
            isLocked: false,
            link: null,
            mark: null,
            pick: null,
            text,
        });
        const row = (sid: string, ...asks: ReturnType<typeof ask>[]) => ({
            asks,
            name: sid,
            pid: 1,
            sid,
        });
        expect(hoverKept([row('a', ask('plain'))], 'a')).toBe('a');
        expect(hoverKept([row('a')], 'a')).toBe(null);
        // its pinned cards draw apart, in no group of its own
        expect(hoverKept([row('a', ask('🧪 test: try'))], 'a')).toBe(null);
        expect(hoverKept([row('b', ask('plain'))], 'a')).toBe(null);
    });

    test('a thread with nothing to take is passed over', () => {
        expect(tickAsker(askers, { ...open, shownPid: 3 })).toBe(null);
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
