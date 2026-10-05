import { describe, expect, test } from 'vitest';

import type { Raw } from './skill-router.ts';
import { decide, loadLine } from './skill-router.ts';

describe('loadLine', () => {
    test.each(['cclio:evergreen', 'cclio:halt', 'x:cmt', 'x:handoff'])(
        'a %s pick is never auto-trusted',
        (name) => {
            expect(loadLine([{ name, p: 0.9 }])).toBe(
                `skills (jev router): ${name} 0.90 ⚠ read first`,
            );
        },
    );

    test('a plain pick carries no warning', () => {
        expect(loadLine([{ name: 'x:pm', p: 0.82 }])).toBe(
            'skills (jev router): x:pm 0.82',
        );
    });

    test('no pick prints nothing', () => {
        expect(loadLine([])).toBeUndefined();
    });
});

describe('decide', () => {
    const raw = (over: Partial<Raw>): Raw => ({
        blocked: [],
        gate: {},
        ms: 0,
        none: 0.1,
        ranked: [['x:pm', 0.6]],
        rerank: { fits: 0.9, need: 0.9, winner: 'x:pm' },
        tokens: 0,
        vetoes: { _ack: 0, _later: 0 },
        ...over,
    });

    test('a veto silences the must-not-miss gate', () => {
        const s = decide(
            raw({
                gate: { 'x:cmt': 0.95 },
                ranked: [['x:cmt', 0.6]],
                rerank: undefined,
                vetoes: { _ack: 0, _later: 0.9 },
            }),
        );
        expect(s.loads).toEqual([]);
    });

    test('the gate loads a shortlisted critical skill stage 1 ranked below none', () => {
        const s = decide(
            raw({
                gate: { 'x:cmt': 0.8 },
                none: 0.7,
                ranked: [['x:cmt', 0.2]],
                rerank: undefined,
            }),
        );
        expect(s.loads.map((l) => l.name)).toEqual(['x:cmt']);
    });

    test('the gate stays silent on a skill stage 1 did not shortlist', () => {
        const s = decide(raw({ gate: { 'x:cmt': 0.95 }, rerank: undefined }));
        expect(s.loads).toEqual([]);
    });

    test('a low needs_skill drops the stage-2 pick', () => {
        const s = decide(
            raw({ rerank: { fits: 0.9, need: 0.2, winner: 'x:pm' } }),
        );
        expect(s.loads).toEqual([]);
    });

    test('a dropped pick names the stage that dropped it', () => {
        const s = decide(
            raw({ rerank: { fits: 0.9, need: 0.2, winner: 'x:pm' } }),
        );
        expect(s.trace).toEqual(['need 0.20 < 0.5']);
    });

    test('a skill already in the session is ranked but never loaded', () => {
        const s = decide(raw({ blocked: ['x:pm'] }));
        expect(s.loads).toEqual([]);
    });
});
