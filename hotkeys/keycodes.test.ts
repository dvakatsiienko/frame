import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { keyCap } from './chord.ts';
import { layout } from './chords/src/keyboard.ts';

// The two tables were hand-kept twins on opposite sides of a language line and drifted to 95
// codes against 66 — the daemon logged `pageup` while the readers called the same key
// `key116`, so a press on it joined to no binding at all. The swift half is generated now, and
// this is what makes the generation non-optional: it reads the committed file rather than the
// generator, so reformatting the emitter is free and falling out of step is not.
const swiftPath = join(
    import.meta.dirname,
    '../schedule/jobs/x-monitor-hotkey-stats/keycodes.swift',
);

const swiftKeyCap = () => {
    const source = readFileSync(swiftPath, 'utf8');
    const rows = source.matchAll(/^ {4}(\d+): "((?:[^"\\]|\\.)*)",$/gm);
    const table: Record<number, string> = {};

    for (const [, code, literal] of rows) {
        table[Number(code)] = String(literal).replace(/\\(.)/g, '$1');
    }

    return table;
};

describe('the carbon keycode table', () => {
    it('reads the same in swift as it does in typescript', () => {
        expect(swiftKeyCap()).toEqual(keyCap);
    });
});

// The board drew `pgup` while every source said `pageup`, so a binding there showed on no cap
// (e83137c). `caps` is hyper and `snip` fires a chord of its own; neither is ever a chord's key.
describe('the board', () => {
    it('names every cap the way the daemon names its key', () => {
        const named = new Set([...Object.values(keyCap), 'caps', 'snip']);
        const caps = layout.flat().flatMap(([label]) => (label ? [label] : []));

        expect(caps.filter((label) => !named.has(label))).toEqual([]);
    });
});
