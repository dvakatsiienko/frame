import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { stop } from './siesta-gate.ts';
import {
    SID,
    commit,
    fixtureHome,
    said,
    stopInput,
    store,
} from './siesta-gate-world.ts';

describe('a delivered tick is resolved', () => {
    const ask = (id: string, isLocked: boolean) => ({
        id,
        pick: 'yes',
        text: 'an ask',
        ...(isLocked ? { isLocked } : {}),
    });

    test('a delivered, unresolved tick is named', () => {
        const home = fixtureHome();
        store(home, {
            [`asks:${SID}`]: { items: [ask('o7', true), ask('o8', false)] },
        });
        const out = stop(home, stopInput(home));
        expect(said(out)).toContain('o7');
        expect(said(out)).not.toContain('o8');
        expect(out).not.toHaveProperty('decision');
    });

    test('the store is the inline json, never a sibling file beside it', () => {
        const home = fixtureHome();
        store(home, { [`asks:${SID}`]: { items: [ask('o7', true)] } });
        writeFileSync(
            join(home, '.claude/plugins/store/x-mod-stash_aaa.lock'),
            '{}',
        );
        expect(said(stop(home, stopInput(home)))).toContain('o7');
    });

    test('a store caught mid-write keeps the ticks already nudged', () => {
        const home = fixtureHome();
        store(home, { [`asks:${SID}`]: { items: [ask('o7', true)] } });
        stop(home, stopInput(home));
        writeFileSync(
            join(home, '.claude/plugins/store/x-mod-stash_inline-0000.json'),
            '{"asks:',
        );
        stop(home, stopInput(home));
        store(home, { [`asks:${SID}`]: { items: [ask('o7', true)] } });
        expect(stop(home, stopInput(home))).toBeUndefined();
    });

    test('another session’s tick and a resolved one warn nothing', () => {
        const home = fixtureHome();
        store(home, { 'asks:s-other': { items: [ask('o7', true)] } });
        expect(stop(home, stopInput(home))).toBeUndefined();
    });

    test('a due siesta and a tick print one line naming both, then nothing until a new tick', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        store(home, { [`asks:${SID}`]: { items: [ask('o7', true)] } });
        const line = said(stop(home, stopInput(home))) ?? '';
        expect(line.split('\n')).toHaveLength(1);
        expect(line).toContain('siesta due');
        expect(line).toContain('o7');
        expect(stop(home, stopInput(home))).toBeUndefined();
        store(home, {
            [`asks:${SID}`]: { items: [ask('o7', true), ask('o9', true)] },
        });
        const next = stop(home, stopInput(home));
        expect(said(next)).toContain('o9');
        expect(said(next)).not.toContain('o7');
        expect(next).not.toHaveProperty('decision');
    });
});
