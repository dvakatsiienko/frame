// select text → hotkey → read aloud; the same hotkey while reading → stop.
// the player is a detached process-group leader, so one kill of its group stops `say` mid-word.
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { type Lang, type Run, normalize } from './normalize.ts';

const STATE_DIR = join(homedir(), 'Library/Caches/speak');
const PID_FILE = join(STATE_DIR, 'speak.pid');

// en has no -v: `say` then speaks with the Spoken Content system voice, which is where siri voice 4 lives
const VOICES = {
    en: [],
    ru: ['-v', 'Milena'],
    uk: ['-v', 'Lesya'],
} as const satisfies Record<Lang, readonly string[]>;

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

async function play(runs: Run[]) {
    for (const run of runs) {
        await new Promise((resolve) =>
            spawn('say', [...VOICES[run.lang], run.text], {
                stdio: 'ignore',
            }).on('exit', resolve),
        );
    }
}

async function main() {
    if (process.argv[2] === '--play') {
        const runs: Run[] = JSON.parse(readFileSync(0, 'utf8'));
        await play(runs);
        if (runningPid() === process.pid) rmSync(PID_FILE, { force: true });
        return;
    }

    const pid = runningPid();
    if (pid) {
        process.kill(-pid, 'SIGTERM');
        rmSync(PID_FILE, { force: true });
        console.log('⏹ speak stopped');
        return;
    }

    const runs = normalize(process.argv[2] ?? grabSelection());
    if (!runs.length) {
        console.log('speak: nothing selected');
        return;
    }
    mkdirSync(STATE_DIR, { recursive: true });
    const player = spawn(process.execPath, [import.meta.filename, '--play'], {
        detached: true,
        stdio: ['pipe', 'ignore', 'ignore'],
    });
    player.stdin.end(JSON.stringify(runs));
    writeFileSync(PID_FILE, String(player.pid));
    player.unref();
    console.log('🔊 speak');
}

await main();
