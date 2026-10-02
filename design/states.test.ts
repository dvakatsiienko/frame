import { join } from 'node:path';
import { expect, it } from 'vitest';

import { runScript, writeTemp } from './lib/run.ts';

const fixtures = join(import.meta.dirname, 'fixtures/states');
const takes = join(fixtures, 'takes');

it('names the board that shows each ftr state, its gloss and case ignored', () => {
    const { status, stdout } = runScript('states', [
        '--ftr',
        join(fixtures, 'FTR.md'),
        '--takes',
        takes,
    ]);

    expect(status).toBe(0);
    expect(stdout).toContain(
        'narrow (<1100 px, the ring unrolled) — project/ring-narrow',
    );
});

it('exits 1 naming a state no board shows', () => {
    const ftr = writeTemp('FTR.md', '> states: day · zoomed\n');

    const { status, stdout } = runScript('states', [
        '--ftr',
        ftr,
        '--takes',
        takes,
    ]);

    expect(status).toBe(1);
    expect(stdout).toContain('missing: zoomed');
});

it('exits 2 without an ftr', () => {
    expect(runScript('states', ['--takes', takes]).status).toBe(2);
});
