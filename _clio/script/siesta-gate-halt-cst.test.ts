import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { stop } from './siesta-gate.ts';
import { SID, fixtureHome, said } from './siesta-gate-world.ts';

describe('a halt that stopped crow writes its CST', () => {
    const bashTranscript = (home: string, ...commands: string[]) => {
        const file = join(home, 'halt.jsonl');
        const rows = commands.map((command) => ({
            message: {
                content: [
                    { input: { command }, name: 'Bash', type: 'tool_use' },
                ],
            },
            type: 'assistant',
        }));
        writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n'));
        return {
            session_id: SID,
            stop_hook_active: false,
            transcript_path: file,
        };
    };

    test('crow stopped and no handoff written blocks the stop', () => {
        const home = fixtureHome();
        const out = stop(
            home,
            bashTranscript(home, 'pnpm -C ~/frame crow:stop'),
        );
        expect(out).toMatchObject({ decision: 'block' });
        expect(said(out)).toContain('CST');
    });

    test('a handoff written after the stop lets it end', () => {
        const home = fixtureHome();
        const out = stop(
            home,
            bashTranscript(
                home,
                'pnpm -C ~/frame crow:stop',
                'x handoff write --audience clio --slug a-halt < cst.md',
            ),
        );
        expect(said(out) ?? '').not.toContain('CST');
    });
    test('a crow restart is no halt', () => {
        const home = fixtureHome();
        const out = stop(
            home,
            bashTranscript(
                home,
                'pnpm -C ~/frame crow:stop',
                'pnpm -C ~/frame crow:start opus --pane',
            ),
        );
        expect(said(out) ?? '').not.toContain('CST');
    });

    test('a command only naming crow:stop is no halt', () => {
        const home = fixtureHome();
        const out = stop(
            home,
            bashTranscript(home, "rg -n 'crow:stop' main.md"),
        );
        expect(said(out) ?? '').not.toContain('CST');
    });
});
