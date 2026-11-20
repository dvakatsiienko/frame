import { expect, test } from 'claude-code/testing';

import { fieldView, isTypingAt, typedInto } from '../hooks/fields.ts';
import { mounted } from '../hooks/orbit.ts';
import type { FieldDraft } from '../types/stash.d.ts';
import {
    askOf,
    assume,
    boxValue,
    glide,
    keptState,
    lastContext,
    mobile,
    pressRace,
    reload,
    savedSteer,
    stateOf,
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

// a field never redraws because of its own typing (dima, 16:15 and 16:22: the caret drifted mid-word)
const T = 1_000_000;

// type each text a tick apart into a field that drew `drawn`
const typeAll = (drawn: string, ...texts: string[]) =>
    texts.reduce<FieldDraft | undefined>(
        (draft, text, i) => typedInto(draft, drawn, text, T + i * 100),
        undefined,
    );

// what the field draws for the stored value at a time: the held value, the stored one, or a remount
function drawn(
    draft: FieldDraft | undefined,
    saved: string,
    at: number,
    isNumber = false,
) {
    const view = fieldView(draft, saved, at, isNumber);
    if (view.kind === 'held') return view.draft.drawn;
    if (view.kind === 'outside' && view.isRemount) return `remount:${saved}`;
    return saved;
}

test('while typing, every redraw draws the value the field showed', () => {
    const draft = typeAll('', 'a', 'ab', 'abc');
    expect(
        ['', 'a', 'ab', 'abc'].map((saved) => drawn(draft, saved, T + 300)),
    ).toEqual(['', '', '', '']);
});

test('a text field keeps drawing what it showed once typing goes quiet, so its view never jumps to the start', () => {
    expect(drawn(typeAll('', 'a', 'ab'), 'ab', T + 60_000)).toBe('');
});

test('after 3 s of quiet a number field draws the stored value', () => {
    expect(drawn(typeAll('0.5', '0', '0.'), '0.5', T + 3200, true)).toBe('0.5');
});

test('a value set from outside, never typed here, is drawn at once', () => {
    expect(drawn(typeAll('', 'a', 'ab'), 'zz', T + 300)).toBe('zz');
});

test('a clear back to what is drawn, after a save landed, remounts the field', () => {
    const draft = typeAll('', 'a', 'ab');
    const view = fieldView(draft, 'ab', T + 250);
    const landed = view.kind === 'held' ? view.draft : draft;
    expect(drawn(landed, '', T + 300)).toBe('remount:');
});

test('the first keystroke before its save lands is lag, never outside', () => {
    expect(drawn(typeAll('', 'a'), '', T + 50)).toBe('');
});

test('a knob value the knob refuses changes nothing drawn while typing', () => {
    expect(drawn(typeAll('0.5', '0', '0.'), '0.5', T + 300)).toBe('0.5');
});

test('the poll counts a field typed into within 3 s as typing, and an older one as idle', () => {
    expect([
        isTypingAt([T], T + 2900),
        isTypingAt([T], T + 3100),
        isTypingAt([], T),
    ]).toEqual([true, false, false]);
});

// FRM-492: the history once kept 50 texts, so a burst of 52+ after a landed save read that save as an outside write
// and drew it over what was typed since
test('a burst of more than 50 keystrokes after a landed save keeps drawing what the field showed', () => {
    let draft = typeAll('', 'a heron');
    const landed = fieldView(draft, 'a heron', T + 2000);
    draft = landed.kind === 'held' ? landed.draft : draft;
    let text = 'a heron';
    for (let i = 0; i < 60; i++) {
        text += 'x';
        const at = T + 3000 + i * 100;
        const v = fieldView(draft, 'a heron', at);
        draft = typedInto(
            v.kind === 'held' ? v.draft : undefined,
            v.kind === 'held' ? v.draft.drawn : 'a heron',
            text,
            at,
        );
    }
    expect(drawn(draft, 'a heron', T + 9500)).toBe('');
});

// FRM-492 local review: a typed-back save still in flight stays his own
test('a backspace back to a landed text keeps the save still in flight as his own', () => {
    const view = fieldView(typeAll('', 'a', 'ab', 'a'), 'a', T + 400);
    const held = view.kind === 'held' ? view.draft : undefined;
    expect(drawn(held, 'ab', T + 500)).toBe('');
});

// FRM-492 local review: a write made from a read older than his last typed save keeps what he typed
const ask = { id: 'o1', pick: 'x', text: 'name a bird' };
test('a write from a read older than his last typed save keeps his steer and what the box mounted with', () => {
    const was = { ...ask, rev: 2, shown: '', steer: 'abcd' };
    const stale = {
        ...ask,
        mark: 'accepted' as const,
        rev: 1,
        shown: '',
        steer: 'abc',
    };
    expect(mounted(was, stale, false)).toEqual({ ...was, mark: 'accepted' });
});

test("a typed save from an older read never rolls back the box's remount", () => {
    const was = { ...ask, gen: 1, rev: 1, shown: '' };
    expect(mounted(was, { ...ask, rev: 1, steer: 'x' }, true)).toEqual({
        ...ask,
        gen: 1,
        rev: 2,
        shown: '',
        steer: 'x',
    });
});

test('a clear from a read as fresh as the last typed save empties the box, remounting it', () => {
    const was = { ...ask, rev: 1, shown: '', steer: 'ab' };
    expect(mounted(was, { ...ask, rev: 1 }, false)).toEqual({
        ...ask,
        gen: 1,
        rev: 1,
        shown: '',
    });
});

test('a steer being typed keeps the value it showed, so a redraw never moves the caret', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await ui.input({ key: 'orbit:steer:o1', kind: 'change', text: 'a' });
    await ui.input({ key: 'orbit:steer:o1', kind: 'change', text: 'ab' });
    expect(
        (await ui.find({ key: 'orbit:steer:o1', type: 'Input' }))?.props.value,
    ).toBe('');
});

