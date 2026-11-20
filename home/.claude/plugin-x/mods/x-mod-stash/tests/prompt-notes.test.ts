import type { On } from 'claude-code';
import { expect, test } from 'claude-code/testing';

import {
    assume,
    lastContext,
    lines,
    mobile,
    nextPrompt,
    orbitNote,
    partOff,
} from './orbit-helpers.ts';
import {
    add,
    board,
    endTurn,
    joined,
    orbit,
    say,
    start,
    world,
} from './orbit-world.ts';

test('a ticked ask joins the next prompt as model-only context', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes'], ['trash the probe', 'yes']);
    await ui.press({ key: 'orbit:accepted:o2' });
    await say($, 'go on');
    expect(joined(w.contexts).join('\n')).toMatch(
        /o2 🛎️ accepted: trash the probe \(your pick: yes\)/,
    );
});

test('an unmarked ask joins no prompt', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes'], ['trash the probe', 'yes']);
    await ui.press({ key: 'orbit:accepted:o2' });
    await say($, 'go on');
    expect(joined(w.contexts).join('\n')).not.toContain('o1');
});

test("a rejected ask joins with dima's steer and clio's hidden steer", async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:rejected:o1' });
    await ui.input({ key: 'orbit:steer:o1', text: 'wait for ci' });
    await say($, 'next');
    expect(joined(w.contexts).join('\n')).toMatch(
        /o1 ↩️ rejected: push FRM-1 \(your pick: yes\) · his steer: «wait for ci» · your note: «came from push FRM-1»/,
    );
});

// how many prompts carried the o1 tick to the model
const tickReads = (contexts: string[][]) =>
    contexts.filter((c) => c.some((l) => l.includes('o1 🛎️ accepted'))).length;

test('a tick the turn never answered reaches the model once, not on the next prompts', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await say($, 'run the long job');
    await ui.press({ key: 'orbit:accepted:o1' });
    await endTurn($);
    for (const prompt of ['next', 'and next', 'and again']) {
        await say($, prompt);
        await endTurn($);
    }
    expect(tickReads(w.contexts)).toBe(1);
});

test('a re-tick of the still-open ask arrives as a fresh tick', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await say($, 'run the long job');
    await ui.press({ key: 'orbit:accepted:o1' });
    await endTurn($);
    await say($, 'next');
    await endTurn($);
    await ui.press({ key: 'orbit:accepted:o1' });
    await say($, 'once more');
    expect(tickReads(w.contexts)).toBe(2);
});

test('his tick joins a prompt whole when nothing else of the orbit changed', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await say($, 'go');
    await nextPrompt($);
    await endTurn($);
    await ui.press({ key: 'orbit:accepted:o1' });
    await say($, 'next');
    expect([orbitNote(w), joined(w.contexts).length]).toEqual([[], 1]);
    expect(joined(w.contexts)[0]).toMatch(
        /^orbit: dima marked an ask\. answer each in this reply, then call mcp__x-mod-stash__orbit.*\n- o1 /,
    );
});

