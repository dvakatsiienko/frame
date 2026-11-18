import { describe, expect, test } from 'vitest';

import { pidFor, shownThread } from './shown.js';

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
