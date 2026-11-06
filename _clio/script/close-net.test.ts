import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

type Ticket = {
    id: string;
    description?: string;
    labels?: string[];
    relations?: { type: string; state: string }[];
    comments?: { body: string }[];
};
type Lane = {
    endedAt?: number;
    items: { ticket?: string; isDone: boolean }[];
    members?: Record<string, unknown>;
};

// a stub `x` on PATH: the list and the read answer from the given tickets; none means linear is down.
// HOME is a fixture dir holding the given glide lanes. A call whose args hold `failOn` exits 1.
function run(
    tickets?: Ticket[],
    lanes: Lane[] = [],
    failOn?: string,
    plan = '',
) {
    const dir = mkdtempSync(join(tmpdir(), 'close-net-'));
    const home = join(dir, 'home');
    mkdirSync(join(home, '.claude/shelf'), { recursive: true });
    mkdirSync(join(home, '.local/state/x/lanes/a-lane'), { recursive: true });
    writeFileSync(
        join(home, '.claude/shelf/lanes.json'),
        JSON.stringify({ lanes }),
    );
    writeFileSync(join(home, '.local/state/x/lanes/a-lane/lane-plan.md'), plan);
    const body = JSON.stringify({ data: { tickets } });
    writeFileSync(
        join(dir, 'x'),
        tickets
            ? `#!/bin/sh\n${failOn ? `case "$*" in *${failOn}*) exit 1;; esac\n` : ''}cat <<'EOF'\n${body}\nEOF\n`
            : '#!/bin/sh\nexit 1\n',
    );
    chmodSync(join(dir, 'x'), 0o755);
    return spawnSync('node', [join(import.meta.dirname, 'close-net.ts')], {
        encoding: 'utf8',
        env: { ...process.env, HOME: home, PATH: `${dir}:${process.env.PATH}` },
    });
}

