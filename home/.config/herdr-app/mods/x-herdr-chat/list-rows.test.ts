/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const rows = readFileSync(new URL('./message-row.js', import.meta.url), 'utf8');

// herdr-app#894: a press or hover handler inside a virtual list's item blanks the whole list. FRM-587's file row
// carried one, and a reply naming a file left clio's thread empty (dima, 14:15). a `.hover()` style is no handler: the
// waiting message's ↩ carried one in a live list, hovered, and the list held (his shot, 2026-11-22 20:36)
test('nothing a list row draws carries a press or hover handler', () => {
    expect(rows).toContain('function row(');
    expect(rows).not.toMatch(/\.(?:on_\w+|tooltip)\(/);
});
