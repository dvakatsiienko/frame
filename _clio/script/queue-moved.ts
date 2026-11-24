// PostToolUse (Bash): a move of the queue (a dispatch, a landing, a state, a link, a body) leaves clio a seal to forget, so the
// lanes are read again once the moves settle, and a lane with a member that owes a move is named to her, silent chore
// usage: hook on stdin; prints one additionalContext json line, or nothing
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

// a burst of moves is one read, by the last of them
const SETTLE_MS = 20_000;
const READ_TIMEOUT_MS = 100_000;
// where a command starts: the text or a line, after `&&`, `;` or `|`, or a loop's `do` / `then`; then env words, a timeout, an x path
const START =
    '(?:^|[;&|]|\\b(?:do|then)\\b)\\s*(?:[A-Za-z_]\\w*=\\S*\\s+)*(?:timeout\\s+\\d+\\s+)?(?:\\S*/)?x\\s+';
// the rest of one command: a flag is a word of its own, so a quoted one (its spaces masked) never counts
const REST = '[^;&|\\n]*\\s';
// an allow-list: only these runs move the queue
const QUEUE_MOVES = [
    `lane\\s+(?:dispatch|landed)\\b${REST}--apply\\b`,
    `linear\\s+set\\b${REST}(?:--(?:state|milestone|order|sort-order)\\b|--add-label[ =]["']?signed\\b)`,
    'linear\\s+link\\b',
    `linear\\s+body\\b${REST}--set\\b`,
].map((move) => new RegExp(START + move, 'm'));

export function isQueueMove(command: string) {
    const text = command
        .replaceAll('\\\n', ' ')
        // a heredoc body is text, whatever its lines start with
        .replace(
            /(<<-?\s*['"]?(\w+)['"]?[^\n]*)\n[\s\S]*?\n[ \t]*\2[ \t]*$/gm,
            '$1',
        )
        // quoted text is text: its spaces and separators are masked, so no command or flag starts inside it
        .replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, (quoted) =>
            quoted.replace(/[\s;&|]/g, '_'),
        );
    return QUEUE_MOVES.some((move) => move.test(text));
}

// the lines of an active lane (a member live or parked) that owes a move
export function forgottenLines(lines: string[]) {
    return lines.filter(
        (line) =>
            line.startsWith('🔴') &&
            (line.includes('member live') || line.includes('member parked')),
    );
}

async function main() {
    const event = parsedEvent(readFileSync(0, 'utf8'));
    if (
        event.tool_name !== 'Bash' ||
        !isQueueMove(event.tool_input?.command ?? '')
    )
        return;
    const stateFile = path.join(
        process.env.HOME || homedir(),
        '.local/state/clio/queue-moved',
    );
    const stamp = String(Date.now());
    mkdirSync(path.dirname(stateFile), { recursive: true });
    writeFileSync(stateFile, stamp);
    await sleep(SETTLE_MS);
    // a later move rewrote the stamp: its own run reads the settled queue
    if (Number(readFileSync(stateFile, 'utf8')) > Number(stamp)) return;
    // exit 0, 1 and 2 are all a normal read; only the lines matter
    const read = spawnSync(
        'node',
        [path.join(import.meta.dirname, 'sealed-ahead.ts')],
        { encoding: 'utf8', timeout: READ_TIMEOUT_MS },
    );
    const lines = (read.stdout ?? '').split('\n');
    const forgotten = forgottenLines(lines);
    if (!forgotten.length) return;
    console.log(
        JSON.stringify({
            hookSpecificOutput: {
                additionalContext: `🦭 the queue moved, clio forgot a seal (silent chore, never an ask to dima): sign, seal or unblock now\n${[...forgotten, ...lines.filter((line) => line.startsWith('🟡'))].join('\n')}`,
                hookEventName: 'PostToolUse',
            },
        }),
    );
}

function parsedEvent(text: string): HookEvent {
    try {
        return (JSON.parse(text) ?? {}) as HookEvent;
    } catch {
        return {};
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();

/* Types */

type HookEvent = { tool_input?: { command?: string }; tool_name?: string };
