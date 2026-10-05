import { describe, expect, test } from 'vitest';

import { loadLine } from './skill-router.ts';

describe('loadLine', () => {
    test.each(['cclio:evergreen', 'cclio:halt', 'x:cmt', 'x:handoff'])(
        'a %s pick is never auto-trusted',
        (name) => {
            expect(loadLine([{ name, p: 0.9 }])).toBe(
                `skills (jev router): ${name} 0.90 ⚠ read first`,
            );
        },
    );

    test('a plain pick carries no warning', () => {
        expect(loadLine([{ name: 'x:pm', p: 0.82 }])).toBe(
            'skills (jev router): x:pm 0.82',
        );
    });

    test('no pick prints nothing', () => {
        expect(loadLine([])).toBeUndefined();
    });
});
