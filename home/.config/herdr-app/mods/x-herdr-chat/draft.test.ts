import { describe, expect, test } from 'vitest';

import { createDrafts } from './draft.js';

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

describe('every write to the quill is the draft too', () => {
    // the 11:59 wisp: a turn took his words, the quill emptied, a switch away and back brought them back
    test('a quill a turn emptied stays empty after a switch away and back', () => {
        const drafts = createDrafts(fakeStorage());
        let shown = '';
        const box = { set_value: (text: string) => (shown = text) };
        drafts.keep('a.jsonl', 'let’s start chores');
        drafts.put(box, 'a.jsonl', '');
        drafts.put(box, 'b.jsonl', drafts.kept('b.jsonl'));
        drafts.put(box, 'a.jsonl', drafts.kept('a.jsonl'));
        expect(shown).toBe('');
    });

    test('what he typed after the taken words is what stays', () => {
        const drafts = createDrafts(fakeStorage());
        const box = { set_value: () => {} };
        drafts.put(box, 'a.jsonl', 'and one more');
        expect(drafts.kept('a.jsonl')).toBe('and one more');
    });
});

describe('the quill keeps what he typed, per thread', () => {
    test('a draft typed for one thread is back when that thread is shown again', () => {
        const drafts = createDrafts(fakeStorage());
        drafts.keep('a.jsonl', 'half a thought');
        drafts.keep('b.jsonl', 'another one');
        expect(drafts.kept('a.jsonl')).toBe('half a thought');
    });

    test('a draft outlives a reload of the mod', () => {
        const storage = fakeStorage();
        createDrafts(storage).keep('a.jsonl', 'half a thought');
        expect(createDrafts(storage).kept('a.jsonl')).toBe('half a thought');
    });

    test('a thread with nothing typed has an empty quill', () => {
        expect(createDrafts(fakeStorage()).kept('a.jsonl')).toBe('');
    });

    test('an emptied quill leaves nothing behind', () => {
        const storage = fakeStorage();
        const drafts = createDrafts(storage);
        drafts.keep('a.jsonl', 'sent in a moment');
        drafts.keep('a.jsonl', '');
        expect(drafts.kept('a.jsonl')).toBe('');
        expect(Object.keys(storage.kept)).toEqual([]);
    });

    test('no thread shown: nothing is kept and nothing read', () => {
        const storage = fakeStorage();
        const drafts = createDrafts(storage);
        drafts.keep(null, 'typed into nowhere');
        expect(drafts.kept(null)).toBe('');
        expect(Object.keys(storage.kept)).toEqual([]);
    });

    test('a store that refuses does not stop his typing', () => {
        const drafts = createDrafts({
            getItem: () => {
                throw new Error('no store');
            },
            removeItem: () => {
                throw new Error('no store');
            },
            setItem: () => {
                throw new Error('full');
            },
        });
        expect(() => drafts.keep('a.jsonl', 'text')).not.toThrow();
        expect(drafts.kept('a.jsonl')).toBe('');
    });
});
