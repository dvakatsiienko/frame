import { describe, expect, test } from 'vitest';

import { listLines, withMarkers } from './lists.js';

describe('a list pasted from the chat gets its markers back (dima, 23:38)', () => {
    const source = [
        'intro line\n\n- a short bullet\n- **bold** and `code` and [a link](https://x.y)\n   - a nested one\n\n1. a numbered step\n2) a second step',
        '```\n- inside a fence\n```',
    ];
    const lines = listLines(source);

    test('each item is keyed by the text a copy of its drawn row holds', () => {
        expect(lines.get('a short bullet')).toBe('- a short bullet');
        expect(lines.get('bold and code and a link')).toBe(
            '- bold and code and a link',
        );
        expect(lines.get('a nested one')).toBe('   - a nested one');
        expect(lines.get('a numbered step')).toBe('1. a numbered step');
        expect(lines.get('a second step')).toBe('2) a second step');
    });

    test('a line inside a code fence is no list item', () => {
        expect(lines.has('inside a fence')).toBe(false);
    });

    test('a multi-line paste gets the markers of the items it holds', () => {
        const pasted =
            'a short bullet\nbold and code and a link\na nested one\nnot a list line';
        expect(withMarkers('say: ', `say: ${pasted}`, lines)).toBe(
            'say: - a short bullet\n- bold and code and a link\n   - a nested one\nnot a list line',
        );
    });

    test('typing one line that equals an item stays as typed', () => {
        expect(withMarkers('a short bulle', 'a short bullet', lines)).toBe(
            'a short bullet',
        );
    });

    test('text around the paste is left alone, a line already marked too', () => {
        const before = 'a short bullet\n';
        const after = `${before}- a short bullet\na numbered step\n`;
        expect(withMarkers(before, after, lines)).toBe(
            `${before}- a short bullet\n1. a numbered step\n`,
        );
    });
});
