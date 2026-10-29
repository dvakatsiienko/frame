import { describe, expect, it } from 'vitest';

import {
    latencyStats,
    missPrompts,
    nearMisses,
    reportLines,
    routeParse,
    routerHealth,
    verdictParse,
} from './jev-report.ts';
import type { Flow, Registry } from './jev-vet.ts';

const registry: Registry = {
    flows: {
        'inbox-lanes': {
            misses: 1,
            since: '2026-09-20',
            state: 'vetting',
            verdicts: 3,
            what: '',
        },
        'skill-router': {
            misses: 0,
            since: '2026-09-08',
            state: 'green',
            verdicts: 20,
            what: '',
        },
    },
    windowDays: 14,
};
const today = '2026-09-22';
const inboxLanes = registry.flows['inbox-lanes'] as Flow;

describe('jev report', () => {
    it('a vetting flow with runs today prints its window and the day', () => {
        const lines = reportLines(
            registry,
            [
                {
                    flow: 'inbox-lanes',
                    items: 4,
                    picks: [
                        { conf: 0.9, name: 'answer' },
                        { conf: 0.45, name: 'fold' },
                    ],
                    tokens: 3200,
                },
            ],
            [],
            today,
        );
        expect(lines).toContain('🟡 **inbox-lanes** — 🧪 2/14 clean');
        expect(lines).toContain(
            '- today — **4** prompts, **1** loads, **0** false',
        );
        expect(lines).toContain('- watch — fold 0.45');
        expect(lines).toContain('- verdicts — 2 ok, 1 misses');
    });

    it('a green flow prints no window and no verdicts line', () => {
        const lines = reportLines(
            registry,
            [{ flow: 'skill-router', items: 12, picks: [], tokens: 800 }],
            [],
            today,
        );
        const at = lines.indexOf('🟢 **skill-router**');
        expect(at).toBeGreaterThan(-1);
        // the block runs to the 📊 line; inbox-lanes above it keeps its own 🧪 and verdicts
        const block = lines.slice(
            at,
            lines.findIndex((l) => l.startsWith('📊')),
        );
        expect(block.some((l) => l.includes('🧪'))).toBe(false);
        expect(block.some((l) => l.startsWith('- verdicts'))).toBe(false);
    });

    it('a miss verdict today turns the flow red and restarts the window', () => {
        const lines = reportLines(
            {
                ...registry,
                flows: { 'inbox-lanes': { ...inboxLanes, since: today } },
            },
            [],
            [
                {
                    flow: 'inbox-lanes',
                    note: 'chords laned ticket, was answer',
                    verdict: 'miss',
                },
            ],
            today,
        );
        expect(lines).toContain('🔴 **inbox-lanes** — 🧪 0/14 restarted today');
        expect(lines).toContain('- miss — chords laned ticket, was answer');
    });

    it('a flow with nothing today is white and one line', () => {
        const lines = reportLines(registry, [], [], today);
        expect(lines[0]).toBe('⚪ **inbox-lanes** — 🧪 2/14 clean');
        expect(lines[1]).toBe('- today — no runs');
    });

    it('the tail sums the session and names the flows without a verdict', () => {
        const lines = reportLines(
            registry,
            [
                { flow: 'inbox-lanes', items: 4, picks: [], tokens: 3200 },
                { flow: 'skill-router', items: 12, picks: [], tokens: 800 },
            ],
            [{ flow: 'skill-router', note: '-', verdict: 'ok' }],
            today,
        );
        expect(lines.at(-2)).toBe(
            '📊 **session** — 2 flows, **16** items, **~4k** tokens (inbox-lanes 4, skill-router 12)',
        );
        expect(lines.at(-1)).toBe(
            '🚦 **health** — api ok, key ok, fixture probe ok, verdicts missing: inbox-lanes, router: on · no runs today',
        );
    });
});

describe('router latency', () => {
    it('avg and p95 come from the ms column, rows without one are skipped', () => {
        const rows = routeParse(
            [
                '2026-09-22T10:00:00.000Z\tclio:pm 0.81\tclio:pm\tread BYT-41',
                '2026-09-22T10:01:00.000Z\tx:cmt 0.90\tx:cmt\tcommit this\t1200',
                '2026-09-22T10:02:00.000Z\tclio:pm 0.45\t-\twhat about\t800',
                '2026-09-21T10:02:00.000Z\tclio:pm 0.45\t-\tyesterday\t9000',
            ].join('\n'),
            '2026-09-22',
        );
        expect(rows.map((r) => r.ms)).toEqual([undefined, 1200, 800]);
        expect(latencyStats(rows)).toEqual({ avg: 1000, p95: 1200, runs: 2 });
    });

    it('the health tail says on with the numbers, or OFF', () => {
        expect(routerHealth(false, { avg: 1000, p95: 1200, runs: 2 })).toBe(
            'router: on · avg 1000 ms · p95 1200 ms (today)',
        );
        expect(routerHealth(false, undefined)).toBe(
            'router: on · no runs today',
        );
        expect(routerHealth(true, { avg: 1000, p95: 1200, runs: 2 })).toBe(
            'router: OFF',
        );
    });

    it('the near-miss band picks the prompts a probe should replay', () => {
        const rows = routeParse(
            [
                '2026-09-22T10:00:00.000Z\tclio:pm 0.81\tclio:pm\tsure\t1',
                '2026-09-22T10:01:00.000Z\tx:cmt 0.50\t-\tmaybe\t1',
                '2026-09-22T10:02:00.000Z\tclio:pm 0.30\t-\tedge\t1',
                '2026-09-22T10:03:00.000Z\tclio:pm 0.10\t-\tno\t1',
            ].join('\n'),
        );
        expect(nearMisses(rows, 5).map((r) => r.prompt)).toEqual([
            'maybe',
            'edge',
        ]);
        expect(nearMisses(rows, 1).map((r) => r.prompt)).toEqual(['edge']);
    });
});

describe('recorded misses', () => {
    const log = [
        '2026-09-20T13:14:38.187Z\tmiss\tlaned ticket, was answer',
        '2026-09-21T16:20:01.441Z\tok\tmatched\tsup, where are we',
        '2026-09-21T16:21:01.441Z\tmiss\tloaded clio:pm, wanted x:notes\tappend to inbox: windscribe',
        '2026-09-22T10:00:00.000Z\tmiss\tno load at all\tdoes the chart render at mobile width?',
    ].join('\n');

    it('a line written before the prompt column carries none', () => {
        expect(verdictParse(log).map((row) => row.prompt)).toEqual([
            undefined,
            'sup, where are we',
            'append to inbox: windscribe',
            'does the chart render at mobile width?',
        ]);
    });

    it('only a miss that recorded its prompt is replayable', () => {
        expect(missPrompts(verdictParse(log), 5)).toEqual([
            'append to inbox: windscribe',
            'does the chart render at mobile width?',
        ]);
        expect(missPrompts(verdictParse(log), 1)).toEqual([
            'does the chart render at mobile width?',
        ]);
    });
});
