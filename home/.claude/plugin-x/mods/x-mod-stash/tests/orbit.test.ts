import type { On } from 'claude-code';
import { type Engine, expect, test } from 'claude-code/testing';

import { closedMark } from '../hooks/board-kit.tsx';
import {
    HERDR_FILE,
    SETTINGS,
    addLinked,
    assume,
    herdrPress,
    lastContext,
    lines,
    mobile,
    partOff,
    press,
    savedSteer,
    stateOf,
    texts,
    tickLog,
    typed,
} from './orbit-helpers.ts';
import {
    type Board,
    SID,
    add,
    asksShown,
    board,
    endTurn,
    joined,
    orbit,
    say,
    start,
    world,
} from './orbit-world.ts';

test('asks the tool adds list in orbit oldest first, each by its id', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes'], ['trash the old probe', 'yes']);
    await add($, ['rename the band', 'later']);
    expect(await asksShown(ui)).toEqual(['o1', 'o2', 'o3']);
});

test("an ask's row reads its text and clio's pick", async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push the branch to main', 'yes, now']);
    expect(
        (await ui.find({ key: 'orbit:ask:o1', type: 'Box' }))?.text,
    ).toContain('push the branch to main➡️ yes, now');
});

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

test('orbit is a card headed «🪐 orbit» with no count, and its check-all is a bare ✅', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['a one', 'x'], ['a two', 'y']);
    const card = await ui.find({ key: 'orbit', type: 'Box' });
    expect([
        card?.props.borderStyle,
        (await ui.find({ text: /^🪐 orbit/, type: 'Text' }))?.text,
        (await ui.find({ key: 'orbit:all', type: 'Button' }))?.text,
    ]).toEqual(['round', '🪐 orbit', '✅']);
});

test('each ask is a card of its own', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['a one', 'x']);
    expect(
        (await ui.find({ key: 'orbit:ask:o1', type: 'Box' }))?.props
            .borderStyle,
    ).toBe('round');
});

test("a peer's prompt carries no mark, but its turn takes the tick at its next tool call", async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    await w.clock.advance(5_000);
    await $.prompt.submit({
        origin: { kind: 'peer-send-message' } as never,
        text: 'status?',
        wait: false,
    });
    const r = await $.tool.call({ command: 'ls', tool: 'Bash' });
    expect([joined(w.contexts), (r.context ?? []).join('\n')]).toEqual([
        [],
        expect.stringMatching(/o1 🛎️ accepted/),
    ]);
});

test('a keep-hot ping turn never takes a tick', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    await $.prompt.submit({
        origin: { kind: 'plugin' } as never,
        text: 'x-mod-stash keep-hot ping: answer with one character, nothing else.',
        wait: false,
    });
    const r = await $.tool.call({ command: 'ls', tool: 'Bash' });
    expect((r.context ?? []).join('\n')).not.toMatch(/accepted/);
});

test('a ping turn a reload kept in state still takes no tick', async ($, on) => {
    world(on);
    // a fresh module after a mid-turn reload: its own flag is the default, the ping turn lives on in $.state
    let keptTurn: unknown;
    on('state.get', (_$, e, next) =>
        e.key === 'turn' && keptTurn
            ? { value: { value: keptTurn, version: 1 } }
            : next(e),
    );
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    keptTurn = { afk: false, isBusy: true, isPinged: true, isUserTurn: false };
    const r = await $.tool.call({ command: 'ls', tool: 'Bash' });
    expect((r.context ?? []).join('\n')).not.toMatch(/accepted/);
});

test('a joined ask keeps its buttons but no steer field while the turn runs', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    await ui.input({ key: 'orbit:steer:o1', text: 'after ci' });
    await say($, 'go');
    const keys = (await ui.findAll({})).map((n) => n.key ?? '');
    expect([
        keys.filter((k) => /^orbit:(accepted|rejected|steer|read):o1$/.test(k)),
        (await ui.find({ key: 'orbit:ask:o1', type: 'Box' }))?.text,
    ]).toEqual([
        ['orbit:accepted:o1', 'orbit:rejected:o1', 'orbit:read:o1'],
        expect.stringContaining('💬 «after ci»'),
    ]);
});

test("a joined ask's held button reads 🔓, and a press changes nothing", async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    await say($, 'go');
    const take = async () =>
        (await ui.find({ key: 'orbit:accepted:o1', type: 'Button' }))?.text;
    const held = await take();
    await ui.press({ key: 'orbit:accepted:o1' });
    expect([held, await take()]).toEqual(['🔓 tick', '🔓 tick']);
});

test('an ask the turn left unanswered gets its controls back when the turn ends', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    await say($, 'go');
    await endTurn($);
    expect(await ui.find({ key: 'orbit:accepted:o1' })).toBeTruthy();
});

test('a held mark swaps its emoji for ✅, and only one of the two holds it', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    const look = async () =>
        Promise.all(
            ['accepted', 'rejected'].map(async (m) => {
                const b = await ui.find({ key: `orbit:${m}:o1` });
                return `${b?.text}|${b?.props.variant ?? '-'}`;
            }),
        );
    const idle = await look();
    await ui.press({ key: 'orbit:accepted:o1' });
    await w.clock.advance(5_000);
    const taken = await look();
    await ui.press({ key: 'orbit:rejected:o1' });
    await w.clock.advance(5_000);
    expect([idle, taken, await look()]).toEqual([
        ['🛎️ tick|primary', '🔁 replay|-'],
        ['✅ tick|primary', '🔁 replay|-'],
        ['🛎️ tick|primary', '✅ replay|-'],
    ]);
});

test('a resolved ask leaves orbit when the turn ends', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes'], ['trash the probe', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    await say($, 'go');
    await orbit($, { ids: ['o1'], op: 'resolve', words: { o1: 'as ticked' } });
    await endTurn($);
    await say($, 'next');
    await endTurn($);
    expect(await asksShown(ui)).toEqual(['o2']);
});

test('a resolved ask reads its closing word on a line of its own under it', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await orbit($, { ids: ['o1'], op: 'resolve', words: { o1: 'landed' } });
    const box = await ui.find({ key: 'orbit:ask:o1', type: 'Box' });
    expect([
        box?.props.flexDirection,
        (await ui.find({ text: '➡️ landed', type: 'Text' }))?.text,
    ]).toEqual(['column', '➡️ landed']);
});

test('an ask resolved with a closing word shows dim with it for one more turn, then leaves', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await say($, 'go');
    await add($, ['push FRM-1', 'yes'], ['trash the probe', 'yes']);
    await orbit($, {
        ids: ['o1', 'o2'],
        op: 'resolve',
        words: { o1: 'dropped: superseded by o58' },
    });
    expect(await texts(ui)).toContain('🗑️ o1: push FRM-1');
    await endTurn($);
    const after = [await asksShown(ui), await texts(ui)] as const;
    await say($, 'next');
    await endTurn($);
    expect([
        after[0],
        /dropped: superseded by o58/.test(after[1]),
        await asksShown(ui),
    ]).toEqual([['o1'], true, []]);
});

