import { spawn } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import {
    fixture,
    liveSince,
    logRows,
    plantHolder,
    queue,
    queueEnv,
    script,
} from './gate-queue-kit.ts';

// a second log beside the first measures the load gate: one row a run that took or waited for a turn, nothing gates on it
describe('gate-queue cpu log', () => {
    const cpuRows = (state: string) =>
        readFileSync(join(state, 'gate-queue-cpu.log'), 'utf8')
            .trimEnd()
            .split('\n')
            .map((row) => row.split('\t'));
    const number = expect.stringMatching(/^\d+(\.\d+)?$/);

    // stubs of the tools the sample reads, each failing fast, and a uptime that says a calm load
    function stubbed(state: string, tools: Record<string, string>) {
        const bin = join(state, 'bin');
        mkdirSync(bin);
        for (const [name, body] of Object.entries(tools)) {
            writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`, {
                mode: 0o755,
            });
        }
        return { PATH: `${bin}:${process.env.PATH}` };
    }

    test('a finished run writes one row of the nine columns, the first log untouched', () => {
        const { state } = fixture();
        // ci is linux, whose iostat takes other flags: the mac's two rows, its first the boot average
        const env = stubbed(state, {
            iostat: 'echo " us sy id"; echo " 15 8 77 2 2 2"; echo " 43 10 47 2 2 2"',
        });
        queue(state, ['--long', 'sh', '-c', 'sleep 2'], '20', {
            ...env,
            GATE_QUEUE_IDLE_SAMPLES: '1',
        });
        const rows = cpuRows(state);
        expect(rows).toHaveLength(1);
        const [start, slot, mods, idle, load, waited, ran, cpu, spawnMs] =
            rows[0] ?? [];
        expect(start).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d{4}$/);
        expect([slot, mods, waited]).toEqual(['long', '0', '0']);
        expect([idle, load, ran, cpu, spawnMs]).toEqual(Array(5).fill(number));
        expect(Number(ran)).toBeGreaterThanOrEqual(2);
        expect(idle).toBe('47');
        expect(rows[0]).toHaveLength(9);
        expect(logRows(state)[0]).toHaveLength(8);
    });

    test('it adds nothing to a run: a 3 s sample never holds it', () => {
        const { state } = fixture();
        const from = Date.now();
        queue(state, ['--long', 'true']);
        expect(Date.now() - from).toBeLessThan(2000);
        expect(cpuRows(state)).toHaveLength(1);
    });

    test('a run that waited keeps its sample', async () => {
        const { state } = fixture();
        const env = stubbed(state, {
            iostat: 'echo " us sy id"; echo " 15 8 77 2 2 2"; echo " 43 10 47 2 2 2"',
        });
        const first = spawn(script, ['--long', 'sleep', '4'], {
            env: queueEnv(state),
            stdio: 'ignore',
        });
        await new Promise((resolve) => setTimeout(resolve, 700));
        queue(state, ['--long', 'true'], '20', env);
        await new Promise((resolve) => first.on('exit', resolve));
        const waited = cpuRows(state).find((row) => Number(row[5]) > 0);
        expect(waited?.[3]).toBe('47');
    });

    test('a run that ends before its sample leaves no sample file behind', async () => {
        const { state } = fixture();
        queue(state, ['--long', 'true'], '20', {
            GATE_QUEUE_IDLE_SAMPLES: '1',
        });
        await new Promise((resolve) => setTimeout(resolve, 3000));
        expect(
            readdirSync(state).filter((f) => f.startsWith('gate-queue-cpu.s')),
        ).toEqual([]);
    });

    test('a sample that fails writes - and the run goes on', () => {
        const { state } = fixture();
        const got = queue(
            state,
            ['--long', 'sh', '-c', 'sleep 1; echo done'],
            '20',
            stubbed(state, { iostat: 'exit 1', perl: 'exit 1' }),
        );
        expect(got.stdout).toBe('done\n');
        const [row] = cpuRows(state);
        expect([row?.[3], row?.[8]]).toEqual(['-', '-']);
        expect(row?.[6]).toMatch(/^\d+$/);
    });

    test('a run the load kept out writes - for its run and cpu', () => {
        const { state, turn } = fixture();
        plantHolder(turn, String(process.pid), liveSince());
        queue(state, ['--long', 'true'], '1');
        const [row] = cpuRows(state);
        expect(Number(row?.[5])).toBeGreaterThanOrEqual(1);
        expect([row?.[6], row?.[7]]).toEqual(['-', '-']);
    });

    test('a mods suite is marked 1', () => {
        const { state } = fixture();
        queue(
            state,
            ['--long', 'sh', '-c', 'sleep 1 # claude plugin test mod'],
            '20',
            stubbed(state, {
                uptime: 'echo "12:27  up 1 day, 7 users, load averages: 1.00 9.00 9.00"',
            }),
        );
        expect(cpuRows(state)[0]?.[2]).toBe('1');
    });

    test('a child burning cpu shows its seconds', () => {
        const { state } = fixture();
        queue(
            state,
            [
                '--long',
                'sh',
                '-c',
                'i=0; while [ $i -lt 300000 ]; do i=$((i+1)); done',
            ],
            '20',
            { GATE_QUEUE_IDLE_SAMPLES: '1' },
        );
        expect(Number(cpuRows(state)[0]?.[7])).toBeGreaterThan(0);
    });

    test('no turn, no row', () => {
        const { state } = fixture();
        queue(state, ['true']);
        expect(existsSync(join(state, 'gate-queue-cpu.log'))).toBe(false);
    });
});
