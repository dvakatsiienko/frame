import { spawnSync } from 'node:child_process';
import {
    chmodSync,
    existsSync,
    mkdtempSync,
    readFileSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// FRM-339: a fixture run with CCROW_STATE_DIR writes its notes there, and the real notes file stays as it was.
// `claude` is a stub on PATH, so the run spends nothing (the frame rule for a script that spends money)
const REAL_NOTES = join(homedir(), '.local/state/crow/notes.jsonl');
const REVIEW = {
    againstDecisions: [],
    findings: [],
    fragileAssumptions: [],
    missing: [],
    noMaterialObjection: true,
    openQuestions: [],
    preMortem: [],
    problemAreas: [],
    verdict: 'proceed',
};

const stamp = (path: string) =>
    existsSync(path)
        ? `${statSync(path).size}:${statSync(path).mtimeMs}`
        : 'absent';

it('a plan critique run under CCROW_STATE_DIR leaves the real notes file unchanged', () => {
    const state = mkdtempSync(join(tmpdir(), 'ccrow-state-'));
    const bin = mkdtempSync(join(tmpdir(), 'ccrow-bin-'));
    writeFileSync(
        join(bin, 'claude'),
        `#!/bin/sh\nprintf '%s' '${JSON.stringify({ result: 'a blind take', session_id: 'stub', structured_output: REVIEW })}'\n`,
    );
    chmodSync(join(bin, 'claude'), 0o755);
    const before = stamp(REAL_NOTES);
    const run = spawnSync(
        'node',
        [
            join(import.meta.dirname, 'plan-critique.ts'),
            join(import.meta.dirname, 'fixtures/plan.md'),
        ],
        {
            encoding: 'utf8',
            env: {
                ...process.env,
                CCROW_STATE_DIR: state,
                PATH: `${bin}:${process.env.PATH}`,
            },
        },
    );
    const notes = readFileSync(join(state, 'notes.jsonl'), 'utf8')
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l) as { channel: string; verdict: string });
    expect([
        run.status,
        notes.map((n) => [n.channel, n.verdict]),
        stamp(REAL_NOTES),
    ]).toEqual([0, [['plan', 'proceed']], before]);
}, 30_000);
