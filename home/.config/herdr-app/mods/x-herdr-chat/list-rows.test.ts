/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

import { withFileRows } from './files.js';
import { createHeights, guessHeight } from './heights.js';
import { noteRows } from './note-rows.js';
import { createPlace } from './place.js';
import type { Row } from './row-model.js';

const rows = readFileSync(new URL('./message-row.js', import.meta.url), 'utf8');

// herdr-app#894: a press or hover handler inside a virtual list's item blanks the whole list. FRM-587's file row
// carried one, and a reply naming a file left clio's thread empty (dima, 14:15). a `.hover()` style is no handler: the
// waiting message's ↩ carried one in a live list, hovered, and the list held (his shot, 2026-11-22 20:36)
test('nothing a list row draws carries a press or hover handler', () => {
    expect(rows).toContain('function row(');
    expect(rows).not.toMatch(/\.(?:on_\w+|tooltip)\(/);
});

// FRM-585 B2: herdr pairs each element with its item, so a row with no size slides every row under it
test('each drawn row has one size, a message’s notes and files and the calls after it too, then the list’s two end marks', () => {
    const row = (id: string, kind: Row['kind'], text: string): Row => ({
        at: null,
        delivery: null,
        files: [],
        id,
        isTurnStart: false,
        isWaiting: false,
        kind,
        pictures: [],
        replyId: null,
        text,
        tools: [],
        version: 1,
    });
    const notes = ['one', 'two', 'three'].map((text, i) => ({
        id: `n${i}`,
        state: 'waiting',
        text,
    }));
    const drawn = withFileRows(
        [row('r', 'reply', 'see ~/a.md'), row('c', 'tool', 'Read, Bash')],
        '/Users/me',
        new Map(),
        (r) => (r.id === 'r' ? noteRows(r, notes as never) : []),
    );
    expect(drawn.map((r) => r.kind)).toEqual([
        'reply',
        'file',
        'note',
        'note',
        'note',
        'tool',
    ]);
    const sizes = createHeights().sizes(drawn, (r) => guessHeight(r, 700));
    const long = row('l', 'note', 'word '.repeat(200));
    expect(guessHeight(long, 700)).toBe(sizes.at(-1));
    const { itemSizes } = createPlace().plan(drawn, sizes, 600);
    expect(itemSizes).toHaveLength(drawn.length + 2);
    expect(itemSizes.every((px) => px > 0)).toBe(true);
});
