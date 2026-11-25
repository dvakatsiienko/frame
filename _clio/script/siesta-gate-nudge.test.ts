import { appendFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

import { gate, prompt, stop } from './siesta-gate.ts';
import {
    HOUR,
    NON_DIMA,
    commit,
    fixtureHome,
    run,
    said,
    siesta,
    stopInput,
    writeSiesta,
} from './siesta-gate-world.ts';

describe('the siesta comes due', () => {
    test('15 files of clio’s block the first stop of the epoch, then stay quiet', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        const first = stop(home, stopInput(home));
        expect(first).toMatchObject({ decision: 'block' });
        expect(said(first)).toContain('siesta due');
        expect(stop(home, stopInput(home))).toBeUndefined();
    });

    test('a new epoch nudges again', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio', '🔧 x', new Date(Date.now() - 60_000));
        stop(home, stopInput(home));
        run(home, ['open']);
        stop(home, stopInput(home));
        writeSiesta(home, { ...siesta(home), open: false });
        commit(
            home,
            15,
            'clio',
            '🐞 another batch',
            new Date(Date.now() + 5000),
        );
        expect(stop(home, stopInput(home))).toMatchObject({
            decision: 'block',
        });
    });

    test('a turn that loaded clio:siesta is not nudged', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        expect(stop(home, stopInput(home, 'clio:siesta'))).toBeUndefined();
    });

    test('a siesta waiting on his word counts nothing due', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        writeSiesta(home, {
            card_at: new Date().toISOString(),
            card_printed: true,
            highs: [],
            open: true,
        });
        expect(stop(home, stopInput(home))).toBeUndefined();
    });

    test('a siesta opened but never carded is nudged by its next batch', () => {
        const home = fixtureHome();
        writeSiesta(home, { card_printed: false, highs: [], open: true });
        commit(home, 15, 'clio');
        expect(said(stop(home, stopInput(home)))).toContain('siesta due');
    });

    test('a skill load followed by its tool result and its meta text still counts as this turn’s', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        const input = stopInput(home, 'clio:siesta');
        appendFileSync(
            input.transcript_path,
            `\n${JSON.stringify({ message: { content: [{ type: 'tool_result' }] }, type: 'user' })}\n${JSON.stringify({ isMeta: true, message: { content: [{ text: 'Base directory for this skill', type: 'text' }] }, type: 'user' })}`,
        );
        expect(stop(home, input)).toBeUndefined();
    });

    test('nothing prints while the stop hook is already active, and the epoch’s nudge waits', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        const active = { ...stopInput(home), stop_hook_active: true };
        expect(stop(home, active)).toBeUndefined();
        expect(stop(home, stopInput(home))).toMatchObject({
            decision: 'block',
        });
    });
});

describe('an ignored siesta comes back', () => {
    test('after the epoch’s block, his own prompts carry the reminder until it opens', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        expect(stop(home, stopInput(home))).toMatchObject({
            decision: 'block',
        });
        expect(stop(home, stopInput(home))).toBeUndefined();
        expect(prompt(home, { prompt: 'next thing' })).toContain('siesta due');
        expect(prompt(home, { prompt: 'and another' })).toContain('siesta due');
        run(home, ['open']);
        expect(prompt(home, { prompt: 'go on' })).toBeUndefined();
    });

    test('a siesta opened and dropped before its card is reminded on his prompts too', () => {
        const home = fixtureHome();
        writeSiesta(home, { card_printed: false, highs: [], open: true });
        commit(home, 15, 'clio');
        expect(stop(home, stopInput(home))).toMatchObject({
            decision: 'block',
        });
        expect(prompt(home, { prompt: 'next thing' })).toContain('siesta due');
    });

    test('a member’s turn never carries it', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        stop(home, stopInput(home));
        expect(prompt(home, { prompt: NON_DIMA[0] ?? '' })).toBeUndefined();
    });

    test('the prompt door prints the reminder on stdout', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        stop(home, stopInput(home));
        expect(
            run(home, ['prompt'], JSON.stringify({ prompt: 'hi' })).stdout,
        ).toContain('siesta due');
    });
});

describe('the warn-only undo', () => {
    test('with the block off, the epoch’s first stop warns instead', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        gate.isBlocking = false;
        try {
            const out = stop(home, stopInput(home));
            expect(out).not.toHaveProperty('decision');
            expect(said(out)).toContain('siesta due');
        } finally {
            gate.isBlocking = true;
        }
    });
});

describe('every clio on its own stamp', () => {
    test('an ignored nudge blocks again after an hour, not before', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        expect(said(stop(home, stopInput(home)))).toContain('siesta due');
        expect(said(stop(home, stopInput(home)))).toBeUndefined();
        writeSiesta(home, {
            ...siesta(home),
            nudged_at: new Date(Date.now() - 2 * HOUR).toISOString(),
        });
        expect(stop(home, stopInput(home))).toMatchObject({
            decision: 'block',
        });
    });

    test('a card left over an hour stops pausing the count', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        writeSiesta(home, {
            card_at: new Date(Date.now() - 2 * HOUR).toISOString(),
            card_printed: true,
            highs: [{ state: 'open', text: 'a hole' }],
            open: true,
        });
        expect(said(stop(home, stopInput(home)))).toContain('siesta due');
    });

    test('a siesta just opened waits for its read, past 30 min its batch nudges', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        const open = (minutes: number) =>
            writeSiesta(home, {
                highs: [],
                open: true,
                opened_at: new Date(
                    Date.now() - minutes * 60_000,
                ).toISOString(),
            });
        open(5);
        expect(said(stop(home, stopInput(home)))).toBeUndefined();
        open(45);
        expect(said(stop(home, stopInput(home)))).toContain('siesta due');
    });
});