// FRM-492: a typed steer survives every redraw — what the box mounted with stays its value until a deliberate
// replacement, whatever else redraws the board
test('a long burst after a saved steer never redraws the field to the old save', async ($, on) => {
    const { clock } = world(on);
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    const key = 'orbit:steer:o1';
    await ui.input({ key, kind: 'change', text: 'a heron' });
    await clock.advance(1600);
    let text = 'a heron';
    for (let i = 0; i < 60; i++) {
        text += 'x';
        await ui.input({ key, kind: 'change', text });
    }
    await add($, ['a second ask', 'x']);
    expect((await ui.find({ key, type: 'Input' }))?.props.value).toBe('');
});

test('after a reload the steer box draws what it mounted with, not the steer typed since', async ($, on) => {
    world(on);
    // a fresh module after a reload mid-typing: the box mounted empty, its typing saved a steer
    const state: Record<string, unknown> = {
        orbit: {
            asks: [
                {
                    id: 'o1',
                    pick: 'pelican',
                    shown: '',
                    steer: 'a heron',
                    text: 'name a bird',
                },
            ],
            next: 2,
            turns: 1,
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
    const ui = await board($);
    expect(
        (await ui.find({ key: 'orbit:steer:o1', type: 'Input' }))?.props.value,
    ).toBe('');
});

test('a poll that reads the board closed while a steer is typed keeps the field as drawn', async ($, on) => {
    const { clock, panes } = world(on);
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    const key = 'orbit:steer:o1';
    await ui.input({ key, kind: 'change', text: 'a heron' });
    await clock.advance(1600);
    await ui.input({ key, kind: 'change', text: 'a heron in' });
    panes.isClosed = true;
    await clock.advance(2500);
    panes.isClosed = false;
    await add($, ['a second ask', 'x']);
    expect((await ui.find({ key, type: 'Input' }))?.props.value).toBe('');
});

// FRM-492 sixth sense round 1: a read that fails says nothing about the board, so it clears nothing even with no typing
// in the quiet window — a fresh module holds no typing stamp, the state a pause past 3 s leaves
test('a failed panes read after a quiet pause keeps the box as drawn', async ($, on) => {
    const { clock, panes } = world(on);
    const seeded = {
        asks: [
            {
                id: 'o1',
                pick: 'pelican',
                rev: 1,
                shown: '',
                steer: 'a heron',
                text: 'name a bird',
            },
        ],
        next: 2,
        turns: 1,
    };
    const state: Record<string, unknown> = { orbit: seeded };
    on('state.get', (_$, e) => ({
        value: { value: state[e.key], version: e.key in state ? 1 : 0 },
    }));
    on('state.set', (_$, e) => {
        state[e.key] = e.value;
        return { value: { isSet: true, version: 2 } };
    });
    await start($);
    const ui = await board($);
    // a fold forgets every typing stamp, the module's and the earlier tests' alike; the box is then seeded as it mounted
    await ui.press({ key: 'fold:orbit' });
    await ui.press({ key: 'fold:orbit' });
    state.orbit = seeded;
    panes.isFailed = true;
    await clock.advance(4100);
    panes.isFailed = false;
    // a state the test answers redraws nothing by itself
    await ui.redraw();
    expect(
        (await ui.find({ key: 'orbit:steer:o1', type: 'Input' }))?.props.value,
    ).toBe('');
});

// FRM-492 sixth sense round 1: two boxes saved together each keep their own steer — one save once wrote the other's
// older read over it, and the first box still showed text the orbit no longer held
const steersOf = (store: Map<string, unknown>) =>
    (
        (
            store.get(`asks:${SID}`) as
                | { items: { id: string; steer?: string }[] }
                | undefined
        )?.items ?? []
    ).map((i) => [i.id, i.steer ?? null]);

test('two steer boxes flushed together keep both steers', async ($, on) => {
    const { store } = world(on);
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican'], ['name a fish', 'cod']);
    await ui.input({ key: 'orbit:steer:o1', kind: 'change', text: 'a heron' });
    await ui.input({ key: 'orbit:steer:o2', kind: 'change', text: 'a trout' });
    await orbit($, { lines: ['one'], op: 'plan' });
    await add($, ['third', 'x']);
    expect([
        (await ui.find({ key: 'orbit:steer:o1', type: 'Input' }))?.props.value,
        steersOf(store).slice(0, 2),
    ]).toEqual([
        '',
        [
            ['o1', 'a heron'],
            ['o2', 'a trout'],
        ],
    ]);
});

// FRM-492 local review: a prompt waits for the steer saves it flushed, so a marked ask locks with its steer
test('a prompt right after typing a steer on a ticked ask joins it with that steer', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican'], ['name a fish', 'cod']);
    await ui.press({ key: 'orbit:accepted:o1' });
    await ui.press({ key: 'orbit:accepted:o2' });
    await ui.input({ key: 'orbit:steer:o1', kind: 'change', text: 'a heron' });
    await say($, 'next');
    expect(joined(w.contexts).join('\n')).toContain('his steer: «a heron»');
});

test('two steer boxes saved by their timers in one step keep both steers', async ($, on) => {
    const { clock, store } = world(on);
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican'], ['name a fish', 'cod']);
    await ui.input({ key: 'orbit:steer:o1', kind: 'change', text: 'a heron' });
    await ui.input({ key: 'orbit:steer:o2', kind: 'change', text: 'a trout' });
    await clock.advance(1600);
    await add($, ['third', 'x']);
    expect(steersOf(store).slice(0, 2)).toEqual([
        ['o1', 'a heron'],
        ['o2', 'a trout'],
    ]);
});

test('a steer saves once typing pauses 1.5 s, never on each keystroke', async ($, on) => {
    const { clock, store } = world(on);
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await ui.input({ key: 'orbit:steer:o1', kind: 'change', text: 'a' });
    await ui.input({ key: 'orbit:steer:o1', kind: 'change', text: 'ab' });
    const typing = savedSteer(store);
    await clock.advance(1600);
    expect([typing, savedSteer(store)]).toEqual([undefined, 'ab']);
});

// a save mid-typing keeps the text as typed: a trimmed save was drawn back once typing went quiet, and the desktop
// field lost what the trim cut (dima's wisp, 10-13 15:42)
test('a steer saved after a pause keeps its trailing space, so the field never loses it', async ($, on) => {
    const { clock, store } = world(on);
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await ui.input({ key: 'orbit:steer:o1', kind: 'change', text: 'not a ' });
    await clock.advance(1600);
    expect(savedSteer(store)).toBe('not a ');
});

test('a steer of only spaces saves as no steer', async ($, on) => {
    const { clock, store } = world(on);
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await ui.input({ key: 'orbit:steer:o1', kind: 'change', text: '   ' });
    await clock.advance(1600);
    expect(savedSteer(store)).toBe(undefined);
});

test('a steer typed with a trailing space joins the turn trimmed', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await ui.input({ key: 'orbit:steer:o1', kind: 'change', text: 'a heron ' });
    await ui.press({ key: 'orbit:accepted:o1' });
    await say($, 'next');
    expect(joined(w.contexts).join('\n')).toContain('his steer: «a heron»');
});

