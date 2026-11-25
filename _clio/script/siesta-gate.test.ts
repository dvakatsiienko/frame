import {
    appendFileSync,
    mkdirSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { compact, prompt, stop } from './siesta-gate.ts';
import {
    SID,
    commit,
    fixtureHome,
    run,
    said,
    siesta,
    stopInput,
    writeSiesta,
} from './siesta-gate-world.ts';

describe('the siesta comes due', () => {
    test('odd files never crash the hook', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        const dir = join(home, '.local/state/clio');
        writeFileSync(join(dir, 'siesta-last'), 'garbage\n');
        const input = stopInput(home);
        appendFileSync(input.transcript_path, '\n{"type": "us');
        mkdirSync(join(home, '.claude/plugins/store'), { recursive: true });
        writeFileSync(
            join(home, '.claude/plugins/store/x-mod-stash_inline-0000.json'),
            'null',
        );
        expect(said(stop(home, input))).toContain('siesta due');
        expect(prompt(home, { prompt: 'go on' })).toContain('siesta due');
    });
});

describe('the state file', () => {
    test('keeps only the keys the gate reads', () => {
        const home = fixtureHome();
        writeSiesta(home, { blocked_epoch: 3, last_turn: 'dima', open: false });
        stop(home, stopInput(home));
        expect(Object.keys(siesta(home))).not.toContain('blocked_epoch');
        expect(Object.keys(siesta(home))).not.toContain('last_turn');
    });
});

describe('a compaction is logged', () => {
    test('one line per compaction, with its time', () => {
        const home = fixtureHome();
        compact(home, { session_id: SID, trigger: 'auto' });
        const log = join(home, '.local/state/clio/compactions.log');
        const lines = readFileSync(log, 'utf8').trim().split('\n');
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d/);
        compact(home, { session_id: SID, trigger: 'manual' });
        expect(readFileSync(log, 'utf8').trim().split('\n')).toHaveLength(2);
    });
});

describe('the cli', () => {
    test('a stdin that is not json leaves the hook silent and whole', () => {
        const home = fixtureHome();
        const out = run(home, ['stop'], 'not json');
        expect(out.status).toBe(0);
    });

    test('stop reads the hook json on stdin and prints its verdict', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        const out = run(home, ['stop'], JSON.stringify(stopInput(home)));
        expect(out.status).toBe(0);
        expect(JSON.parse(out.stdout)).toMatchObject({ decision: 'block' });
    });
});