test('«back at the mac» ends mobile mode', async ($, on) => {
    const w = world(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await mobile($);
    await say($, 'ok, back at the mac');
    await endTurn($);
    await say($, 'hi');
    expect(lastContext(w.contexts)).not.toContain('asks fence');
});

// FRM-456: his typed word ends the mode, as /mobile-mode off does
for (const typed of ['Mobile mode off', 'ok, MOBILE MODE OFF now'])
    test(`«${typed}» typed ends mobile mode`, async ($, on) => {
        const w = world(on);
        await start($);
        await add($, ['push FRM-1', 'yes']);
        await mobile($);
        await say($, typed);
        const same = lastContext(w.contexts);
        await endTurn($);
        await say($, 'hi');
        expect([same, lastContext(w.contexts)]).not.toContainEqual(
            expect.stringContaining('asks fence'),
        );
    });

// x answers ticket reads for FRM-381; down, it fails
const linear = (on: On, isDown = false) => {
    const runs: string[][] = [];
    on('process.run', (_$, e) => {
        runs.push([...e.argv]);
        return {
            value: {
                exitCode: isDown ? 1 : 0,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout: JSON.stringify({
                    data: {
                        tickets: [
                            {
                                id: 'FRM-381',
                                state: 'Done',
                                title: 'stash: orbit',
                                url: 'https://linear.app/x-com/issue/FRM-381/stash-orbit',
                            },
                        ],
                    },
                }),
            },
        };
    });
    return runs;
};

test('a prompt naming a ticket hands the session its title, state and link', async ($, on) => {
    const w = world(on);
    linear(on);
    await start($);
    await say($, 'look at FRM-381 again');
    expect((w.contexts.at(-1) ?? []).join('\n')).toContain(
        'FRM-381: stash: orbit · Done · https://linear.app/x-com/issue/FRM-381/stash-orbit',
    );
});

test('a peer prompt naming a ticket looks nothing up', async ($, on) => {
    world(on);
    const runs = linear(on);
    await start($);
    await say($, 'status of FRM-381?', 'peer-send-message' as never);
    expect(runs.filter((r) => r.includes('linear'))).toEqual([]);
});

test('with x down a prompt carries no ticket line', async ($, on) => {
    const w = world(on);
    linear(on, true);
    await start($);
    await say($, 'look at FRM-381 again');
    expect((w.contexts.at(-1) ?? []).join('\n')).not.toContain(
        'read from linear',
    );
});

test('↩️ with a steer joins the next prompt as a wrong assumption', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await assume($, 'kept the old port');
    await ui.press({ key: 'orbit:wrong:a1' });
    await ui.input({
        key: 'orbit:asteer:a1',
        kind: 'change',
        text: 'use 7374',
    });
    await say($, 'next');
    expect((w.contexts.at(-1) ?? []).join('\n')).toContain(
        '- a1 wrong assumption: kept the old port · his steer: «use 7374»',
    );
});

test("dima's own prompt carries a fresh tick", async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    await say($, 'go');
    expect(joined(w.contexts).join('\n')).toMatch(/o1 🛎️ accepted/);
});

test("a phases tick and its steer ride dima's next prompt", async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await orbit($, { lines: ['now: a'], op: 'plan' });
    await ui.press({ key: 'plan:tick' });
    await ui.input({
        key: 'plan:steer',
        kind: 'submit',
        text: 'a first, it unblocks b',
    });
    await say($, 'go');
    expect((w.contexts.at(-1) ?? []).join('\n')).toMatch(
        /🛎️ ticked their order[\s\S]*his steer: «a first, it unblocks b»/,
    );
});

test('a phases steer alone never joins a turn', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await orbit($, { lines: ['now: a'], op: 'plan' });
    await ui.input({ key: 'plan:steer', kind: 'submit', text: 'just a note' });
    await w.clock.advance(5_000);
    await say($, 'go');
    expect((w.contexts.at(-1) ?? []).join('\n')).not.toMatch(/🌔 phases: dima/);
});

test('with assumed switched off, a sent-back assumption joins no prompt', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await assume($, 'kept the old port');
    await ui.press({ key: 'orbit:wrong:a1' });
    partOff(w, 'stash.assumed');
    await say($, 'next');
    expect(lines(w)).not.toContain('wrong assumption');
});

test("with 🌔 phases switched off, dima's phases tick joins no prompt", async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await orbit($, { lines: ['now: a'], op: 'plan' });
    await ui.press({ key: 'plan:tick' });
    await w.clock.advance(5_000);
    partOff(w, 'stash.phases');
    await say($, 'go');
    expect(lines(w)).not.toContain('🌔 phases: dima');
});

// todo 17: the cost hint is clio's alone; this world's session is no clio
test('a cost question in a session that is not clio carries no cost hint', async ($, on) => {
    const w = world(on);
    await start($);
    await say($, 'what does a cache read cost?');
    expect((w.contexts.at(-1) ?? []).join('\n')).not.toMatch(/a cost question/);
});