test('a tick pressed right after typing carries the steer still waiting to save', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await ui.input({
        key: 'orbit:steer:o1',
        kind: 'change',
        text: 'not a pelican',
    });
    await ui.press({ key: 'orbit:accepted:o1' });
    await say($, 'next');
    expect(joined(w.contexts).join('\n')).toContain(
        'his steer: «not a pelican»',
    );
});

test('a steer is kept as it is typed, with no Enter', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:rejected:o1' });
    await ui.input({
        key: 'orbit:steer:o1',
        kind: 'change',
        text: 'wait for ci',
    });
    await say($, 'next');
    expect(joined(w.contexts).join('\n')).toContain('his steer: «wait for ci»');
});

test("an assumption's steer box is empty once ↩️ sent it back", async ($, on) => {
    world(on);
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
    await endTurn($);
    expect(
        (await ui.find({ key: 'orbit:asteer:a1', type: 'Input' }))?.props
            .value ?? '',
    ).toBe('');
});

test('a card folded and opened again draws the saved steer, not the text from before he typed', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await ui.input({ key: 'orbit:steer:o1', kind: 'change', text: 'a heron' });
    await w.clock.advance(5_000);
    await ui.press({ key: 'fold:orbit' });
    await ui.press({ key: 'fold:orbit' });
    expect(
        (await ui.find({ key: 'orbit:steer:o1', type: 'Input' }))?.props.value,
    ).toBe('a heron');
});

