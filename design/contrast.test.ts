import { expect, it } from 'vitest';

import { colorTokens, runScript, writeTemp } from './lib/run.ts';

it('fails a text pair at 3:1 with its WCAG ratio and APCA Lc, and exits 1', () => {
    const tokens = writeTemp(
        'tokens.json',
        colorTokens({ bg: { base: '#ffffff' }, fg: { grey: '#949494' } }),
    );

    const { status, stdout } = runScript('contrast', [tokens]);

    expect(stdout).toMatch(
        /^fail\s+fg\.grey on bg\.base\s+3\.03:1 \(min 4\.5\)\s+APCA Lc\s+57\.1/m,
    );
    expect(status).toBe(1);
});