test('a tick while the turn runs reaches that turn, and its resolve takes it out at turn end', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await say($, 'run the long job');
    await ui.press({ key: 'orbit:accepted:o1' });
    await w.clock.advance(5_000);
    const r = await $.tool.call({ command: 'sleep 20', tool: 'Bash' });
    await orbit($, { ids: ['o1'], op: 'resolve', words: { o1: 'as ticked' } });
    await endTurn($);
    await say($, 'next');
    await endTurn($);
    expect([(r.context ?? []).join('\n'), await asksShown(ui)]).toEqual([
        expect.stringMatching(
            /o1 🛎️ accepted: name a bird \(your pick: pelican\)/,
        ),
        [],
    ]);
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

test('a remote mark landing while dima types a steer leaves his typed steer in its box', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await ui.input({ key: 'orbit:steer:o1', kind: 'change', text: 'a heron' });
    herdrPress(w, 'o1', { at: w.clock.now(), verdict: 'tick' });
    await w.clock.advance(5_000);
    expect(savedSteer(w.store)).toBe('a heron');
});

test('the orbit card is bordered a soft grey on the desktop', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['a one', 'x']);
    expect(
        (await ui.find({ key: 'orbit', type: 'Box' }))?.props.borderColor,
    ).toBe('#8080804d');
});

test('🔁 replay reads ✅ replay at once', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:rejected:o1' });
    expect((await ui.find({ key: 'orbit:rejected:o1' }))?.text).toBe(
        '✅ replay',
    );
});

test('the Stop passes with 🪐 orbit switched off, an ask open and a wrap_up ask', async ($, on) => {
    const w = world(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    w.store.set('shown', { 'stash.orbit': false });
    await say($, 'go');
    await wrapUp($, 'Commit now?');
    expect((await stop($)).block).toBeUndefined();
});

test('⏸️ on an assumption pauses speak', async ($, on) => {
    const w = world(on);
    const sent = speakStub(on, { paused: false, speaking: true });
    await start($);
    const ui = await board($);
    await assume($, 'kept the old port');
    await w.clock.advance(5_000);
    await ui.press({ key: 'orbit:pause:a1' });
    expect(sent.filter((r) => r.op !== 'status')).toEqual([{ op: 'pause' }]);
});

test('⏹️ on an assumption stops speak', async ($, on) => {
    const w = world(on);
    const sent = speakStub(on, { paused: false, speaking: true });
    await start($);
    const ui = await board($);
    await assume($, 'kept the old port');
    await w.clock.advance(5_000);
    await ui.press({ key: 'orbit:stop:a1' });
    expect(sent.filter((r) => r.op !== 'status')).toEqual([{ op: 'stop' }]);
});

test("a card steer lands over the member's own unless it typed into that box a moment ago", async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await ui.input({ key: 'orbit:steer:o1', kind: 'change', text: 'a heron' });
    herdrPress(w, 'o1', {
        at: w.clock.now(),
        steer: 'a swan',
        verdict: 'tick',
    });
    await say($, 'go');
    expect(savedSteer(w.store)).toBe('a heron');
});

test('a steer typed on another board replaces the one the ask already holds', async ($, on) => {
    const w = world(on);
    await start($);
    await add($, ['name a bird', 'pelican']);
    const ui = await board($);
    await ui.input({ key: 'orbit:steer:o1', kind: 'change', text: 'a heron' });
    await w.clock.advance(5_000);
    await ui.press({ key: 'fold:orbit' });
    await ui.press({ key: 'fold:orbit' });
    herdrPress(w, 'o1', {
        at: w.clock.now(),
        steer: 'a swan',
        verdict: 'tick',
    });
    await w.clock.advance(5_000);
    expect(savedSteer(w.store)).toBe('a swan');
});

/* the orbit note speaks only on a change (FRM-640): the rules sit in the tool's own text, so no sentence rides every prompt */

const orbitNote = (w: { contexts: string[][] }) =>
    (w.contexts.at(-1) ?? []).filter((c) => c.startsWith('orbit holds'));

const nextPrompt = async ($: Engine) => {
    await endTurn($);
    await say($, 'more');
};

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

const tools = async ($: Engine, n: number) => {
    const out: string[] = [];
    for (let i = 0; i < n; i++)
        out.push(
            (
                (await $.tool.call({ command: 'ls', tool: 'Bash' })).context ??
                []
            ).join('\n'),
        );
    return out;
};

const edits = async ($: Engine, n: number) => {
    const out: string[] = [];
    for (let i = 0; i < n; i++)
        out.push(
            (
                (
                    await $.tool.call({
                        file_path: '/tmp/a.ts',
                        new_string: 'b',
                        old_string: 'a',
                        tool: 'Edit',
                    } as never)
                ).context ?? []
            ).join('\n'),
        );
    return out;
};

test('the third tool call of a working turn with no phases set carries the nudge, once', async ($, on) => {
    world(on);
    await start($);
    await say($, 'go');
    const seen = await edits($, 4);
    expect(seen.map((c) => /no phases yet/.test(c))).toEqual([
        false,
        false,
        true,
        false,
    ]);
});

test('a q&a turn of reads gets no phases nudge', async ($, on) => {
    world(on);
    await start($);
    await say($, 'why does it wrap?');
    const seen = await tools($, 5);
    expect(seen.some((c) => /phases/.test(c))).toBe(false);
});

test('a commit through bash makes the turn a working one', async ($, on) => {
    world(on);
    await start($);
    await say($, 'go');
    await $.tool.call({ command: 'x lane commit m.txt -- a.ts', tool: 'Bash' });
    const seen = await tools($, 2);
    expect(seen.at(-1)).toMatch(/no phases yet/);
});

test('a turn that set its phases gets no nudge', async ($, on) => {
    world(on);
    await start($);
    await say($, 'go');
    await orbit($, { lines: ['now: a'], op: 'plan' });
    const seen = await tools($, 3);
    expect(seen.some((c) => /phases/.test(c))).toBe(false);
});

test('phases set in the last 2 turns hold: working turns stay quiet till the third', async ($, on) => {
    world(on);
    await start($);
    await say($, 'go');
    await orbit($, { lines: ['now: a'], op: 'plan' });
    await endTurn($);
    const nudged: boolean[] = [];
    for (let i = 0; i < 3; i++) {
        await say($, 'go on');
        nudged.push(
            (await edits($, 3)).some((c) =>
                /phases not set for 3 turns/.test(c),
            ),
        );
        await endTurn($);
    }
    expect(nudged).toEqual([false, false, true]);
});

test('the phases show in the board, a moon each, at most seven', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await orbit($, {
        lines: ['now: a', 'next: b', 'then: c', 'd', 'e', 'f', 'g', 'h'],
        op: 'plan',
    });
    expect(
        (await ui.findAll({ type: 'Text' }))
            .map((t) => t.text)
            .filter((t) => /^[🌕🌔🌓🌒🌑] (?!phases)/u.test(t ?? '')),
    ).toEqual([
        '🌕 now: a',
        '🌔 next: b',
        '🌓 then: c',
        '🌒 d',
        '🌑 e',
        '🌑 f',
        '🌑 g',
    ]);
});

test('the phases stick to the bottom of a docked board', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await orbit($, { lines: ['now: a', 'next: b'], op: 'plan' });
    const boxes = await ui.findAll({ type: 'Box' });
    const gap = boxes.findIndex((b) => b.key === 'phases:gap');
    expect([
        boxes[0]?.props.minHeight,
        boxes[gap]?.props.flexGrow,
        boxes[gap + 1]?.key,
    ]).toEqual([40, 1, 'phases']);
});

test('a phase fades with its distance from now', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await orbit($, { lines: ['now: a', 'next: b', 'then: c'], op: 'plan' });
    expect(
        (await ui.findAll({ type: 'Text' }))
            .filter((t) => /^[🌕🌔🌓] (?!phases)/u.test(t.text ?? ''))
            .map((t) => [Boolean(t.props.bold), Boolean(t.props.dimColor)]),
    ).toEqual([
        [false, false],
        [false, false],
        [false, true],
    ]);
});

