import { SESSION_NAME, STATE_DIR, armHot, fail, oneCrow } from './lib.ts';

if (process.argv.length > 2) {
    fail(
        'crow:keep-cache-hot — find the live crow tab and keep it 🔥 hot; takes no arguments',
    );
}

// crow lives in a desktop tab dima opens (mods load there, not under --bg); clio cannot open one
const running = oneCrow();
if (running) {
    console.log(`crow live: pid ${running.pid}`);
    armHot(running.sessionId);
} else {
    console.log(
        `crow not live: dima opens a desktop Code tab in ${STATE_DIR} named «${SESSION_NAME}»`,
    );
}
