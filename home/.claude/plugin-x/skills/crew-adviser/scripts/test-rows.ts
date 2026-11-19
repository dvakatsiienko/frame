import { join } from 'node:path';

import { readLines } from './transcript.ts';

export const fixtures = join(import.meta.dirname, 'fixtures');

export const lines = readLines(join(fixtures, 'transcript.jsonl'));

export const toolUse = (id: string, name: string, input: object) =>
    JSON.stringify({
        message: {
            content: [{ id, input, name, type: 'tool_use' }],
            id: `m-${id}`,
        },
        type: 'assistant',
    });

export const toolResult = (id: string, content: unknown, isError = false) =>
    JSON.stringify({
        message: {
            content: [
                {
                    content,
                    ...(isError ? { is_error: true } : {}),
                    tool_use_id: id,
                    type: 'tool_result',
                },
            ],
        },
        type: 'user',
    });

export const prompt = (text: string) =>
    JSON.stringify({ message: { content: text }, type: 'user' });

export const say = (text: string) =>
    JSON.stringify({
        message: { content: [{ text, type: 'text' }], id: `m-${text}` },
        type: 'assistant',
    });