test('only the now lead word reads green', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await orbit($, { lines: ['now: a', 'next: b'], op: 'plan' });
    expect(
        (await ui.findAll({ type: 'Text' }))
            .filter((t) => t.text === 'now:' || t.text === 'next:')
            .map((t) => [t.text, Boolean(t.props.color)]),
    ).toEqual([
        ['now:', true],
        ['next:', false],
    ]);
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

test("orbit's open asks reach the shared store the board counts from", async ($, on) => {
    const w = world(on);
    await start($);
    await say($, 'go');
    await add($, ['push FRM-1', 'yes'], ['trash the probe', 'yes']);
    await orbit($, { ids: ['o1'], op: 'resolve' });
    expect((w.store.get(`asks:${SID}`) as { asks: string[] }).asks).toEqual([
        'trash the probe',
    ]);
});

test("🔊 sends the ask's text to speak's control socket", async ($, on) => {
    world(on);
    const runs: string[][] = [];
    on('process.run', (_$, e) => {
        runs.push([...e.argv]);
        return {
            value: {
                exitCode: 0,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout: '{"ok":true}',
            },
        };
    });
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await ui.press({ key: 'orbit:read:o1' });
    const sent = runs.find((argv) =>
        argv.includes('/home/.local/share/x-speak/control.sock'),
    );
    expect(JSON.parse(sent?.[4] ?? '{}')).toEqual({
        op: 'read',
        text: 'name a bird. pelican',
    });
});

// speak's control socket as a stub: `status` answers the given state, every request is kept
function speakStub(on: On, state: { speaking: boolean; paused: boolean }) {
    const sent: Record<string, unknown>[] = [];
    on('process.run', (_$, e) => {
        const isSpeak = e.argv.some((a) => a.endsWith('x-speak/control.sock'));
        const request = (
            isSpeak ? JSON.parse(e.argv[4] ?? '{}') : {}
        ) as Record<string, unknown>;
        if (isSpeak) sent.push(request);
        return {
            value: {
                exitCode: 0,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout:
                    request.op === 'status'
                        ? JSON.stringify(state)
                        : '{"ok":true}',
            },
        };
    });
    return sent;
}

const playLabel = async (ui: Board, id: string) =>
    (await ui.find({ key: `orbit:pause:${id}` }))?.text;

test('the play button reads ⏸️ once speak says it reads, ▶️ while quiet', async ($, on) => {
    world(on);
    const state = { paused: false, speaking: false };
    speakStub(on, state);
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    const quiet = await playLabel(ui, 'o1');
    state.speaking = true;
    await ui.press({ key: 'orbit:read:o1' });
    expect([quiet, await playLabel(ui, 'o1')]).toEqual(['▶️', '⏸️']);
});

test('▶️ with speak quiet reads the row', async ($, on) => {
    world(on);
    const sent = speakStub(on, { paused: false, speaking: false });
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await ui.press({ key: 'orbit:pause:o1' });
    expect(sent.filter((r) => r.op !== 'status')).toEqual([
        { op: 'read', text: 'name a bird. pelican' },
    ]);
});

test('▶️ with speak paused resumes it, never reads anew', async ($, on) => {
    world(on);
    const sent = speakStub(on, { paused: true, speaking: true });
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await ui.press({ key: 'orbit:pause:o1' });
    expect(sent.filter((r) => r.op !== 'status')).toEqual([{ op: 'pause' }]);
});

test('🔊 on an assumption reads its text aloud', async ($, on) => {
    world(on);
    const runs: string[][] = [];
    on('process.run', (_$, e) => {
        runs.push([...e.argv]);
        return {
            value: {
                exitCode: 0,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout: '{"ok":true}',
            },
        };
    });
    await start($);
    const ui = await board($);
    await orbit($, { op: 'assume', texts: ['moons repeat past five'] });
    await ui.press({ key: 'orbit:read:a1' });
    const sent = runs.find((argv) =>
        argv.includes('/home/.local/share/x-speak/control.sock'),
    );
    expect(JSON.parse(sent?.[4] ?? '{}')).toEqual({
        op: 'read',
        text: 'moons repeat past five',
    });
});

test("orbit's asks survive a reload", async ($, on) => {
    const w = world(on);
    const kept = {
        asks: [{ id: 'o3', pick: 'yes', text: 'kept across a reload' }],
        next: 4,
        turns: 2,
    };
    // a reload: the engine keeps $.state, and session.start runs again in a fresh module
    const state: Record<string, unknown> = { orbit: kept };
    on('state.get', (_$, e) => ({
        value: { value: state[e.key], version: e.key in state ? 1 : 0 },
    }));
    on('state.set', (_$, e) => {
        state[e.key] = e.value;
        return { value: { isSet: true, version: 2 } };
    });
    await start($);
    await say($, 'hi');
    expect((w.contexts.at(-1) ?? []).join('\n')).toContain('(o3)');
});

test("a turn that ends before a reloaded module's start keeps orbit", async ($, on) => {
    world(on);
    const kept = {
        asks: [{ id: 'o3', pick: 'yes', text: 'kept across a reload' }],
        next: 4,
        turns: 2,
    };
    const state: Record<string, unknown> = { orbit: kept };
    on('state.get', (_$, e) => ({
        value: { value: state[e.key], version: e.key in state ? 1 : 0 },
    }));
    on('state.set', (_$, e) => {
        state[e.key] = e.value;
        return { value: { isSet: true, version: 2 } };
    });
    // the reload lands at the turn's end: turn.complete reaches the fresh module before its session.start
    await endTurn($);
    expect(
        (state.orbit as { asks: { id: string }[] }).asks.map((a) => a.id),
    ).toEqual(['o3']);
});

test("an ask's pick is drawn bold", async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes, after ci']);
    // the pick is its own nested Text; ui.find would return the line around it first
    expect(
        (await ui.findAll({ type: 'Text' })).find(
            (n) => n.text === 'yes, after ci',
        )?.props.bold,
    ).toBe(true);
});

test('an ask answered this turn leads its line with 👀 until the turn ends', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await say($, 'go');
    await orbit($, { ids: ['o1'], op: 'resolve' });
    const row = await ui.find({ key: 'orbit:ask:o1', type: 'Box' });
    expect(row?.text?.startsWith('👀 o1:')).toBe(true);
});

