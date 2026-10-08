import { describe, expect, it } from 'vitest';

import { nextAt, wakeStamp } from './kick';

const NOW = new Date(2026, 9, 8, 14, 0);

describe('nextAt', () => {
    it('reads a time still ahead as today', () => {
        expect(nextAt('14:03', NOW)).toEqual(new Date(2026, 9, 8, 14, 3));
    });

    it('reads a time already passed as tomorrow', () => {
        expect(nextAt('9:30', NOW)).toEqual(new Date(2026, 9, 9, 9, 30));
    });

    it('refuses a time that is not HH:MM', () => {
        expect(nextAt('25:00', NOW)).toBeUndefined();
    });
});

describe('wakeStamp', () => {
    it("names the minute before the kick in pmset's format", () => {
        expect(wakeStamp(new Date(2026, 9, 9, 0, 0))).toBe('10/08/26 23:59:00');
    });
});
