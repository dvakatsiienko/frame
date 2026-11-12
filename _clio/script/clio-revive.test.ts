import { spawnSync } from 'node:child_process';
import {
    chmodSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';

// FRM-579 exit 2: a revive resumes the same session id, then records it again through x brief summon, since a dead
// thread's record left the store; hc, x and node are fakes that log their argv
function revive(which: string[]) {
    const home = mkdtempSync(join(tmpdir(), 'clio-revive-'));
    const bin = join(home, 'bin');
    const sid = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
    const projects = join(home, '.claude/projects/-Users-dima-frame--clio');
    mkdirSync(projects, { recursive: true });
    mkdirSync(join(home, '.claude/sessions'), { recursive: true });
    mkdirSync(bin);
    const title =
        which[0] === 'main' ? '🦉 clio' : `🦉🪽 clio: wing ${which[1]}`;
    writeFileSync(
        join(projects, `${sid}.jsonl`),
        `${JSON.stringify({ customTitle: title })}\n`,
    );
    const fake = (name: string, body: string) => {
        writeFileSync(join(bin, name), `#!/bin/zsh\n${body}\n`);
        chmodSync(join(bin, name), 0o755);
    };
    // the resumed claude registers under the id it resumed, as cc does
    fake(
        'hc',
        `print -r -- "hc $*" >> "$HOME/calls"\nprint -r -- '{"sessionId":"${sid}","pid":1}' > "$HOME/.claude/sessions/1.json"\nprint -r -- '{"address":"t1"}'`,
    );
    fake(
        'x',
        `print -r -- "x $*" >> "$HOME/calls"\n[[ "$1 $2" == "thread list" ]] && print -r -- '{"data":{"threads":[]}}'\nexit 0`,
    );
    fake('node', 'exit 0');
    const run = spawnSync(
        'zsh',
        [join(import.meta.dirname, 'clio-revive.sh'), ...which],
        {
            encoding: 'utf8',
            env: { HOME: home, PATH: `${bin}:/usr/bin:/bin:/opt/homebrew/bin` },
        },
    );
    const calls = readFileSync(join(home, 'calls'), 'utf8');
    rmSync(home, { recursive: true });
    return { calls, run, sid };
}

for (const [which, role] of [
    [['main'], 'coordinator'],
    [['wing', '2'], 'wing:2'],
] as const)
    test(`a revive of ${which.join(' ')} resumes its session and records it as ${role}`, () => {
        const { calls, run, sid } = revive([...which]);
        expect([run.status, calls]).toEqual([
            0,
            expect.stringContaining(
                `x brief summon --role ${role} --session ${sid}`,
            ),
        ]);
        expect(calls).toContain(`claude --resume ${sid}`);
    });
