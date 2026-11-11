import { describe, expect, it } from 'vitest';

import { FOLD_SHOWN, foldBlocks, wrapLines } from './fold.js';

const prose = (n: number) =>
    Array.from({ length: n }, (_, i) => `line ${i + 1}`).join('\n');

describe('wrapLines', () => {
    it('counts a short line as one', () => {
        expect(wrapLines('hi', 60)).toBe(1);
    });
    it('wraps a long line by the bubble width', () => {
        expect(wrapLines('x'.repeat(130), 60)).toBe(3);
    });
    it('counts an empty line', () => {
        expect(wrapLines('a\n\nb', 60)).toBe(3);
    });
});

describe('foldBlocks', () => {
    it('leaves a short reply whole', () => {
        expect(foldBlocks([{ kind: 'text', text: prose(40) }], 60)).toBeNull();
    });
    it('shows a long reply’s first lines and counts the rest', () => {
        const fold = foldBlocks([{ kind: 'text', text: prose(100) }], 60);
        expect(fold?.shown).toEqual([
            { kind: 'text', text: prose(FOLD_SHOWN) },
        ]);
        expect(fold?.hidden).toBe(100 - FOLD_SHOWN);
    });
    it('cuts a long paragraph at a word with an ellipsis', () => {
        const words = Array.from({ length: 2000 }, () => 'word').join(' ');
        const fold = foldBlocks([{ kind: 'text', text: words }], 60);
        const text = fold?.shown[0]?.text ?? '';
        expect(text.endsWith('word…')).toBe(true);
        expect(text.length).toBeLessThanOrEqual(FOLD_SHOWN * 60 + 1);
    });
    it('keeps a cut code block’s whole text for its copy', () => {
        const code = prose(60);
        const fold = foldBlocks(
            [
                { kind: 'text', text: prose(4) },
                { isClosed: true, kind: 'code', lang: 'ts', text: code },
            ],
            60,
        );
        const cut = fold?.shown[1] as { full?: string; text: string };
        expect(cut.full).toBe(code);
        expect(cut.text.split('\n')).toHaveLength(FOLD_SHOWN - 4 - 2);
    });
    it('never cuts a prompt card', () => {
        const fold = foldBlocks(
            [
                { kind: 'text', text: prose(20) },
                { kind: 'prompt', text: prose(30), to: 'clio' },
            ],
            60,
        );
        expect(fold?.shown).toEqual([{ kind: 'text', text: prose(20) }]);
    });
    it('shows an opening card taller than the fold whole', () => {
        const card = { kind: 'prompt' as const, text: prose(30), to: 'clio' };
        const fold = foldBlocks([card, { kind: 'text', text: prose(30) }], 60);
        expect(fold?.shown).toEqual([card]);
        expect(fold?.hidden).toBe(30);
    });
    it('counts the lines a skipped card leaves out', () => {
        const fold = foldBlocks(
            [
                { kind: 'text', text: prose(20) },
                { kind: 'prompt', text: prose(30), to: 'clio' },
            ],
            60,
        );
        expect(fold?.hidden).toBe(30);
    });
    it('drops the blocks past the shown lines', () => {
        const fold = foldBlocks(
            [
                { kind: 'text', text: prose(30) },
                { kind: 'text', text: prose(30) },
            ],
            60,
        );
        expect(fold?.shown).toHaveLength(1);
    });
});
