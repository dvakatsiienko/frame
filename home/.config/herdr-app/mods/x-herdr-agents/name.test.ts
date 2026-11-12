import { describe, expect, test } from 'vitest';

import { threadName } from './name.js';

describe('the agents list names a thread', () => {
    test('by the pretty name its record draws', () => {
        expect(
            threadName({
                display: '🌗 🔧 cli | FRM-436',
                name: '⚡ 🔧 codie: tests-cheaper | FRM-533',
            }),
        ).toBe('🌗 🔧 cli | FRM-436');
    });

    test('by its registry name when the record reads unknown', () => {
        expect(threadName({ display: 'unknown', name: '🦉 clio' })).toBe(
            '🦉 clio',
        );
    });

    test('with the joiner put back in a registry name', () => {
        expect(threadName({ name: '🐦 ⬛ crow' })).toBe('🐦‍⬛ crow');
    });

    test('by nothing when no session is found', () => {
        expect(threadName(null)).toBeNull();
    });
});
