import { describe, expect, it } from 'vitest';

import { costPerTicket, parseSession } from './agent-ops.ts';

const assistant = (
    id: string,
    ts: string,
    usage: Record<string, number>,
    content: object[],
    stopReason = 'tool_use',
) =>
    JSON.stringify({
        message: { content, id, stop_reason: stopReason, usage },
        timestamp: ts,
        type: 'assistant',
    });

const call = (name: string) => ({
    input: { file_path: 'a.ts' },
    name,
    type: 'tool_use',
});
const text = { text: 'hello', type: 'text' };
const title = (value: string) =>
    JSON.stringify({ customTitle: value, type: 'custom-title' });

describe('parseSession', () => {
    it('counts a step once when its message.id repeats across lines', () => {
        const usage = { input_tokens: 10, output_tokens: 5 };
        const session = parseSession(
            [
                assistant('m1', '2026-10-07T10:00:00Z', usage, [call('Bash')]),
                assistant('m1', '2026-10-07T10:00:01Z', usage, [call('Bash')]),
            ],
            'a.jsonl',
        );
        expect(session.steps).toBe(1);
        expect(session.tokens).toBe(15);
    });

    it('sums input, cache creation, cache read and output tokens', () => {
        const session = parseSession(
            [
                assistant(
                    'm1',
                    '2026-10-07T10:00:00Z',
                    {
                        cache_creation_input_tokens: 100,
                        cache_read_input_tokens: 1000,
                        input_tokens: 1,
                        output_tokens: 10,
                    },
                    [text],
                    'end_turn',
                ),
            ],
            'a.jsonl',
        );
        expect(session.tokens).toBe(1111);
    });
});

describe('costPerTicket', () => {
    it('adds the coder and verifier sessions of one ticket', () => {
        const usage = { output_tokens: 100 };
        const session = (name: string, start: string, end: string) =>
            parseSession(
                [
                    title(name),
                    assistant('m1', start, usage, [text], 'end_turn'),
                    assistant('m2', end, usage, [text], 'end_turn'),
                ],
                'a.jsonl',
            );
        const costs = costPerTicket([
            session(
                '☕️ 🔧 FRM-9 code: x',
                '2026-10-07T10:00:00Z',
                '2026-10-07T10:10:00Z',
            ),
            session(
                '☕️ 🔎 FRM-9 verify: #1',
                '2026-10-07T11:00:00Z',
                '2026-10-07T11:05:00Z',
            ),
        ]);
        expect(costs.get('FRM-9')).toEqual({ tokens: 400, wallMs: 15 * 60000 });
    });
});