test("a plan line's lead word prints bold", async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await orbit($, {
        lines: ['now: the slim row', 'no lead here'],
        op: 'plan',
    });
    const bold = (await ui.findAll({ type: 'Text' }))
        .filter((n) => n.props.bold)
        .map((n) => n.text);
    expect([bold.includes('now:'), bold.includes('no lead here')]).toEqual([
        true,
        false,
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

test("a follow drops the ask's tick record: his word answered the old question (S3)", async ($, on) => {
    world(on);
    const writes = tickLog(on);
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    await orbit($, {
        id: 'o1',
        op: 'follow',
        pick: 'yes',
        text: 'push `backup`',
    });
    expect(writes.at(-1)).toEqual([]);
});

test('a speak press keeps mobile mode on', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await mobile($);
    await ui.press({ key: 'orbit:stop:o1' });
    await say($, 'hi');
    expect(lastContext(w.contexts)).toContain('asks fence');
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

const hrefs = async (ui: {
    findAll: (q: {
        type: string;
    }) => Promise<{ props: Record<string, unknown> }[]>;
}) => (await ui.findAll({ type: 'Link' })).map((n) => n.props.href);

test('a ticket id in an ask opens its linear page', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['close FRM-381 after the sixth sense', 'yes']);
    expect(await hrefs(ui)).toContain('https://linear.app/x-com/issue/FRM-381');
});

test('a ticket id in a phase line opens its linear page', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await orbit($, { lines: ['now: build BYT-12'], op: 'plan' });
    expect(await hrefs(ui)).toContain('https://linear.app/x-com/issue/BYT-12');
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

test('an assumption shows under «assumed» below the asks', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await assume($, 'kept the old port, 7373');
    expect([
        (await ui.find({ text: 'assumed', type: 'Text' }))?.text,
        (await ui.find({ key: 'orbit:assumption:a1', type: 'Box' }))?.text,
    ]).toEqual([
        'assumed',
        expect.stringContaining('a1: kept the old port, 7373'),
    ]);
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

test('an unmarked assumption leaves after three turns', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await say($, 'go');
    await assume($, 'kept the old port');
    for (let i = 0; i < 3; i++) {
        await endTurn($);
        await say($, 'more');
    }
    expect(await ui.find({ key: 'orbit:assumption:a1', type: 'Box' })).toBe(
        undefined,
    );
});

test('an assumption still shows two turns on', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await say($, 'go');
    await assume($, 'kept the old port');
    for (let i = 0; i < 2; i++) {
        await endTurn($);
        await say($, 'more');
    }
    expect(await ui.find({ key: 'orbit:assumption:a1', type: 'Box' })).not.toBe(
        undefined,
    );
});

// the 🎛️ board parts (FRM-391 batch 3): each drawn by default, gone when its switch is off
const BOARD_PARTS: [string, (ui: Board) => Promise<boolean>][] = [
    [
        'stash.orbit',
        async (ui) =>
            (await ui.find({ key: 'orbit', type: 'Box' })) !== undefined,
    ],
    [
        'stash.assumed',
        async (ui) =>
            (await ui.find({ key: 'orbit:assumed', type: 'Box' })) !==
            undefined,
    ],
    [
        'stash.phases',
        async (ui) =>
            (await ui.find({ key: 'phases', type: 'Box' })) !== undefined,
    ],
    [
        'stash.speak',
        async (ui) =>
            (await ui.find({ key: 'orbit:read:o1', type: 'Button' })) !==
            undefined,
    ],
];

for (const [part, drawn] of BOARD_PARTS)
    test(`the ${part} switch hides its part of the board`, async ($, on) => {
        world(on).store.set('shown', { [part]: false });
        await start($);
        const ui = await board($);
        await add($, ['push FRM-1', 'yes']);
        await orbit($, { op: 'assume', texts: ['moons repeat'] });
        await orbit($, { lines: ['now: a'], op: 'plan' });
        expect(await drawn(ui)).toBe(false);
    });

for (const [part, drawn] of BOARD_PARTS)
    test(`the ${part} part draws while its switch is on`, async ($, on) => {
        world(on);
        await start($);
        const ui = await board($);
        await add($, ['push FRM-1', 'yes']);
        await orbit($, { op: 'assume', texts: ['moons repeat'] });
        await orbit($, { lines: ['now: a'], op: 'plan' });
        expect(await drawn(ui)).toBe(true);
    });

// 📁 folds a card to its head row and back (dima's o5)
for (const [card, body] of [
    ['orbit', { key: 'orbit:ask:o1' }],
    ['phases', { text: '🌕 now: a', type: 'Text' as const }],
] as const)
    test(`📁 folds the ${card} card to its head and a second press opens it`, async ($, on) => {
        world(on);
        await start($);
        const ui = await board($);
        await add($, ['push FRM-1', 'yes']);
        await orbit($, { lines: ['now: a'], op: 'plan' });
        const drawn = async () => (await ui.find(body)) !== undefined;
        const open = await drawn();
        await ui.press({ key: `fold:${card}` });
        const folded = await drawn();
        await ui.press({ key: `fold:${card}` });
        expect([open, folded, await drawn()]).toEqual([true, false, true]);
    });

test("orbit's head ends ✅ then 📁, at the far right", async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    const head = (await ui.findAll({ type: 'Button' }))
        .map((b) => b.key)
        .filter((k) => k === 'orbit:all' || k === 'fold:orbit');
    expect(head).toEqual(['orbit:all', 'fold:orbit']);
});

test('the fold button reads 📂 while its card is open and 📁 while folded', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    const glyph = async () => (await ui.find({ key: 'fold:orbit' }))?.text;
    const open = await glyph();
    await ui.press({ key: 'fold:orbit' });
    expect([open, await glyph()]).toEqual(['📂', '📁']);
});

test('with read-aloud on assumptions off, an assumption draws no 🔊', async ($, on) => {
    const w = world(on);
    w.store.set('speak-assumed', false);
    await start($);
    const ui = await board($);
    await orbit($, { op: 'assume', texts: ['moons repeat'] });
    expect(await ui.find({ key: 'orbit:read:a1' })).toBe(undefined);
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

test("an ask's https link draws as a link to that url", async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await addLinked($, 'https://github.com/x/y/pull/7');
    expect(
        (await ui.find({ text: '🔗 github.com', type: 'Link' }))?.props.href,
    ).toBe('https://github.com/x/y/pull/7');
});

test("an ask's file link opens through open, its ~ the home dir", async ($, on) => {
    world(on);
    const runs: string[][] = [];
    on('process.run', (_$, e) => {
        runs.push([...e.argv]);
        return {
            value: {
                exitCode: 0,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout: '',
            },
        };
    });
    await start($);
    const ui = await board($);
    await addLinked($, '~/frame/.scratch/catch/kinds.md');
    const label = (await ui.find({ key: 'ask:link:o1', type: 'Button' }))?.text;
    await ui.press({ key: 'ask:link:o1' });
    expect([label, runs.at(-1)]).toEqual([
        '🔗 kinds.md',
        ['open', '/home/frame/.scratch/catch/kinds.md'],
    ]);
});

// FRM-426 rider: a vault note can be linked from an ask
function openRuns(on: On) {
    const runs: string[][] = [];
    on('process.run', (_$, e) => {
        runs.push([...e.argv]);
        return {
            value: {
                exitCode: 0,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout: '',
            },
        };
    });
    return runs;
}

test("an ask's file link may hold spaces, as an iCloud vault path does", async ($, on) => {
    world(on);
    const runs = openRuns(on);
    await start($);
    const ui = await board($);
    await addLinked(
        $,
        '~/Library/Mobile Documents/iCloud~md~obsidian/Documents/vault/_hq/the inbox.md',
    );
    const label = (await ui.find({ key: 'ask:link:o1', type: 'Button' }))?.text;
    await ui.press({ key: 'ask:link:o1' });
    expect([label, runs.at(-1)]).toEqual([
        '🔗 the inbox.md',
        [
            'open',
            '/home/Library/Mobile Documents/iCloud~md~obsidian/Documents/vault/_hq/the inbox.md',
        ],
    ]);
});

test("an ask's obsidian:// link opens through open, labelled by its note", async ($, on) => {
    world(on);
    const runs = openRuns(on);
    await start($);
    const ui = await board($);
    const url = 'obsidian://open?vault=vault&file=_hq%2Finbox';
    await addLinked($, url);
    const label = (await ui.find({ key: 'ask:link:o1', type: 'Button' }))?.text;
    await ui.press({ key: 'ask:link:o1' });
    expect([label, runs.at(-1)]).toEqual(['🔗 inbox', ['open', url]]);
});

test('an obsidian:// link with a stray % still draws, labelled by the raw note', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await addLinked($, 'obsidian://open?vault=v&file=100%');
    expect((await ui.find({ key: 'ask:link:o1', type: 'Button' }))?.text).toBe(
        '🔗 100%',
    );
});

