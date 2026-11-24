import type { On } from 'claude-code';

// a row's wait of `ms` mock time in two polls, not one a minute: the poll due next, then one at the wait's end. hooked
// above the row's `mock.clock`, or the clock takes the wait first
export function pollSkip(on: On, poll: number) {
    let wait: number | undefined;
    on('clock.after', { ms: poll }, (_$, e, next) => {
        const ms = wait ?? e.ms;
        wait = undefined;
        return next({ ...e, ms });
    });
    return (clock: { advance: (ms: number) => Promise<void> }, ms: number) => {
        wait = ms > poll ? ms - poll : undefined;
        return clock.advance(ms);
    };
}
