import { describe, expect, test } from 'vitest';

import { OUR_KEYS, keysWithOurs, rebind } from './hotkeys.js';

const ours = [
    { action: 'x-herdr-chatter.focus', key: 'cmd-k', title: 'Focus the quill' },
    {
        action: 'x-herdr-deck.toggle',
        key: 'cmd-e',
        title: 'Show or hide the deck',
    },
];

describe('keysWithOurs', () => {
    test('our keys join his global section, his own keys stay as they were', () => {
        const { keys, refused } = keysWithOurs(
            {
                global: { 'cmd-t': 'tab.new' },
                terminal: { 'ctrl-1': 'terminal' },
            },
            ours,
        );
        expect(keys).toEqual({
            global: {
                'cmd-e': 'x-herdr-deck.toggle',
                'cmd-k': 'x-herdr-chatter.focus',
                'cmd-t': 'tab.new',
            },
            terminal: { 'ctrl-1': 'terminal' },
        });
        expect(refused).toEqual([]);
    });

    test('a key herdr already binds is refused by name and herdr keeps it', () => {
        const { keys, refused } = keysWithOurs(
            { global: { 'cmd-d': 'pane.split:right' } },
            [
                {
                    action: 'x-herdr-deck.toggle',
                    key: 'cmd-d',
                    title: 'Show or hide the deck',
                },
            ],
        );
        expect(keys.global['cmd-d']).toBe('pane.split:right');
        expect(refused).toEqual([
            {
                action: 'x-herdr-deck.toggle',
                key: 'cmd-d',
                takenBy: 'pane.split:right',
                title: 'Show or hide the deck',
            },
        ]);
    });

    test('a key of ours no longer registered leaves his file, one he moved stays where he put it', () => {
        const { keys } = keysWithOurs(
            {
                global: {
                    'cmd-j': 'x-herdr-chatter.focus',
                    'cmd-t': 'tab.new',
                    'cmd-y': 'x-herdr-chatter.probe',
                },
            },
            ours,
        );
        expect(keys.global).toEqual({
            'cmd-e': 'x-herdr-deck.toggle',
            'cmd-j': 'x-herdr-chatter.focus',
            'cmd-t': 'tab.new',
        });
    });

    test('a terminal-only binding of the same key does not block ours', () => {
        const { refused } = keysWithOurs(
            { global: {}, terminal: { 'cmd-k': 'terminal' } },
            ours,
        );
        expect(refused).toEqual([]);
    });

    test('two of ours on one key: the first keeps it, the second is refused naming the first', () => {
        const { keys, refused } = keysWithOurs({ global: {} }, [
            ours[0],
            {
                action: 'x-herdr-deck.toggle',
                key: 'cmd-k',
                title: 'Show or hide the deck',
            },
        ]);
        expect(keys.global['cmd-k']).toBe('x-herdr-chatter.focus');
        expect(refused[0].takenBy).toBe('x-herdr-chatter.focus');
    });

    test('a file with no global section gets one', () => {
        expect(keysWithOurs({}, ours).keys.global['cmd-k']).toBe(
            'x-herdr-chatter.focus',
        );
    });
});

describe('a rebind kept in his keys.json', () => {
    test('an action of ours already on another key stays there, its default unused', () => {
        const { keys } = keysWithOurs(
            { global: { 'cmd-j': 'x-herdr-deck.toggle' } },
            ours,
        );
        expect(keys.global).toEqual({
            'cmd-j': 'x-herdr-deck.toggle',
            'cmd-k': 'x-herdr-chatter.focus',
        });
    });
});

describe('rebind', () => {
    const his = {
        global: {
            'cmd-e': 'x-herdr-chatter.deck',
            'cmd-k': 'x-herdr-chatter.focus',
            'cmd-t': 'tab.new',
        },
    };

    test('our key moves to a free key, the old one leaves', () => {
        expect(rebind(his, 'cmd-e', 'cmd-j')).toEqual({
            keys: {
                global: {
                    'cmd-j': 'x-herdr-chatter.deck',
                    'cmd-k': 'x-herdr-chatter.focus',
                    'cmd-t': 'tab.new',
                },
            },
        });
    });

    test('a herdr key moves the same way, in its place', () => {
        // biome sorts the fixture's keys, so its order is cmd-e, cmd-k, cmd-t: the moved key keeps cmd-e's place
        expect(
            Object.entries(rebind(his, 'cmd-e', 'cmd-j').keys?.global ?? {}),
        ).toEqual([
            ['cmd-j', 'x-herdr-chatter.deck'],
            ['cmd-k', 'x-herdr-chatter.focus'],
            ['cmd-t', 'tab.new'],
        ]);
        expect(rebind(his, 'cmd-t', 'cmd-y').keys?.global['cmd-y']).toBe(
            'tab.new',
        );
    });

    test('a key already held is refused by the name of what holds it', () => {
        expect(rebind(his, 'cmd-e', 'cmd-t')).toEqual({ refused: 'tab.new' });
    });

    test('a key that is not bound, or the same key, changes nothing', () => {
        expect(rebind(his, 'cmd-x', 'cmd-y')).toEqual({ refused: null });
        expect(rebind(his, 'cmd-e', 'cmd-e')).toEqual({ keys: his });
    });

    test('a key herdr reads its own way is refused: plain letters and bare ctrl-letters go to the program', () => {
        expect(rebind(his, 'cmd-e', 'd')).toEqual({ refused: 'typing' });
        expect(rebind(his, 'cmd-e', 'ctrl-c')).toEqual({ refused: 'typing' });
    });
});

describe('the x-herdr keys', () => {
    test('the effort key lands on cmd-shift-e beside cmd-k and cmd-e, through the status bar', () => {
        const { keys, refused } = keysWithOurs(
            { global: { 'cmd-shift-d': 'pane.split:down' } },
            OUR_KEYS,
        );
        expect(refused).toEqual([]);
        expect(keys.global).toMatchObject({
            'cmd-e': 'x-herdr-status.deck',
            'cmd-k': 'x-herdr-status.quill',
            'cmd-shift-e': 'x-herdr-status.effort',
        });
    });
});
