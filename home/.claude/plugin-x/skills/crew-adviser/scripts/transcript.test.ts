import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { wakeMarker } from './lib.ts';
import { lines, prompt, toolResult, toolUse } from './test-rows.ts';
import {
    readLines,
    readTurn,
    receiptsOf,
    transcriptDelta,
} from './transcript.ts';

describe('transcriptDelta', () => {
    test('keeps dima, peer and clio text from the offset on', () => {
        expect(transcriptDelta(lines, 2).text).toBe(
            [
                '## dima\nship the crow build',
                '## clio\non it',
                '## peer\ncoder: done, pr #9',
                '## clio\ndone, all green',
            ].join('\n\n'),
        );
    });

    test('keeps a message dima typed mid-turn, its image as a marker', () => {
        const queued = [
            JSON.stringify({
                attachment: {
                    prompt: [
                        { type: 'image' },
                        { text: 'the fold bug', type: 'text' },
                    ],
                    type: 'queued_command',
                },
                type: 'attachment',
            }),
        ];
        expect(transcriptDelta(queued, 0).text).toBe(
            '## dima\n[image]\nthe fold bug',
        );
    });

    test("keeps dima's orbit marks and notes, drops the other hook context", () => {
        const hooked = [
            JSON.stringify({
                attachment: {
                    content: [
                        'now 15:48',
                        'orbit: dima marked 1 ask.\n- o98 🛎️ accepted: hazards · his note: «which workflows?»',
                    ],
                    hookEvent: 'UserPromptSubmit',
                    type: 'hook_additional_context',
                },
                type: 'attachment',
            }),
            JSON.stringify({
                attachment: {
                    content: ['phases not set this turn'],
                    hookEvent: 'PreToolUse',
                    type: 'hook_additional_context',
                },
                type: 'attachment',
            }),
        ];
        expect(transcriptDelta(hooked, 0).text).toBe(
            '## dima\norbit: dima marked 1 ask.\n- o98 🛎️ accepted: hazards · his note: «which workflows?»',
        );
    });

    test('leaves out a peer message queued mid-turn', () => {
        const queued = [
            JSON.stringify({
                attachment: {
                    prompt: '<cross-session-message from="x">hi</cross-session-message>',
                    type: 'queued_command',
                },
                type: 'attachment',
            }),
        ];
        expect(transcriptDelta(queued, 0).text).toBe('');
    });

    test('caps a long task notification and names its output file', () => {
        const report = 'x'.repeat(5_000);
        const note = [
            JSON.stringify({
                message: {
                    content: `<task-notification><output-file>/tmp/a.output</output-file><result>${report}</result></task-notification>`,
                },
                type: 'user',
            }),
        ];
        const text = transcriptDelta(note, 0).text;
        expect(text.length).toBeLessThan(2_200);
        expect(text).toContain('full: /tmp/a.output');
    });

    test('an over-long delta drops whole blocks from its head', () => {
        const big = Array.from({ length: 4 }, (_, i) =>
            JSON.stringify({
                message: { content: `${i}`.repeat(25_000) },
                type: 'user',
            }),
        );
        const delta = transcriptDelta(big, 0);
        expect([delta.text.startsWith('## dima\n2'), delta.cut.blocks]).toEqual(
            [true, 2],
        );
    });

    test('counts one step per assistant message id', () => {
        expect(transcriptDelta(lines, 2).steps).toBe(2);
    });

    test('a compaction that replays the old chain keeps every block since the last wake', () => {
        const entry = (uuid: string, timestamp: string, text: string) =>
            JSON.stringify({
                message: { content: text },
                timestamp,
                type: 'user',
                uuid,
            });
        const oldChain = ['a', 'b', 'c'].map((uuid, i) =>
            entry(
                uuid,
                `2026-10-22T14:0${i}:00Z`,
                `old-${uuid} ${'x'.repeat(25_000)}`,
            ),
        );
        const compacted = [
            ...oldChain,
            entry('d', '2026-10-22T16:23:00Z', 'new-d'),
            entry('e', '2026-10-22T16:39:00Z', 'new-e'),
            ...oldChain,
            JSON.stringify({
                subtype: 'compact_boundary',
                timestamp: '2026-10-22T16:48:19Z',
                type: 'system',
                uuid: 'f',
            }),
            entry('g', '2026-10-22T16:49:00Z', 'new-g'),
        ];
        const bodies = transcriptDelta(compacted, oldChain.length)
            .text.split(/\n\n(?=## )/)
            .map((block) => block.split('\n')[1]);
        expect(bodies).toEqual(['new-d', 'new-e', 'new-g']);
    });

    test("leaves out a compaction's summary, which is cc's text, not dima's", () => {
        const summary = [
            JSON.stringify({
                isCompactSummary: true,
                message: {
                    content:
                        'This session is being continued from a previous conversation',
                },
                type: 'user',
                uuid: 'h',
            }),
        ];
        expect(transcriptDelta(summary, 0).text).toBe('');
    });
});

describe('receiptsOf', () => {
    test('one line per call since dima last spoke, with its exit, error and image', () => {
        const receipts = receiptsOf([
            toolUse('old', 'Bash', { command: 'before his line' }),
            toolResult('old', 'x'),
            prompt('fix it'),
            toolUse('a', 'Bash', { command: 'pnpm test' }),
            toolResult('a', 'all green'),
            toolUse('b', 'Bash', { command: 'x lane commit' }),
            toolResult('b', 'Exit code 1\nbiome refused\nmore', true),
            toolUse('c', 'Read', { file_path: '/tmp/shot.png' }),
            toolResult('c', [{ source: {}, type: 'image' }]),
            toolUse('d', 'Edit', { file_path: '/tmp/a.ts' }),
        ]);
        expect(receipts.split('\n')).toEqual([
            '- Bash exit 0 · pnpm test',
            '- Bash exit 1 · x lane commit · biome refused',
            '- Read ok · /tmp/shot.png · [image: /tmp/shot.png]',
            '- Edit pending · /tmp/a.ts',
        ]);
    });

    test('a harness reminder is not dima, and his words beside one are', () => {
        const reminder = '<system-reminder>session finished</system-reminder>';
        const lines = [
            prompt('go'),
            toolUse('a', 'Bash', { command: 'ls' }),
            toolResult('a', 'x'),
            prompt(reminder),
        ];
        expect(receiptsOf(lines)).toBe('- Bash exit 0 · ls');
        expect(receiptsOf([...lines, prompt(`${reminder}\nstop`)])).toBe('');
    });

    test('a gate that echoes its exit reads red, past a long command prefix', () => {
        const prefix = `cd ~/frame && S=/tmp/${'x'.repeat(200)}`;
        const receipts = receiptsOf([
            prompt('go'),
            toolUse('a', 'Bash', { command: `${prefix} && x lane commit` }),
            toolResult('a', 'exit 1\nbiome refused'),
            toolUse('b', 'Bash', { command: 'pnpm test; echo "exit $?"' }),
            toolResult('b', 'ok\nexit 0'),
        ]).split('\n');
        expect(receipts[0]).toContain('exit 1');
        expect(receipts[0]).toContain('x lane commit');
        expect(receipts[0]).toContain('biome refused');
        expect(receipts[1]).toBe('- Bash exit 0 · pnpm test; echo "exit $?"');
    });

    test('a tool with no command or path shows its input', () => {
        expect(
            receiptsOf([
                prompt('go'),
                toolUse('a', 'orbit', { ids: ['o23'], op: 'resolve' }),
                toolResult('a', 'resolved o23'),
            ]),
        ).toBe('- orbit ok · {"ids":["o23"],"op":"resolve"}');
    });

    test('a peer and a subagent notice are not dima, so they cut nothing', () => {
        const receipts = receiptsOf([
            prompt('go'),
            toolUse('a', 'Bash', { command: 'ls' }),
            toolResult('a', 'x'),
            JSON.stringify({
                message: { content: 'from codie' },
                origin: { kind: 'peer' },
                type: 'user',
            }),
            JSON.stringify({
                message: { content: '<task-notification>x' },
                origin: { kind: 'task-notification' },
                type: 'user',
            }),
        ]);
        expect(receipts).toBe('- Bash exit 0 · ls');
    });
});

describe('readLines', () => {
    test('leaves out a last line that has no newline yet', () => {
        const path = join(mkdtempSync(join(tmpdir(), 'crow-')), 't.jsonl');
        writeFileSync(path, '{"a":1}\n{"b":');
        expect(readLines(path)).toEqual(['{"a":1}']);
    });
});

test('a desktop turn ends on stop_hook_summary, timed from its timestamps', () => {
    const dir = mkdtempSync(join(tmpdir(), 'crow-turn-'));
    const path = join(dir, 't.jsonl');
    const lines = [
        {
            message: { content: 'crow wake 1 · mode day' },
            timestamp: '2026-10-09T14:45:00Z',
            type: 'user',
        },
        {
            message: {
                content: [{ text: 'none', type: 'text' }],
                id: 'a',
                model: 'claude-fable-5-1',
            },
            timestamp: '2026-10-09T14:46:00Z',
            type: 'assistant',
        },
        {
            subtype: 'stop_hook_summary',
            timestamp: '2026-10-09T14:47:00Z',
            type: 'system',
        },
    ];
    writeFileSync(path, `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`);
    expect(readTurn(path, wakeMarker('1'))).toMatchObject({
        model: 'claude-fable-5-1',
        note: 'none',
        seconds: 120,
    });
});

test("main's wake never harvests a wing's turn that came first in the same minute", () => {
    const path = join(mkdtempSync(join(tmpdir(), 'crow-turn-')), 't.jsonl');
    const turn = (wakeId: string, note: string, minute: number) => [
        {
            message: { content: `crow wake ${wakeId} · mode day` },
            timestamp: `2026-11-07T22:${minute}0:00Z`,
            type: 'user',
        },
        {
            message: { content: [{ text: note, type: 'text' }], id: note },
            timestamp: `2026-11-07T22:${minute}1:00Z`,
            type: 'assistant',
        },
        {
            subtype: 'stop_hook_summary',
            timestamp: `2026-11-07T22:${minute}2:00Z`,
            type: 'system',
        },
    ];
    const lines = [
        ...turn('202611072240w3', 'the wing note', 1),
        ...turn('202611072240', 'the main note', 2),
    ];
    writeFileSync(path, `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`);
    expect(readTurn(path, wakeMarker('202611072240'))?.note).toBe(
        'the main note',
    );
});

test('a delta block carries its local time when the entry has one', () => {
    const at = '2026-10-09T14:45:00Z';
    const local = new Date(at);
    const hhmm = `${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')}`;
    const lines = [
        JSON.stringify({
            message: { content: 'hi' },
            timestamp: at,
            type: 'user',
        }),
    ];
    expect(transcriptDelta(lines, 0).text).toBe(`## dima · ${hhmm}\nhi`);
});
