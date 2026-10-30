import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { liveStore } from './store.ts';

// FRM-467 riders (FRM-425's leftovers): the milestone check's read of linear — an unreachable linear is not asked
// again at once, a project that gains its first milestone is seen within minutes, and a workspace of more than one
// page of projects is read whole
const MILESTONE = 'pick a milestone, or propose one';
const MOVE = 'x linear set FRM-1 --project cli';
const project = (id: string, name: string, hasMilestone: boolean) => ({
    id,
    name,
    projectMilestones: { nodes: hasMilestone ? [{ id: 'm' }] : [] },
    slugId: `${name}-slug`,
});

type Reply = { nodes: ReturnType<typeof project>[]; next?: string };

// pages: what linear answers per call, in order; an Error is an unreachable linear
function world(on: On, pages: (Reply | Error)[]) {
    const clock = mock.clock(on, { now: 1_000_000 });
    liveStore(on);
    const asked: string[] = [];
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('session.root', () => ({ value: '/repo' }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', () => ({ value: false }));
    on('ui.log', () => ({ value: undefined }));
    on('process.run', (_$, e) => {
        const query = String(e.argv.at(-1));
        asked.push(query);
        const page = pages[Math.min(asked.length - 1, pages.length - 1)];
        const isDown = page instanceof Error;
        return {
            value: {
                exitCode: isDown ? 1 : 0,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: isDown ? 'dial tcp: no such host' : '',
                stdout: isDown
                    ? ''
                    : JSON.stringify({
                          data: {
                              projects: {
                                  nodes: page?.nodes,
                                  pageInfo: {
                                      endCursor: page?.next,
                                      hasNextPage: !!page?.next,
                                  },
                              },
                          },
                      }),
            },
        };
    });
    on('tool.call', () => ({ result: {}, text: 'ran' }));
    return { asked, clock };
}

const bash = ($: Engine, command: string) =>
    $.tool.call({ command, tool: 'Bash' });

test('an unreachable linear is asked once inside a minute, not on every move', async ($, on) => {
    const w = world(on, [new Error('down')]);
    await bash($, MOVE);
    await bash($, MOVE);
    await bash($, 'x linear set FRM-2 --project cli');
    expect(w.asked).toHaveLength(1);
});

test('an unreachable linear is asked again after the minute', async ($, on) => {
    const w = world(on, [new Error('down')]);
    await bash($, MOVE);
    await w.clock.advance(61_000);
    await bash($, MOVE);
    expect(w.asked).toHaveLength(2);
});

test('while linear is unreachable the move still runs, warned', async ($, on) => {
    world(on, [new Error('down')]);
    await bash($, MOVE);
    const r = await bash($, MOVE);
    expect([
        r.deny,
        r.context?.some((c) => /milestone check .*skipped/.test(c)),
    ]).toEqual([undefined, true]);
});

test('a project that gained its first milestone is refused within ten minutes', async ($, on) => {
    const w = world(on, [
        { nodes: [project('p1', 'cli', false)] },
        { nodes: [project('p1', 'cli', true)] },
    ]);
    expect((await bash($, MOVE)).deny).toBeUndefined();
    await w.clock.advance(601_000);
    expect((await bash($, MOVE)).deny).toContain(MILESTONE);
});

test('a project without milestones inside the ten minutes is not read again', async ($, on) => {
    const w = world(on, [{ nodes: [project('p1', 'cli', false)] }]);
    await bash($, MOVE);
    await w.clock.advance(60_000);
    await bash($, MOVE);
    expect(w.asked).toHaveLength(1);
});

test('a project on the second page of projects is read', async ($, on) => {
    const w = world(on, [
        { next: 'cursor-1', nodes: [project('p1', 'lab', false)] },
        { nodes: [project('p2', 'cli', true)] },
    ]);
    expect((await bash($, MOVE)).deny).toContain(MILESTONE);
    expect(w.asked[1]).toContain('after: "cursor-1"');
});

test('a move inside bash -c or eval is checked against the milestones too', async ($, on) => {
    const w = world(on, [{ nodes: [project('p1', 'cli', true)] }]);
    for (const command of [`bash -c '${MOVE}'`, `eval "${MOVE}"`])
        expect((await bash($, command)).deny).toContain(MILESTONE);
    expect(w.asked.length).toBeGreaterThan(0);
});
