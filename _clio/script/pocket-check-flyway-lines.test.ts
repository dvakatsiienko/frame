import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { checkPocket, orbitAnswered } from './pocket-check.ts';
import { config, flyway, task, today } from './pocket-check-world.ts';

describe('checkPocket', () => {
    test('an open line pointing at a closed item is red, a finished line or an open item is not', () => {
        const withItem = (status: string, line: string) =>
            checkPocket(
                config,
                [
                    task(
                        {
                            labels: ['m', 'clio-wing-1'],
                            title: 'flyway: wing 1',
                        },
                        line,
                    ),
                    task({ id: 'PK-77', status }),
                ],
                today,
            ).join('\n');
        expect(withItem('done', '- [ ] #1 PK-77 a chore')).toContain(
            'points at PK-77',
        );
        expect(withItem('open', '- [ ] #1 PK-77 a chore')).not.toContain(
            'points at',
        );
        expect(withItem('done', '- [x] #1 PK-77 a chore')).not.toContain(
            'points at',
        );
        expect(flyway({}, '- [ ] #1 PK-404 gone')).toContain(
            'points at PK-404',
        );
    });

    const flywayWith = (body: string, answered: string[] = []) =>
        checkPocket(
            config,
            [
                task(
                    {
                        labels: ['m', 'clio-wing-1'],
                        ordinal: '1001',
                        priority: 'now',
                        title: 'flyway: wing 1',
                    },
                    body,
                ),
            ],
            today,
            '',
            undefined,
            undefined,
            undefined,
            new Set(answered),
        ).join('\n');

    test('a wait on dima with no orbit id is red', () => {
        expect(
            flywayWith('- [ ] #1 ⏳ pick a name — waits for: dima'),
        ).toContain('#1 waits on dima with no orbit ask');
    });

    test('a wait on dima citing an orbit id passes', () => {
        expect(
            flywayWith('- [ ] #1 ⏳ pick a name — waits for: dima o12'),
        ).toBe('');
    });

    test('a wait on a thing other than dima needs no orbit id', () => {
        expect(flywayWith('- [ ] #1 ⏳ the build — waits for: ci')).toBe('');
    });

    test('a wait whose orbit ask dima answered is red', () => {
        expect(
            flywayWith('- [ ] #1 ⏳ pick a name — waits for: dima o12', [
                'o12',
            ]),
        ).toContain('#1: dima answered o12: act on it, then clear the line');
    });

    test('an orbit ask still open leaves the wait green', () => {
        expect(
            flywayWith('- [ ] #1 ⏳ pick a name — waits for: dima o12', ['o7']),
        ).toBe('');
    });

    test('a dated line whose day is today is red', () => {
        expect(flywayWith(`- [ ] #1 📅 ship it — on: ${today}`)).toContain(
            `#1: its day came (${today})`,
        );
    });

    test('a dated line whose day is tomorrow passes', () => {
        expect(flywayWith('- [ ] #1 📅 ship it — on: 2026-10-10')).toBe('');
    });

    test('a line over 120 characters is red, 120 passes', () => {
        expect(flywayWith(`- [ ] #1 ${'a'.repeat(121)}`)).toContain(
            '#1 is 121 chars',
        );
        expect(flywayWith(`- [ ] #1 ${'a'.repeat(107)} — with: dima`)).toBe('');
    });

    test('an orbit store answers the resolved asks no session holds open', () => {
        const dir = mkdtempSync(join(tmpdir(), 'orbit-'));
        const file = join(dir, 'store.json');
        writeFileSync(
            file,
            JSON.stringify({
                'kept:a': {
                    orbit: {
                        asks: [
                            { id: 'o1', isResolved: true },
                            { id: 'o2', isResolved: true },
                            { id: 'o3' },
                        ],
                    },
                },
                'kept:b': { orbit: { asks: [{ id: 'o2' }] } },
                'state:a': {
                    orbit: { asks: [{ id: 'o9', isResolved: true }] },
                },
            }),
        );
        expect([...orbitAnswered(file)]).toEqual(['o1']);
    });

    test('a missing orbit store answers nothing', () => {
        expect(orbitAnswered('/nonexistent/store.json').size).toBe(0);
    });

    test('a ticked line reds the same day, naming the move', () => {
        expect(flyway({}, '- [x] #1 shipped')).toContain(
            'flyway-done.ts PK-1 1',
        );
    });

    test.each([
        [
            'a wait with its tail',
            '- [ ] #1 ⏳ cpu read — waits for: 2026-11-14',
            false,
        ],
        ['a wait with no tail', '- [ ] #1 ⏳ cpu read, until 11-14', true],
        [
            'a later with its tail',
            '- [ ] #1 🦥 helga grill — later: dima 19:58',
            false,
        ],
        ['a later with no tail', '- [ ] #1 🦥 helga grill', true],
        [
            'a dated with its date',
            '- [ ] #1 📅 crow read — on: 2026-11-14',
            false,
        ],
        ['a dated with no date', '- [ ] #1 📅 crow read, next week', true],
    ])('%s', (_, line, isRed) => {
        expect(flyway({}, line).includes(' ends «')).toBe(isRed);
    });

    test.each([
        [
            'open, waits, later',
            ['redraw', '⏳ a — waits for: x', '🦥 b — later: dima 1'],
            false,
        ],
        ['an open line under a wait', ['⏳ a — waits for: x', 'redraw'], true],
        [
            'a wait under a later',
            ['🦥 b — later: dima 1', '⏳ a — waits for: x'],
            true,
        ],
        [
            'dated by date',
            [
                '⏳ a — waits for: x',
                '📅 b — on: 2026-11-11',
                '📅 c — on: 2026-11-14',
                '🦥 d — later: dima 1',
            ],
            false,
        ],
        [
            'dated out of date order',
            ['📅 c — on: 2026-11-14', '📅 b — on: 2026-11-11'],
            true,
        ],
        [
            'a dated above a wait',
            ['📅 b — on: 2026-11-11', '⏳ a — waits for: x'],
            true,
        ],
    ])('lines in the order %s', (_, lines, isRed) => {
        const body = lines
            .map((line, i) => `- [ ] #${i + 1} ${line}`)
            .join('\n');
        expect(flyway({}, body).includes('out of order')).toBe(isRed);
    });
});
