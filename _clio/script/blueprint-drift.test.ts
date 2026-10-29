import { describe, expect, test } from 'vitest';

import { drawnSince, logWindow, versionOf } from './blueprint-drift.ts';

describe('logWindow', () => {
    test('a sha opens its window after that commit, a date is a --since', () => {
        const sha = 'a'.repeat(40);
        expect(logWindow(sha)).toEqual([`${sha}..HEAD`]);
        expect(logWindow('2026-10-01')).toEqual(['--since=2026-10-01']);
    });
});

describe('drawnSince', () => {
    test('a board file opens its window at its last commit', () => {
        expect(
            drawnSince({ file: 'a.drawio' }, '2026-10-20T10:00:00Z'),
        ).toEqual({
            since: '2026-10-20T10:00:00Z',
        });
    });

    test('a board file with no commit yet is never drawn', () => {
        expect(drawnSince({ file: 'a.drawio' }, '')).toEqual({
            stale: 'never drawn',
        });
    });

    test('a url board opens its window at its drawn date', () => {
        expect(drawnSince({ drawn: '2026-10-01' }, '')).toEqual({
            since: '2026-10-01',
        });
    });

    test('a url board with no drawn date is stale', () => {
        expect(drawnSince({}, '')).toEqual({ stale: 'no drawn date' });
    });

    test('--since wins over every other source', () => {
        expect(
            drawnSince(
                { drawn: '2026-10-01', file: 'a.drawio' },
                '',
                '1 week ago',
            ),
        ).toEqual({ since: '1 week ago' });
    });
});

describe('versionOf', () => {
    test("a board's line carries its builder's version", () => {
        expect(versionOf('excalidraw/crew-pm-flow/board.excalidraw')).toMatch(
            /^ · v\d+ \(\d{4}-\d{2}-\d{2}\)$/,
        );
    });

    test('a board with no version prints nothing extra', () => {
        expect(versionOf('excalidraw/no-such-board/board.excalidraw')).toBe('');
    });
});
