// the 5h ladder's numbers and words, one place: pure, no `$`. acting on a line is clio's (`clio:shift` § the 5h ladder)
const MIN = 60_000;
const HOUR = 60 * MIN;
const FIVE_HOUR_MS = 5 * HOUR;
// the waker's resume wave never reads as over pace
const FRESH_PACE = 10;
const STALE_MS = 10 * MIN;
// the same window, whatever the api's seconds do to its reset time
const SAME_WINDOW_MS = 10 * MIN;

// every number a 🎛️ row shows and `pnpm mods:set` writes, read at each poll; the store key is the name
export const PACE_SETTINGS = {
    'hot-late': {
        label: '🔥 last ping, min before the reset',
        max: 60,
        min: 0,
        of: 45,
    },
    'hot-minutes': { label: '🔥 ping every, min', max: 59, min: 1, of: 50 },
    'pace-burn': { label: '🔋 burn at, min left', max: 120, min: 0, of: 55 },
    'pace-over': { label: '🔋 park at, % over pace', max: 100, min: 1, of: 5 },
    'pace-park': { label: '🔋 park at, % used', max: 100, min: 1, of: 90 },
    'pace-stop': { label: '🔋 stop at, % used', max: 100, min: 1, of: 97 },
    'pace-under': {
        label: '🔋 resume at, % under pace',
        max: 100,
        min: 0,
        of: 2,
    },
} as const;

export const PACE_KEYS = Object.keys(
    PACE_SETTINGS,
) as (keyof typeof PACE_SETTINGS)[];

const defaults = Object.fromEntries(
    Object.entries(PACE_SETTINGS).map(([k, v]) => [k, v.of]),
) as PaceNumbers;

// the share of the window already gone, so a used % on pace keeps up exactly
export const paceOf = (resetsAt: number, now: number) =>
    Math.round(
        Math.min(100, Math.max(0, (1 - (resetsAt - now) / FIVE_HOUR_MS) * 100)),
    );

// the rung the meter is on now, highest first, `stored` the one the session last heard; `between` keeps the stored one, undefined
// only a turn writes the meter, and only a turn raises used %: an old file blocks the parks, never the resume, and a park
// it blocks stays `between`
export function paceRung(
    { now, resetsAt, used, writtenAt }: PaceMeter,
    stored?: string,
    n: PaceNumbers = defaults,
) {
    const left = resetsAt - now;
    if (left <= 0 || writtenAt < resetsAt - FIVE_HOUR_MS) return undefined;
    const pace = paceOf(resetsAt, now);
    const over = used - pace;
    if (used >= n['pace-stop']) return 'stop';
    if (left <= n['pace-burn'] * MIN) return 'burn';
    if (used >= n['pace-park'] || over >= n['pace-over']) {
        if (now - writtenAt > STALE_MS || pace < FRESH_PACE) return 'between';
        return used >= n['pace-park'] ? 'park-used' : 'park-over';
    }
    return isPaceParked(stored) && over <= -n['pace-under']
        ? 'resume'
        : 'between';
}

export const isPaceParked = (rung: string | undefined) =>
    rung === 'park-over' || rung === 'park-used';

// the reset's own line waits on what the fleet was told: a stop or a park
export const isPaceHeld = (rung: string | undefined) =>
    rung === 'stop' || isPaceParked(rung);

export const isSameWindow = (a: number, b: number) =>
    Math.abs(a - b) < SAME_WINDOW_MS;

export const isPaceLineDue = (rung: PaceRung, stored: PaceRung | undefined) =>
    rung !== 'between' && rung !== stored;

export const PACE_NEW_WINDOW =
    '🔋 new window: reset done, resume the fleet; a hand park stays';

export function paceLine(
    rung: Exclude<PaceRung, 'between'>,
    m: PaceMeter,
    n: PaceNumbers = defaults,
) {
    const over = m.used - paceOf(m.resetsAt, m.now);
    const left = Math.max(0, Math.round((m.resetsAt - m.now) / MIN));
    const gap = over
        ? `${Math.abs(over)} % ${over > 0 ? 'over' : 'under'} pace`
        : 'on pace';
    const park = ['park', 'park at a pit stop, 🔥 on for all'] as const;
    const [word, ask] = {
        burn: [
            'burn',
            `unspent usage dies at the reset; run to ${n['pace-stop']} %`,
        ],
        'park-over': park,
        'park-used': park,
        resume: ['resume', 'resume the fleet'],
        stop: [
            'stop',
            'tell everyone to pause now; they continue from the same spot at the new window; the rest is for small asks',
        ],
    }[rung];
    return `🔋 ${word}: ${m.used} % used, ${gap}, ${Math.floor(left / 60)}h ${left % 60}m left — ${ask}`;
}

/* Types */
export type PaceMeter = {
    now: number;
    resetsAt: number;
    used: number;
    writtenAt: number;
};
export type PaceRung = NonNullable<ReturnType<typeof paceRung>>;
export type PaceNumbers = Record<keyof typeof PACE_SETTINGS, number>;
