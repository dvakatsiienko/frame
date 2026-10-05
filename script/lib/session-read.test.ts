import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { listingParse, sessionRead } from './session-read.ts';

describe('sessionRead', () => {
    test('a compaction clears the skills in play', () => {
        const path = join(
            mkdtempSync(join(tmpdir(), 'session-read-')),
            't.jsonl',
        );
        const lines = [
            {
                message: {
                    content: [
                        {
                            input: { skill: 'x:cmt' },
                            name: 'Skill',
                            type: 'tool_use',
                        },
                    ],
                },
                type: 'assistant',
            },
            { subtype: 'compact_boundary', type: 'system' },
        ];
        writeFileSync(path, lines.map((l) => JSON.stringify(l)).join('\n'));
        expect([...sessionRead(path).seen]).toEqual([]);
    });
});

describe('listingParse', () => {
    test('a description holding its own bullets stays one skill', () => {
        const content =
            '- x:walkthrough: teach by showing\n- Explicit learning requests\n- Confusion signals\n- x:pm: tickets';
        expect(listingParse(content, ['x:walkthrough', 'x:pm'])).toEqual([
            [
                'x:walkthrough',
                'teach by showing - Explicit learning requests - Confusion signals',
            ],
            ['x:pm', 'tickets'],
        ]);
    });
});
