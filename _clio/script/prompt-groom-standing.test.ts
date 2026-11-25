import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { liftStanding, openStanding, tagStanding } from './prompt-groom.ts';

describe('standing lines', () => {
    const groomed = () => {
        const dir = mkdtempSync(join(tmpdir(), 'groom-standing-'));
        writeFileSync(
            join(dir, '2026-11-01-1419.groomed.md'),
            'W1 (2026-11-01 14:19, dima): find some stuff to solve for yourself meanwhile. #standing\n',
        );
        writeFileSync(
            join(dir, '2026-11-02-1216.groomed.md'),
            'W2 (2026-11-02 12:16, dima): find some stuff to solve meanwhile. #standing\nW3 (2026-11-02 12:16, dima): why did mobile mode turn on? ❓\n',
        );
        writeFileSync(
            join(dir, '2026-11-02-1310.groomed.md'),
            'W4 (2026-11-02 13:10, dima): ask me a round at the end. #standing\n',
        );
        return dir;
    };

    test('only the day’s open standing lines are printed', () => {
        const dir = groomed();
        expect(openStanding('2026-11-02', dir).map((l) => l.id)).toEqual([
            'W2',
            'W4',
        ]);
        rmSync(dir, { recursive: true });
    });

    test('a lifted line stops printing and the others stay', () => {
        const dir = groomed();
        expect(liftStanding('2026-11-02', dir, 'W2')).toEqual(['W2']);
        expect(openStanding('2026-11-02', dir).map((l) => l.id)).toEqual([
            'W4',
        ]);
        expect(
            readFileSync(join(dir, '2026-11-02-1216.groomed.md'), 'utf8'),
        ).toContain('meanwhile. #lifted');
        rmSync(dir, { recursive: true });
    });

    test('lifting all leaves no open line that day and touches no other day', () => {
        const dir = groomed();
        expect(liftStanding('2026-11-02', dir, 'all')).toEqual(['W2', 'W4']);
        expect(openStanding('2026-11-02', dir)).toEqual([]);
        expect(openStanding('2026-11-01', dir).map((l) => l.id)).toEqual([
            'W1',
        ]);
        rmSync(dir, { recursive: true });
    });
});

describe('full wish ids in the groom checks', () => {
    test("a full argument leaves another home's line of that number alone", () => {
        const dir = mkdtempSync(join(tmpdir(), 'groom-tag-'));
        const file = join(dir, '2026-11-06-1000.groomed.md');
        writeFileSync(file, 'PK-3:W1 (x): mine\nFRM-9:W1 (x): theirs\n');
        expect(tagStanding('2026-11-06', dir, 'PK-3:W1')).toEqual(['W1']);
        expect(readFileSync(file, 'utf8')).toBe(
            'PK-3:W1 (x): mine #standing\nFRM-9:W1 (x): theirs\n',
        );
    });

    test('a bare id two homes answer to is refused, nothing lifted', () => {
        const dir = mkdtempSync(join(tmpdir(), 'groom-lift-'));
        const file = join(dir, '2026-11-06-1000.groomed.md');
        const body = 'PK-3:W1 (x): a #standing\nFRM-9:W1 (x): b #standing\n';
        writeFileSync(file, body);
        expect(() => liftStanding('2026-11-06', dir, 'W1')).toThrow(/full id/);
        expect(readFileSync(file, 'utf8')).toBe(body);
    });

    test.each([
        ['a full argument', 'PK-3:W1'],
        ['a bare argument', 'W1'],
    ])(
        'tagStanding takes %s and tags a full line and a bare line',
        (_name, id) => {
            const dir = mkdtempSync(join(tmpdir(), 'groom-tag-'));
            const full = join(dir, '2026-11-06-1000.groomed.md');
            const bare = join(dir, '2026-11-06-1100.groomed.md');
            writeFileSync(full, 'PK-3:W1 (2026-11-06 10:00, dima): full\n');
            writeFileSync(
                bare,
                'W1 (2026-11-06 11:00, dima): bare\nW2 (2026-11-06 11:00, dima): other\n',
            );
            expect(tagStanding('2026-11-06', dir, id)).toEqual(['W1', 'W1']);
            expect(readFileSync(full, 'utf8')).toBe(
                'PK-3:W1 (2026-11-06 10:00, dima): full #standing\n',
            );
            expect(readFileSync(bare, 'utf8')).toBe(
                'W1 (2026-11-06 11:00, dima): bare #standing\nW2 (2026-11-06 11:00, dima): other\n',
            );
            rmSync(dir, { recursive: true });
        },
    );

    test('liftStanding takes a full argument too', () => {
        const dir = mkdtempSync(join(tmpdir(), 'groom-lift-'));
        writeFileSync(
            join(dir, '2026-11-06-1000.groomed.md'),
            'PK-3:W1 (2026-11-06 10:00, dima): full #standing\n',
        );
        expect(liftStanding('2026-11-06', dir, 'PK-3:W1')).toEqual(['W1']);
        rmSync(dir, { recursive: true });
    });
});
