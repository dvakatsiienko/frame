import { describe, expect, test } from 'vitest';

import { freshHotAsk } from './orbit.js';

// FRM-618 slice B exit 3: antenna's 🔥 reaches the deck's own press path
describe("antenna's keep-hot ask", () => {
    const ask = { at: 20, on: true, sid: 's1' };

    test('an ask after the last one seen fires once', () => {
        expect(freshHotAsk(ask, 10)).toEqual(ask);
        expect(freshHotAsk(ask, 20)).toBeNull();
    });

    test('a malformed ask never fires', () => {
        expect(freshHotAsk({ at: 30, sid: 's1' }, 0)).toBeNull();
        expect(freshHotAsk({ at: 30, on: true }, 0)).toBeNull();
        expect(freshHotAsk(null, 0)).toBeNull();
    });
});
