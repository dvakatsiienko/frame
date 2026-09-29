/**
 * hotkeys:stamp — writes `feature` onto every press line the recorder logged before it stamped
 * them, using the bindings as they stood at each press (ended rows included). Once every line
 * carries its feature, no ended binding is needed to explain the past, and manual.ts holds only
 * what is on the keyboard.
 *
 * `--prune` also deletes every press no live binding's feature explains — never a hotkey, or a
 * binding dima removed. The log then holds exactly what the page counts (dima, 2026-09-29: «no
 * db in chords», a wiped binding takes its history with it).
 *
 * It copies the log directory aside first and refuses to run while the recorder is up: the
 * recorder holds its month's file open, and a file replaced under it would swallow new presses.
 *
 *   launchctl bootout gui/$UID/com.dima.x-monitor-hotkey-stats
 *   pnpm hotkeys:stamp [--prune]
 *   launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.dima.x-monitor-hotkey-stats.plist
 */
import { execFileSync } from 'node:child_process';
import { cpSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { logFiles } from './log.ts';
import type { Hotkey } from './manual.ts';
import { featureOf, labelAt, liveFeatures } from './stats.ts';

const DATA = join(homedir(), '.local/share/x-monitor-hotkey-stats');
const JOB = 'com.dima.x-monitor-hotkey-stats';

const isRecorderUp = () => {
    try {
        return /"PID" = \d+/.test(
            execFileSync('launchctl', ['list', JOB], { encoding: 'utf8' }),
        );
    } catch {
        return false;
    }
};

if (isRecorderUp()) {
    console.error(
        `the recorder is running — stop it first: launchctl bootout gui/$UID/${JOB}`,
    );
    process.exit(1);
}

const bindings: Hotkey[] = JSON.parse(
    readFileSync(join(import.meta.dirname, 'hotkeys.json'), 'utf8'),
).hotkeys;
const isPruning = process.argv.includes('--prune');
const live = liveFeatures(bindings);

const backup = `${DATA}.backup-${new Date().toISOString().slice(0, 16).replace(/[:T-]/g, '')}`;
cpSync(DATA, backup, { recursive: true });

let stamped = 0;
let unbound = 0;
let pruned = 0;

// one line in, zero or one line out
const rewrite = (line: string): string[] => {
    if (!line.trim()) return [line];
    let press: Record<string, unknown>;
    try {
        press = JSON.parse(line);
    } catch {
        return [line];
    }
    const isChord = press.kind === undefined || press.kind === 'chord';
    if (!isChord || typeof press.chord !== 'string') return [line];

    const hotkey =
        typeof press.feature === 'string'
            ? undefined
            : labelAt(
                  bindings,
                  press.chord,
                  String(press.ts),
                  String(press.app),
              );
    const feature =
        typeof press.feature === 'string'
            ? press.feature
            : hotkey && featureOf(hotkey);

    if (isPruning && (feature === undefined || !live.has(feature))) {
        pruned += 1;
        return [];
    }
    if (typeof press.feature === 'string') return [line];
    if (feature === undefined) {
        unbound += 1;
        return [line];
    }
    stamped += 1;
    // the recorder's own field order: ts, kind, chord, feature, app
    const { ts, kind, chord, app, ...rest } = press;
    return [JSON.stringify({ app, chord, feature, kind, ts, ...rest })];
};

for (const name of logFiles(DATA)) {
    const path = join(DATA, name);
    const lines = readFileSync(path, 'utf8').split('\n').flatMap(rewrite);
    writeFileSync(`${path}.stamping`, lines.join('\n'));
    renameSync(`${path}.stamping`, path);
}

console.log(
    `stamped ${stamped} · pruned ${pruned} · ${unbound} left unbound · backup ${backup}`,
);
