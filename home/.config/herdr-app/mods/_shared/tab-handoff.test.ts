import { describe, expect, test } from 'vitest';

import { createTabMember } from './tab-loop.js';

// FRM-673 exit 2: the keyboard crosses from one mod to another through herdr's shared store alone. the stub herdr
// keeps the store, and every setShared re-renders each mod, as herdr does; a mod's render publishes its stops and
// focuses the stop its member takes
function stubWindow() {
    const store = new Map<string, unknown>();
    const herdr = {
        layout: () => ({
            children: [
                { content: { mod: 'x-herdr-chat' } },
                { content: { mod: 'x-herdr-deck' } },
            ],
        }),
        setShared: (key: string, value: unknown) => {
            store.set(key, value);
            renderAll();
        },
        shared: (key: string) => store.get(key),
    };
    const chat = createTabMember('x-herdr-chat', herdr);
    const deck = createTabMember('x-herdr-deck', herdr);
    const mods = [
        { member: chat, stops: ['quill'] },
        { member: deck, stops: ['steer-a:o1', 'steer-b:o2'] },
    ];
    const window = { focused: 'quill' };
    function renderAll() {
        for (const { member, stops } of mods) {
            member.publish(stops, (run) => queueMicrotask(run));
            const to = member.take();
            if (to) window.focused = to;
        }
    }
    const opened = async () => {
        renderAll();
        await new Promise((done) => setTimeout(done, 0));
    };
    return { chat, deck, opened, window };
}

describe('the Tab hand-off between mods', () => {
    test('Tab from the last steer box lands in the quill', async () => {
        const w = stubWindow();
        await w.opened();
        w.window.focused = 'steer-b:o2';
        w.deck.ask('steer-b:o2', false);
        expect(w.window.focused).toBe('quill');
    });

    test('shift-Tab from the quill lands in the last steer box', async () => {
        const w = stubWindow();
        await w.opened();
        w.chat.ask('quill', true);
        expect(w.window.focused).toBe('steer-b:o2');
    });

    test('Tab walks quill → each steer box → quill', async () => {
        const w = stubWindow();
        await w.opened();
        const walked = [w.window.focused];
        for (const member of [w.chat, w.deck, w.deck]) {
            member.ask(w.window.focused, false);
            walked.push(w.window.focused);
        }
        expect(walked).toEqual(['quill', 'steer-a:o1', 'steer-b:o2', 'quill']);
    });
});
