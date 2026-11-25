import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { stop } from './siesta-gate.ts';
import { SID, fixtureHome, said } from './siesta-gate-world.ts';

describe('his items wait for his prompt', () => {
    const turnFrom = (home: string, opener: string) => {
        const file = join(home, 'pace.jsonl');
        const rows = [
            { message: { content: opener }, type: 'user' },
            {
                message: {
                    content: [
                        {
                            input: { asks: [], op: 'add' },
                            name: 'mcp__x-mod-stash__orbit',
                            type: 'tool_use',
                        },
                    ],
                },
                type: 'assistant',
            },
        ];
        writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n'));
        return {
            session_id: SID,
            stop_hook_active: false,
            transcript_path: file,
        };
    };

    test('a job-woken turn that asks him is hinted, never blocked', () => {
        const home = fixtureHome();
        const out = stop(home, turnFrom(home, '<task-notification> done'));
        expect(said(out)).toContain('his items wait');
        expect(out).not.toHaveProperty('decision');
    });

    test('a queue run holds the hint off', () => {
        const home = fixtureHome();
        const flags = join(home, '.local/state/clio/queue-run');
        mkdirSync(flags, { recursive: true });
        writeFileSync(join(flags, SID), '');
        const out = stop(home, turnFrom(home, '<task-notification> done'));
        expect(said(out) ?? '').not.toContain('his items wait');
    });

    test('his own prompt opening an ask is fine', () => {
        const home = fixtureHome();
        const out = stop(home, turnFrom(home, 'go 1 + 2'));
        expect(said(out) ?? '').not.toContain('his items wait');
    });
});
