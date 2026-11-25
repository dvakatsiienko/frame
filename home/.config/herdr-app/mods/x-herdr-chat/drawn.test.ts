import { describe, expect, test } from 'vitest';

import { drawnBlocks } from './drawn.js';

const row = (kind: string, text: string, more = {}) =>
    ({ id: 'a', kind, text, ...more }) as never;

describe('the markdown a row draws', () => {
    test('his message is one block, as typed', () => {
        expect(drawnBlocks(row('mine', '**hi** <b>'))).toEqual([
            '\\*\\*hi\\*\\* \\<b\\>',
        ]);
    });

    test('a reply is its blocks: code in its fence, a file link as its name, a ribbon not drawn', () => {
        expect(
            drawnBlocks(
                row(
                    'reply',
                    'see [log](file:///tmp/log.md)\n📋 **copy → terminal** 📋\n```ts\nrun()\n```\n✂️ **end** ✂️\nbye',
                ),
            ),
        ).toEqual(['see log', '```ts\nrun()\n```', 'bye']);
    });

    test('a reply that grew is cut anew', () => {
        const at = { id: 'a', kind: 'reply', text: 'one' };
        expect(drawnBlocks(at as never)).toEqual(['one']);
        at.text = 'one two';
        expect(drawnBlocks(at as never)).toEqual(['one two']);
    });

    test('an open call’s card is its json; a tool line and a file draw no text view', () => {
        expect(
            drawnBlocks(
                row('tool', '{"a":1}', {
                    calls: [{ input: '{"a":1}', name: 'Bash' }],
                    id: 't#call-0#card',
                }),
            ),
        ).toEqual(['```json\n{"a":1}\n```']);
        expect(drawnBlocks(row('tool', 'Bash 2'))).toEqual([]);
        expect(drawnBlocks(row('file', 'log.md'))).toEqual([]);
    });
});
