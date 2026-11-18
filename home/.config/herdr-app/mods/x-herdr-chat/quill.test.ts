import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

import { EMPTY, createQuills, next } from './quill.js';

const mark = (said: string, id = 'm1') => ({
    at: 1_000,
    id,
    said,
    sid: 'sid-a',
    state: 'pending' as const,
    thread: 'a.jsonl',
});

function fakeStorage(kept: Record<string, string> = {}) {
    return {
        getItem: (key: string) => kept[key] ?? null,
        kept,
        removeItem: (key: string) => {
            delete kept[key];
        },
        setItem: (key: string, value: string) => {
            kept[key] = value;
        },
    };
}

function fakeBox(text = '') {
    const box = {
        set_value: (value: string) => {
            box.text = value;
            box.writes += 1;
        },
        text,
        value: () => box.text,
        writes: 0,
    };
    return box;
}

describe('the quill moves typed → marked → shown in the chat → cleared, one event a step', () => {
    test('typed: the quill holds what he typed', () => {
        expect(next(EMPTY, { text: 'half a thought', type: 'typed' })).toEqual({
            mark: null,
            text: 'half a thought',
        });
    });

    test('marked: the words wait to join a turn, still in the quill', () => {
        const typed = { mark: null, text: 'also the tests' };
        expect(
            next(typed, { mark: mark('also the tests'), type: 'marked' }),
        ).toEqual({
            mark: mark('also the tests'),
            text: 'also the tests',
        });
    });

    test('shown: the words he marked leave the quill as they show in the chat', () => {
        const marked = { mark: mark('also the tests'), text: 'also the tests' };
        expect(next(marked, { id: 'm1', type: 'shown' })).toEqual({
            mark: { ...mark('also the tests'), state: 'joined' },
            text: '',
        });
    });

    test('shown: what he typed after the marked words stays', () => {
        const marked = {
            mark: mark('also the tests'),
            text: 'also the tests\nand one more',
        };
        expect(next(marked, { id: 'm1', type: 'shown' }).text).toBe(
            'and one more',
        );
    });

    test('shown: a quill he rewrote meanwhile is left as it is', () => {
        const marked = { mark: mark('also the tests'), text: 'something else' };
        expect(next(marked, { id: 'm1', type: 'shown' }).text).toBe(
            'something else',
        );
    });

    test('cleared: the shown mark goes once it was shown long enough', () => {
        const shown = {
            mark: { ...mark('also the tests'), state: 'joined' as const },
            text: '',
        };
        expect(next(shown, { id: 'm1', type: 'unmarked' })).toEqual(EMPTY);
    });

    test('unmarked: a mark taken off leaves the words in the quill', () => {
        const marked = { mark: mark('also the tests'), text: 'also the tests' };
        expect(next(marked, { id: 'm1', type: 'unmarked' })).toEqual({
            mark: null,
            text: 'also the tests',
        });
    });

    test('retexted: more words typed under the mark ride its row', () => {
        const marked = { mark: mark('also'), text: 'also the tests' };
        expect(
            next(marked, { id: 'm1', said: 'also the tests', type: 'retexted' })
                .mark?.said,
        ).toBe('also the tests');
    });

    test('a late answer for a mark that was replaced changes nothing', () => {
        const marked = { mark: mark('second', 'm2'), text: 'second' };
        for (const event of [
            { id: 'm1', type: 'shown' as const },
            { id: 'm1', type: 'unmarked' as const },
            { id: 'm1', said: 'first', type: 'retexted' as const },
        ])
            expect(next(marked, event)).toBe(marked);
    });

    test('a mark already shown is not shown twice: the words typed since stay', () => {
        const shown = {
            mark: { ...mark('yes'), state: 'joined' as const },
            text: 'yes again',
        };
        expect(next(shown, { id: 'm1', type: 'shown' })).toBe(shown);
    });

    test('sent: the words that went leave, what he typed since stays', () => {
        const typed = { mark: null, text: 'go now\n\nand this' };
        expect(next(typed, { said: 'go now', type: 'sent' }).text).toBe(
            'and this',
        );
    });

    test('returned: words that did not go come back before what he typed since', () => {
        const typed = { mark: null, text: 'and this' };
        expect(next(typed, { said: 'go now', type: 'returned' }).text).toBe(
            'go now\n\nand this',
        );
    });

    test('returned into an empty quill: just the words', () => {
        expect(next(EMPTY, { said: 'go now', type: 'returned' }).text).toBe(
            'go now',
        );
    });
});

