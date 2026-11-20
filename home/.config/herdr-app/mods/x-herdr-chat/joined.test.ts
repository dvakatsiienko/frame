import { describe, expect, test } from 'vitest';

import { rejoin } from './joined.js';
import { relayIn } from './relay.js';

describe('a name cc stored with its joiner as a space draws whole (dima, 16:00: «crow emoji in folded messages»)', () => {
    test('crow, the second wind and dima come back whole', () => {
        expect(rejoin('🐦 ⬛ crow')).toBe('🐦‍⬛ crow');
        expect(rejoin('🐦 🔥 wind')).toBe('🐦‍🔥 wind');
        expect(rejoin('🙋 ♂️ dima')).toBe('🙋‍♂️ dima');
    });

    test('a name with no split joiner stays as it is', () => {
        expect(rejoin('🦉 clio')).toBe('🦉 clio');
        expect(rejoin('🐦‍⬛ crow')).toBe('🐦‍⬛ crow');
    });

    test("a folded message's sender reads whole", () => {
        const entry = {
            origin: { body: 'consult', kind: 'peer', name: '🐦 ⬛ crow' },
            timestamp: '2026-11-12T13:59:00Z',
            type: 'user',
        };
        expect(relayIn(entry)?.from).toBe('🐦‍⬛ crow');
    });
});
