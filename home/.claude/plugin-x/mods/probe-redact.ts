// pnpm mods:probe-redact — proves redact live: a headless session gets a planted fake key in its prompt, pipes it
// through Bash into a file, and its transcript must hold the key only in the engine's queue-operation record
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
    existsSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    realpathSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

// built by concatenation, so no source line reads as a secret to a live redactor
const fake = ['sk-ant-api03-', 'PROBE'.repeat(5)].join('');
const placeholder = /‹sk-ant…[0-9a-f]{8}›/;
const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'probe-redact-')));
const out = join(cwd, 'out.txt');
const sessionId = randomUUID();

const run = spawnSync(
    'claude',
    [
        '-p',
        `Run exactly this one Bash command and nothing else, then reply done: printf %s ${fake} | tee ${out}`,
        '--allowedTools=Bash',
        '--session-id',
        sessionId,
    ],
    { cwd, encoding: 'utf8', timeout: 240_000 },
);
if (run.error || run.status === null) {
    console.error(
        `probe-redact: claude did not run — ${run.error?.message ?? 'timed out after 4 min'}`,
    );
    process.exit(2);
}

const transcript = findTranscript(sessionId);
if (!transcript) {
    console.error(
        `probe-redact: no transcript for session ${sessionId} under ~/.claude/projects`,
    );
    process.exit(1);
}

const rows = readFileSync(transcript, 'utf8').split('\n').filter(Boolean);
const raw = rows.filter(
    (row) => row.includes(fake) && !row.includes('"queue-operation"'),
).length;
const masked = rows.filter((row) => placeholder.test(row)).length;
const checks: [string, boolean][] = [
    [
        'the command got the real value',
        existsSync(out) && readFileSync(out, 'utf8') === fake,
    ],
    [
        `no raw value outside the queue-operation record (${raw} found)`,
        raw === 0,
    ],
    [`rows read the placeholder (${masked} found)`, masked > 0],
];
for (const [check, isOk] of checks) console.log(`${isOk ? '✓' : '✘'} ${check}`);
console.log(`transcript: ${transcript}`);
process.exit(checks.every(([, isOk]) => isOk) ? 0 : 1);

function findTranscript(id: string) {
    const root = join(homedir(), '.claude/projects');
    for (const dir of readdirSync(root)) {
        const path = join(root, dir, `${id}.jsonl`);
        if (existsSync(path)) return path;
    }
    return undefined;
}
