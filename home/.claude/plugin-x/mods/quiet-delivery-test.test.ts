import { spawnSync } from 'node:child_process';
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';

import { deadlineOf, deliveryTestState } from './quiet-delivery-test.ts';
import { LEDGER_SENDS, QUIET_LOG_APPEND } from './x-mod-stash/hooks/parse.ts';

const line = (verdict: string, deliveryTest?: string) =>
    JSON.stringify({
        at: 1,
        from: 'frame-5e',
        verdict,
        ...(deliveryTest ? { deliveryTest } : {}),
    });

test('a nonce with no log line reads none', () => {
    expect(deliveryTestState(line('held'), 'c1')).toBe('none');
});

test('a held nonce reads held', () => {
    expect(deliveryTestState(line('held', 'c1'), 'c1')).toBe('held');
});

test('a flushed line beats its held one, across two days', () => {
    expect(
        deliveryTestState(
            `${line('held', 'c1')}\n\n${line('flushed', 'c1')}\n`,
            'c1',
        ),
    ).toBe('flushed');
});

test("another nonce's lines and a torn line are ignored", () => {
    expect(
        deliveryTestState(
            `${line('flushed', 'c2')}\n{"at":1,\n${line('held', 'c1')}\n`,
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

test("the log's append makes its dir and keeps every byte of the lines before", () => {
    const home = mkdtempSync(join(tmpdir(), 'quiet-log-'));
    const file = join(home, 'a dir/2026-10-12.jsonl');
    const texts = [
        line('it\'s 5 % "x" $HOME \\n 🦉'),
        '{"at":2,"torn',
        '{"at":3}',
    ];
    for (const text of texts)
        spawnSync('sh', ['-c', QUIET_LOG_APPEND, 'sh', file, text], {
            timeout: 10_000,
        });
    const kept = readFileSync(file, 'utf8');
    rmSync(home, { force: true, recursive: true });
    expect(kept).toBe(texts.map((t) => `\n${t}\n`).join(''));
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
    const out = spawnSync(
        'sh',
        ['-c', LEDGER_SENDS, 'sh', home, 'sid-1', 'clio'],
        { encoding: 'utf8', timeout: 10_000 },
    ).stdout;
    // frame's commit hook runs this file: its fixtures leave with it
    rmSync(home, { force: true, recursive: true });
    return out.split('\n').filter(Boolean);
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
