import { describe, expect, test } from 'vitest';

import {
    type Registry,
    spotCheckDue,
    statusLines,
    verdictApply,
    verdictLine,
} from './jev-vet.ts';

// biome-ignore lint/suspicious/noControlCharactersInRegex: the escape byte is the point
const ANSI = /\x1b\[[0-9;]*m/g;

const registry: Registry = {
    flows: {
        'inbox-lanes': {
            misses: 0,
            since: '2026-09-01',
            state: 'vetting',
            verdicts: 3,
            what: 'lanes',
        },
    },
    windowDays: 14,
};

describe('verdictApply', () => {
    test('a miss restarts the window from that day', () => {
        const next = verdictApply(
            registry,
            'inbox-lanes',
            'miss',
            '2026-09-10',
        );
        expect(next.flows['inbox-lanes']).toMatchObject({
            misses: 1,
            since: '2026-09-10',
            state: 'vetting',
        });
    });

    test('an ok after the window promotes the flow to green', () => {
        const next = verdictApply(registry, 'inbox-lanes', 'ok', '2026-09-15');
        expect(next.flows['inbox-lanes']?.state).toBe('green');
    });

    test('an ok inside the window keeps it vetting', () => {
        const next = verdictApply(registry, 'inbox-lanes', 'ok', '2026-09-10');
        expect(next.flows['inbox-lanes']?.state).toBe('vetting');
    });

    test('a green flow that misses drops back to vetting', () => {
        const green = verdictApply(registry, 'inbox-lanes', 'ok', '2026-09-15');
        const next = verdictApply(green, 'inbox-lanes', 'miss', '2026-09-16');
        expect(next.flows['inbox-lanes']?.state).toBe('vetting');
    });
});

describe('lanes and spot-checks', () => {
    test('a verdict naming a lane tallies that lane', () => {
        const a = verdictApply(
            registry,
            'inbox-lanes',
            'ok',
            '2026-09-02',
            'ticket',
        );
        const b = verdictApply(
            a,
            'inbox-lanes',
            'miss',
            '2026-09-03',
            'ticket',
        );
        expect(b.flows['inbox-lanes']?.lanes).toEqual({
            ticket: { hit: 1, total: 2 },
        });
    });

    test('a green flow is due a spot-check after seven days', () => {
        const green = verdictApply(registry, 'inbox-lanes', 'ok', '2026-09-15');
        const flow = green.flows['inbox-lanes'];
        if (!flow) throw new Error('flow missing');
        expect(spotCheckDue(flow, '2026-09-16')).toBe(true);
        expect(
            spotCheckDue(
                { ...flow, spotCheckedAt: '2026-09-14' },
                '2026-09-16',
            ),
        ).toBe(false);
        expect(
            spotCheckDue(
                { ...flow, spotCheckedAt: '2026-09-08' },
                '2026-09-16',
            ),
        ).toBe(true);
    });
});

describe('statusLines', () => {
    test('prints the clean streak against the window', () => {
        const plain = statusLines(registry, '2026-09-10').map((l) =>
            l.replace(ANSI, ''),
        );
        expect(plain).toEqual([
            '🟡 inbox-lanes — vetting 9/14 d clean · 3 verdicts, 0 misses',
        ]);
    });
});

describe('the verdict record', () => {
    const at = new Date('2026-09-22T10:00:00.000Z');

    test('a miss carries the prompt that produced it', () => {
        expect(
            verdictLine(
                'miss',
                'loaded clio:pm, wanted x:notes',
                'append to inbox: windscribe',
                at,
            ),
        ).toBe(
            '2026-09-22T10:00:00.000Z\tmiss\tloaded clio:pm, wanted x:notes\tappend to inbox: windscribe\n',
        );
    });

    test('a verdict with no prompt keeps the three columns it always had', () => {
        expect(verdictLine('ok', 'all four lanes matched', undefined, at)).toBe(
            '2026-09-22T10:00:00.000Z\tok\tall four lanes matched\n',
        );
    });

    test('a newline or a tab in the prompt collapses, so one verdict stays one line', () => {
        const line = verdictLine(
            'miss',
            'note',
            'read BYT-41\nand\tfold it',
            at,
        );
        expect(line.split('\t')).toHaveLength(4);
        expect(line).toContain('read BYT-41 and fold it');
    });
});
