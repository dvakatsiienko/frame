import { SESSION_NAME, STATE_DIR, armHot, fail, oneCcrow } from './lib.ts';

if (process.argv.length > 2) {
    fail(
        'ccrow:keep-cache-hot — find the live ccrow tab and keep it 🔥 hot; takes no arguments',
    );
}

// ccrow lives in a desktop tab dima opens (mods load there, not under --bg); cclio cannot open one
const running = oneCcrow();
if (running) {
    console.log(`ccrow live: pid ${running.pid}`);
    armHot(running.sessionId);
} else {
    console.log(
        `ccrow not live: dima opens a desktop Code tab in ${STATE_DIR} named «${SESSION_NAME}»`,
    );
}
