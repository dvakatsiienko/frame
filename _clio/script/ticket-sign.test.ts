import { createHash } from 'node:crypto';
import { describe, expect, test } from 'vitest';

import { stampBody } from './ticket-sign.ts';

const hashOf = (text: string) =>
    createHash('sha256').update(text).digest('hex').slice(0, 8);

describe('stampBody', () => {
    test('a first sign opens the block, its hash over the body with its blank line', () => {
        const above = 'lane: quick\n\n## wish\n\n* W1 x\n\n';
        expect(
            stampBody(
                'lane: quick\n\n## wish\n\n* W1 x\n',
                'signed',
                '',
                '2026-11-06',
            ),
        ).toBe(
            `${above}## signed\n\n✍️ signed 2026-11-06 · body ${hashOf(above)}\n`,
        );
    });

    test('a re-sign appends, and its hash ignores the lines already there', () => {
        const above = 'body\n\n';
        const body = `${above}## signed\n✍️ signed 2026-11-01 · body aaaaaaaa\n`;
        expect(stampBody(body, 're-signed', 'a new exit', '2026-11-06')).toBe(
            `${body}✍️ re-signed 2026-11-06 — a new exit · body ${hashOf(above)}\n`,
        );
    });

    test('a tiny change names itself no re-sign', () => {
        expect(
            stampBody('b\n\n## signed\n', 'changed', 'a typo', '2026-11-06'),
        ).toContain('✏️ changed 2026-11-06 — a typo, no re-sign: tiny · body ');
    });
});
