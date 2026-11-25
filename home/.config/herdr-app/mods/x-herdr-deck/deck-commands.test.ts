import { describe, expect, test } from 'vitest';

import {
    hoverKept,
    isChatShown,
    isDeckShown,
    openThreadPid,
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
    hovered: null as string | null,
    isShown: true,
    openPid: null as number | null,
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
            const sid = tickAsker(askers, { ...open, openPid: 2 });
            if (sid) pressed.push(sid);
        };
        takeCommands(commandsOf('tickall'), { tickall: tick });
        await settle();
        expect(pressed).toEqual(['b']);
    });

    test('with the deck hidden ⌘⇧K ticks nothing', () => {
        expect(tickAsker(askers, { ...open, isShown: false, openPid: 2 })).toBe(
            null,
        );
    });

    test('the asker under the pointer wins over the chat’s thread', () => {
        expect(
            tickAsker(askers, {
                ...open,
                hovered: 'a',
                openPid: 2,
            }),
        ).toBe('a');
    });

    // FRM-620:W61 (dima, 13:37): in clio's thread ⌘⇧K ticked wing 1's asks, whose card he had clicked before
    test('with no hover it ticks the thread open on screen', () => {
        expect(tickAsker(askers, { ...open, openPid: 2 })).toBe('b');
        // the open thread has nothing left to take: nothing is ticked elsewhere
        expect(tickAsker(askers, { ...open, openPid: 3 })).toBe(null);
    });

    test('a hovered asker with nothing left to take ticks nobody else’s asks', () => {
        expect(tickAsker(askers, { ...open, hovered: 'c', openPid: 2 })).toBe(
            null,
        );
    });

    // dima, 2026-11-25 14:12: «from terminal view, cmd+shift+k does not work at all»
    test('the open thread is the focused one, never the one a hidden chat showed last', () => {
        const pids = { t2: 2, t3: 3 };
        const at = {
            address: 't2' as string | null,
            chatAddress: 't3',
            isChatShown: false,
            pids: pids as Record<string, number> | null,
        };
        expect(openThreadPid(at)).toBe(2);
        // a shell holds the keyboard in Terminal view, or a thread antenna has not read yet: no thread is guessed
        expect(openThreadPid({ ...at, address: null })).toBe(null);
        const unread = { ...at, isChatShown: true, pids: { t3: 3 } };
        expect(openThreadPid(unread)).toBe(null);
        expect(openThreadPid({ ...unread, pids: null })).toBe(null);
        // the Files panel holds the keyboard in Chat view: the one the chat shows, by antenna's pid
        expect(openThreadPid({ ...at, address: null, isChatShown: true })).toBe(
            3,
        );
        expect(openThreadPid({ ...unread, address: null, pids: {} })).toBe(
            null,
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
        const a = { at: 10, sid: 'a' };
        expect(hoverKept([row('a', ask('plain'))], a, null)).toBe(a);
        expect(hoverKept([row('a')], a, null)).toBe(null);
        // its pinned cards draw apart, in no group of its own
        expect(hoverKept([row('a', ask('🧪 test: try'))], a, null)).toBe(null);
        expect(hoverKept([row('b', ask('plain'))], a, null)).toBe(null);
        expect(hoverKept([row('a', ask('plain'))], null, null)).toBe(null);
        // ⌘E hid the deck after the hover, with no leave told: it is none; one made since the deck came back holds
        expect(hoverKept([row('a', ask('plain'))], a, 11)).toBe(null);
        expect(hoverKept([row('a', ask('plain'))], a, 9)).toBe(a);
    });

    test('a thread with nothing to take is passed over', () => {
        expect(tickAsker(askers, { ...open, openPid: 3 })).toBe(null);
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

    test('the chat reads as shown only as the child its stack shows', () => {
        const chat = { content: { mod: 'x-herdr-chat' }, id: 'chat-body' };
        const views = (active?: string, hidden = false) => ({
            root: {
                children: [
                    {
                        active,
                        children: [
                            { children: [chat], hidden, id: 'chat' },
                            { content: { tab: 'active' }, id: 'main' },
                        ],
                        id: 'views',
                        type: 'stack',
                    },
                ],
                type: 'row',
            },
        });
        expect(isChatShown(views('chat'))).toBe(true);
        expect(isChatShown(views('main'))).toBe(false);
        // herdr shows the first child while none was picked, and never a hidden one
        expect(isChatShown(views())).toBe(true);
        expect(isChatShown(views('chat', true))).toBe(false);
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
