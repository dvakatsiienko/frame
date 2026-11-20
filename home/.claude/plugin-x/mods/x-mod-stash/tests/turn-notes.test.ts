import { type Engine, expect, test } from 'claude-code/testing';

import {
    SETTINGS,
    lastContext,
    lines,
    mobile,
    nextPrompt,
    orbitNote,
    partOff,
    typed,
} from './orbit-helpers.ts';
import {
    SID,
    add,
    board,
    endTurn,
    joined,
    orbit,
    say,
    start,
    world,
} from './orbit-world.ts';

test("a prompt of any origin names the session's open asks once, with no fixed sentence", async ($, on) => {
    const w = world(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await $.prompt.submit({
        origin: { kind: 'peer-send-message' } as never,
        text: 'status?',
        wait: false,
    });
    expect(orbitNote(w)).toEqual(['orbit holds 1 open ask (o1); no plan set.']);
});

test('a prompt after one that told the same asks and plan carries no orbit note', async ($, on) => {
    const w = world(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await say($, 'go');
    await orbit($, { lines: ['now: a'], op: 'plan' });
    await nextPrompt($);
    const told = orbitNote(w);
    await nextPrompt($);
    expect([told, orbitNote(w)]).toEqual([
        ['orbit holds 1 open ask (o1); plan set.'],
        [],
    ]);
});

test('a state whose prompt was dropped is told with the next prompt', async ($, on) => {
    const w = world(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    w.prompts.isDropped = true;
    await say($, 'lost');
    w.prompts.isDropped = false;
    await say($, 'kept');
    expect(orbitNote(w)).toEqual(['orbit holds 1 open ask (o1); no plan set.']);
});

test('a new open ask is told once', async ($, on) => {
    const w = world(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await say($, 'go');
    await add($, ['trash the old probe', 'yes']);
    await nextPrompt($);
    const told = orbitNote(w);
    await nextPrompt($);
    expect([told, orbitNote(w)]).toEqual([
        ['orbit holds 2 open asks (o1, o2); no plan set.'],
        [],
    ]);
});

test('a resolved ask is told once', async ($, on) => {
    const w = world(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await say($, 'go');
    await orbit($, { ids: ['o1'], op: 'resolve' });
    await nextPrompt($);
    const told = orbitNote(w);
    await nextPrompt($);
    expect([told, orbitNote(w)]).toEqual([
        ['orbit holds no open ask; no plan set.'],
        [],
    ]);
});

test('a plan turned stale is told once, however its age grows', async ($, on) => {
    const w = world(on);
    await start($);
    await say($, 'go');
    await orbit($, { lines: ['now: a'], op: 'plan' });
    const notes: string[][] = [];
    for (let i = 0; i < 6; i++) {
        await nextPrompt($);
        notes.push(orbitNote(w));
    }
    expect(notes).toEqual([
        ['orbit holds no open ask; plan set.'],
        [],
        [],
        ['orbit holds no open ask; plan set 3 turns ago, stale: set it again.'],
        [],
        [],
    ]);
});

for (const reason of ['clear', 'resume'] as const)
    test(`a ${reason} tells the orbit state once again`, async ($, on) => {
        const w = world(on);
        on('session.end', (_$, e) => ({ sessionId: e.sessionId }));
        await start($);
        await say($, 'go');
        await orbit($, { lines: ['now: a'], op: 'plan' });
        await nextPrompt($);
        await nextPrompt($);
        const quiet = orbitNote(w);
        await endTurn($);
        await $.session.end({ reason, resume: { id: SID }, sessionId: SID });
        await say($, 'back');
        expect([quiet, orbitNote(w)]).toEqual([
            [],
            ['orbit holds no open ask; plan set.'],
        ]);
    });

test('a compaction tells the orbit state once again, then keeps quiet', async ($, on) => {
    const w = world(on);
    on('session.compact', (_$, e) => ({ messages: e.messages }));
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await say($, 'go');
    await nextPrompt($);
    const quiet = orbitNote(w);
    await endTurn($);
    await $.session.compact({
        messages: [{ role: 'user', text: 'hi', toolUses: [] }],
        trigger: 'auto',
    } as never);
    await say($, 'after the compact');
    const told = orbitNote(w);
    await nextPrompt($);
    expect([quiet, told, orbitNote(w)]).toEqual([
        [],
        ['orbit holds 1 open ask (o1); no plan set.'],
        [],
    ]);
});

const stalePlan = async ($: Engine) => {
    await start($);
    await say($, 'go');
    await orbit($, { lines: ['now: a'], op: 'plan' });
    for (let i = 0; i < 4; i++) await nextPrompt($);
};

test('his text for the stale plan replaces the built-in clause, {n} its age', async ($, on) => {
    const w = world(
        on,
        typed({ 'stash.orbit.text.plan-stale': 'heron: {n} turns, {x} kept' }),
    );
    await stalePlan($);
    expect(orbitNote(w)).toEqual([
        'orbit holds no open ask; plan set 3 turns ago, heron: 3 turns, {x} kept.',
    ]);
});

for (const [shape, files] of [
    ['an emptied box', typed({ 'stash.orbit.text.plan-stale': '  ' })],
    ['a settings file that does not parse', { [SETTINGS]: '{ "rows": ' }],
    ['no settings file', {}],
] as const)
    test(`the stale plan reads the built-in text with ${shape}`, async ($, on) => {
        const w = world(on, { ...files });
        await stalePlan($);
        expect(orbitNote(w)).toEqual([
            'orbit holds no open ask; plan set 3 turns ago, stale: set it again.',
        ]);
    });

test('his text for a tick replaces only the sentence after the fixed prefix', async ($, on) => {
    const w = world(
        on,
        typed({ 'stash.orbit.text.tick': 'heron {n}: close them with {tool}' }),
    );
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican'], ['name a fish', 'cod']);
    await ui.press({ key: 'orbit:accepted:o1' });
    await ui.press({ key: 'orbit:accepted:o2' });
    await say($, 'next');
    expect(joined(w.contexts)[0]?.split('\n')[0]).toBe(
        'orbit: dima marked 2 asks. heron 2: close them with mcp__x-mod-stash__orbit',
    );
});

test('an empty orbit adds no reminder after the first turn', async ($, on) => {
    const w = world(on);
    await start($);
    await say($, 'hi');
    await endTurn($);
    await say($, 'again');
    expect((w.contexts.at(-1) ?? []).join('\n')).not.toContain('orbit');
});

test("a session's first prompt says phases are its live plan", async ($, on) => {
    const w = world(on);
    await start($);
    await say($, 'hi');
    expect((w.contexts.at(-1) ?? []).join('\n')).toMatch(
        /phases are your live plan/,
    );
});

test('after a /clear the first prompt says phases are its live plan again', async ($, on) => {
    const w = world(on);
    on('command.run', () => ({ text: '' }));
    on('session.end', (_$, e) => ({ sessionId: e.sessionId }));
    await start($);
    await say($, 'hi');
    await endTurn($);
    await $.command.run({
        args: '',
        command: 'clear',
        origin: { kind: 'composer' },
        presentation: { columns: 80, isFullscreen: false },
    });
    await $.session.end({
        reason: 'clear',
        resume: { id: SID },
        sessionId: SID,
    });
    await say($, 'fresh start');
    expect((w.contexts.at(-1) ?? []).join('\n')).toMatch(
        /phases are your live plan/,
    );
});

test('a prompt that lands mid-turn reads a plan set this turn as set, never as stale', async ($, on) => {
    const w = world(on);
    await start($);
    await say($, 'go');
    await orbit($, { lines: ['now: a'], op: 'plan' });
    await say($, 'a steer mid-turn');
    expect((w.contexts.at(-1) ?? []).join('\n')).toMatch(
        /orbit holds no open ask; plan set\.$/m,
    );
});

test('a plan untouched for three turns reads stale', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await say($, 'go');
    await orbit($, { lines: ['now: a'], op: 'plan' });
    for (let i = 0; i < 4; i++) {
        await endTurn($);
        await say($, 'more');
    }
    expect([
        (await ui.find({ text: /^🌔 phases/, type: 'Text' }))?.text,
        (w.contexts.at(-1) ?? []).join('\n'),
    ]).toEqual([
        expect.stringContaining('stale'),
        expect.stringMatching(/plan set 3 turns ago, stale/),
    ]);
});

test('after /mobile-mode the next prompt asks for the asks fence with the ids', async ($, on) => {
    const w = world(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await mobile($);
    await say($, 'hi');
    expect(lastContext(w.contexts)).toMatch(/asks fence.*\(o1\)/s);
});

test('/mobile-mode off brings the orbit reminder back', async ($, on) => {
    const w = world(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await mobile($);
    await mobile($, 'off');
    await say($, 'hi');
    expect(lastContext(w.contexts)).not.toContain('asks fence');
});

test('mobile mode survives a reload', async ($, on) => {
    const w = world(on);
    const state: Record<string, unknown> = {
        mobile: true,
        orbit: {
            asks: [{ id: 'o3', pick: 'yes', text: 'kept' }],
            next: 4,
            turns: 2,
        },
    };
    on('state.get', (_$, e) => ({
        value: { value: state[e.key], version: e.key in state ? 1 : 0 },
    }));
    on('state.set', (_$, e) => {
        state[e.key] = e.value;
        return { value: { isSet: true, version: 2 } };
    });
    await start($);
    await say($, 'hi');
    expect(lastContext(w.contexts)).toMatch(/asks fence.*\(o3\)/s);
});

// o112: the board's phases are gone on mobile, so the reminder asks for the plan's next 3 moves under the fence
test('on mobile the reminder asks for «🌔 next:» and the next 3 moves', async ($, on) => {
    const w = world(on);
    await start($);
    await orbit($, { lines: ['now: a', 'next: b'], op: 'plan' });
    await mobile($);
    await say($, 'hi');
    expect(lastContext(w.contexts)).toMatch(/🌔 next:.*next 3 moves/s);
});

test('on mobile a stale plan is still named', async ($, on) => {
    const w = world(on);
    await start($);
    await say($, 'go');
    await orbit($, { lines: ['now: a'], op: 'plan' });
    for (let i = 0; i < 4; i++) {
        await endTurn($);
        await say($, 'more');
    }
    await mobile($);
    await say($, 'hi');
    expect(lastContext(w.contexts)).toMatch(/plan is stale/);
});

test('with 🌔 phases switched off, no prompt names phases or the plan', async ($, on) => {
    const w = world(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    partOff(w, 'stash.phases');
    await say($, 'hi');
    expect(lines(w)).not.toMatch(/phases|plan/);
});

test('with 🌔 phases switched off, the mobile reminder asks for no next moves', async ($, on) => {
    const w = world(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await mobile($);
    partOff(w, 'stash.phases');
    await say($, 'hi');
    expect(lines(w)).not.toMatch(/🌔|plan/);
});

test('with 🌔 phases switched off, a plan alone brings no orbit reminder', async ($, on) => {
    const w = world(on);
    await start($);
    await orbit($, { lines: ['now: a'], op: 'plan' });
    partOff(w, 'stash.phases');
    await say($, 'hi');
    expect(lines(w)).not.toContain('orbit holds');
});

const NO_BOARD = /^no board reaches dima/;

const noBoard = (w: { contexts: string[][] }) =>
    (w.contexts.at(-1) ?? []).filter((c) => NO_BOARD.test(c));

test('📱 mobile mode on puts the no-board reminder on the prompt', async ($, on) => {
    const w = world(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await mobile($);
    await say($, 'hi');
    expect(noBoard(w)).toEqual([expect.stringMatching(/\(o1\)/)]);
});

test('🪐 orbit switched off puts the same no-board reminder as mobile mode', async ($, on) => {
    const w = world(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await mobile($);
    await say($, 'hi');
    const onMobile = noBoard(w);
    await mobile($, 'off');
    w.store.set('shown', { 'stash.orbit': false });
    await say($, 'again');
    expect([onMobile.length, noBoard(w)]).toEqual([1, onMobile]);
});

test('with mobile mode off and orbit on, no prompt carries the no-board reminder', async ($, on) => {
    const w = world(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await say($, 'hi');
    expect(noBoard(w)).toEqual([]);
});

/* a mac reboot relaunches every session: its orbit comes back (dima's ✨ wisp, 10-13 16:26: o169 was gone) */
