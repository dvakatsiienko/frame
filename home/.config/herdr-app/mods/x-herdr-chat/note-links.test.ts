import { describe, expect, test } from 'vitest';

import { linkNotes, noteOfUrl } from './note-links.js';

describe('a note’s words drawn as a link (FRM-585 B5)', () => {
    test('the words link to their note, and every written offset finds them there', () => {
        const linked = linkNotes('the retry is cheap', [
            { end: 9, id: 'n1', start: 4 },
        ]);
        expect(linked.source).toBe('the [retry](note:n1) is cheap');
        expect(linked.source.slice(linked.at(4), linked.at(9))).toBe('retry');
        expect(linked.source.slice(linked.at(13), linked.at(18))).toBe('cheap');
    });

    test('a range he selects in the drawn markdown stands back where it was written', () => {
        const linked = linkNotes('the retry is cheap', [
            { end: 9, id: 'n1', start: 4 },
        ]);
        // herdr reports a selection over a link in its markup: «try](note:n1) is»
        const start = linked.source.indexOf('try');
        const end = linked.source.indexOf(' is') + ' is'.length;
        expect(linked.back({ end, start })).toEqual({ end: 12, start: 6 });
    });

    test('of two that overlap, the newer is the link', () => {
        const linked = linkNotes('the retry is cheap', [
            { end: 9, id: 'old', start: 4 },
            { end: 12, id: 'new', start: 6 },
        ]);
        expect(linked.source).toBe('the re[try is](note:new) cheap');
    });

    test.each([
        ['in a code block', '```ts\nlet retry\n```', 10, 15],
        ['in a code span', 'the `retry` path', 5, 10],
        ['in a link', 'see [the retry](https://x.io)', 9, 14],
        ['across a line break', 'the re\ntry', 4, 10],
        ['in a table', '| retry | cheap |', 2, 15],
    ])(
        'none %s: its mark and its row stay its door',
        (_where, source, start, end) => {
            expect(linkNotes(source, [{ end, id: 'n1', start }]).source).toBe(
                source,
            );
        },
    );

    test('its url names its note, any other names none', () => {
        expect([noteOfUrl('note:n1'), noteOfUrl('path:0')]).toEqual([
            'n1',
            null,
        ]);
    });
});
