import { describe, expect, it } from 'vitest';

import {
    extractRuns,
    missingLines,
    snappyDecompress,
} from './notes-obsidian-recover.ts';

describe('snappyDecompress', () => {
    it('expands a literal followed by an overlapping copy-1', () => {
        // length 12, literal "abcd", copy 8 bytes from offset 4
        const packed = Buffer.from([
            12, 0x0c, 0x61, 0x62, 0x63, 0x64, 0x11, 0x04,
        ]);
        expect(snappyDecompress(packed).toString()).toBe('abcdabcdabcd');
    });
});

describe('missingLines', () => {
    it('lists snapshot lines the live file lacks, ignoring whitespace and short lines', () => {
        const snapshot =
            'ratio 400ml / 5tbsp\n  short\nsimmer for twenty minutes';
        const live = 'ratio   350ml / 5tbsp\nsimmer for   twenty minutes';
        expect(missingLines(snapshot, live)).toEqual(['ratio 400ml / 5tbsp']);
    });
});

describe('extractRuns', () => {
    it('finds a utf-16 note inside junk bytes at either alignment', () => {
        const note = 'ratio 400ml / 5tbsp, simmer twenty minutes';
        const junk = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00]);
        const odd = Buffer.concat([junk, Buffer.from(note, 'utf16le'), junk]);
        const even = Buffer.concat([
            junk.subarray(1),
            Buffer.from(note, 'utf16le'),
            junk,
        ]);
        expect(extractRuns(odd)).toContain(note);
        expect(extractRuns(even)).toContain(note);
    });
});