test('the link rides the ask a glide card draws from the store', async ($, on) => {
    const w = world(on);
    await start($);
    await addLinked($, 'https://github.com/x/y/pull/7');
    expect(
        (w.store.get('asks:o1o1o1o1-orbit') as { items: { link?: string }[] })
            .items[0]?.link,
    ).toBe('https://github.com/x/y/pull/7');
});

test('a store written by the old build loads untouched, its stale keys ignored', async ($, on) => {
    const w = world(on);
    const shown = { 'stash.chips': false };
    w.store.set('undo-window', true);
    w.store.set('undo-delay', 30);
    w.store.set('shown', shown);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    expect([
        (await ui.find({ key: 'orbit:accepted:o1' }))?.text,
        w.store.get('undo-window'),
        w.store.get('shown'),
    ]).toEqual(['✅ tick', true, shown]);
});

test('a tick reads ✅ tick at once', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    expect((await ui.find({ key: 'orbit:accepted:o1' }))?.text).toBe('✅ tick');
});

test('a tick taken back by a second press never reaches the turn', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await say($, 'run the long job');
    await ui.press({ key: 'orbit:accepted:o1' });
    await ui.press({ key: 'orbit:accepted:o1' });
    const r = await $.tool.call({ command: 'ls', tool: 'Bash' });
    expect((r.context ?? []).join('\n')).not.toMatch(/o1 🛎️ accepted/);
});

test('a running turn takes a tick at its next tool call', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await say($, 'run the long job');
    await ui.press({ key: 'orbit:accepted:o1' });
    const r = await $.tool.call({ command: 'ls', tool: 'Bash' });
    expect((r.context ?? []).join('\n')).toMatch(/o1 🛎️ accepted/);
});

const turnContext = async ($: Engine) =>
    ((await $.tool.call({ command: 'ls', tool: 'Bash' })).context ?? []).join(
        '\n',
    );

test('a herdr tick joins the running turn once, labelled from herdr, with his steer', async ($, on) => {
    const files: Record<string, string> = {};
    const w = world(on, files);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await say($, 'run the long job');
    const at = w.clock.now();
    files[HERDR_FILE] = press({
        at,
        id: 'o1',
        steer: 'say "hi"\nthen go',
        verdict: 'tick',
    });
    const first = await turnContext($);
    const second = await turnContext($);
    expect([
        first.match(
            /o1 🛎️ accepted from herdr: push FRM-1.*his steer: «say "hi"\nthen go»/s,
        )?.length,
        second.includes('o1 🛎️'),
        w.store.get(`herdr-read:${SID}`),
    ]).toEqual([1, false, at]);
});

// the newest press wins, as at x-mod-guard (sixth sense round 1 on FRM-544: the first-wins rule locked out his ↩️ then 🛎)
test('a herdr replay after a desktop tick takes it back, its tick record with it', async ($, on) => {
    const files: Record<string, string> = {};
    const w = world(on, files);
    const writes = tickLog(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    files[HERDR_FILE] = press({
        at: w.clock.now(),
        id: 'o1',
        verdict: 'replay',
    });
    await say($, 'go on');
    expect([
        /o1 🛎️ accepted/.test(joined(w.contexts).join('\n')),
        (writes.at(-1) as unknown[] | undefined)?.length,
    ]).toEqual([false, 0]);
});

// clio's o49 at 19:30: x-herdr-deck prunes a press once read and the turn that takes the ask clears its mark, so a herdr
// 🛎 writes the tick record a seat-board 🛎 writes, which x-mod-guard honours for 2 h
test('a herdr tick writes the tick record a seat-board tick writes', async ($, on) => {
    const files: Record<string, string> = {};
    const w = world(on, files);
    const writes = tickLog(on);
    await start($);
    await add($, ['✍️ sign FRM-1: a small ticket', 'sign it']);
    files[HERDR_FILE] = press({
        at: w.clock.now(),
        id: 'o1',
        text: '✍️ sign FRM-1: a small ticket',
        verdict: 'tick',
    });
    await say($, 'go on');
    const last = (writes.at(-1) ?? []) as { id: string; text: string }[];
    expect(last.map((t) => [t.id, t.text])).toEqual([
        ['o1', '✍️ sign FRM-1: a small ticket'],
    ]);
});

test('of two herdr presses on one ask read together, the newest wins', async ($, on) => {
    const files: Record<string, string> = {};
    const w = world(on, files);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    const at = w.clock.now();
    files[HERDR_FILE] =
        press({ at, id: 'o1', verdict: 'replay' }) +
        press({ at: at + 1, id: 'o1', verdict: 'tick' });
    await say($, 'go on');
    expect(joined(w.contexts).join('\n')).toMatch(/o1 🛎️ accepted/);
});

test('a herdr 🛎 after his ↩️ on the seat board ticks the ask', async ($, on) => {
    const files: Record<string, string> = {};
    const w = world(on, files);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:rejected:o1' });
    files[HERDR_FILE] = press({ at: w.clock.now(), id: 'o1', verdict: 'tick' });
    await say($, 'go on');
    expect(joined(w.contexts).join('\n')).toMatch(/o1 🛎️ accepted/);
});

test('a herdr tick on a resolved ask changes nothing', async ($, on) => {
    const files: Record<string, string> = {};
    const w = world(on, files);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await orbit($, { ids: ['o1'], op: 'resolve', words: { o1: 'done' } });
    files[HERDR_FILE] = press({ at: w.clock.now(), id: 'o1', verdict: 'tick' });
    await say($, 'go on');
    expect([joined(w.contexts), keptMark(w.store, 'o1')]).toEqual([
        [],
        undefined,
    ]);
});

// the mark the stash kept for an ask, read from the store copy of its orbit
const keptMark = (store: Map<string, unknown>, id: string) =>
    (
        store.get(`kept:${SID}`) as
            | { orbit?: { asks?: { id: string; mark?: string }[] } }
            | undefined
    )?.orbit?.asks?.find((a) => a.id === id)?.mark;

test('a herdr press already taken never marks the round a follow puts under its id', async ($, on) => {
    const files: Record<string, string> = {};
    const w = world(on, files);
    await start($);
    await add($, ['push FRM-1', 'yes'], ['push FRM-2', 'yes']);
    await say($, 'go');
    const at = w.clock.now();
    files[HERDR_FILE] = press({ at, id: 'o1', verdict: 'tick' });
    await turnContext($);
    await orbit($, {
        id: 'o1',
        op: 'follow',
        pick: 'after ci',
        text: 'push FRM-1',
    });
    await endTurn($);
    // a newer press on another ask makes the file worth reading again; only the watermark keeps o1's old line out
    files[HERDR_FILE] += press({ at: at + 1, id: 'o2', verdict: 'tick' });
    await say($, 'go on');
    expect(joined(w.contexts).join('\n')).toMatch(
        /^(?![\s\S]*- o1 )[\s\S]*- o2 🛎️/,
    );
});

test('a herdr press made on the old question never marks the new one a follow put under its id', async ($, on) => {
    const files: Record<string, string> = {};
    const w = world(on, files);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await orbit($, {
        id: 'o1',
        op: 'follow',
        pick: 'after ci',
        text: 'push FRM-1 once ci is green',
    });
    files[HERDR_FILE] = press({
        at: w.clock.now(),
        id: 'o1',
        text: 'push FRM-1',
        verdict: 'tick',
    });
    await say($, 'go on');
    expect(joined(w.contexts)).toEqual([]);
});

// FRM-552's decision 4 (no record from a herdr tick) is reversed: x-mod-guard already read the press file as his word
// since FRM-544 slice 1, behind the ticks-write fence, and the press is gone from the file after his next one
test('a herdr tick on an ask quoting a command writes the record x-mod-guard reads as his word', async ($, on) => {
    const files: Record<string, string> = {};
    const w = world(on, files);
    const writes = tickLog(on);
    await start($);
    await add($, ['⚠️ push `git push --mirror origin` to the backup', 'yes']);
    files[HERDR_FILE] = press({ at: w.clock.now(), id: 'o1', verdict: 'tick' });
    await say($, 'go on');
    const last = (writes.at(-1) ?? []) as { targets: string[] }[];
    expect([joined(w.contexts).join('\n'), last.map((t) => t.targets)]).toEqual(
        [
            expect.stringMatching(/o1 🛎️ accepted/),
            [['git push --mirror origin']],
        ],
    );
});

test('a phases tick is ready at once', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await orbit($, { lines: ['now: a', 'next: b'], op: 'plan' });
    await ui.press({ key: 'plan:tick' });
    expect((await ui.find({ key: 'plan:tick' }))?.text).toBe('✅ tick');
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

test("an ask's row puts its steer before its file link (dima, 20:57)", async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await orbit($, {
        asks: [{ link: '/tmp/proposal.md', pick: 'apply', text: 'r34 groom' }],
        op: 'add',
    });
    // the harness keeps no text or key on a row's children (mods/engine.md): the steer is the one Box, the link a Button
    const row = await ui.find({ key: 'orbit:row:o1' });
    const types = (row?.children ?? []).map(
        (c) => (c as { type?: string }).type,
    );
    expect(types.slice(-2)).toEqual(['Box', 'Button']);
});

/* o84: dima reorders, ticks and steers the phases on the board */

const phaseLines = async (ui: Board) =>
    (await ui.findAll({ type: 'Text' }))
        .map((t) => t.text ?? '')
        .filter((t) => /^[🌕🌔🌓🌒🌑] (?!phases)/u.test(t));

test('a ↑ on a phase moves it up on the board at once', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await orbit($, { lines: ['now: a', 'next: b', 'then: c'], op: 'plan' });
    await ui.press({ key: 'plan:1:up' });
    expect((await phaseLines(ui)).map((t) => t.slice(-1))).toEqual([
        'b',
        'a',
        'c',
    ]);
});