describe('the quills of every thread, kept and shown by one owner', () => {
    test('the shown thread’s quill is on screen the moment it changes', () => {
        const quills = createQuills(fakeStorage());
        const box = fakeBox();
        quills.show('a.jsonl', box);
        quills.apply('a.jsonl', { mark: mark('yes'), type: 'marked' });
        quills.apply('a.jsonl', { text: 'yes', type: 'typed' });
        quills.apply('a.jsonl', { id: 'm1', type: 'shown' });
        expect(box.text).toBe('');
    });

    test('a thread not shown changes its quill without touching the screen', () => {
        const quills = createQuills(fakeStorage());
        const box = fakeBox();
        quills.show('a.jsonl', box);
        quills.apply('b.jsonl', { said: 'for b', type: 'returned' });
        expect(box.text).toBe('');
        expect(quills.get('b.jsonl').text).toBe('for b');
    });

    // the 11:59 wisp: a turn took his words, the quill emptied, a switch away and back brought them back
    test('a quill a turn emptied stays empty after a switch away and back', () => {
        const quills = createQuills(fakeStorage());
        const box = fakeBox();
        quills.show('a.jsonl', box);
        quills.apply('a.jsonl', { text: 'let’s start chores', type: 'typed' });
        quills.apply('a.jsonl', {
            mark: mark('let’s start chores'),
            type: 'marked',
        });
        quills.apply('a.jsonl', { id: 'm1', type: 'shown' });
        quills.show('b.jsonl', box);
        quills.show('a.jsonl', box);
        expect(box.text).toBe('');
    });

    test('what he types is not written back over his typing', () => {
        const quills = createQuills(fakeStorage());
        const box = fakeBox();
        quills.show('a.jsonl', box);
        box.text = 'typed by him';
        quills.apply('a.jsonl', { text: 'typed by him', type: 'typed' });
        expect(box.writes).toBe(0);
    });

    test('a write from code tells the view, so Enter’s line break is found against it', () => {
        const told: string[] = [];
        const quills = createQuills(fakeStorage(), (text) => told.push(text));
        const box = fakeBox();
        quills.show('a.jsonl', box);
        quills.apply('a.jsonl', { said: 'back', type: 'returned' });
        expect(told).toEqual(['', 'back']);
    });

    test('a draft outlives a reload of the mod', () => {
        const storage = fakeStorage();
        createQuills(storage).apply('a.jsonl', {
            text: 'half a thought',
            type: 'typed',
        });
        expect(createQuills(storage).get('a.jsonl').text).toBe(
            'half a thought',
        );
    });

    test('a waiting mark outlives a reload of the mod', () => {
        const storage = fakeStorage();
        createQuills(storage).apply('a.jsonl', {
            mark: mark('yes'),
            type: 'marked',
        });
        expect(createQuills(storage).get('a.jsonl').mark?.id).toBe('m1');
    });

    test('a mark already shown is not kept across a reload', () => {
        const storage = fakeStorage();
        const quills = createQuills(storage);
        quills.apply('a.jsonl', { mark: mark('yes'), type: 'marked' });
        quills.apply('a.jsonl', { id: 'm1', type: 'shown' });
        expect(createQuills(storage).get('a.jsonl').mark).toBeNull();
    });

    test('an emptied quill leaves nothing behind', () => {
        const storage = fakeStorage();
        const quills = createQuills(storage);
        quills.apply('a.jsonl', { text: 'sent in a moment', type: 'typed' });
        quills.apply('a.jsonl', { text: '', type: 'typed' });
        expect(Object.keys(storage.kept)).toEqual([]);
    });

    test('no thread shown: the screen still follows, nothing is kept', () => {
        const storage = fakeStorage();
        const quills = createQuills(storage);
        const box = fakeBox();
        quills.show(null, box);
        box.text = 'typed into nowhere\n';
        quills.apply(null, { text: 'typed into nowhere\n', type: 'typed' });
        quills.apply(null, { text: 'typed into nowhere', type: 'typed' });
        expect(box.text).toBe('typed into nowhere');
        expect(Object.keys(storage.kept)).toEqual([]);
    });

    test('no thread shown again: the quill starts empty, never with words typed into nowhere before', () => {
        const quills = createQuills(fakeStorage());
        const box = fakeBox();
        quills.show(null, box);
        quills.apply(null, { text: 'typed into nowhere', type: 'typed' });
        quills.show('a.jsonl', box);
        quills.show(null, box);
        expect(box.text).toBe('');
    });

    test('a store that refuses does not stop his typing', () => {
        const refusing = {
            getItem: () => {
                throw new Error('no store');
            },
            removeItem: () => {
                throw new Error('no store');
            },
            setItem: () => {
                throw new Error('full');
            },
        };
        const quills = createQuills(refusing);
        expect(() =>
            quills.apply('a.jsonl', { text: 'text', type: 'typed' }),
        ).not.toThrow();
        expect(quills.get('a.jsonl').text).toBe('text');
    });

    test('the quill is written in one place: no file of the chat but quill.js sets a box’s text', () => {
        const dir = new URL('.', import.meta.url).pathname;
        const writers = readdirSync(dir)
            .filter((name) => name.endsWith('.js'))
            .filter((name) =>
                /\.set_value\(/.test(readFileSync(`${dir}${name}`, 'utf8')),
            );
        expect(writers).toEqual(['quill.js']);
    });
});
