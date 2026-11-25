import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { stop } from './siesta-gate.ts';
import {
    HOUR,
    commit,
    fixtureHome,
    said,
    stamp,
    stopInput,
} from './siesta-gate-world.ts';

describe('the siesta comes due', () => {
    const plant = (home: string, files: string[]) => {
        const repo = join(home, 'frame');
        for (const file of files) {
            mkdirSync(join(repo, file, '..'), { recursive: true });
            writeFileSync(join(repo, file), 'x');
        }
        commit(home, 0, 'clio');
    };

    test('three memory, rule or skill text files of clio’s make it due', () => {
        const home = fixtureHome();
        plant(home, [
            '_clio/memory/craft-pm.md',
            'home/.claude/rules/code.md',
            '_clio/plugin-clio/skills/boot/SKILL.md',
        ]);
        expect(said(stop(home, stopInput(home)))).toContain(
            '3 memory, rule or skill text files',
        );
    });

    test('two memory or rule text files of clio’s make none due', () => {
        const home = fixtureHome();
        plant(home, ['_clio/memory/craft-pm.md', 'home/.claude/rules/code.md']);
        expect(stop(home, stopInput(home))).toBeUndefined();
    });

    test('a skill’s code files never count as memory text', () => {
        const home = fixtureHome();
        plant(home, [
            'home/.claude/plugin-x/skills/crew-adviser/scripts/wake.ts',
            'home/.claude/plugin-x/skills/crew-adviser/scripts/wake.test.ts',
            'home/.claude/plugin-x/skills/crew-adviser/scripts/decision.ts',
        ]);
        expect(stop(home, stopInput(home))).toBeUndefined();
    });

    test.each([
        'x linear set FRM-9 --state Done',
        "x linear set FRM-9 --state 'Canceled'",
        "node script/ticket-sign.ts FRM-9 re-signed 'why'",
        'x lane landed FRM-9 --pr 161 --apply',
    ])('clio’s «%s» since the stamp makes it due', (command) => {
        const home = fixtureHome();
        const input = stopInput(home);
        appendFileSync(
            input.transcript_path,
            `\n${JSON.stringify({ message: { content: [{ input: { command }, name: 'Bash', type: 'tool_use' }] }, timestamp: new Date().toISOString(), type: 'assistant' })}`,
        );
        expect(said(stop(home, input))).toContain('ticket close(s) or sign(s)');
    });

    test.each([
        'x linear set FRM-9 --state Todo',
        "node script/ticket-sign.ts FRM-9 changed 'tiny'",
        'x lane landed FRM-9 --pr 161',
    ])('clio’s «%s» makes none due', (command) => {
        const home = fixtureHome();
        const input = stopInput(home);
        appendFileSync(
            input.transcript_path,
            `\n${JSON.stringify({ message: { content: [{ input: { command }, name: 'Bash', type: 'tool_use' }] }, timestamp: new Date().toISOString(), type: 'assistant' })}`,
        );
        expect(stop(home, input)).toBeUndefined();
    });

    test('a ticket close within 30 min of the stamp makes none due', () => {
        const home = fixtureHome();
        writeFileSync(
            join(home, '.local/state/clio/siesta-last'),
            `${stamp(new Date(Date.now() - 10 * 60_000))}\n`,
        );
        const input = stopInput(home);
        appendFileSync(
            input.transcript_path,
            `\n${JSON.stringify({ message: { content: [{ input: { command: 'x linear set FRM-9 --state Done' }, name: 'Bash', type: 'tool_use' }] }, timestamp: new Date().toISOString(), type: 'assistant' })}`,
        );
        expect(stop(home, input)).toBeUndefined();
    });

    test.each([
        [
            'two ticket closes',
            [
                'x linear set FRM-9 --state Done',
                'x linear set FRM-8 --state Done',
            ],
        ],
        ['a landed lane', ['x lane landed FRM-9 --pr 161 --apply']],
    ])('%s within 30 min of the stamp makes it due', (_name, commands) => {
        const home = fixtureHome();
        writeFileSync(
            join(home, '.local/state/clio/siesta-last'),
            `${stamp(new Date(Date.now() - 10 * 60_000))}\n`,
        );
        const input = stopInput(home);
        for (const command of commands)
            appendFileSync(
                input.transcript_path,
                `\n${JSON.stringify({ message: { content: [{ input: { command }, name: 'Bash', type: 'tool_use' }] }, timestamp: new Date().toISOString(), type: 'assistant' })}`,
            );
        expect(said(stop(home, input))).toContain('ticket close(s) or sign(s)');
    });

    test('a ticket close before the stamp makes none due', () => {
        const home = fixtureHome();
        const input = stopInput(home);
        appendFileSync(
            input.transcript_path,
            `\n${JSON.stringify({ message: { content: [{ input: { command: 'x linear set FRM-9 --state Done' }, name: 'Bash', type: 'tool_use' }] }, timestamp: new Date(Date.now() - 2 * HOUR).toISOString(), type: 'assistant' })}`,
        );
        expect(stop(home, input)).toBeUndefined();
    });

    test('another agent’s memory file makes none due', () => {
        const home = fixtureHome();
        const repo = join(home, 'frame');
        mkdirSync(join(repo, '_clio/memory'), { recursive: true });
        writeFileSync(join(repo, '_clio/memory/craft-pm.md'), 'x');
        commit(home, 0, 'codie');
        expect(stop(home, stopInput(home))).toBeUndefined();
    });

    test('14 files, another agent’s, or the pocket’s auto commits make none due', () => {
        const home = fixtureHome();
        commit(home, 14, 'clio');
        commit(home, 5, 'clio-side');
        commit(home, 5, 'codie');
        commit(home, 5, 'clio', '📜 pocket: pk-1 (auto)');
        expect(stop(home, stopInput(home))).toBeUndefined();
    });
});