describe('close-net', () => {
    describe('a ticket moved back to Todo', () => {
        const moved = (...bodies: string[]) => [
            {
                comments: bodies.map((body) => ({ body })),
                id: 'FRM-1',
                labels: ['needs human'],
            },
        ];

        test.each([
            ['nothing due reds', ['↩️ back to Todo'], 1],
            ['a wait line reds too', ['⏳ waits: its sign'], 1],
            ['a due date later passes', ['↩️ x', '⏰ due: y by 2999-01-01'], 0],
            ['a due date passed reds', ['↩️ x', '⏰ due: y by 2000-01-01'], 1],
            [
                'a due line older than the move reds',
                ['⏰ due: y by 2999-01-01', '↩️ x'],
                1,
            ],
            ['a due line with no date reds', ['↩️ x', '⏰ due: y'], 1],
            ['a ticket never moved passes', ['a plain comment'], 0],
        ])('%s', (_label, bodies, status) => {
            expect(run(moved(...bodies)).status).toBe(status);
        });

        test('a live door prints what it waits on', () => {
            const out = run(
                moved('↩️ x', '🚪 door: the first real pr, by 2999-01-01'),
            );
            expect(out.stdout).toContain('the first real pr');
        });
    });

    describe('a door on a ticket never moved', () => {
        const never = (body: string) => [
            { comments: [{ body }], id: 'FRM-1', labels: ['needs human'] },
        ];

        test('prints what it waits on', () => {
            const out = run(never('🚪 door: the first real pr, by 2999-01-01'));
            expect(out.status).toBe(0);
            expect(out.stdout).toContain('the first real pr');
        });

        test('reds once its date passed', () => {
            expect(run(never('⏰ due: y by 2000-01-01')).status).toBe(1);
        });

        test('quiets the dispatched warning', () => {
            const [ticket] = never('⏰ due: y by 2999-01-01');
            const out = run([
                { ...ticket, description: '🚀 dispatched' } as Ticket,
            ]);
            expect(out.stdout).not.toContain('🟡');
        });
    });

    describe('a dispatched ticket in Todo with no door', () => {
        const dispatched = [
            {
                description: '🚀 dispatched 2026-11-05',
                id: 'FRM-1',
                labels: ['needs human'],
            },
        ];

        test('is named', () => {
            expect(run(dispatched).stdout).toContain('🟡 FRM-1: dispatched');
        });

        test('on a live lane step stays quiet', () => {
            const out = run(dispatched, [
                {
                    items: [{ isDone: false, ticket: 'FRM-1' }],
                    members: { codie: 'x' },
                },
            ]);
            expect(out.stdout).not.toContain('🟡');
        });
    });

    describe('a ticket already built and still Todo', () => {
        const todo = [{ id: 'FRM-1', labels: ['needs human'] }];

        test('reds on a ticked plan step, with the share', () => {
            const out = run(
                todo,
                [],
                undefined,
                '- [x] 01 · FRM-1 a\n- [ ] 02 · FRM-1 b\n',
            );
            expect(out.status).toBe(1);
            expect(out.stdout).toContain(
                '🔴 FRM-1: built, 1 of 2 plan steps ticked',
            );
        });

        test.each([
            ['another id', '- [x] 01 · FRM-12 a\n'],
            ['an unticked plan', '- [ ] 01 · FRM-1 a\n'],
            ['no plan line', ''],
        ])('passes on %s', (_label, plan) => {
            expect(run(todo, [], undefined, plan).status).toBe(0);
        });

        test('passes while a live lane holds it', () => {
            const out = run(
                todo,
                [
                    {
                        items: [{ isDone: false, ticket: 'FRM-1' }],
                        members: { codie: 'x' },
                    },
                ],
                undefined,
                '- [x] 01 · FRM-1 a\n',
            );
            expect(out.stdout).not.toContain('🔴 FRM-1: built');
        });

        test('a live door keeps it green and prints the built work', () => {
            const out = run(
                [
                    {
                        ...todo[0],
                        comments: [{ body: '⏰ due: y by 2999-01-01' }],
                    } as Ticket,
                ],
                [],
                undefined,
                '- [x] 01 · FRM-1 a\n',
            );
            expect(out.status).toBe(0);
            expect(out.stdout).toContain('(built, 1 of 1 plan steps ticked)');
        });
    });

    test('the label needs human passes', () => {
        const out = run([{ id: 'FRM-1', labels: ['needs human'] }]);
        expect(out.status).toBe(0);
        expect(out.stdout).toContain('FRM-1: needs human');
    });

    test('an open blocked-by passes', () => {
        const out = run([
            {
                id: 'FRM-1',
                relations: [{ state: 'In Progress', type: 'blocked by' }],
            },
        ]);
        expect(out.status).toBe(0);
        expect(out.stdout).toContain('FRM-1: blocked by');
    });

    test('an open step on a running glide card passes', () => {
        const out = run(
            [{ id: 'FRM-1' }],
            [{ items: [{ isDone: false, ticket: 'FRM-1' }] }],
        );
        expect(out.status).toBe(0);
        expect(out.stdout).toContain('FRM-1: a glide step');
    });

    test('with no member on a card, only its current step passes', () => {
        const items = [
            { isDone: false, ticket: 'FRM-1' },
            { isDone: false, ticket: 'FRM-2' },
        ];
        const out = run([{ id: 'FRM-1' }, { id: 'FRM-2' }], [{ items }]);
        expect(out.status).toBe(1);
        expect(out.stdout).toContain('🔴 FRM-2');
        expect(out.stdout).not.toContain('🔴 FRM-1');
    });

    test('a linked member passes every open step', () => {
        const items = [
            { isDone: false, ticket: 'FRM-1' },
            { isDone: false, ticket: 'FRM-2' },
        ];
        const out = run(
            [{ id: 'FRM-1' }, { id: 'FRM-2' }],
            [{ items, members: { codie: {} } }],
        );
        expect(out.status).toBe(0);
    });

    test('a ticket with no reason to stay reds and is named', () => {
        const out = run([
            { id: 'FRM-1', labels: ['agent'] },
            { id: 'FRM-2', labels: ['needs human'] },
        ]);
        expect(out.status).toBe(1);
        expect(out.stdout).toContain(
            '🔴 FRM-1: close it, or give it a reason to stay (needs human, blocked by, a glide step)',
        );
        expect(out.stdout).not.toContain('🔴 FRM-2');
    });

    test('a closed blocker, a done step and an ended lane do not pass', () => {
        const out = run(
            [
                {
                    id: 'FRM-1',
                    relations: [{ state: 'Done', type: 'blocked by' }],
                },
                { id: 'FRM-2' },
                { id: 'FRM-3' },
            ],
            [
                {
                    items: [
                        { isDone: true, ticket: 'FRM-2' },
                        { isDone: false, ticket: 'FRM-4' },
                    ],
                },
                { endedAt: 1, items: [{ isDone: false, ticket: 'FRM-3' }] },
            ],
        );
        expect(out.status).toBe(1);
        for (const id of ['FRM-1', 'FRM-2', 'FRM-3'])
            expect(out.stdout).toContain(`🔴 ${id}`);
    });

    test('linear down is a red', () => {
        const out = run();
        expect(out.status).toBe(1);
        expect(out.stdout).toContain('unreachable');
    });

    test('an In Progress read that fails is a red', () => {
        const out = run([{ id: 'FRM-1' }], [], 'read');
        expect(out.status).toBe(1);
        expect(out.stdout).toContain('In Progress tickets unread');
    });

    test('a Todo list that fails is a red', () => {
        const out = run([], [], 'Todo');
        expect(out.status).toBe(1);
        expect(out.stdout).toContain('Todo tickets unread');
    });

    test('a Todo ticket never moved back, with no door, is skipped by name', () => {
        const out = run([{ id: 'FRM-1', labels: ['needs human'] }]);
        expect(out.status).toBe(0);
        expect(out.stdout).toContain(
            '⏭️ 1 Todo never moved back, skipped: FRM-1',
        );
    });
});
