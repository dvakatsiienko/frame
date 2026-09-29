import Color from 'colorjs.io';
import { expect, it } from 'vitest';

import { runScript } from './lib/run.ts';

it('fits each ramp step within 0.1 of its target ratio against the background', () => {
    const targets = [3, 4.5, 7];

    const { stdout } = runScript('palette', [
        '#5b3cc4',
        '--ratios',
        targets.join(','),
        '--bg',
        '#111318',
    ]);

    const { color } = JSON.parse(stdout);
    const background = new Color(color.bg.base.$value);
    const measured = Object.values<{ $value: string }>(color.brand).map(
        (step) => background.contrast(new Color(step.$value), 'WCAG21'),
    );
    expect(measured).toHaveLength(targets.length);
    for (const [index, target] of targets.entries())
        expect(measured[index]).toBeCloseTo(target, 1);
});
