// pnpm mods:quiet-canary [--deadline <min>] — sends clio a test [progress] ping through x-mod-stash's /quiet-canary in
// a headless session (no model call), then reads her quiet log by the ping's nonce: held → delivered, or FAIL. exit 0
// delivered, 1 FAIL, 2 bad input
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

// the verdicts a nonce's lines can carry, furthest along first
const ORDER = ['flushed', 'failed-open', 'passed', 'held'] as const;

export type CanaryState = 'none' | QuietVerdict;

// the furthest a nonce's log lines got: a flushed line beats held, held beats none
export function canaryState(
    store: Record<string, unknown>,
    nonce: string,
): CanaryState {
    const lines = Object.entries(store)
        .filter(([k, v]) => k.startsWith('quiet-log:') && Array.isArray(v))
        .flatMap(([, v]) => v as { canary?: unknown; verdict?: unknown }[])
        .filter((l) => l?.canary === nonce);
    const verdicts = new Set(lines.map((l) => l.verdict));
    for (const v of ORDER) if (verdicts.has(v)) return v;
    return 'none';
}

// minutes to wait for the flush: the idle wait dima set (1–60, 10 by default) + 2 with no args, `--deadline <n>` alone,
// else undefined
export function deadlineOf(argv: string[], wait?: unknown) {
    const set = Number(wait);
    if (!argv.length) return (set >= 1 && set <= 60 ? set : 10) + 2;
    const n = Number(argv[1]);
    return argv.length === 2 && argv[0] === '--deadline' && n > 0
        ? n
        : undefined;
}

function readStores() {
    const dir = join(homedir(), '.claude/plugins/store');
    const store: Record<string, unknown> = {};
    let files: string[] = [];
    try {
        files = readdirSync(dir);
    } catch {}
    for (const f of files.filter((n) => /^x-mod-stash_.*\.json$/.test(n)))
        try {
            const v = JSON.parse(readFileSync(join(dir, f), 'utf8'));
            for (const [k, lines] of Object.entries(v))
                store[k] = Array.isArray(lines)
                    ? [...((store[k] as unknown[] | undefined) ?? []), ...lines]
                    : lines;
        } catch {}
    return store;
}

async function waitFor(
    nonce: string,
    isDone: (s: CanaryState) => boolean,
    ms: number,
) {
    const end = Date.now() + ms;
    let state = canaryState(readStores(), nonce);
    while (!isDone(state) && Date.now() < end) {
        await sleep(2000);
        state = canaryState(readStores(), nonce);
    }
    return state;
}

async function main(argv: string[]) {
    const deadline = deadlineOf(argv, readStores()['quiet-wait']);
    if (deadline === undefined) {
        console.error('usage: pnpm mods:quiet-canary [--deadline <minutes>]');
        return 2;
    }
    const nonce = `c${Date.now().toString(36)}`;
    const run = spawnSync(
        'claude',
        ['-p', `/quiet-canary ${nonce}`, '--output-format', 'json'],
        { encoding: 'utf8', timeout: 90_000 },
    );
    let result = run.stderr || 'no output';
    try {
        result = JSON.parse(run.stdout).result ?? result;
    } catch {}
    if (!result.endsWith(`quiet canary ${nonce}: sent`)) {
        console.log(`FAIL: the send did not go out: ${result.trim()}`);
        return 1;
    }
    const first = await waitFor(nonce, (s) => s !== 'none', 30_000);
    if (first === 'none') {
        console.log(
            `FAIL: sent ${nonce}, clio's log holds no line for it in 30 s — her x-mod-stash is not loaded, not named 🦉 clio, or the ping was lost`,
        );
        return 1;
    }
    if (first === 'failed-open') {
        console.log(
            `FAIL: ${nonce} passed unjudged, the hold threw (failed-open)`,
        );
        return 1;
    }
    if (first === 'passed') {
        console.log(
            `passed → delivered: ${nonce} was not held (quiet off or mobile mode)`,
        );
        return 0;
    }
    console.log(
        `held: ${nonce}, waiting up to ${deadline} min for clio's next prompt or the idle row`,
    );
    const last = await waitFor(
        nonce,
        (s) => s === 'flushed',
        deadline * 60_000,
    );
    if (last === 'flushed') {
        console.log(`held → delivered: ${nonce}`);
        return 0;
    }
    console.log(
        `FAIL: ${nonce} held, not delivered in ${deadline} min — the 🤫 n on clio's row should read red`,
    );
    return 1;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));

/* Types */
type QuietVerdict = (typeof ORDER)[number];
