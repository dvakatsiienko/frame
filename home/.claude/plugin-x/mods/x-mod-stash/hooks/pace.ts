// the 5h ladder's numbers and words, one place: pure, no `$`. acting on a line is clio's (`clio:shift` § the 5h ladder)
const MIN = 60_000;
const HOUR = 60 * MIN;
const FIVE_HOUR_MS = 5 * HOUR;
const BURN_LEFT_MS = HOUR;
const PARK_USED = 90;
const PARK_OVER = 5;
const NO_CHUNK_USED = 70;
const RESUME_OVER = 0;
// the waker's resume wave never reads as over pace
const FRESH_PACE = 10;
const STALE_MS = 10 * MIN;
// the same window, whatever the api's seconds do to its reset time
const SAME_WINDOW_MS = 10 * MIN;

const RUNG_WORDS = {
    burn: '≤ 1 h left — burn',
    'no-chunk': '70–80 % — no new chunk',
    'park-over': '+5 over pace — park',
    'park-used': '90 % — park',
    resume: 'back to ≤ 0 — resume',
} as const;

// the share of the window already gone, so a used % on pace keeps up exactly
export const paceOf = (resetsAt: number, now: number) =>
    Math.round(
        Math.min(100, Math.max(0, (1 - (resetsAt - now) / FIVE_HOUR_MS) * 100)),
    );

// the rung the meter is on now, highest first, `stored` the one the session last heard; `between` keeps the stored one, undefined means no window to read
// only a turn writes the meter, and only a turn raises used %: an old file blocks the parks, never the resume, and a park
// it blocks stays `between`, or a lower rung's turn would refresh the file and send the park again
export function paceRung(
    { now, resetsAt, used, writtenAt }: PaceMeter,
    stored?: string,
) {
    const left = resetsAt - now;
    if (left <= 0 || writtenAt < resetsAt - FIVE_HOUR_MS) return undefined;
    const pace = paceOf(resetsAt, now);
    const over = used - pace;
    if (left <= BURN_LEFT_MS) return 'burn';
    if (used >= PARK_USED || over >= PARK_OVER) {
        if (now - writtenAt > STALE_MS || pace < FRESH_PACE) return 'between';
        return used >= PARK_USED ? 'park-used' : 'park-over';
    }
    // a parked fleet hears resume, not «no new chunk»: the lower rung waits for a window that was never parked
    const isParked = stored === 'park-over' || stored === 'park-used';
    if (over <= RESUME_OVER && (isParked || used < NO_CHUNK_USED))
        return 'resume';
    if (used < NO_CHUNK_USED || isParked || stored === 'resume')
        return 'between';
    return 'no-chunk';
}

export const isSameWindow = (a: number, b: number) =>
    Math.abs(a - b) < SAME_WINDOW_MS;

// a line only when the rung differs from the stored one; a resume needs something to resume from
export const isPaceLineDue = (rung: PaceRung, stored: PaceRung | undefined) =>
    rung !== 'between' &&
    rung !== stored &&
    !(rung === 'resume' && stored === undefined);

export function paceLine(rung: Exclude<PaceRung, 'between'>, m: PaceMeter) {
    const over = m.used - paceOf(m.resetsAt, m.now);
    const left = Math.max(0, Math.round((m.resetsAt - m.now) / MIN));
    return `🔋 pace watch: ${RUNG_WORDS[rung]}; ${m.used} % used, ${over > 0 ? '+' : ''}${over} over pace, ${Math.floor(left / 60)}h ${left % 60}m left. acting on it: clio:shift § the 5h ladder`;
}

/* Types */
export type PaceMeter = {
    now: number;
    resetsAt: number;
    used: number;
    writtenAt: number;
};
export type PaceRung = NonNullable<ReturnType<typeof paceRung>>;
