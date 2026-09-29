import { expect, it } from 'vitest';

import { colorTokens, runScript, writeTemp } from './lib/run.ts';

it('flags a red/green pair that collapses under deuteranopia with its ΔE under 8', () => {
    const tokens = writeTemp(
        'tokens.json',
        colorTokens({
            bg: { base: '#ffffff' },
            fg: { error: '#e0442f', success: '#6b8e23' },
        }),
    );

    const { status, stdout } = runScript('cvd', [tokens]);

    const row = stdout
        .split('\n')
        .find((line) => line.includes('fg.error / fg.success'));
    const [normal, protan, deutan] = row?.match(/!?\d+\.\d/g) ?? [];
    expect(row).toMatch(/^flag/);
    expect({ deutan, normal, protan }).toEqual({
        deutan: '!7.9',
        normal: '54.6',
        protan: '20.9',
    });
    expect(status).toBe(1);
});
