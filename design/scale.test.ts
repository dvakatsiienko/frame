import { expect, it } from 'vitest';

import { runScript } from './lib/run.ts';

it('prints 8 type and 9 space steps, each a valid clamp()', () => {
    const { stdout } = runScript('scale', []);

    const steps = [...stdout.matchAll(/^\s+--(text|spacing)-[\w-]+: (.+);/gm)];
    const clamp =
        /^clamp\(-?\d+(\.\d+)?rem, -?\d+(\.\d+)?rem [+-] \d+(\.\d+)?vw, -?\d+(\.\d+)?rem\)$/;
    expect(steps.filter(([, family]) => family === 'text')).toHaveLength(8);
    expect(steps.filter(([, family]) => family === 'spacing')).toHaveLength(9);
    for (const [, , value] of steps) expect(value).toMatch(clamp);
});