test('a typed steer keeps mobile mode on', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await mobile($);
    await ui.input({ key: 'orbit:steer:o1', text: 'after ci' });
    await say($, 'hi');
    expect(lastContext(w.contexts)).toContain('asks fence');
});

test("the session's new plan keeps the steer dima typed, and the box keeps his text", async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await orbit($, { lines: ['now: a'], op: 'plan' });
    await ui.input({ key: 'plan:steer', kind: 'submit', text: 'b before a' });
    await orbit($, { lines: ['now: b', 'next: a'], op: 'plan' });
    expect(
        (await ui.find({ key: 'plan:steer', type: 'Input' }))?.props.value,
    ).toBe('b before a');
});

// FRM-492 local review: a new process draws a fresh pane, so what the old box mounted with is gone
test('a steer box resumed in a new process draws the kept steer', async ($, on) => {
    const w = world(on);
    stateOf(on);
    w.store.set(`kept:${SID}`, {
        at: w.clock.now(),
        orbit: {
            asks: [
                {
                    id: 'o1',
                    pick: 'yes',
                    rev: 1,
                    shown: '',
                    steer: 'a heron',
                    text: 'name a bird',
                },
            ],
            next: 2,
            turns: 4,
        },
    });
    await start($);
    const ui = await board($);
    expect(
        (await ui.find({ key: 'orbit:steer:o1', type: 'Input' }))?.props.value,
    ).toBe('a heron');
});

test('a glide steer box keeps what it mounted with across a reload', async ($, on) => {
    const w = world(on, glide());
    const state = keptState(on);
    await start($);
    const ui = await board($);
    await ui.input({
        key: 'lane:l9:steer',
        kind: 'change',
        text: 'cards first',
    });
    await w.clock.advance(5_000);
    const before = await boxValue(ui, 'lane:l9:steer');
    await reload($, ui, state, 'lane:l9');
    expect([before, await boxValue(ui, 'lane:l9:steer')]).toEqual(['', '']);
});

test("an assumption's steer box keeps what it mounted with across a reload", async ($, on) => {
    const w = world(on);
    const state = keptState(on);
    await start($);
    const ui = await board($);
    await assume($, 'kept the port r3');
    await ui.redraw();
    const id = (state.orbit as { assumed: { id: string }[] }).assumed[0]?.id;
    const key = `orbit:asteer:${id}`;
    await ui.input({ key, kind: 'change', text: 'use 7374' });
    await w.clock.advance(5_000);
    const before = await boxValue(ui, key);
    await reload($, ui, state, 'orbit');
    expect([before, await boxValue(ui, key)]).toEqual(['', '']);
});

