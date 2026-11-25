import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('herdr', () => ({
    appHome: () => '/app',
    openOverlay: vi.fn(),
    watchFolder: vi.fn(),
}));
vi.mock('gpui-base', () => ({}));
vi.mock('gpui-kit', () => ({}));
vi.mock('fs/promises', () => ({ mkdir: vi.fn(), readFile: vi.fn() }));

const { ago, resetText, usageWindows } = await import('./usage.js');

const NOW = new Date(2026, 10, 25, 14, 0).getTime();
const HOUR = 3600 * 1000;
const usage = (rate_limits: object) => ({ at: NOW, rate_limits }) as never;

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
});
afterEach(() => {
    vi.useRealTimers();
});

describe('the usage windows', () => {
    test('the 5-hour one first, each named, its percent whole', () => {
        expect(
            usageWindows(
                usage({
                    five_hour: { used_percentage: 12.2 },
                    seven_day: { used_percentage: 48.6 },
                    seven_day_opus_4: { used_percentage: 3 },
                }),
            ).map((w) => [w.key, w.name, w.short, w.pct]),
        ).toEqual([
            ['five_hour', '5-hour limit', '5h', 12],
            ['seven_day', 'Weekly limit', 'wk', 49],
            ['seven_day_opus_4', 'Weekly limit · Opus 4', null, 3],
        ]);
    });

    test('a percent past its ends stays on the bar', () => {
        expect(
            usageWindows(
                usage({
                    a: { used_percentage: 140 },
                    b: { used_percentage: -2 },
                }),
            ).map((w) => w.pct),
        ).toEqual([100, 0]);
    });

    test('a reset time reads in seconds, milliseconds or a date; one that passed shows 0', () => {
        const at = (resets_at: unknown) =>
            usageWindows(
                usage({ five_hour: { resets_at, used_percentage: 70 } }),
            )[0];
        expect(at((NOW + HOUR) / 1000)).toMatchObject({
            pct: 70,
            reset: false,
            resets: NOW + HOUR,
        });
        expect(at(NOW + HOUR)?.resets).toBe(NOW + HOUR);
        expect(at(new Date(NOW + HOUR).toISOString())?.resets).toBe(NOW + HOUR);
        expect(at('soon')?.resets).toBeNull();
        expect(at((NOW - HOUR) / 1000)).toMatchObject({ pct: 0, reset: true });
    });

    test('a spend limit says its money; a window with no percent is left out, no file has none', () => {
        expect(
            usageWindows(
                usage({
                    spend_limit: {
                        limit_usd: 20,
                        period: 'month',
                        used_percentage: 5,
                        used_usd: 1.5,
                    },
                    unread: {},
                }),
            ).map((w) => [w.name, w.spend]),
        ).toEqual([['Spend limit', '$1.50 / $20.00 this month']]);
        expect(usageWindows(null)).toEqual([]);
    });
});

test('a reset’s time today, with its weekday on another day, and one that passed', () => {
    const text = (resets: number | null, reset = false) =>
        resetText({ reset, resets } as never);
    expect(text(NOW + HOUR)).toBe('Resets at 3:00 PM');
    expect(text(NOW + 24 * HOUR)).toBe('Resets at Thu 2:00 PM');
    expect(text(NOW - 14 * HOUR, true)).toBe('Reset at 12:00 AM');
    expect(text(null)).toBe('');
});

test('how long ago, in the nearest unit', () => {
    expect(
        [0, 59, 60, 3600 * 5, 86400 * 3].map((s) => ago(NOW - s * 1000)),
    ).toEqual(['just now', 'just now', '1 min ago', '5 h ago', '3 days ago']);
});