test('a reorder joins the running turn at once, the new order listed', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await orbit($, { lines: ['now: a', 'next: b'], op: 'plan' });
    await say($, 'go');
    await ui.press({ key: 'plan:0:down' });
    const first =
        (await $.tool.call({ command: 'ls', tool: 'Bash' })).context ?? [];
    const again =
        (await $.tool.call({ command: 'ls', tool: 'Bash' })).context ?? [];
    expect([
        first.join('\n'),
        again.some((c) => /reordered your phases/.test(c)),
    ]).toEqual([
        expect.stringMatching(
            /reordered your phases[\s\S]*1\. next: b\n2\. now: a/,
        ),
        false,
    ]);
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

test("every phase line keeps the same two arrow buttons; an end's dead one does nothing", async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await orbit($, { lines: ['now: a', 'next: b', 'then: c'], op: 'plan' });
    // the same two buttons on every line; a press on an end's dead one changes nothing (dima, 21:23)
    const has = async (k: string) => (await ui.find({ key: k }))?.type ?? '-';
    const before = await phaseLines(ui);
    await ui.press({ key: 'plan:0:up' });
    await ui.press({ key: 'plan:2:down' });
    expect([
        await Promise.all(
            [0, 1, 2]
                .flatMap((i) => [`plan:${i}:up`, `plan:${i}:down`])
                .map(has),
        ),
        await phaseLines(ui),
    ]).toEqual([Array(6).fill('Button'), before]);
});

test('a press on a dead end arrow sends the turn no reorder', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await orbit($, { lines: ['now: a', 'next: b'], op: 'plan' });
    await say($, 'go');
    await ui.press({ key: 'plan:0:up' });
    await w.clock.advance(5_000);
    const r = await $.tool.call({ command: 'ls', tool: 'Bash' });
    expect((r.context ?? []).some((c) => /reordered your phases/.test(c))).toBe(
        false,
    );
});

test("the phases tick and steer sit in the card's head row, centered, before 📂 (dima, 21:26)", async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await orbit($, { lines: ['now: a', 'next: b'], op: 'plan' });
    const head = await ui.find({ key: 'phases:head' });
    const act = await ui.find({ key: 'plan:act' });
    expect([
        head?.props.alignItems,
        (head?.children ?? []).map((c) => (c as { type?: string }).type),
        act?.props.alignItems,
        Boolean(await ui.find({ key: 'plan:tick' })),
    ]).toEqual(['center', ['Box', 'Box', 'Button'], 'center', true]);
});

test("a closed ask leads with its word's emoji: dropped 🗑️, started ▶️, anything else ✅", () => {
    expect(
        [
            'dropped: superseded by o58',
            'queued for the mods codie',
            'started',
            'landed',
            'applied, quote gate clean',
        ].map(closedMark),
    ).toEqual(['🗑️', '▶️', '▶️', '✅', '✅']);
});

