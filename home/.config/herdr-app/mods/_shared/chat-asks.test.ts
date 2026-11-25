import { describe, expect, test } from 'vitest';

import { chatDropOf, chatSelectArgs, chatViewOf } from './chat-asks.js';

describe('another mod brings the chat into view (FRM-676)', () => {
    const chat = {
        content: {
            mod: 'x-herdr-chat',
            props: { self: 'chat', stack: 'views' },
        },
        id: 'chat',
    };

    test('the chat block names its own child and stack for layout.select', () => {
        const tree = {
            root: {
                children: [{ children: [chat], id: 'views' }],
                id: 'root',
            },
        };
        expect(chatSelectArgs(tree)).toEqual({ child: 'chat', stack: 'views' });
    });

    test('a layout with no stacked chat selects nothing', () => {
        expect(
            chatSelectArgs({
                children: [{ content: { mod: 'x-herdr-chat', props: {} } }],
            }),
        ).toBeNull();
    });
});

describe("a viewer ask, read safely from herdr's shared value", () => {
    test('its pictures, the one to open, ⌘ and the press time pass', () => {
        expect(
            chatViewOf({
                at: 1,
                files: ['/a.png', '/b.png'],
                isDesktop: true,
                time: 5,
            }),
        ).toEqual({
            at: 1,
            files: ['/a.png', '/b.png'],
            isDesktop: true,
            time: 5,
        });
    });

    test('no pictures, an at past them, or no time is no ask', () => {
        expect(chatViewOf({ at: 0, files: [], time: 5 })).toBeNull();
        expect(chatViewOf({ at: 2, files: ['/a.png'], time: 5 })).toBeNull();
        expect(chatViewOf({ at: 0, files: ['/a.png'] })).toBeNull();
        expect(chatViewOf(null)).toBeNull();
    });
});

describe("a drop on the header, read safely from herdr's shared value", () => {
    const drop = { address: 't1', paths: ['/a.png', '/b.md'], time: 5 };

    test('its thread, its files and its time pass', () => {
        expect(chatDropOf(drop)).toEqual(drop);
    });

    test('no file, no thread or no time is no drop', () => {
        expect(chatDropOf({ ...drop, paths: [7] })).toBeNull();
        expect(chatDropOf({ ...drop, address: null })).toBeNull();
        expect(chatDropOf({ ...drop, time: '5' })).toBeNull();
        expect(chatDropOf(null)).toBeNull();
    });
});
