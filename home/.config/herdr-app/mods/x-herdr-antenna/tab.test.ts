import { describe, expect, test } from 'vitest';

import { createTabMember } from '../_shared/tab-loop.js';
import { tabStops } from './rows.js';

// FRM-618 slice A, the Tab exit: antenna's thread rows join the one Tab loop, Tab from the quill reaches them
describe("antenna's rows in the Tab loop", () => {
    test('each drawn row holding a keyboard handle is a stop, in drawn order', () => {
        expect(
            tabStops(['t1', 't2', 't3'], {
                hasKey: (a) => a !== 't2',
                isNarrow: false,
            }),
        ).toEqual(['thread-t1', 'thread-t3']);
    });

    test('narrow, antenna holds no stop', () => {
        expect(
            tabStops(['t1'], { hasKey: () => true, isNarrow: true }),
        ).toEqual([]);
    });

    test('Tab from the quill lands on the first thread row, shift-Tab from it goes back', () => {
        const store = new Map<string, unknown>();
        const herdr = {
            layout: () => ({
                children: [
                    { content: { mod: 'x-herdr-antenna' } },
                    { content: { mod: 'x-herdr-chat' } },
                ],
            }),
            setShared: (key: string, value: unknown) => store.set(key, value),
            shared: (key: string) => store.get(key),
        };
        const antenna = createTabMember('x-herdr-antenna', herdr);
        const chat = createTabMember('x-herdr-chat', herdr);
        const stops = tabStops(['t1', 't2'], {
            hasKey: () => true,
            isNarrow: false,
        });
        antenna.draw(stops, (run) => run());
        chat.draw(['quill'], (run) => run());
        chat.ask('quill', false);
        expect(antenna.draw(stops, (run) => run())).toBe('thread-t1');
        antenna.ask('thread-t1', true);
        expect(chat.draw(['quill'], (run) => run())).toBe('quill');
    });
});
