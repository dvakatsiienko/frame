import { describe, expect, test } from 'vitest';

import {
    type Ahead,
    blockedIds,
    pickNext,
    sealedAhead,
} from './sealed-ahead.ts';

const sealed = (id: string): Ahead => ({
    id,
    preflightError: '',
    preflightOk: true,
    signed: true,
});
const failed = (
    id: string,
    signed: boolean,
    preflightError: string,
): Ahead => ({
    id,
    preflightError,
    preflightOk: false,
    signed,
});
const noExits =
    '1 problem in FRM-2\nline 1: lint ## exit — the ticket has no exit lines';
const hashDrift =
    "line 1: lint wish: line — records body a1, the ticket's newest ✍️ line holds body b2: sync the section to the re-sign";

describe('blockedIds', () => {
    test('a closed or non-blocking relation is no candidate', () => {
        expect(
            blockedIds([
                { id: 'FRM-1', state: 'Done', type: 'blocks' },
                { id: 'FRM-2', state: 'Duplicate', type: 'blocks' },
                { id: 'FRM-3', state: 'Canceled', type: 'blocks' },
                { id: 'FRM-4', state: 'Todo', type: 'blocked by' },
                { id: 'FRM-5', state: 'Todo', type: 'blocks' },
            ]),
        ).toEqual(['FRM-5']);
    });
});

describe('pickNext', () => {
    test('a sealed candidate beats a lower-id signed one', () => {
        expect(
            pickNext([failed('FRM-645', true, noExits), sealed('FRM-692')])?.id,
        ).toBe('FRM-692');
    });

    test('a signed candidate beats an unsigned one', () => {
        expect(
            pickNext([
                failed('FRM-1', false, noExits),
                failed('FRM-2', true, noExits),
            ])?.id,
        ).toBe('FRM-2');
    });

    test('a tie goes to the lowest id', () => {
        expect(pickNext([sealed('FRM-692'), sealed('FRM-645')])?.id).toBe(
            'FRM-645',
        );
    });

    test('no candidate is none', () => {
        expect(pickNext([])).toBeNull();
    });
});

describe('sealedAhead', () => {
    test('two sealed chunks ahead is green', () => {
        expect(
            sealedAhead([
                { after: sealed('FRM-3'), id: 'FRM-1', next: sealed('FRM-2') },
            ]),
        ).toEqual({
            exit: 0,
            lines: ['🟢 FRM-1 → 1 FRM-2 sealed · 2 FRM-3 sealed'],
        });
    });

    test('one sealed and none queued asks clio to queue one', () => {
        expect(
            sealedAhead([{ after: null, id: 'FRM-1', next: sealed('FRM-2') }]),
        ).toEqual({
            exit: 1,
            lines: [
                '🔴 FRM-1 → 1 FRM-2 sealed · 2 none queued — queue one (clio)',
            ],
        });
    });

    test('a signed chunk that fails preflight asks clio to seal', () => {
        expect(
            sealedAhead([
                {
                    after: null,
                    id: 'FRM-1',
                    next: failed('FRM-2', true, noExits),
                },
            ]).lines,
        ).toEqual([
            '🔴 FRM-1 → 1 FRM-2 signed, not sealed · 2 none queued — seal (clio)',
        ]);
    });

    test('an unsigned chunk asks dima to sign', () => {
        expect(
            sealedAhead([
                {
                    after: sealed('FRM-3'),
                    id: 'FRM-1',
                    next: failed('FRM-2', false, noExits),
                },
            ]).lines,
        ).toEqual([
            '🔴 FRM-1 → 1 FRM-2 unsigned · 2 FRM-3 sealed — sign (dima)',
        ]);
    });

    test('a hash drift reads reseal and asks clio to seal', () => {
        expect(
            sealedAhead([
                {
                    after: sealed('FRM-3'),
                    id: 'FRM-1',
                    next: failed('FRM-2', true, hashDrift),
                },
            ]).lines,
        ).toEqual(['🔴 FRM-1 → 1 FRM-2 reseal · 2 FRM-3 sealed — seal (clio)']);
    });

    test('no running chunk is green', () => {
        expect(sealedAhead([])).toEqual({
            exit: 0,
            lines: ['🟢 no running lane'],
        });
    });

    test('one red lane among green ones exits 1 and keeps every line', () => {
        const out = sealedAhead([
            { after: sealed('FRM-3'), id: 'FRM-1', next: sealed('FRM-2') },
            { after: null, id: 'BYT-1', next: null },
        ]);
        expect(out.exit).toBe(1);
        expect(out.lines).toEqual([
            '🟢 FRM-1 → 1 FRM-2 sealed · 2 FRM-3 sealed',
            '🔴 BYT-1 → 1 none queued · 2 none queued — queue one (clio)',
        ]);
    });
});
