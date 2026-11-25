import { describe, expect, test } from 'vitest';

import { prompt, stop } from './siesta-gate.ts';
import {
    NON_DIMA,
    commit,
    fixtureHome,
    run,
    said,
    siesta,
    stopInput,
    store,
    writeSiesta,
} from './siesta-gate-world.ts';

describe('the siesta closes on dima’s word', () => {
    test.each(NON_DIMA)('an open siesta stays open on «%s»', (text) => {
        const home = fixtureHome();
        writeSiesta(home, { card_printed: true, highs: [], open: true });
        prompt(home, { prompt: text });
        expect(siesta(home).open).toBe(true);
    });

    test('his prompt after the card closes it, a reminder before it never deciding', () => {
        const home = fixtureHome();
        writeSiesta(home, { card_printed: true, highs: [], open: true });
        prompt(home, {
            prompt: '<system-reminder>a fork finished</system-reminder>\ngo on',
        });
        expect(siesta(home).open).toBe(false);
    });

    test('a fix landed before the close is no new batch; the next files are', () => {
        const home = fixtureHome();
        writeSiesta(home, { card_printed: true, highs: [], open: true });
        commit(home, 15, 'clio', '🔧 fix', new Date(Date.now() - 5000));
        prompt(home, { prompt: 'go on' });
        expect(stop(home, stopInput(home))).toBeUndefined();
        commit(home, 15, 'clio', '🔧 next batch', new Date(Date.now() + 5000));
        expect(siesta(home).due).toBe(false);
        stop(home, stopInput(home));
        expect(siesta(home).due).toBe(true);
    });

    test('his prompt before the card leaves it open', () => {
        const home = fixtureHome();
        writeSiesta(home, { card_printed: false, highs: [], open: true });
        prompt(home, { prompt: 'how is it going' });
        expect(siesta(home).open).toBe(true);
    });

    test('afk, an open high keeps it open; fixed or parked with a why closes it', () => {
        const home = fixtureHome();
        store(home, { afk: { on: true } });
        const card = (state: string, why?: string) =>
            writeSiesta(home, {
                card_printed: true,
                highs: [{ state, text: 'a hole', ...(why ? { why } : {}) }],
                open: true,
            });
        card('open');
        prompt(home, { prompt: 'still there?' });
        expect(siesta(home).open).toBe(true);
        card('parked');
        prompt(home, { prompt: 'still there?' });
        expect(siesta(home).open).toBe(true);
        card('parked', 'FRM-9 holds it');
        prompt(home, { prompt: 'still there?' });
        expect(siesta(home).open).toBe(false);
        card('fixed');
        prompt(home, { prompt: 'still there?' });
        expect(siesta(home).open).toBe(false);
    });

    test('afk, a siesta whose card is not printed stays open at her turn end', () => {
        const home = fixtureHome();
        store(home, { afk: { on: true } });
        writeSiesta(home, { card_printed: false, highs: [], open: true });
        stop(home, stopInput(home));
        expect(siesta(home).open).toBe(true);
    });

    test('afk, a settled card closes at her own turn end', () => {
        const home = fixtureHome();
        store(home, { afk: { on: true } });
        writeSiesta(home, {
            card_printed: true,
            highs: [{ state: 'fixed', text: 'a hole' }],
            open: true,
        });
        stop(home, stopInput(home));
        expect(siesta(home).open).toBe(false);
    });

    test('the 11-02 shape: three member turns, one block, closed only by him', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        const outs = [0, 1, 2].map(() => {
            prompt(home, { prompt: NON_DIMA[0] ?? '' });
            return stop(home, stopInput(home));
        });
        expect(said(outs[0])).toContain('siesta due');
        expect(outs.map((o) => o && 'decision' in o)).toEqual([
            true,
            undefined,
            undefined,
        ]);
        run(home, ['open']);
        run(home, ['skip', 'a fixture with no transcript']);
        run(home, ['card']);
        prompt(home, { prompt: NON_DIMA[0] ?? '' });
        expect(siesta(home).open).toBe(true);
        prompt(home, { prompt: 'ok, next' });
        expect(siesta(home).open).toBe(false);
    });
});
