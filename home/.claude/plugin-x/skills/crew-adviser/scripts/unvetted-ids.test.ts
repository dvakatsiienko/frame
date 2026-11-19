import { describe, expect, test } from 'vitest';

import { unvettedIds } from './unvetted-ids.ts';

describe('unvettedIds', () => {
    const finding = (
        id: string,
        thread: string | undefined,
        located = true,
    ) => ({
        channel: 'plan',
        finding: { located, quote: 'q' },
        id,
        thread,
    });
    const notes = [
        { channel: 'plan', finding: null, id: 'plan-1-0', thread: 'main' },
        finding('plan-1-1', 'main'),
        finding('plan-1-2', 'main', false),
        finding('plan-2-1', 'wing-1'),
        finding('plan-0-1', undefined),
        { id: '202611191600', note: 'head\n🔴 sent to clio' },
        { id: '202611191601', note: 'head\n🟢 held' },
    ];

    test('owes a located finding of the thread’s own critique and a 🔴 note sent to it', () => {
        expect(unvettedIds(notes, new Set(), 'main')).toEqual([
            'plan-1-1',
            '202611191600',
        ]);
    });

    test('a wing owes only the findings its own critique stamped', () => {
        expect(unvettedIds(notes, new Set(), 'wing-1')).toEqual(['plan-2-1']);
    });

    test('a vetted or flagged id is owed no more', () => {
        expect(unvettedIds(notes, new Set(['plan-1-1']), 'main')).toEqual([
            '202611191600',
        ]);
    });
});
