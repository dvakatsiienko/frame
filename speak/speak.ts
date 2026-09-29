// select text → hotkey → read aloud; the same hotkey while reading → stop.
// the player is a detached process-group leader, so one kill of its group stops every engine mid-word.
// a stop never touches 1password: only the player runs under op-run (~0.8 s per call, measured 2026-09-29).
import { execFileSync, spawn } from 'node:child_process';
import {
    mkdirSync,
    openSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { CHAIN, ENGINES, type EngineName } from './engines.ts';
import { type Run, normalize } from './normalize.ts';

const STATE_DIR = join(homedir(), 'Library/Caches/speak');
const PID_FILE = join(STATE_DIR, 'speak.pid');
const OP_RUN = join(import.meta.dirname, '../script/op-run.sh');

// a finished player leaves its pid file behind; a dead pid reads as «not running»
function runningPid() {
    try {
        const pid = Number(readFileSync(PID_FILE, 'utf8'));
        process.kill(pid, 0);
        return pid;
    } catch {
        return undefined;
    }
}

// ⌘C through system events, then the previous clipboard text goes back; changeCount tells a real copy from none
const GRAB_SELECTION = `
ObjC.import('AppKit');
const board = $.NSPasteboard.generalPasteboard;
const saved = board.stringForType($.NSPasteboardTypeString);
const before = board.changeCount;
Application('System Events').keystroke('c', { using: 'command down' });
let copied = '';
for (let i = 0; i < 40 && board.changeCount === before; i++) delay(0.01);
if (board.changeCount !== before) copied = ObjC.unwrap(board.stringForType($.NSPasteboardTypeString)) ?? '';
if (!saved.isNil()) { board.clearContents; board.setStringForType(saved, $.NSPasteboardTypeString); }
copied;
`;

function grabSelection() {
    return execFileSync(
        'osascript',
        ['-l', 'JavaScript', '-e', GRAB_SELECTION],
        { encoding: 'utf8' },
    ).trim();
}

async function play({ engines, runs }: PlayJob) {
    for (const run of runs) {
        for (const name of engines) {
            try {
                await ENGINES[name](run);
                break;
            } catch (error) {
                console.error(
                    `speak: ${name} skipped — ${(error as Error).message}`,
                );
            }
        }
    }
}

async function main() {
    const { positionals, values } = parseArgs({
        allowPositionals: true,
        options: { engine: { type: 'string' }, play: { type: 'boolean' } },
    });

    if (values.play) return play(JSON.parse(positionals[0] ?? ''));

    const pid = runningPid();
    if (pid) {
        process.kill(-pid, 'SIGTERM');
        rmSync(PID_FILE, { force: true });
        console.log('⏹ speak stopped');
        return;
    }

    const engine = values.engine;
    if (engine && !(engine in ENGINES))
        throw new Error(
            `speak: engines are ${Object.keys(ENGINES).join(', ')}`,
        );
    const runs = normalize(positionals.join(' ') || grabSelection());
    if (!runs.length) {
        console.log('speak: nothing selected');
        return;
    }

    mkdirSync(STATE_DIR, { recursive: true });
    const job: PlayJob = {
        engines: engine ? [engine as EngineName] : [...CHAIN],
        runs,
    };
    const player = spawn(
        OP_RUN,
        [process.execPath, import.meta.filename, '--play', JSON.stringify(job)],
        {
            detached: true,
            stdio: [
                'ignore',
                'ignore',
                openSync(join(STATE_DIR, 'speak.log'), 'a'),
            ],
        },
    );
    writeFileSync(PID_FILE, String(player.pid));
    player.unref();
    console.log('🔊 speak');
}

await main();

/* Types */

interface PlayJob {
    engines: EngineName[];
    runs: Run[];
}
