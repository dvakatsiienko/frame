/**
 * hotkeys:top — what the x-monitor-hotkey-stats daemon recorded. Top chords, the apps they
 * were pressed in, app switches, and the bindings that exist but never get pressed.
 * Aggregation lives in `stats.ts`; the daemon that fills the log is `main.swift`.
 */

import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

import {
    bold,
    dim,
    done,
    note,
    step,
    title,
    warn,
    yb,
} from '../script/lib/print.ts';
/* Instruments */
import { appName } from './app-name.ts';
import { chordOf } from './chord.ts';
import { readLog } from './log.ts';
import type { Hotkey } from './manual.ts';
import {
    LABEL_SEPARATOR,
    type Tally,
    byApp,
    byChord,
    byLabelledChord,
    isUntracked,
    liveHotkeys,
    ofKind,
    selectEvents,
    tally,
    tallyFeatures,
    timeInFront,
    unpressed,
} from './stats.ts';

const DATA = join(homedir(), '.local/share/x-monitor-hotkey-stats');

const HELP = `
monitor-hotkey:top — read the chord and app-switch log

  pnpm monitor-hotkey:top [options]

  --days <n>       how far back to look, in days           (default all time)
  --app <text>     only events whose bundle id contains    (default all apps)
                   this text, case-insensitive
  --ignore <chord> drop a chord from the window entirely;
                   repeatable, or comma-separated          (default none)
                   e.g. --ignore opt+esc,shift+cmd+4
  --limit <n>      rows per section, 0 for every row        (default 15)
  --help           this text

  Log: ~/.local/share/x-monitor-hotkey-stats/YYYY-MM.jsonl
`;

if (process.argv.includes('--help')) {
    console.log(HELP.trim());
    process.exit(0);
}

const flag = (name: string) => {
    const at = process.argv.indexOf(`--${name}`);
    return at === -1 ? undefined : process.argv[at + 1];
};

const flagAll = (name: string) =>
    process.argv.flatMap((arg, at) =>
        arg === `--${name}` ? (process.argv[at + 1]?.split(',') ?? []) : [],
    );

// No default window: the lifetime record is what this is opened for, and it is the window
// the chords app opens on. The two surfaces answer the same question, so they may not disagree
// about which days that question covers.
const daysFlag = flag('days');
const days = daysFlag === undefined ? undefined : Number(daysFlag);
const app = flag('app');
// A section truncates by default, so every row past the cap is unreachable at
// any terminal height — `--limit 0` is the way to see all of them.
const capped = Number(flag('limit') ?? 15);
const ignore = flagAll('ignore');

if (days !== undefined && (!Number.isFinite(days) || days <= 0)) {
    console.error('--days wants a positive number');
    process.exit(1);
}

if (!Number.isInteger(capped) || capped < 0) {
    console.error('--limit wants a whole number, 0 or more');
    process.exit(1);
}

const limit = capped === 0 ? Number.POSITIVE_INFINITY : capped;

const readBindings = (): Hotkey[] => {
    try {
        const raw = execFileSync(
            process.execPath,
            [join(import.meta.dirname, 'scan.ts')],
            { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
        );
        return JSON.parse(raw).hotkeys as Hotkey[];
    } catch (error) {
        // Silence here cost a day: the move into schedule/ left this path one level short, and
        // the join simply stopped happening behind the tidy "skipping" line below.
        console.error(`hotkeys:scan failed — ${(error as Error).message}`);
        return [];
    }
};

const bar = (count: number, top: number) =>
    '█'.repeat(Math.max(1, Math.round((count / top) * 18)));

const table = (
    rows: Tally[],
    label: (name: string) => string = (name) => name,
) => {
    const top = rows[0]?.count ?? 1;
    const pad = String(top).length;
    for (const row of rows.slice(0, limit)) {
        console.log(
            `  ${bold(String(row.count).padStart(pad))} ${dim(bar(row.count, top).padEnd(18))} ${label(row.name)}`,
        );
    }
    if (rows.length > limit) note(`… ${rows.length - limit} more`);
};

const all = readLog(DATA);
const window = selectEvents(all, { app, days, ignore });
const chords = ofKind(window, 'chord');
const switches = ofKind(window, 'activate');

const subtitle = [
    days === undefined ? 'all time' : `${days} d`,
    app ? `app ~ ${app}` : '',
    ignore.length > 0 ? `ignoring ${ignore.join(', ')}` : '',
]
    .filter(Boolean)
    .join(' · ');

title('monitor-hotkey:top', subtitle);

if (all.length === 0) {
    warn('nothing logged yet', DATA.replace(homedir(), '~'));
    note(
        'is the daemon up?  launchctl print gui/$UID/com.dima.x-monitor-hotkey-stats',
    );
    done('nothing to report', { clean: false });
    process.exit(0);
}

const bindings = readBindings();
// The chords table joins a press to the meaning it had at the time, so it reads every row a
// move ever ended. The never-pressed list asks what is on the keyboard today, so it reads only
// what is still bound.
const live = liveHotkeys(bindings);

const chordLabel = (name: string) => {
    const [chord, action, app] = name.split(LABEL_SEPARATOR);
    return chord && action ? `${chord}  ${dim(`${action} · ${app}`)}` : name;
};

const pressed = chords.filter((event) => !isUntracked(bindings, event));

step('features');
table(
    tallyFeatures(bindings, pressed).map(({ feature, count }) => ({
        count,
        name: feature,
    })),
    (name) => name,
);

step(`chords  ${dim(`${pressed.length} presses`)}`);
table(tally(pressed, byLabelledChord(bindings)), chordLabel);

step(`time per app  ${dim('minutes in front, a gap over 15 capped')}`);
table(timeInFront(window), appName);

if (switches.length > 0) {
    step(`switches per app  ${dim(`${switches.length} activations`)}`);
    table(tally(switches, byApp), appName);
}

if (bindings.length === 0) {
    step('bound but never pressed');
    warn('hotkeys:scan returned nothing — skipping the join');
} else {
    const cold = unpressed(live, chords);
    step(`bound but never pressed  ${dim(`${cold.length} of ${live.length}`)}`);
    for (const hotkey of cold.slice(0, limit)) {
        console.log(
            `  ${yb(chordOf(hotkey).padEnd(22))} ${hotkey.action} ${dim(hotkey.app)}`,
        );
    }
    if (cold.length > limit) note(`… ${cold.length - limit} more`);
}

const plural = (n: number, one: string, many: string) =>
    `${n} ${n === 1 ? one : many}`;
done(
    [
        plural(pressed.length, 'press', 'presses'),
        plural(tally(pressed, byChord).length, 'chord', 'chords'),
        plural(switches.length, 'switch', 'switches'),
    ].join(' · '),
);
