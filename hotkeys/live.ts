// The always-on half of the hotkey map: it counts what has actually been pressed, reruns the
// binding scan when an app's preferences move, and serves the chords app that draws both.
//   node ./hotkeys/live.ts [--watch]
//
// Counts live in this process now and travel to the page as server-sent events. They used to
// be written to a presses.js the page re-inserted on a 2s timer, because a page opened off
// disk cannot fetch a sibling file — that whole road existed to get around file://, and being
// served removes it.
//
// The daemon stays dumb about the keyboard on purpose. The swift monitor appends one jsonl
// line per chord and knows nothing about this file, the page, or any format — everything the
// map shows is derived here, from the log it already writes. A page format that reached into
// main.swift would need a swift rebuild, a codesign and an Input Monitoring re-grant every
// time the map wanted a new number.
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { logFiles, readLog } from './log.ts';
import { startChordsServer } from './serve.ts';
import { sourceList } from './sources.ts';

// --data-dir aims the watcher at a fixture directory instead of the monitor's real log, so a
// second daemon can be stood up around a press that never happened. It fails loud rather than
// falling back: a silent default here would test the wrong directory and still look green.
const dataDir = () => {
    const at = process.argv.indexOf('--data-dir');

    if (at === -1)
        return join(homedir(), '.local/share/x-monitor-hotkey-stats');

    const path = process.argv[at + 1];

    if (!path) throw new Error('--data-dir needs a path');

    return path;
};

const DATA = dataDir();
const SCAN = join(import.meta.dirname, 'scan.ts');
const EVERY_MS = 2000;

const readCounts = () => {
    const counts: Record<string, number> = {};

    for (const event of readLog(DATA)) {
        if (event.kind !== 'chord' || !event.chord) continue;

        counts[event.chord] = (counts[event.chord] ?? 0) + 1;
    }

    return { counts, updatedAt: new Date().toISOString() };
};

// This runs as an always-on launchd job, so the idle path has to cost nothing: the log is a
// month of lines (27k by mid-september) and re-parsing it every 2s to learn that nothing
// happened would burn cpu forever. One stat per file per tick answers that instead, and the
// counts are only rebuilt when a press actually landed.
const logSignature = () =>
    logFiles(DATA)
        .map((name) => `${name}:${statSync(join(DATA, name)).mtimeMs}`)
        .join('|');

// The bindings go stale too: dima rebinds something in wispr or cursor and the map keeps
// drawing yesterday's keyboard until someone remembers `pnpm hotkeys:scan`. Same trick,
// different files — the scan's own source list, stat'd, and a change reruns it. A rebind made
// from the chords ui lands in manual.ts, which is on that list, so it comes back the same way.
const sourceSignature = () =>
    sourceList
        .map(
            (path) =>
                `${path}:${statSync(path, { throwIfNoEntry: false })?.mtimeMs ?? 0}`,
        )
        .join('|');

// Run out of process: the scan opens the app config files, one through plutil, and a throw from
// any of them must not take the watcher down with it. scan.ts rewrites hotkeys.json as it runs.
const rescan = () => {
    try {
        execFileSync(process.execPath, [SCAN], {
            stdio: ['ignore', 'ignore', 'inherit'],
        });
        console.log(`bindings rescanned — ${new Date().toISOString()}`);

        return true;
    } catch (error) {
        console.error(`scan failed — ${(error as Error).message}`);

        return false;
    }
};

let lastSources = sourceSignature();
let lastSignature = logSignature();

if (process.argv.includes('--watch')) {
    const chords = startChordsServer({ dataDir: DATA });

    chords.pushPresses(readCounts());
    console.log(
        `watching ${DATA} and ${sourceList.length} config sources — checked every ${EVERY_MS / 1000}s`,
    );

    setInterval(() => {
        const sources = sourceSignature();

        if (sources !== lastSources) {
            lastSources = sources;
            if (rescan()) chords.pushBindings();
        }

        const signature = logSignature();

        if (signature === lastSignature) return;

        lastSignature = signature;
        chords.pushPresses(readCounts());
    }, EVERY_MS);
} else {
    console.log(
        `${Object.keys(readCounts().counts).length} chords pressed so far — run with --watch to serve chords`,
    );
}
