import { describe, expect, test } from 'vitest';

import {
    asksActedOn,
    isFreshAsk,
    isShownIn,
    pidFor,
    shownThread,
} from './shown.js';

const claude = (address: string, tab: string) => ({
    address,
    app: 'claude-code',
    tab,
});

describe('the thread the chat shows: the focused tab’s Claude', () => {
    const all = [
        claude('t1', 'tabA'),
        claude('t2', 'tabA'),
        claude('t3', 'tabB'),
        { address: 't4', app: null, tab: 'tabA' },
    ];

    test('the focused pane’s Claude, when it is one', () => {
        expect(
            shownThread(
                all,
                { agent: 't2', tab: 'tabA', terminal: 't2' },
                null,
            ),
        ).toBe('t2');
    });

    test('a focused shell in the tab keeps the Claude shown before', () => {
        expect(
            shownThread(
                all,
                { agent: null, tab: 'tabA', terminal: 't4' },
                't2',
            ),
        ).toBe('t2');
    });

    test('a tab first reached shows its first Claude', () => {
        expect(
            shownThread(
                all,
                { agent: null, tab: 'tabB', terminal: 'tx' },
                't1',
            ),
        ).toBe('t3');
    });

    test('a tab with no Claude shows none', () => {
        expect(
            shownThread(
                all,
                { agent: null, tab: 'tabC', terminal: 'ty' },
                't1',
            ),
        ).toBeNull();
    });

    test('no focus at all shows none', () => {
        expect(shownThread(all, null, 't1')).toBeNull();
    });
});

describe('a terminal’s Claude, by the terminal id in its environment', () => {
    const ps = [
        '  412 /bin/zsh HC_TERMINAL_ID=t1 TERM=xterm',
        ' 9001 claude --model opus HC_TERMINAL_ID=t2 HOME=/Users/x',
        ' 9002 claude HC_TERMINAL_ID=t3',
    ].join('\n');

    test('the session pid whose process carries the terminal id', () => {
        expect(pidFor('t2', ps, [9001, 9002])).toBe(9001);
    });

    test('a process with no session file is never the thread', () => {
        expect(pidFor('t1', ps, [9001, 9002])).toBeNull();
    });

    test('a terminal no Claude runs in reads none', () => {
        expect(pidFor('t9', ps, [9001, 9002])).toBeNull();
    });
});

describe('whether the chat is on screen: its child is the stack’s shown one', () => {
    const tree = {
        children: [
            {
                active: 'main',
                children: [{ id: 'chat' }, { id: 'old-chat' }, { id: 'main' }],
                id: 'views',
            },
        ],
        id: 'root',
    };

    test('the stack shows another child: the chat is hidden', () => {
        expect(isShownIn(tree, 'views', 'chat')).toBe(false);
    });

    test('the stack shows the chat', () => {
        expect(isShownIn(tree, 'views', 'main')).toBe(true);
    });

    test('a stack with no shown child yet shows its first', () => {
        const fresh = {
            children: [
                { children: [{ id: 'chat' }, { id: 'main' }], id: 'views' },
            ],
            id: 'root',
        };
        expect(isShownIn(fresh, 'views', 'chat')).toBe(true);
    });

    test('a chat in no stack is always on screen', () => {
        expect(isShownIn(tree, undefined, 'chat')).toBe(true);
    });
});

describe('a ⌘K or ⌘⇧E press is acted on only while fresh', () => {
    test('a press from the last two seconds is acted on', () => {
        expect(isFreshAsk(9_000, 10_000)).toBe(true);
    });

    test('a press the chat slept through is dropped', () => {
        expect(isFreshAsk(7_000, 10_000)).toBe(false);
    });

    test('no press at all is nothing', () => {
        expect(isFreshAsk(null, 10_000)).toBe(false);
    });
});

describe('what ⌘K and ⌘⇧E do, and when the quill takes the keyboard', () => {
    const at = {
        effortAsk: null,
        isShown: true,
        isSwitched: false,
        lastEffort: null,
        lastQuill: null,
        now: 10_000,
        quillAsk: null,
        wasShown: true,
    };

    test('a hidden chat answers no ⌘⇧E: the chat on screen opens its own picker', () => {
        expect(
            asksActedOn({ ...at, effortAsk: 9_500, isShown: false }).isEffort,
        ).toBe(false);
    });

    test('a chat on screen opens its picker on a fresh ⌘⇧E', () => {
        expect(asksActedOn({ ...at, effortAsk: 9_500 }).isEffort).toBe(true);
    });

    test('the same ⌘⇧E is acted on once', () => {
        expect(
            asksActedOn({ ...at, effortAsk: 9_500, lastEffort: 9_500 })
                .isEffort,
        ).toBe(false);
    });

    test('the quill takes the keyboard when the chat comes on screen', () => {
        expect(asksActedOn({ ...at, wasShown: false }).isFocus).toBe(true);
    });

    test('a hidden chat never takes the keyboard, ⌘K or not', () => {
        expect(
            asksActedOn({ ...at, isShown: false, quillAsk: 9_500 }).isFocus,
        ).toBe(false);
    });

    test('a quiet draw takes nothing', () => {
        expect(asksActedOn(at)).toEqual({ isEffort: false, isFocus: false });
    });
});