test('a steer typed but not saved yet is kept in $.state until its save lands', async ($, on) => {
    const w = world(on);
    const state = keptState(on);
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await ui.redraw();
    const key = `orbit:steer:${(state.orbit as { asks: { id: string }[] }).asks[0]?.id}`;
    await ui.input({ key, kind: 'change', text: 'a heron' });
    const typed = JSON.stringify(state.fields ?? {});
    await w.clock.advance(5_000);
    expect([
        typed.includes('a heron'),
        JSON.stringify(state.fields ?? {}).includes('a heron'),
    ]).toEqual([true, false]);
});

test('a steer whose save a reload dropped is saved at the next flush', async ($, on) => {
    const w = world(on);
    // the old module typed «a heron» and reloaded before its 1.5 s pause ran out: the save never fired
    keptState(on, {
        fields: { 'orbit:steer:o8': { pending: 'a heron' } },
        orbit: {
            asks: [{ id: 'o8', pick: 'pelican', text: 'name a bird' }],
            next: 9,
            turns: 1,
        },
    });
    await start($);
    await board($);
    await say($, 'go');
    expect(savedSteer(w.store)).toBe('a heron');
});

test('a send-back that joined a turn empties the steer box once the turn ends', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-9', 'yes']);
    const key = 'orbit:steer:o1';
    await ui.input({ key, kind: 'change', text: 'wait for ci' });
    await ui.press({ key: 'orbit:rejected:o1' });
    await w.clock.advance(5_000);
    await say($, 'go');
    await endTurn($);
    const box = (await ui.findAll({ type: 'Input' })).find((n) =>
        n.key?.startsWith(key),
    );
    expect([box?.key === key, box?.props.value]).toEqual([false, '']);
});

test('a board opened again draws the steer it saved while closed', async ($, on) => {
    const w = world(on);
    // the box mounted empty and its typing saved a steer; the typing stamps run on the real clock, so a fold forgets them
    // (and drops what the box mounted with), and the orbit is seeded again as it mounted
    const seeded = {
        asks: [
            {
                id: 'o1',
                pick: 'pelican',
                rev: 1,
                shown: '',
                steer: 'a heron',
                text: 'name a bird',
            },
        ],
        next: 2,
        turns: 1,
    };
    const state = keptState(on, { orbit: seeded });
    await start($);
    const ui = await board($);
    await ui.press({ key: 'fold:orbit' });
    await ui.press({ key: 'fold:orbit' });
    state.orbit = seeded;
    await ui.redraw();
    const key = 'orbit:steer:o1';
    const before = await boxValue(ui, key);
    w.panes.isClosed = true;
    await w.clock.advance(4_100);
    w.panes.isClosed = false;
    await w.clock.advance(4_100);
    await ui.redraw();
    expect([before, await boxValue(ui, key)]).toEqual(['', 'a heron']);
});

/* FRM-492 round 4: a replayed save yields to a newer steer, a failed one keeps its text, a draw before start keeps the key */

test('a save a reload dropped never writes over a newer steer from another board', async ($, on) => {
    const w = world(on, glide());
    // typed over no steer; a text kept with no base is a module before the base was kept, and lands as it did there
    keptState(on, {
        fields: { 'lane:l9:steer': { base: '', pending: 'old from A' } },
    });
    w.store.set('lane-steer:l9', { steer: 'newer from B' });
    await start($);
    await board($);
    await say($, 'go');
    expect(
        (w.store.get('lane-steer:l9') as { steer?: string } | undefined)?.steer,
    ).toBe('newer from B');
});

test('a save a reload dropped that fails is tried again at the next flush', async ($, on) => {
    const w = world(on, glide());
    keptState(on, { fields: { 'lane:l9:steer': { pending: 'from A' } } });
    let isFailing = true;
    w.taps.set = (key) =>
        isFailing && key === 'lane-steer:l9' ? 'store down' : undefined;
    await start($);
    await board($);
    await say($, 'go');
    isFailing = false;
    await say($, 'again');
    expect(
        (w.store.get('lane-steer:l9') as { steer?: string } | undefined)?.steer,
    ).toBe('from A');
});

