import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { stop } from './siesta-gate.ts';
import { SID, fixtureHome, said } from './siesta-gate-world.ts';

describe('a resume reads the 5h window', () => {
    const turn = (home: string, ...tools: object[]) => {
        const file = join(home, 'resume.jsonl');
        const rows = [
            { message: { content: 'resume the lane' }, type: 'user' },
            ...tools.map((t) => ({
                message: { content: [{ type: 'tool_use', ...t }] },
                type: 'assistant',
            })),
        ];
        writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n'));
        return {
            session_id: SID,
            stop_hook_active: false,
            transcript_path: file,
        };
    };
    const resume = (id: string, to = '⚡ 🔧 codie: clio-lean | FRM-494') => ({
        id,
        input: { message: 'resume — the window is back on pace', to },
        name: 'SendMessage',
    });

    test('a resume to a lane member with no window read in the turn is named', () => {
        const home = fixtureHome();
        const out = stop(home, turn(home, resume('t1')));
        expect(out).not.toHaveProperty('decision');
        expect(said(out)).toContain('5h window');
    });

    test.each([
        {
            input: {
                command: 'jq .five_hour ~/.claude/shelf/cc-usage-window.json',
            },
            name: 'Bash',
        },
        { input: {}, name: 'mcp__ccd_session_mgmt__get_usage' },
        {
            input: {
                file_path: '/Users/dima/.claude/shelf/cc-usage-window.json',
            },
            name: 'Read',
        },
    ])('a window read in the same turn clears it', (read) => {
        const home = fixtureHome();
        expect(
            stop(home, turn(home, { id: 'r1', ...read }, resume('t1'))),
        ).toBeUndefined();
    });

    test('a resume to a member’s session id is a lane member’s too', () => {
        const home = fixtureHome();
        const out = stop(home, turn(home, resume('t1', 'local_d02d1c75-aaaa')));
        expect(said(out)).toContain('5h window');
    });

    test('a resume to helga or a plain message to a member warns nothing', () => {
        const home = fixtureHome();
        const steer = {
            id: 't2',
            input: { message: 'next: FRM-495', to: '⚡ 🔧 codie: x' },
            name: 'SendMessage',
        };
        expect(
            stop(home, turn(home, resume('t1', '🎀 helga'), steer)),
        ).toBeUndefined();
    });

    test('the same resume is named once', () => {
        const home = fixtureHome();
        const input = turn(home, resume('t1'));
        expect(said(stop(home, input))).toContain('5h window');
        expect(stop(home, input)).toBeUndefined();
    });
});
