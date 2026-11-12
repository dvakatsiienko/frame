// The sounds when an agent starts needing dima or finishes. Off by default:
// dima turns them on with the header's ♪; his own sound files go in this mod's `sounds/` folder, picked by name in
// shared `x-herdr-agents.sounds` ({ blocked, done }: "chime" or "file:<name>"). Herdr ignores settings.json's sounds (0.1.9),
// so they play here; quieter copies are made ahead (volume.js), so a sound plays the moment a status changes.

import { agents, playSound, shared } from 'herdr';

import { play, prepare } from './volume.js';

export const SOUNDS_ON = 'sounds';
export function isSoundOn() {
    try {
        return localStorage.getItem(SOUNDS_ON) === 'on';
    } catch {
        return false;
    }
}

const EVENTS = ['blocked', 'done'];
const choiceOf = (id) => shared('x-herdr-agents.sounds')?.[id] ?? 'chime';
const volumeOf = (id) => shared('x-herdr-agents.volume')?.[id] ?? 100;
const fileOf = (choice) =>
    choice.startsWith('file:')
        ? `mods/x-herdr-agents/sounds/${choice.slice(5)}`
        : null;

export function startJobs(cx) {
    let last = null;
    const warmed = new Set();
    cx.timer.every(1000, (cx) => {
        const list = agents();
        if (!isSoundOn()) {
            last = null;
            return;
        }
        for (const id of EVENTS) {
            const file = fileOf(choiceOf(id)),
                v = volumeOf(id);
            if (file && !warmed.has(`${file}|${v}`)) {
                warmed.add(`${file}|${v}`);
                cx.spawn(
                    async (cx) => {
                        await prepare(file, [v], cx).catch(() => {});
                    },
                    { owner: null },
                );
            }
        }
        const prev = last;
        last = new Map(list.map((a) => [a.address, a.status]));
        if (!prev) return;
        for (const a of list) {
            if (!EVENTS.includes(a.status) || prev.get(a.address) === a.status)
                continue;
            const choice = choiceOf(a.status),
                file = fileOf(choice);
            if (choice === 'chime') playSound(a.status);
            else if (file)
                cx.spawn(
                    async (cx) => {
                        await play(file, volumeOf(a.status), cx);
                    },
                    { owner: null },
                );
        }
    });
}