test('a board drawn before a reloaded start keeps each box under its kept key', async ($, on) => {
    world(on);
    keptState(on, {
        fields: {
            'lane:l8:steer': {
                draft: { at: 0, drawn: '', isLanded: true, sent: ['typed'] },
                gen: 2,
            },
        },
        lanes: [
            {
                current: 0,
                history: [],
                id: 'l8',
                items: [{ isDone: false, text: 'a' }],
                members: {},
                movedAt: 0,
                // the box's landed save, as the old module last showed the lane
                steer: 'typed',
                title: 'drawn early',
            },
        ],
    });
    const ui = await board($);
    expect(
        (await ui.findAll({ type: 'Input' }))
            .map((n) => n.key)
            .filter((k) => k?.startsWith('lane:l8:steer')),
    ).toEqual(['lane:l8:steer#2']);
});

test('a save a reload dropped lands over the steer it was typed over', async ($, on) => {
    const w = world(on, glide());
    keptState(on, {
        fields: { 'lane:l9:steer': { base: 'cards', pending: 'cards first' } },
    });
    w.store.set('lane-steer:l9', { steer: 'cards' });
    await start($);
    await board($);
    await say($, 'go');
    expect(
        (w.store.get('lane-steer:l9') as { steer?: string } | undefined)?.steer,
    ).toBe('cards first');
});

test('a save a reload dropped yields to a steer other than the one it was typed over', async ($, on) => {
    const w = world(on, glide());
    keptState(on, {
        fields: { 'lane:l9:steer': { base: 'cards', pending: 'cards first' } },
    });
    w.store.set('lane-steer:l9', { steer: 'guards' });
    await start($);
    await board($);
    await say($, 'go');
    expect(
        (w.store.get('lane-steer:l9') as { steer?: string } | undefined)?.steer,
    ).toBe('guards');
});

// dima's o123: a third refusal keeps the text and stops trying, never dropping what he typed
test('a save a reload dropped that keeps failing is kept after three flushes and tried no more', async ($, on) => {
    const w = world(on, glide());
    const state = keptState(on, {
        fields: { 'lane:l9:steer': { base: '', pending: 'from A' } },
    });
    let tries = 0;
    w.taps.set = (key) => {
        if (key !== 'lane-steer:l9') return undefined;
        tries++;
        return 'store down';
    };
    await start($);
    const ui = await board($);
    for (const text of ['one', 'two', 'three', 'four']) await say($, text);
    // keptState's state.set hides the write from the kit, so the pane redraws by hand
    await ui.redraw();
    const offer = await ui.find({ key: 'kept:lane:l9:steer', type: 'Button' });
    expect([
        tries,
        JSON.stringify(state.fields ?? {}).includes('from A'),
        offer?.text,
    ]).toEqual([3, true, expect.stringContaining('from A')]);
});

test('a kept steer the board offers back is saved by a press, and the offer leaves', async ($, on) => {
    const w = world(on, glide());
    keptState(on, {
        fields: { 'lane:l9:steer': { base: '', pending: 'from A' } },
    });
    let isDown = true;
    w.taps.set = (key) =>
        key === 'lane-steer:l9' && isDown ? 'store down' : undefined;
    await start($);
    const ui = await board($);
    for (const text of ['one', 'two', 'three']) await say($, text);
    isDown = false;
    await ui.redraw();
    await ui.press({ key: 'kept:lane:l9:steer' });
    await ui.redraw();
    expect([
        (w.store.get('lane-steer:l9') as { steer?: string } | undefined)?.steer,
        await ui.find({ key: 'kept:lane:l9:steer', type: 'Button' }),
    ]).toEqual(['from A', undefined]);
});

test("a kept steer offered beside an ask's box saves its steer, and the box draws it", async ($, on) => {
    const w = world(on);
    const state = keptState(on, {
        fields: { 'orbit:steer:o1': { keptSteers: ['from A'] } },
        orbit: {
            asks: [
                { id: 'o1', pick: 'pelican', shown: '', text: 'name a bird' },
            ],
            next: 2,
            turns: 1,
        },
    });
    await start($);
    const ui = await board($);
    // a poll publishes the board view the offer draws from; keptState hides that write from the kit
    await w.clock.advance(5_000);
    await ui.redraw();
    await ui.press({ key: 'kept:orbit:steer:o1' });
    await ui.redraw();
    const box = (await ui.findAll({ type: 'Input' })).find((n) =>
        n.key?.startsWith('orbit:steer:o1'),
    );
    expect([
        (state.orbit as { asks: { steer?: string }[] }).asks[0]?.steer,
        box?.props.value,
        await ui.find({ key: 'kept:orbit:steer:o1', type: 'Button' }),
    ]).toEqual(['from A', 'from A', undefined]);
});

