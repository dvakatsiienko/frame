// a waystation, not a home: the store keys whose owners still sit in register.tsx; each one leaves with its
// owner's move, and FRM-662 slice B's last step deletes this file or names why a key stays
import type { BackgroundTask } from './parse.ts';

// a session's last reply: when it ended, its 🔭 wait; `ended` once the session itself exited
// waits: every background task's own name when the reply set no 🔭, so the board can list them all
export type Reply = {
    at: number;
    // a keep-hot ping's reply end: it warms the cache without being a reply dima reads
    pingedAt?: number;
    name?: string;
    wait?: string;
    waits?: string[];
    // the background tasks the wait came from, so an end notice can settle one
    tasks?: BackgroundTask[];
    ended?: number;
};
// how far this session read herdr's ticks file for it: the `at` of the newest press taken, one key per session id
export const HERDR_READ = 'herdr-read:';
// 💨 and ⏰ stay here with 🔥: keep-warm writes them, session-record copies them into the fleet's shelf
export const AFK_KEY = 'afk';
export const REPLY = 'reply:';
// the model and effort of a session's main loop, as its last model request named them
export const MODEL = 'model:';
// the waker: one global switch, off by default; when on, a session stopped on the 5h cap gets one resume at the reset
export const WAKER_KEY = 'waker';
// stays here, never a leftover: session-record writes it into the fleet's shelf and keep-warm writes the shelf through
// session-record, so keep-warm holding the key would close an import cycle
// 🔥 keep warm: `hot:<sid>`, this session's ping clock, `{ since }` on, `{ off: true }` dima's off
export const HOT = 'hot:';

// off is a written value, so a seat's default arms only a key never written
export const hotOf = (key: unknown) =>
    key && (key as { off?: boolean }).off !== true
        ? (key as { since: number })
        : undefined;
