import { describe, expect, test } from 'vitest';

import { stampBody } from './ticket-sign.ts';

// x stands in: a stamp's hash is whatever x prints for the text above ## signed, so the fake echoes that text's length
const hashOf = (above: string) => above.length.toString(16).padStart(8, '0');

describe('stampBody', () => {
    test('a first sign opens the block, its hash over the body with its blank line', () => {
        const above = 'lane: quick\n\n## wish\n\n* W1 x\n\n';
        expect(
            stampBody(
                'lane: quick\n\n## wish\n\n* W1 x\n',
                'signed',
                '',
                '2026-11-06',
                hashOf,
            ),
        ).toBe(
            `${above}## signed\n\n✍️ signed 2026-11-06 · body ${hashOf(above)}\n`,
        );
    });

    test('a re-sign appends, and its hash ignores the lines already there', () => {
        const above = 'body\n\n';
        const body = `${above}## signed\n✍️ signed 2026-11-01 · body aaaaaaaa\n`;
        expect(
            stampBody(body, 're-signed', 'a new exit', '2026-11-06', hashOf),
        ).toBe(
            `${body}✍️ re-signed 2026-11-06 — a new exit · body ${hashOf(above)}\n`,
        );
    });

    test('the hash is taken over the text above the last ## signed heading', () => {
        const above = 'a\n\n## signed\nquoted\n\nb\n\n';
        const body = `${above}## signed\n✍️ signed 2026-11-01 · body aaaaaaaa\n`;
        const seen: string[] = [];
        stampBody(body, 'changed', 'a line', '2026-11-12', (text) => {
            seen.push(text);
            return hashOf(text);
        });
        expect(seen).toEqual([above]);
    });

    test('a tiny change names itself no re-sign', () => {
        expect(
            stampBody(
                'b\n\n## signed\n',
                'changed',
                'a typo',
                '2026-11-06',
                hashOf,
            ),
        ).toContain('✏️ changed 2026-11-06 — a typo, no re-sign: tiny · body ');
    });
});
