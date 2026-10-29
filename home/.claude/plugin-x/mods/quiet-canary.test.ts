import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';

import { canaryState, deadlineOf } from './quiet-canary.ts';
import { LEDGER_SENDS } from './x-mod-stash/hooks/parse.ts';

const line = (verdict: string, canary?: string) => ({
    at: 1,
    from: 'frame-5e',
    verdict,
    ...(canary ? { canary } : {}),
});

test('a nonce with no log line reads none', () => {
    expect(canaryState({ 'quiet-log:2026-10-12': [line('held')] }, 'c1')).toBe(
        'none',
    );
});

test('a held nonce reads held', () => {
    expect(
        canaryState({ 'quiet-log:2026-10-12': [line('held', 'c1')] }, 'c1'),
    ).toBe('held');
});

test('a flushed line beats its held one, across two days', () => {
    expect(
        canaryState(
            {
                'quiet-log:2026-10-12': [line('held', 'c1')],
                'quiet-log:2026-10-13': [line('flushed', 'c1')],
            },
            'c1',
        ),
    ).toBe('flushed');
});

test("another nonce's lines and other keys are ignored", () => {
    expect(
        canaryState(
            {
                'quiet-gap': { gaps: [] },
                'quiet-log:2026-10-12': [
                    line('flushed', 'c2'),
                    line('held', 'c1'),
                ],
            },
            'c1',
        ),
    ).toBe('held');
});

test('the deadline reads the default wait + 2 bare, n after --deadline, undefined for anything else', () => {
    expect(
        [
            [],
            ['--deadline', '3'],
            ['--nope'],
            ['--deadline'],
            ['--deadline', '0'],
            ['x', '--deadline', '3'],
        ].map(deadlineOf),
    ).toEqual([12, 3, undefined, undefined, undefined, undefined]);
});

test('a bare deadline follows the idle wait dima set, falling back to 10 outside 1–60', () => {
    expect([30, 61, 'x', undefined].map((w) => deadlineOf([], w))).toEqual([
        32, 12, 12, 12,
    ]);
});

// the ledger counts a member's sends to clio from its own transcript; a send whose result said success:false never
// reached her, so it is no loss
function sends(rows: unknown[]) {
    const home = mkdtempSync(join(tmpdir(), 'ledger-'));
    mkdirSync(join(home, '.claude/projects/-p'), { recursive: true });
    writeFileSync(
        join(home, '.claude/projects/-p/sid-1.jsonl'),
        rows.map((r) => JSON.stringify(r)).join('\n'),
    );
    return spawnSync('sh', ['-c', LEDGER_SENDS, 'sh', home, 'sid-1', 'clio'], {
        encoding: 'utf8',
    })
        .stdout.split('\n')
        .filter(Boolean);
}
const call = (id: string, at: string) => ({
    message: {
        content: [
            {
                id,
                input: { message: '[progress] x', to: '🦉 clio' },
                name: 'SendMessage',
                type: 'tool_use',
            },
        ],
    },
    timestamp: at,
    type: 'assistant',
});
const answer = (id: string, isSent: boolean) => ({
    message: {
        content: [
            {
                content: [
                    {
                        text: JSON.stringify({ message: 'm', success: isSent }),
                        type: 'text',
                    },
                ],
                tool_use_id: id,
                type: 'tool_result',
            },
        ],
    },
    type: 'user',
});

test('the ledger counts every send to clio that went out', () => {
    expect(
        sends([
            call('t1', '2026-10-12T15:01:00Z'),
            answer('t1', true),
            call('t2', '2026-10-12T15:02:00Z'),
        ]),
    ).toEqual(['2026-10-12T15:01:00Z', '2026-10-12T15:02:00Z']);
});

test('the ledger leaves out a send whose result said success:false', () => {
    expect(
        sends([
            call('t1', '2026-10-12T15:01:00Z'),
            answer('t1', false),
            call('t2', '2026-10-12T15:02:00Z'),
            answer('t2', true),
        ]),
    ).toEqual(['2026-10-12T15:02:00Z']);
});
