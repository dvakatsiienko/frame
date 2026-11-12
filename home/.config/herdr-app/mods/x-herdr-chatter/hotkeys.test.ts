import { describe, expect, test } from 'vitest';

import { keysWithOurs } from './hotkeys.js';

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

    test('a key of ours no longer registered leaves his file, one moved to a new key moves', () => {
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
            'cmd-k': 'x-herdr-chatter.focus',
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
