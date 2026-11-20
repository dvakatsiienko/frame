// 🎚️ the band's presses (FRM-662): a press on another surface's band — herdr, the desktop — read from the shared
// press log past this thread's own watermark, each taken once, a refused one told back

import type { EngineInterface } from 'claude-code';

import {
    type ViewDoors,
    armHot,
    setAfk,
    setHot,
    setWaker,
} from './keep-warm.ts';
import { PRESS_DIR, bandPressLines } from './orbit.ts';
import { takeOverridePress } from './override.ts';
import { registry } from './roster.ts';
import { currentId } from './session-identity.ts';
import { AFK_KEY, WAKER_KEY } from './store-keys.ts';
import { markActive } from './turn.ts';
import { setWind } from './wind.ts';

// how far this thread read the band presses: the `at` of the newest line taken, from the thread's start on
export const BAND_READ = 'band-read:';
// `band-refused:<sid>`: the times of lines this thread saw dated ahead of now
export const BAND_REFUSED = 'band-refused:';
const BAND_REFUSED_MS = 24 * 60 * 60 * 1000;
// herdr's band presses reach this thread as its own band's would: wind and hot only for their sid, ⏰ and 💨 only when
// newer than the state they set, so the latest press wins whichever band it came from (FRM-568 slice 5)
export async function takeBandPresses($: EngineInterface, view: ViewDoors) {
    const sid = await currentId($);
    const home = await $.env.get('HOME').catch(() => undefined);
    if (!sid || !home) return;
    const now = await $.clock.now();
    const read = await $.store.get(BAND_READ + sid).catch(() => undefined);
    const after =
        typeof read === 'number'
            ? read
            : ((await registry($).catch(() => []))
                  .filter((r) => r.base.sid === sid)
                  .map((r) => r.startedAt)
                  .find((at) => typeof at === 'number') ?? now);
    const text = await $.fs
        .read(`${home}/.claude/shelf/${PRESS_DIR}/band.jsonl`)
        .catch(() => '');
    // a line dated ahead of now is refused for good, never taken once its time passes: its time is kept a day
    const refusedKey = BAND_REFUSED + sid;
    const kept = ((await $.store.get(refusedKey).catch(() => undefined)) ??
        []) as number[];
    const ahead = bandPressLines(text, after, Number.POSITIVE_INFINITY)
        .map((p) => p.at)
        .filter((at) => at > now);
    const refused = [...new Set([...kept, ...ahead])].filter(
        (at) => at > now - BAND_REFUSED_MS,
    );
    if (refused.join() !== kept.join()) await $.store.set(refusedKey, refused);
    const presses = bandPressLines(text, after, now).filter(
        (p) => !refused.includes(p.at),
    );
    // his press from herdr is an event: the bookkeeping jobs tick at 4 s again
    if (presses.length) await markActive($);
    for (const p of presses) {
        if (p.button === 'wind' && p.sid === sid) await setWind($, sid, p.on);
        if (p.button === 'hot' && p.sid === sid) {
            await setHot($, p.on);
            await armHot($, view);
        }
        if (p.button !== 'waker' && p.button !== 'afk') continue;
        const key = p.button === 'waker' ? WAKER_KEY : AFK_KEY;
        const stored = (await $.store.get(key)) as { at?: number } | undefined;
        if (typeof stored?.at === 'number' && stored.at >= p.at) continue;
        if (p.button === 'waker') await setWaker($, p.on, p.at);
        else await setAfk($, p.on, p.at);
    }
    const override = presses.findLast((p) => p.button === 'override');
    if (override) await takeOverridePress($, home, override);
    const last = Math.max(after, ...presses.map((p) => p.at));
    if (last !== read) await $.store.set(BAND_READ + sid, last);
    if (presses.length) await view.load();
}

export async function forgetBandReads($: EngineInterface, sid: string) {
    await $.store.delete(BAND_READ + sid);
    await $.store.delete(BAND_REFUSED + sid);
}
