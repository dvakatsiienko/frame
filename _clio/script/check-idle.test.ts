import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const script = join(import.meta.dirname, 'check-idle.ts');
const trustScreen =
    ' Quick safety check: Is this a project you created or one you trust?\n ❯ 1. Yes, I trust this folder\n   2. No, exit\n';

// a summoned pane that never took a turn, its screen served by a stub hc
function check(screen: string, turn = 0) {
    const root = mkdtempSync(join(tmpdir(), 'check-idle-'));
    mkdirSync(join(root, '.claude/sessions'), { recursive: true });
    mkdirSync(join(root, 'bin'));
    writeFileSync(join(root, 'screen.txt'), screen);
    const terminals = {
        terminals: [
            {
                address: 't9',
                agent: 'claude-code',
                cwd: '/repo',
                name: 'probe-codie',
                turn,
            },
        ],
    };
    writeFileSync(
        join(root, 'bin', 'hc'),
        [
            '#!/bin/sh',
            `case "$1" in`,
            `ls) echo '${JSON.stringify(terminals)}' ;;`,
            `get) echo '{"pid": 999999}' ;;`,
            `read) cat '${join(root, 'screen.txt')}' ;;`,
            'esac',
        ].join('\n'),
        { mode: 0o755 },
    );
    return spawnSync(process.execPath, [script, 'probe-codie'], {
        encoding: 'utf8',
        env: {
            ...process.env,
            HOME: root,
            PATH: `${join(root, 'bin')}:${process.env.PATH}`,
        },
        timeout: 10_000,
    });
}

describe('check-idle on a freshly summoned pane', () => {
    test('a folder-trust dialog is named, never read as a stall', () => {
        const out = check(trustScreen);
        expect(out.stdout).toContain('trust dialog');
        expect(out.stdout).toContain('t9');
    });

    test('a pane past its first turn is not read for the dialog', () => {
        expect(check(trustScreen, 3).stdout).not.toContain('trust dialog');
    });

    test('a first screen with no dialog names none', () => {
        expect(check(' ❯ \n').stdout).not.toContain('trust dialog');
    });
});
