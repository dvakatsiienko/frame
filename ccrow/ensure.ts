import {
    armOfDay,
    dayOf,
    fail,
    findSession,
    readState,
    startCcrow,
} from './lib.ts';

if (process.argv.length > 2) {
    fail(
        'ccrow:ensure — start ccrow on the day’s arm unless one already runs; takes no arguments',
    );
}

const running = findSession();
if (running) {
    console.log(
        `ccrow live: pid ${running.pid}, job ${running.jobId ?? 'unknown'}`,
    );
} else {
    const now = Date.now();
    await startCcrow(armOfDay(dayOf(readState().firstWakeAt ?? now, now)));
}