test('a «siesta:» phase draws 🌤️ in place of its moon', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await orbit($, {
        lines: ['now: a', 'siesta: wishkeeper', 'then: b'],
        op: 'plan',
    });
    const leads = (await ui.findAll({ type: 'Text' }))
        .map((t) => t.text ?? '')
        .filter((t) => /(now|siesta|then): /.test(t) && !/phases/.test(t))
        .map((t) => [...t][0]);
    expect(leads).toEqual(['🌕', '🌤', '🌓']);
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

test('with 🌔 phases switched off, no prompt names phases or the plan', async ($, on) => {
    const w = world(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    partOff(w, 'stash.phases');
    await say($, 'hi');
    expect(lines(w)).not.toMatch(/phases|plan/);
});

test('with 🌔 phases switched off, a working turn gets no nudge', async ($, on) => {
    const w = world(on);
    await start($);
    partOff(w, 'stash.phases');
    await say($, 'go');
    expect((await edits($, 4)).some((c) => /phases/.test(c))).toBe(false);
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

test("with 🌔 phases switched off, dima's phases tick joins no running turn", async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await orbit($, { lines: ['now: a'], op: 'plan' });
    await say($, 'go');
    await ui.press({ key: 'plan:tick' });
    await w.clock.advance(5_000);
    partOff(w, 'stash.phases');
    const r = await $.tool.call({ command: 'ls', tool: 'Bash' });
    expect((r.context ?? []).join('\n')).not.toContain('🌔 phases: dima');
});

/* one no-board reply reminder: 📱 mobile mode and 🪐 orbit switched off both inject it (dima's o162) */

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

// the old process quits as a reboot quits it: session.end, not a /clear
const quit = ($: Engine) =>
    $.session.end({ reason: 'other', sessionId: SID } as never);

test('open asks come back when the session is resumed in a new process', async ($, on) => {
    world(on);
    const state = stateOf(on);
    await start($);
    await add($, ['push FRM-1', 'yes'], ['trash the probe', 'no']);
    await quit($);
    state.clear();
    await start($);
    const ui = await board($);
    expect(await asksShown(ui)).toEqual(['o1', 'o2']);
});

// an app restart mid-turn: the new process's first hook is that turn's end, before its session.start (10-13 17:22,
// clio's o158 gone)
test('open asks come back when the new process ends a turn before its start', async ($, on) => {
    const w = world(on);
    stateOf(on);
    w.store.set(`kept:${SID}`, {
        at: w.clock.now(),
        orbit: {
            asks: [
                { id: 'o1', pick: 'yes', text: 'push FRM-1' },
                { id: 'o2', pick: 'no', text: 'trash the probe' },
            ],
            next: 3,
            turns: 4,
        },
    });
    await endTurn($);
    await start($);
    const ui = await board($);
    expect(await asksShown(ui)).toEqual(['o1', 'o2']);
});

test('a process that quits before its start leaves the kept asks for the next one', async ($, on) => {
    const w = world(on);
    stateOf(on);
    w.store.set(`kept:${SID}`, {
        at: w.clock.now(),
        orbit: {
            asks: [{ id: 'o1', pick: 'yes', text: 'push FRM-1' }],
            next: 2,
            turns: 4,
        },
    });
    await quit($);
    await start($);
    const ui = await board($);
    expect(await asksShown(ui)).toEqual(['o1']);
});

test('a resumed orbit keeps counting its ids where it stopped', async ($, on) => {
    world(on);
    const state = stateOf(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await quit($);
    state.clear();
    await start($);
    const r = (await add($, ['one more', 'yes'])) as { result?: string };
    expect(r.result).toMatch(/^added o2 /);
});

test('a /clear starts the next conversation with an empty orbit', async ($, on) => {
    world(on);
    const state = stateOf(on);
    on('command.run', () => ({ text: '' }));
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await $.command.run({
        args: '',
        command: 'clear',
        origin: { kind: 'composer' },
        presentation: { columns: 80, isFullscreen: false },
    });
    state.clear();
    await start($);
    const ui = await board($);
    expect(await asksShown(ui)).toEqual([]);
});

test('a kept state unsaved for a week is dropped at the next start', async ($, on) => {
    const w = world(on);
    const week = 7 * 24 * 60 * 60 * 1000;
    w.store.set('kept:gone-sid', { at: w.clock.now() - week, orbit: {} });
    w.store.set('kept:recent-sid', {
        at: w.clock.now() - week + 60_000,
        orbit: {},
    });
    await start($);
    expect([...w.store.keys()].filter((k) => k.startsWith('kept:'))).toEqual([
        'kept:recent-sid',
    ]);
});

test("a resumed orbit's open asks reach the store again, so every board counts them", async ($, on) => {
    const w = world(on);
    const state = stateOf(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await quit($);
    state.clear();
    await start($);
    expect(
        (w.store.get(`asks:${SID}`) as { asks?: string[] } | undefined)?.asks,
    ).toEqual(['push FRM-1']);
});

test('🌔 phases come back when the session is resumed in a new process', async ($, on) => {
    const w = world(on);
    const state = stateOf(on);
    await start($);
    await orbit($, { lines: ['now: a', 'next: b'], op: 'plan' });
    await quit($);
    state.clear();
    await start($);
    await say($, 'hi');
    expect(lines(w)).toMatch(/plan set/);
});

test('a folded card comes back folded when the session is resumed in a new process', async ($, on) => {
    world(on);
    const state = stateOf(on);
    await start($);
    state.set('folds', { 'orbit:assumed': true });
    await quit($);
    state.clear();
    await start($);
    expect(state.get('folds')).toEqual({ 'orbit:assumed': true });
});

test('📱 mobile mode comes back on when the session is resumed in a new process', async ($, on) => {
    const w = world(on);
    const state = stateOf(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await mobile($);
    await quit($);
    state.clear();
    await start($);
    await say($, 'hi');
    expect(lines(w)).toMatch(/no board reaches dima/);
});

// a crash or a power cut ends the process with no session.end: what was saved before it comes back
test('asks saved before a crash come back, with no clean quit', async ($, on) => {
    world(on);
    const state = stateOf(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    state.clear();
    await start($);
    const ui = await board($);
    expect(await asksShown(ui)).toEqual(['o1']);
});

test('a fold made a poll before a crash comes back, with no clean quit', async ($, on) => {
    const w = world(on);
    const state = stateOf(on);
    await start($);
    state.set('folds', { 'orbit:assumed': true });
    await w.clock.advance(4_000);
    state.clear();
    await start($);
    expect(state.get('folds')).toEqual({ 'orbit:assumed': true });
});

test('a poll that finds nothing changed leaves the kept copy as it was', async ($, on) => {
    const w = world(on);
    stateOf(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    const before = (w.store.get(`kept:${SID}`) as { at?: number } | undefined)
        ?.at;
    await w.clock.advance(8_000);
    expect(
        (w.store.get(`kept:${SID}`) as { at?: number } | undefined)?.at,
    ).toBe(before);
});

// todo 17: the cost hint is clio's alone; this world's session is no clio
test('a cost question in a session that is not clio carries no cost hint', async ($, on) => {
    const w = world(on);
    await start($);
    await say($, 'what does a cache read cost?');
    expect((w.contexts.at(-1) ?? []).join('\n')).not.toMatch(/a cost question/);
});

// PK-227: one home for the next move — a wrap_up ask while an orbit ask is open reds the Stop once
const WRAP_UP = 'mcp__ccd_turn__wrap_up';

const stop = ($: Engine, text = 'done.', isActive = false) =>
    $.classic.Stop({
        last_assistant_message: text,
        session_id: SID,
        stop_hook_active: isActive,
    } as never);

const wrapUp = ($: Engine, ask?: string) =>
    $.tool.call({
        ...(ask ? { ask } : {}),
        recap: 'shipped',
        tool: WRAP_UP,
    } as never);

test('a wrap_up carrying an ask while an orbit ask is open reds the Stop, naming the ask', async ($, on) => {
    world(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await say($, 'go');
    await wrapUp($, 'Commit now?');
    const r = await stop($);
    expect(r.block).toMatch(/wrap_up.*o1.*push FRM-1/s);
});

for (const [why, run] of [
    [
        'no open orbit ask',
        async ($: Engine) => {
            await say($, 'go');
            await wrapUp($, 'Commit now?');
        },
    ],
    [
        'a wrap_up with no ask',
        async ($: Engine) => {
            await add($, ['push FRM-1', 'yes']);
            await say($, 'go');
            await wrapUp($);
        },
    ],
] as const)
    test(`the Stop passes with ${why}`, async ($, on) => {
        world(on);
        await start($);
        await run($);
        expect((await stop($)).block).toBeUndefined();
    });

test('the turn right after its own red passes: no loop', async ($, on) => {
    world(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await say($, 'go');
    await wrapUp($, 'Commit now?');
    await stop($);
    // the continuation the red woke repeats the wrap_up ask; it still passes
    await wrapUp($, 'Commit now?');
    expect((await stop($, 'fixed.', true)).block).toBeUndefined();
});

test('a --bg session passes: its asks go to its coordinator', async ($, on) => {
    world(on, {
        '/home/.claude/sessions/4242.json': JSON.stringify({
            kind: 'bg',
            name: 'probe',
            pid: 4242,
        }),
    });
    on('process.run', () => ({
        value: {
            exitCode: 0,
            isStderrTruncated: false,
            isStdoutTruncated: false,
            stderr: '',
            stdout: '4242\nMon Oct 12 15:00:00 2026\n',
        },
    }));
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await say($, 'go');
    await wrapUp($, 'Commit now?');
    expect((await stop($)).block).toBeUndefined();
});

// the 10-25 rider: a grill's Q asks go out with their round — an add opening «Q<n>» needs «❓ **Q<n>**» in the reply
test('an orbit add opening «Q2» passes, and a reply lacking «❓ **Q2**» reds the Stop', async ($, on) => {
    world(on);
    await start($);
    await say($, 'grill me');
    const r = await orbit($, {
        asks: [{ pick: 'a', text: 'Q2 which door for the tick record?' }],
        op: 'add',
    });
    expect([r.deny, (await stop($, 'asked in orbit.')).block]).toEqual([
        undefined,
        expect.stringMatching(/Q2.*❓ \*\*Q2\*\*/s),
    ]);
});

test('a reply printing «❓ **Q2**» passes the Stop', async ($, on) => {
    world(on);
    await start($);
    await say($, 'grill me');
    await orbit($, {
        asks: [{ pick: 'a', text: 'Q2 which door for the tick record?' }],
        op: 'add',
    });
    expect(
        (await stop($, '❓ **Q2** which door?\n- a) state\n- b) file')).block,
    ).toBeUndefined();
});

test('a round with its title inside the bold passes the Stop, no reprint', async ($, on) => {
    world(on);
    await start($);
    await say($, 'grill me');
    await orbit($, {
        asks: [{ pick: 'a', text: 'Q2 which door for the tick record?' }],
        op: 'add',
    });
    expect(
        (await stop($, '❓ **Q2 - which door**: state or file?')).block,
    ).toBeUndefined();
});

test('a printed «❓ **Q20**» does not stand in for «Q2»', async ($, on) => {
    world(on);
    await start($);
    await say($, 'grill me');
    await orbit($, {
        asks: [{ pick: 'a', text: 'Q2 which door for the tick record?' }],
        op: 'add',
    });
    expect((await stop($, '❓ **Q20** another question')).block).toMatch(
        /Q2.*❓ \*\*Q2\*\*/s,
    );
});

test('an orbit kept with caught pieces loads without them, and the board draws no 🐠', async ($, on) => {
    world(on);
    let kept: unknown = {
        asks: [{ id: 'o1', pick: 'yes', text: 'push FRM-1' }],
        caught: [{ at: 0, id: 'c2', kind: '💡', text: 'an old piece' }],
        next: 3,
        turns: 1,
    };
    on('state.get', (_$, e, next) =>
        e.key === 'orbit' ? { value: { value: kept, version: 1 } } : next(e),
    );
    on('state.set', (_$, e, next) => {
        if (e.key !== 'orbit') return next(e);
        kept = e.value;
        return { value: { isSet: true, version: 2 } };
    });
    await start($);
    const ui = await board($);
    expect([
        'caught' in (kept as object),
        (await texts(ui)).includes('🐠'),
        await asksShown(ui),
    ]).toEqual([false, false, ['o1']]);
});

test('an ask that breaks the orbit card blanks the card alone, the board still draws', async ($, on) => {
    world(on);
    const state: Record<string, unknown> = {
        orbit: { asks: [], next: 2, turns: 1 },
    };
    on('state.get', (_$, e) => ({
        value: { value: state[e.key], version: e.key in state ? 1 : 0 },
    }));
    on('state.set', (_$, e) => {
        state[e.key] = e.value;
        return { value: { isSet: true, version: 2 } };
    });
    await start($);
    state.orbit = {
        asks: [{ id: 'o1', link: 5, pick: 'y', text: 'x' }],
        next: 2,
        turns: 1,
    };
    const ui = await board($);
    expect([
        (await ui.find({ key: 'broken:orbit', type: 'Box' }))?.text,
        (await ui.find({ text: /failed to draw/, type: 'Text' }))?.text,
    ]).toEqual(['⚠ orbit could not draw', undefined]);
});

/* FRM-492 round 3: a hot reload keeps $.state and starts a fresh module. the harness keeps one module per file, so a
   row forgets the module's boxes with a fold, lays back the $.state the old module left, and runs the reload's start */

test('✅ on twenty-five asks keeps every record', async ($, on) => {
    world(on);
    const writes = tickLog(on);
    await start($);
    const ui = await board($);
    for (let i = 0; i < 25; i++) await add($, [`push \`t${i}\``, 'yes']);
    await ui.press({ key: 'orbit:all' });
    expect((writes.at(-1) as unknown[]).length).toBe(25);
});

test('a press drops a record past its 2 h, and keeps a live one', async ($, on) => {
    const w = world(on);
    const writes = tickLog(on);
    const now = w.clock.now();
    const old = {
        at: now - 2 * 60 * 60 * 1000 - 1,
        id: 'o8',
        targets: [],
        text: 'old',
    };
    const live = { at: now - 1000, id: 'o9', targets: [], text: 'live' };
    on('state.get', (_$, e, next) =>
        e.key === 'ticks'
            ? { value: { value: [old, live], version: 1000 } }
            : next(e as never),
    );
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    expect((writes.at(-1) as { id: string }[]).map((t) => t.id)).toEqual([
        'o9',
        'o1',
    ]);
});

// the deck's tick is a toggle: his ↩️ there after a 🛎 a turn already took drops the record, as a seat-board ↩️ does,
// so the guard honours no tick he took back
test('a herdr ↩️ after a herdr tick a turn took drops its tick record', async ($, on) => {
    const files: Record<string, string> = {};
    const w = world(on, files);
    const writes = tickLog(on);
    await start($);
    await add($, ['⚠️ push `git push --mirror origin` to the backup', 'yes']);
    const at = w.clock.now();
    files[HERDR_FILE] = press({ at, id: 'o1', verdict: 'tick' });
    await say($, 'go on');
    await endTurn($);
    files[HERDR_FILE] += press({ at: at + 1, id: 'o1', verdict: 'replay' });
    await say($, 'next');
    const last = (writes.at(-1) ?? []) as { id: string }[];
    expect(last.map((t) => t.id)).toEqual([]);
});

// FRM-574 rider, PK-363:W934: his untick on x-herdr-deck takes back a tick the stash already read, and a tick after it
// marks the ask again
test('exit 12: a herdr untick after a read tick leaves the next turn no mark, and a tick after it marks again', async ($, on) => {
    const files: Record<string, string> = {};
    const w = world(on, files);
    const writes = tickLog(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    const at = w.clock.now();
    files[HERDR_FILE] = press({ at, id: 'o1', steer: 'go', verdict: 'tick' });
    await say($, 'go on');
    await endTurn($);
    const ticked = joined(w.contexts).join('\n');
    w.contexts.length = 0;
    files[HERDR_FILE] += press({ at: at + 1, id: 'o1', verdict: 'untick' });
    await say($, 'go on');
    await endTurn($);
    const unticked = joined(w.contexts).join('\n');
    const record = (writes.at(-1) as unknown[] | undefined)?.length;
    w.contexts.length = 0;
    files[HERDR_FILE] += press({ at: at + 2, id: 'o1', verdict: 'tick' });
    await say($, 'go on');
    expect([
        /o1 🛎️ accepted/.test(ticked),
        /o1 🛎️/.test(unticked),
        record,
        /o1 🛎️ accepted/.test(joined(w.contexts).join('\n')),
    ]).toEqual([true, false, 0, true]);
});

test('of a herdr tick and his untick read together, the untick wins', async ($, on) => {
    const files: Record<string, string> = {};
    const w = world(on, files);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    const at = w.clock.now();
    files[HERDR_FILE] =
        press({ at, id: 'o1', verdict: 'tick' }) +
        press({ at: at + 1, id: 'o1', verdict: 'untick' });
    await say($, 'go on');
    expect(joined(w.contexts).join('\n')).not.toMatch(/o1 🛎️/);
});
