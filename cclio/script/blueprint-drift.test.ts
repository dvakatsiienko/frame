import { describe, expect, test } from 'vitest';

import { drawnSince, logWindow } from './blueprint-drift.ts';

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