test('a kept steer pressed after its ask locked stays offered, never dropped', async ($, on) => {
    const w = world(on);
    const state = keptState(on, {
        fields: { 'orbit:steer:o1': { keptSteers: ['from A'] } },
        orbit: {
            asks: [
                { id: 'o1', pick: 'pelican', shown: '', text: 'name a bird' },
            ],
            next: 2,
            turns: 1,
        },
    });
    await start($);
    const ui = await board($);
    await w.clock.advance(5_000);
    await ui.redraw();
    const o = state.orbit as { asks: Record<string, unknown>[] };
    state.orbit = { ...o, asks: [{ ...o.asks[0], isLocked: true }] };
    await ui.press({ key: 'kept:orbit:steer:o1' });
    expect([
        (state.orbit as { asks: { steer?: string }[] }).asks[0]?.steer,
        JSON.stringify(state.fields ?? {}).includes('from A'),
    ]).toEqual([undefined, true]);
});

test('a second give-up on one box stacks: the newest is offered first, then the one before', async ($, on) => {
    const w = world(on, glide());
    keptState(on, {
        fields: {
            'lane:l9:steer': {
                base: '',
                keptSteers: ['from A'],
                pending: 'from B',
            },
        },
    });
    let isDown = true;
    w.taps.set = (key) =>
        key === 'lane-steer:l9' && isDown ? 'store down' : undefined;
    await start($);
    const ui = await board($);
    for (const text of ['one', 'two', 'three']) await say($, text);
    isDown = false;
    await ui.redraw();
    const offer = async () =>
        (await ui.find({ key: 'kept:lane:l9:steer', type: 'Button' }))?.text;
    const both = await offer();
    await ui.press({ key: 'kept:lane:l9:steer' });
    await ui.redraw();
    expect([
        both,
        (w.store.get('lane-steer:l9') as { steer?: string } | undefined)?.steer,
        await offer(),
    ]).toEqual([
        expect.stringMatching(/from B.*\+1/),
        'from B',
        expect.stringContaining('from A'),
    ]);
});

test('a kept steer whose box is gone shows on its own line, and its ✕ drops it', async ($, on) => {
    const w = world(on);
    const state = keptState(on, {
        fields: { 'orbit:steer:o9': { keptSteers: ['a gone ask'] } },
    });
    await start($);
    const ui = await board($);
    await w.clock.advance(5_000);
    await ui.redraw();
    const line = await ui.find({
        text: /its box is not on the board/,
        type: 'Text',
    });
    await ui.press({ key: 'kept-drop:orbit:steer:o9' });
    await ui.redraw();
    expect([
        line?.text,
        JSON.stringify(state.fields ?? {}).includes('a gone ask'),
        await ui.find({ text: /its box is not on the board/, type: 'Text' }),
    ]).toEqual([expect.stringContaining('a gone ask'), false, undefined]);
});

test('a save kept with no base, by a module before the base was kept, lands as it did there', async ($, on) => {
    const w = world(on, glide());
    keptState(on, { fields: { 'lane:l9:steer': { pending: 'cards first' } } });
    w.store.set('lane-steer:l9', { steer: 'cards' });
    await start($);
    await board($);
    await say($, 'go');
    expect(
        (w.store.get('lane-steer:l9') as { steer?: string } | undefined)?.steer,
    ).toBe('cards first');
});

/* a pick that signs or merges is taken as written: the guard reads no ask's shape (FRM-581) */

test('a steer typed during a tool call outlives a save reading from before it', async ($, on) => {
    world(on);
    const race = pressRace(on);
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes'], ['push `backup`', 'yes']);
    await say($, 'run the long job');
    await ui.press({ key: 'orbit:rejected:o2' });
    await ui.find({ key: 'orbit:rejected:o2' });
    const stale = race.last;
    await ui.input({ key: 'orbit:steer:o2', text: 'wait for ci' });
    await ui.press({ key: 'orbit:accepted:o1' });
    race.frozen = stale;
    await $.tool.call({ command: 'ls', tool: 'Bash' });
    race.frozen = undefined;
    expect((askOf(race, 'o2') as { steer?: string } | undefined)?.steer).toBe(
        'wait for ci',
    );
});
