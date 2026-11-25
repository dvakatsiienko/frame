import { describe, expect, test } from 'vitest';

import { checkPocket } from './pocket-check.ts';
import { config, flyway, task, today } from './pocket-check-world.ts';

describe('checkPocket', () => {
    test('a flyway off its thread slot is red, naming the edit', () => {
        expect(flyway({ ordinal: '10000', priority: 'next' })).toContain(
            '--priority now --ordinal 1001',
        );
        expect(flyway({ ordinal: '1005' })).toContain('--ordinal 1001');
    });

    test('a work item in a flyway slot is red', () => {
        expect(
            checkPocket(
                config,
                [task({ ordinal: '1003', priority: 'now' })],
                today,
            ).join('\n'),
        ).toContain("a flyway's slot");
    });

    test('a clean flyway from any earlier day stays, past the stale check', () => {
        expect(
            flyway({ updated_date: '2026-01-01' }, '- [ ] #1 c — with: dima'),
        ).toBe('');
    });

    test('a wish about flyways is no flyway', () => {
        expect(
            flyway({
                ordinal: '10000',
                priority: 'next',
                title: 'flyways board view',
            }),
        ).toBe('');
    });

    test('a flyway never closes', () => {
        expect(flyway({ status: 'done' })).toContain('never closes');
    });

    test('a flyway carries its thread label, main and wing alike', () => {
        expect(flyway({ labels: ['m'] })).toContain('clio-wing-1');
        expect(flyway({ labels: ['m'], title: 'flyway: main' })).toContain(
            'clio-main',
        );
        expect(
            flyway({
                labels: ['m', 'clio-main'],
                ordinal: '1000',
                title: 'flyway: main',
            }),
        ).toBe('');
    });

    test('a flyway title names a thread', () => {
        expect(flyway({ title: 'flyway: 11-07' })).toContain('titled');
    });

    test('one flyway per thread', () => {
        const one = task({ labels: ['m', 'clio-main'], title: 'flyway: main' });
        expect(checkPocket(config, [one, one], today).join('\n')).toContain(
            'one flyway per thread',
        );
    });
});
