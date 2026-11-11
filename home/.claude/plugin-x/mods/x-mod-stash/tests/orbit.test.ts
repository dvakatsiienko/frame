import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { closedMark } from '../hooks/register.tsx';

const SID = 'o1o1o1o1-orbit';
const TOOL = 'mcp__x-mod-stash__orbit';

// one session: `contexts` holds each prompt's model-only context, `appended` each hidden mid-turn message
// the orbit tool's description as the last start registered it
let described = '';
let schema: {
    properties?: Record<
        string,
        { items?: { properties?: Record<string, unknown> }; enum?: string[] }
    >;
} = {};
let isDeferred: boolean | undefined;

// a test holds the store's key list shut, to keep a hook mid-way while a draw overtakes it
let storeKeysGate: Promise<void> | undefined;

// `files`: what `$.fs.read` finds, such as the glide shelf file
function world(on: On, files: Record<string, string> = {}) {
    on('fs.read', (_$, e) =>
        e.path in files
            ? { value: files[e.path] ?? '' }
            : { deny: 'no such file' },
    );
    const contexts: string[][] = [];
    const appended: string[] = [];
    const clock = mock.clock(on, {
        now: new Date(2026, 9, 10, 19, 0).getTime(),
    });
    // a store in memory the test reads back: the shared store other sessions' boards count from
    const store = new Map<string, unknown>();
    // a test's tap into the store calls, to land another board's write between two of them
    // a tap that returns a reason refuses that write, as a failing store would
    const taps = {
        delete: (_key: string) => {},
        set: (_key: string): string | undefined => undefined,
    };
    on('store.get', (_$, e) => ({ value: store.get(e.key) }));
    on('store.set', (_$, e) => {
        const refused = taps.set(e.key);
        if (refused) return { deny: refused };
        store.set(e.key, e.value);
        return { value: undefined };
    });
    on('store.keys', async () => {
        await storeKeysGate;
        return { value: [...store.keys()] };
    });
    on('store.delete', (_$, e) => {
        taps.delete(e.key);
        store.delete(e.key);
        return { value: undefined };
    });
    on('session.id', () => ({ value: SID }));
    on('env.get', () => ({ value: '/home' }));
    on('ui.log', () => ({ value: undefined }));
    // a test flips it to read the board as closed at the next poll, or to fail the read
    const panes = { isClosed: false, isFailed: false };
    on('ui.panes', () => {
        if (panes.isFailed) throw new Error('panes read failed');
        return {
            value: panes.isClosed
                ? []
                : [
                      {
                          id: 'x-cc-deck',
                          isFocused: false,
                          isPlaced: true,
                          isShown: true,
                          plugin: 'x-mod-stash',
                          title: 'fleet board',
                      },
                  ],
        };
    });
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('session.attach', (_$, e) => ({ clientId: e.clientId }));
    on('session.detach', (_$, e) => ({ clientId: e.clientId }));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('session.repo', () => ({
        value: { internal: false, name: null, remote: null, root: '/tmp' },
    }));
    on('fs.list', () => ({ value: [] }));
    on('tool.register', (_$, e) => {
        described = e.description;
        schema = e.inputSchema as typeof schema;
        isDeferred = e.isDeferred;
        return { value: { tool: `mcp__x-mod-stash__${e.name}` } };
    });
    on('prompt.submit', (_$, e) => {
        contexts.push([...(e.context ?? [])]);
        return { text: e.text };
    });
    on('session.append', (_$, e, next) => {
        for (const b of e.message.content)
            if (b.type === 'text') appended.push(String(b.text));
        return next(e);
    });
    on('turn.complete', () => ({ text: '' }));
    on('classic.Stop', () => ({}));
    on('tool.call', () => ({ result: {}, text: 'done' }));
    on('skill.prompt', (_$, e) => ({ text: e.text }));
    return { appended, clock, contexts, panes, store, taps };
}

const start = ($: Engine) =>
    $.session.start({ cwd: '/tmp', isInteractive: true, surface: 'desktop' });

const orbit = ($: Engine, input: Record<string, unknown>) =>
    $.tool.call({ tool: TOOL, ...input } as never);

const add = ($: Engine, ...asks: [string, string][]) =>
    orbit($, {
        asks: asks.map(([text, pick]) => ({
            hiddenNote: `came from ${text}`,
            pick,
            text,
        })),
        op: 'add',
    });

const say = ($: Engine, text: string, kind = 'composer' as const) =>
    $.prompt.submit({ origin: { kind }, text, wait: false });

const endTurn = ($: Engine) =>
    $.turn.complete({
        answer: '',
        durationMs: 1,
        isAborted: false,
        reason: 'answer',
        turnId: 't',
    });

const board = ($: Engine) =>
    $.ui.mount({
        component: 'Pane',
        plugin: 'x-mod-stash',
        props: {
            bodyColumns: 100,
            isFocused: true,
            placement: 'dock',
            scroll: { bodyRows: 40, offset: 0 },
            title: 'fleet board',
            view: {},
        },
        requestId: 'x-cc-deck',
        surface: 'desktop',
    });

type Board = Awaited<ReturnType<typeof board>>;

// orbit's ask ids as the mounted board shows them, in order
async function asksShown(ui: Board) {
    return (await ui.findAll({ type: 'Box' }))
        .filter((n) => n.key?.startsWith('orbit:ask:'))
        .map((n) => n.key?.slice('orbit:ask:'.length));
}

const joined = (contexts: string[][]) =>
    (contexts.at(-1) ?? []).filter((c) => c.startsWith('orbit: dima marked'));

test('asks the tool adds list in orbit oldest first, each by its id', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes'], ['trash the old probe', 'yes']);
    await add($, ['rename the band', 'later']);
    expect(await asksShown(ui)).toEqual(['o1', 'o2', 'o3']);
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

// the steer as the session's published asks hold it, the store mirror every board reads
const savedSteer = (store: Map<string, unknown>) =>
    (store.get(`asks:${SID}`) as { items: { steer?: string }[] } | undefined)
        ?.items[0]?.steer;

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

test('check all accepts every open ask', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['a one', 'x'], ['a two', 'y']);
    await ui.press({ key: 'orbit:all' });
    await say($, 'go');
    expect(
        joined(w.contexts)
            .join('\n')
            .match(/o\d 🛎️/g),
    ).toEqual(['o1 🛎️', 'o2 🛎️']);
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

const texts = async (ui: Board) =>
    (await ui.findAll({ type: 'Text' })).map((t) => t.text ?? '').join('\n');

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
test("a follow-up clears dima's steer on the old question", async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.input({ key: 'orbit:steer:o1', text: 'tastaet' });
    await say($, 'go');
    await orbit($, {
        id: 'o1',
        op: 'follow',
        pick: 'after ci',
        text: 'push the branch once ci is green',
    });
    await endTurn($);
    // the box drew '' and still holds his text: the clear remounts it under a new key (FRM-492)
    const box = await ui.find({ key: 'orbit:steer:o1#1', type: 'Input' });
    expect([
        box?.props.value,
        await ui.find({ key: 'orbit:steer:o1' }),
    ]).toEqual(['', undefined]);
});

test('a follow-up keeps its id and place with new text, led by 🆕', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes'], ['trash the probe', 'yes']);
    await say($, 'go');
    await orbit($, {
        id: 'o1',
        op: 'follow',
        pick: 'after ci',
        text: 'push the branch once ci is green',
    });
    await endTurn($);
    expect([
        await asksShown(ui),
        (await ui.find({ key: 'orbit:ask:o1', type: 'Box' }))?.text,
    ]).toEqual([
        ['o1', 'o2'],
        expect.stringMatching(
            /^🆕 o1: push the branch once ci is green➡️ after ci🛎️ tick/u,
        ),
    ]);
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

test('a tick the running turn never reads starts no turn of its own', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await say($, 'answer in one line');
    await ui.press({ key: 'orbit:accepted:o1' });
    await endTurn($);
    expect([w.appended, w.contexts.length]).toEqual([[], 1]);
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
    w.store.set(`marks:${SID}:o1`, { at: w.clock.now(), mark: 'accepted' });
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

test("a card steer lands over the member's own unless it typed into that box a moment ago", async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await ui.input({ key: 'orbit:steer:o1', kind: 'change', text: 'a heron' });
    w.store.set(`marks:${SID}:o1`, {
        at: w.clock.now(),
        isSteerEdit: true,
        steer: 'a swan',
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
    w.store.set(`marks:${SID}:o1`, {
        at: w.clock.now(),
        isSteerEdit: true,
        steer: 'a swan',
    });
    await w.clock.advance(5_000);
    expect(savedSteer(w.store)).toBe('a swan');
});

test('a steer typed on another board while its mark is taken in survives for the next take', async ($, on) => {
    const w = world(on);
    const key = `marks:${SID}:o1`;
    let isRaced = false;
    const race = () => {
        if (isRaced) return;
        isRaced = true;
        w.store.set(key, {
            at: w.clock.now() + 1,
            isSteerEdit: true,
            steer: 'a swan again',
        });
    };
    await start($);
    await add($, ['name a bird', 'pelican']);
    w.store.set(key, {
        at: w.clock.now(),
        isSteerEdit: true,
        steer: 'a swan',
    });
    w.taps.set = (k) => {
        if (!k.startsWith('marks:')) race();
    };
    w.taps.delete = (k) => {
        if (k === key) race();
    };
    await w.clock.advance(5_000);
    expect(isRaced).toBe(true);
    await say($, 'next');
    expect(savedSteer(w.store)).toBe('a swan again');
});

test('every prompt reminds the session of its open asks and the tool', async ($, on) => {
    const w = world(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await $.prompt.submit({
        origin: { kind: 'peer-send-message' } as never,
        text: 'status?',
        wait: false,
    });
    expect((w.contexts.at(-1) ?? []).join('\n')).toMatch(
        /orbit holds 1 open ask \(o1\).*mcp__x-mod-stash__orbit/,
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

test('a prompt that lands mid-turn reads a plan set this turn as 0 turns old', async ($, on) => {
    const w = world(on);
    await start($);
    await say($, 'go');
    await orbit($, { lines: ['now: a'], op: 'plan' });
    await say($, 'a steer mid-turn');
    expect((w.contexts.at(-1) ?? []).join('\n')).toMatch(
        /plan set 0 turns ago/,
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

test("a tool call before a mid-turn reload's start still stamps the running turn", async ($, on) => {
    world(on);
    const state: Record<string, unknown> = {
        orbit: {
            asks: [],
            assumed: ['a1', 'a2', 'a3'].map((id) => ({ at: 2, id, text: id })),
            next: 1,
            turns: 2,
        },
        turn: { isBusy: true, isPinged: false, isUserTurn: true },
    };
    on('state.get', (_$, e) => ({
        value: { value: state[e.key], version: e.key in state ? 1 : 0 },
    }));
    on('state.set', (_$, e) => {
        state[e.key] = e.value;
        return { value: { isSet: true, version: 2 } };
    });
    const r = await orbit($, { op: 'assume', texts: ['one more'] });
    expect((r as { deny?: string }).deny).toBeUndefined();
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

const mobile = ($: Engine, args = '') =>
    $.skill.prompt({
        skill: 'x:mobile-mode',
        text: `# mobile-mode${args ? `\n\nARGUMENTS: ${args}` : ''}`,
    });

const lastContext = (contexts: string[][]) =>
    (contexts.at(-1) ?? []).join('\n');

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

// FRM-427: dima's 🛎️ press is his word — the tick record lives in this mod's $.state, written by the press alone
function tickLog(on: On) {
    const writes: unknown[] = [];
    on('state.set', (_$, e, next) => {
        if (e.plugin === 'x-mod-stash' && e.key === 'ticks')
            writes.push(e.value);
        return next(e);
    });
    return writes;
}

test("a 🛎️ press writes the tick record: the ask's id, text, quoted targets and time", async ($, on) => {
    const w = world(on);
    const writes = tickLog(on);
    await start($);
    const ui = await board($);
    await add($, ['⚠️ push `git push --mirror origin` to the backup', 'yes']);
    const at = await w.clock.now();
    await ui.press({ key: 'orbit:accepted:o1' });
    expect(writes.at(-1)).toEqual([
        {
            at,
            id: 'o1',
            targets: ['git push --mirror origin'],
            text: '⚠️ push `git push --mirror origin` to the backup',
        },
    ]);
});

test('a press that lands on an ask his prompt already locked keeps the tick record (S1)', async ($, on) => {
    world(on);
    const writes = tickLog(on);
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    await say($, 'go');
    await ui.press({ key: 'orbit:accepted:o1' }).catch(() => undefined);
    expect(writes.at(-1)).toEqual([expect.objectContaining({ id: 'o1' })]);
});

test('the tick record lands before the mark a running turn can take', async ($, on) => {
    world(on);
    const order: string[] = [];
    on('state.set', (_$, e, next) => {
        const isMarked =
            e.key === 'orbit' &&
            (e.value as { asks: { mark?: string }[] }).asks.some((a) => a.mark);
        if (e.key === 'ticks' || isMarked) order.push(e.key);
        return next(e);
    });
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    expect(order.slice(0, 2)).toEqual(['ticks', 'orbit']);
});

test('two presses at once leave no mark and no tick record', async ($, on) => {
    const w = world(on);
    const writes = tickLog(on);
    // the first press waits inside its record read, so the second lands while it is in flight
    let open = () => {};
    const gate = new Promise<void>((resolve) => {
        open = resolve;
    });
    on('state.get', async (_$, e, next) => {
        if (e.key === 'ticks') await gate;
        return next(e as never);
    });
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    await ui.press({ key: 'orbit:accepted:o1' });
    open();
    await w.clock.advance(1);
    expect([
        writes.at(-1),
        (await ui.find({ key: 'orbit:accepted:o1' }))?.text,
    ]).toEqual([[], '🛎️ tick']);
});

test('an untick clears the mark before it drops the record', async ($, on) => {
    world(on);
    const order: string[] = [];
    let isUnticking = false;
    on('state.set', (_$, e, next) => {
        if (isUnticking && (e.key === 'ticks' || e.key === 'orbit'))
            order.push(e.key);
        return next(e);
    });
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    isUnticking = true;
    await ui.press({ key: 'orbit:accepted:o1' });
    expect(order.slice(0, 2)).toEqual(['orbit', 'ticks']);
});

// a throwing state mock is skipped by the harness (engine.md), so a kept value nothing can filter forces the failure
test('a tick record that cannot be written still marks the ask', async ($, on) => {
    const w = world(on);
    on('state.get', (_$, e, next) =>
        e.key === 'ticks'
            ? { value: { value: 5, version: 1 } }
            : next(e as never),
    );
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    await say($, 'go');
    expect(joined(w.contexts).join('\n')).toMatch(/o1 🛎️ accepted/);
});

test('a tool call landing during a press takes its mark whole, record and all', async ($, on) => {
    world(on);
    const writes = tickLog(on);
    let open = () => {};
    let isHeld = false;
    const gate = new Promise<void>((resolve) => {
        open = resolve;
    });
    on('state.get', async (_$, e, next) => {
        if (isHeld && e.key === 'ticks') await gate;
        return next(e as never);
    });
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes']);
    await say($, 'run the long job');
    await ui.press({ key: 'orbit:rejected:o1' });
    isHeld = true;
    await ui.press({ key: 'orbit:accepted:o1' });
    const call = $.tool.call({ command: 'ls', tool: 'Bash' });
    open();
    const r = await call;
    expect([
        (writes.at(-1) as { id: string }[]).map((t) => t.id),
        r.context?.some((c) => /o1 🛎️ accepted/.test(c)),
    ]).toEqual([['o1'], true]);
});

test('an untick whose record cannot be dropped says so', async ($, on) => {
    world(on);
    let isBroken = false;
    const toasts: string[] = [];
    on('ui.toast', (_$, e) => {
        toasts.push(e.text);
        return { value: undefined };
    });
    on('state.get', (_$, e, next) =>
        isBroken && e.key === 'ticks'
            ? { value: { value: 5, version: 1000 } }
            : next(e as never),
    );
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    isBroken = true;
    await ui.press({ key: 'orbit:accepted:o1' });
    expect(toasts).toEqual([expect.stringMatching(/^🛎️ untick not recorded/)]);
});

test('a second 🛎️ press takes the tick back', async ($, on) => {
    world(on);
    const writes = tickLog(on);
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    await ui.press({ key: 'orbit:accepted:o1' });
    expect(writes.at(-1)).toEqual([]);
});

test('a 🔁 replay press writes no tick', async ($, on) => {
    world(on);
    const writes = tickLog(on);
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes']);
    await ui.press({ key: 'orbit:rejected:o1' });
    expect(writes.flat()).toEqual([]);
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

test("an agent's own orbit ops never write a tick", async ($, on) => {
    world(on);
    const writes = tickLog(on);
    await start($);
    await orbit($, {
        ops: [
            {
                asks: [
                    { mark: 'accepted', pick: 'yes', text: 'push `origin`' },
                ],
                op: 'add',
            },
            {
                id: 'o1',
                mark: 'accepted',
                op: 'follow',
                text: 'push `origin` now',
            },
            { ids: ['o1'], op: 'resolve' },
        ],
    });
    expect(writes).toEqual([]);
});

test('a 🛎️ press on a followed-up ask writes the tick record with the new text', async ($, on) => {
    const w = world(on);
    const writes = tickLog(on);
    await start($);
    const ui = await board($);
    await add($, ['push `git push origin --delete old`', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    await orbit($, { ids: ['o1'], op: 'resolve' });
    await orbit($, {
        id: 'o1',
        op: 'follow',
        pick: 'yes',
        text: '⚠️ delete `git push origin --delete cloud/x-help-drift`',
    });
    const at = await w.clock.now();
    await ui.press({ key: 'orbit:accepted:o1' });
    expect(writes.at(-1)).toEqual([
        {
            at,
            id: 'o1',
            targets: ['git push origin --delete cloud/x-help-drift'],
            text: '⚠️ delete `git push origin --delete cloud/x-help-drift`',
        },
    ]);
});

test("a mark from another board's glide card writes no tick record: the shared store it travels through is anything's to write", async ($, on) => {
    const w = world(on);
    const writes = tickLog(on);
    await start($);
    await add($, ['push `git push origin --delete old`', 'yes']);
    w.store.set(`marks:${SID}:o1`, {
        at: await w.clock.now(),
        mark: 'accepted',
    });
    await w.clock.advance(5_000);
    expect(writes.flat()).toEqual([]);
});

test('a 🛎️ press in orbit ends mobile mode', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await mobile($);
    await ui.press({ key: 'orbit:accepted:o1' });
    await say($, 'hi');
    expect(lastContext(w.contexts)).not.toContain('asks fence');
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

const long = 'x'.repeat(91);

test('an ask text over 90 chars is refused with its length', async ($, on) => {
    world(on);
    await start($);
    const r = await add($, [long, 'yes']);
    expect((r as { deny?: string }).deny).toMatch(/91 chars; keep it ≤90/);
});

test('a follow text over 90 chars is refused', async ($, on) => {
    world(on);
    await start($);
    await add($, ['short', 'yes']);
    const r = await orbit($, {
        id: 'o1',
        op: 'follow',
        pick: 'yes',
        text: long,
    });
    expect((r as { deny?: string }).deny).toMatch(/orbit follow: .*91 chars/);
});

test('a phase line over 90 chars is refused', async ($, on) => {
    world(on);
    await start($);
    const r = await orbit($, { lines: ['now: short', long], op: 'plan' });
    expect((r as { deny?: string }).deny).toMatch(/orbit plan: .*91 chars/);
});

test('an ask text of exactly 90 chars is taken', async ($, on) => {
    world(on);
    await start($);
    const r = await add($, ['x'.repeat(90), 'yes']);
    expect((r as { deny?: string }).deny).toBe(undefined);
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

const assume = ($: Engine, ...texts: string[]) =>
    orbit($, { op: 'assume', texts });

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

test('a fourth assumption in one turn is refused', async ($, on) => {
    world(on);
    await start($);
    await say($, 'go');
    await assume($, 'one', 'two', 'three');
    const r = await assume($, 'four');
    expect((r as { deny?: string }).deny).toMatch(
        /at most 3 a turn, 3 already/,
    );
});

test('🛎️ clears an assumption', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await assume($, 'kept the old port');
    await ui.press({ key: 'orbit:right:a1' });
    expect(await ui.find({ key: 'orbit:assumption:a1', type: 'Box' })).toBe(
        undefined,
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

test('a plan of fewer than 7 lines is set with a nudge to fill it', async ($, on) => {
    world(on);
    await start($);
    const r = await orbit($, { lines: ['now: a', 'next: b'], op: 'plan' });
    expect((r as { result?: unknown }).result).toBe(
        'plan set, 2 lines — plan has 2 of 7, fill to 7',
    );
});

test('a full plan of 7 lines is set with no nudge', async ($, on) => {
    world(on);
    await start($);
    const r = await orbit($, {
        lines: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
        op: 'plan',
    });
    expect((r as { result?: unknown }).result).toBe('plan set, 7 lines');
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

test('the phase lines knob caps a plan and its nudge', async ($, on) => {
    const w = world(on);
    w.store.set('phase-lines', 5);
    await start($);
    const ui = await board($);
    const result = await orbit($, {
        lines: ['now: a', 'next: b', 'then: c', 'd', 'e', 'f', 'g'],
        op: 'plan',
    });
    const lines = (await ui.findAll({ type: 'Text' }))
        .map((t) => t.text)
        .filter((t) => /^[🌕🌔🌓🌒🌑] (?!phases)/u.test(t ?? ''));
    expect([
        JSON.stringify(result).includes('plan set, 5 lines'),
        lines.length,
    ]).toEqual([true, 5]);
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

test("orbit's description fits the 4096 chars cc shows the model, every op named", async ($, on) => {
    world(on);
    await start($);
    const ops = [...described.matchAll(/^op (\w+)/gmu)].map((m) => m[1]);
    expect([described.length <= 4096, ops]).toEqual([
        true,
        ['add', 'resolve', 'follow', 'assume', 'plan', 'glide'],
    ]);
});

/* brief 8 item 1: an ask carries one link dima opens in a click */

const addLinked = ($: Engine, link: string) =>
    orbit($, {
        asks: [
            { link, pick: 'read it', text: 'the proposal for the catch kinds' },
        ],
        op: 'add',
    }) as Promise<{ deny?: string }>;

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

test('a link that is neither an https url nor a file path is refused, and no ask lands', async ($, on) => {
    const w = world(on);
    await start($);
    const r = await addLinked($, 'javascript:alert(1)');
    expect([r.deny, w.store.has('asks:o1o1o1o1-orbit')]).toEqual([
        'orbit add: link «javascript:alert(1)» is neither an https url, an obsidian://open url nor a file path (/… or ~/…)',
        false,
    ]);
});

test('an obsidian:// link that writes (new, overwrite) is refused, and no ask lands', async ($, on) => {
    const w = world(on);
    await start($);
    const r = await addLinked(
        $,
        'obsidian://new?vault=v&file=_hq%2Finbox&overwrite=true',
    );
    expect([r.deny, w.store.has('asks:o1o1o1o1-orbit')]).toEqual([
        'orbit add: link «obsidian://new?vault=v&file=_hq%2Finbox&» is neither an https url, an obsidian://open url nor a file path (/… or ~/…)',
        false,
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

test('an http url, a file:// url and a bare word are still refused as links', async ($, on) => {
    world(on);
    await start($);
    for (const link of ['http://x.test/a', 'file:///etc/passwd', 'inbox.md'])
        expect((await addLinked($, link)).deny).toContain(
            'is neither an https url',
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

// FRM-544 slice 1: x-herdr-deck draws the gated mark the stash publishes, never its own copy of the pattern
test('a gated ask carries isGated in the store, a plain ask none', async ($, on) => {
    const w = world(on);
    await start($);
    const asks = [
        { pick: 'run it', text: '⚠️ mirror: `git push --mirror origin`' },
        { pick: 'merge it', text: 'merge https://github.com/x/y/pull/7' },
        { pick: 'cut it', text: 'cut the probe?' },
    ];
    await orbit($, { asks, op: 'add' });
    const items = (
        w.store.get('asks:o1o1o1o1-orbit') as {
            items: { isGated?: boolean; text: string }[];
        }
    ).items;
    expect(items.map((a) => a.isGated)).toEqual([true, true, undefined]);
});

test('orbit registers loaded up front, never behind ToolSearch', async ($, on) => {
    world(on);
    await start($);
    expect(isDeferred).toBe(false);
});

/* a tick lands at once: no sending state, no delay field */

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

test("a tick from another board's glide card joins the running turn at once", async ($, on) => {
    const w = world(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await say($, 'run the long job');
    w.store.set(`marks:${SID}:o1`, { at: w.clock.now(), mark: 'accepted' });
    const r = await $.tool.call({ command: 'ls', tool: 'Bash' });
    expect((r.context ?? []).join('\n')).toMatch(/o1 🛎️ accepted/);
});

// FRM-552: herdr's board writes one press per line of the session's ticks file, and stash keeps how far it read
const HERDR_FILE = `/home/.claude/shelf/orbit-ticks/${SID}.jsonl`;
const press = (p: Record<string, unknown>) => `${JSON.stringify(p)}\n`;
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

// the engine drops an argument its schema does not name: an arg missing here reaches no op (clio, 21:08)
test("orbit's schema names every argument its ops read", async ($, on) => {
    world(on);
    await start($);
    const props = schema.properties ?? {};
    const inner = (name: string) =>
        Object.keys(props[name]?.items?.properties ?? {}).sort();
    expect([
        [
            'act',
            'asks',
            'current',
            'id',
            'ids',
            'items',
            'lines',
            'op',
            'ops',
            'pick',
            'plan',
            'role',
            'session',
            'text',
            'texts',
            'title',
            'words',
        ].filter((name) => !(name in props)),
        inner('asks'),
        props.act?.enum,
    ]).toEqual([
        [],
        ['hiddenNote', 'link', 'pick', 'text'],
        ['create', 'edit', 'link', 'step', 'end'],
    ]);
});

// PK-204: a resolve on a ticked ask says what shipped — «as ticked», or «changed: <what>» beside a new round
const ticked = async ($: Engine, w: ReturnType<typeof world>) => {
    const ui = await board($);
    await add($, ['name the band', 'breathing bars']);
    await say($, 'go');
    await ui.press({ key: 'orbit:accepted:o1' });
    await w.clock.advance(5_000);
    await $.tool.call({ command: 'true', tool: 'Bash' });
    return ui;
};

for (const words of [{}, { o1: 'shipped' }, { o1: 'landed as planned' }])
    test(`a ticked ask's resolve with neither «as ticked» nor «changed:» is refused: ${JSON.stringify(words)}`, async ($, on) => {
        const w = world(on);
        await start($);
        const ui = await ticked($, w);
        const r = await orbit($, { ids: ['o1'], op: 'resolve', words });
        await endTurn($);
        expect([r.deny, await asksShown(ui)]).toEqual([
            expect.stringMatching(/o1 was ticked.*as ticked.*changed:/),
            ['o1'],
        ]);
    });

test('a ticked ask resolved «as ticked» leaves', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await ticked($, w);
    const r = await orbit($, {
        ids: ['o1'],
        op: 'resolve',
        words: { o1: 'as ticked: renamed' },
    });
    await endTurn($);
    await say($, 'next');
    await endTurn($);
    expect([r.deny, await asksShown(ui)]).toEqual([undefined, []]);
});

test('a ticked ask resolved «changed:» alone is refused, naming the follow', async ($, on) => {
    const w = world(on);
    await start($);
    await ticked($, w);
    const r = await orbit($, {
        ids: ['o1'],
        op: 'resolve',
        words: { o1: 'changed: kept the old name' },
    });
    expect(r.deny).toMatch(/follow or an add in the same call/);
});

test('a ticked ask resolved «changed:» beside a follow lands both', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await ticked($, w);
    const r = await orbit($, {
        ops: [
            {
                ids: ['o1'],
                op: 'resolve',
                words: { o1: 'changed: the bars stay, the name moves' },
            },
            { id: 'o1', op: 'follow', pick: 'pulse', text: 'name the band v2' },
        ],
    });
    expect([r.deny, await asksShown(ui), await texts(ui)]).toEqual([
        undefined,
        ['o1'],
        expect.stringContaining('name the band v2'),
    ]);
});

test('an unticked ask resolves with no word, as before', async ($, on) => {
    world(on);
    await start($);
    await add($, ['name the band', 'breathing bars']);
    const r = await orbit($, { ids: ['o1'], op: 'resolve' });
    expect(r.deny).toBeUndefined();
});

// o83: one call carries many ops; each reports, and a refused one leaves the rest landed
test('one call carrying an add, a resolve and a plan lands all three', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    const r = await orbit($, {
        ops: [
            { asks: [{ pick: 'yes', text: 'trash the probe' }], op: 'add' },
            { ids: ['o1'], op: 'resolve' },
            { lines: ['now: build', 'next: test'], op: 'plan' },
        ],
    });
    await endTurn($);
    expect([
        String(r.result),
        await asksShown(ui),
        (await texts(ui)).includes('now: build'),
    ]).toEqual([
        expect.stringMatching(
            /1 add: added o2.*\n2 resolve: resolved o1\n3 plan: plan set/s,
        ),
        ['o2'],
        true,
    ]);
});

test('a call whose resolve is refused reports per op, the other ops landing', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await ticked($, w);
    const r = await orbit($, {
        ops: [
            { asks: [{ pick: 'yes', text: 'trash the probe' }], op: 'add' },
            { ids: ['o1'], op: 'resolve' },
            { lines: ['now: build'], op: 'plan' },
        ],
    });
    expect([String(r.result), await asksShown(ui)]).toEqual([
        expect.stringMatching(
            /2 resolve: refused — orbit resolve: o1 was ticked/,
        ),
        ['o1', 'o2'],
    ]);
});

test('a call whose every op is refused is refused', async ($, on) => {
    world(on);
    await start($);
    const r = await orbit($, {
        ops: [{ op: 'nope' }, { id: 'o9', op: 'follow' }],
    });
    expect(r.deny).toMatch(/1 nope: refused.*\n2 follow: refused/s);
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

// o88 wisp (dima, 20:39): a tick on an ask the running turn had just followed up was ignored until the turn ended
test('a tick on an ask just followed up mid-turn lands at once', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    await say($, 'go');
    await orbit($, {
        id: 'o1',
        op: 'follow',
        pick: 'yes',
        text: 'push FRM-1 to main?',
    });
    await ui.press({ key: 'orbit:accepted:o1' });
    await w.clock.advance(5_000);
    expect((await ui.find({ key: 'orbit:accepted:o1' }))?.text).toBe('✅ tick');
});

/* a part switched off in 🎛️ settings is off for the model too (l13 r4) */

const partOff = (w: { store: Map<string, unknown> }, key: string) =>
    w.store.set('shown', { [key]: false });

const lines = (w: { contexts: string[][] }) =>
    (w.contexts.at(-1) ?? []).join('\n');

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

test('with assumed switched off, op assume is refused in one line naming the switch', async ($, on) => {
    const w = world(on);
    await start($);
    partOff(w, 'stash.assumed');
    const r = (await assume($, 'kept the old port')) as { deny?: string };
    expect([r.deny?.includes('\n'), r.deny]).toEqual([
        false,
        expect.stringContaining(
            'assumed section is switched off in 🎛️ settings',
        ),
    ]);
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

test('with 🌔 phases switched off, op plan is refused in one line naming the switch', async ($, on) => {
    const w = world(on);
    await start($);
    partOff(w, 'stash.phases');
    const r = (await orbit($, { lines: ['now: a'], op: 'plan' })) as {
        deny?: string;
    };
    expect([r.deny?.includes('\n'), r.deny]).toEqual([
        false,
        expect.stringContaining('🌔 phases is switched off in 🎛️ settings'),
    ]);
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

// the session's $.state as a map the test can wipe, as a new process starts with none
function stateOf(on: On) {
    const state = new Map<string, unknown>();
    on('state.get', (_$, e) => ({
        value: { value: state.get(e.key), version: state.has(e.key) ? 1 : 0 },
    }));
    on('state.set', (_$, e) => {
        state.set(e.key, e.value);
        return { value: { isSet: true, version: 2 } };
    });
    on('session.end', (_$, e) => ({ sessionId: e.sessionId }));
    return state;
}

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

test("held member pings come back when clio's session is resumed in a new process", async ($, on) => {
    world(on);
    const state = stateOf(on);
    await start($);
    const held = {
        held: [{ at: 1, from: '☕️ 🔧 codie: mods', text: 'step 2 landed' }],
    };
    state.set('quiet', held);
    await quit($);
    state.clear();
    await start($);
    expect(state.get('quiet')).toEqual(held);
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

// review round 1: «changed:» needs a follow or an add that lands, never one the same call refuses
test('a «changed:» resolve beside a refused follow is refused', async ($, on) => {
    const w = world(on);
    await start($);
    await ticked($, w);
    const r = await orbit($, {
        ops: [
            { ids: ['o1'], op: 'resolve', words: { o1: 'changed: renamed' } },
            { id: 'o9', op: 'follow', pick: 'x', text: 'no such ask' },
        ],
    });
    expect(r.deny).toMatch(/1 resolve: refused.*follow or an add/s);
});

// dima, 2026-10-28 15:33: the 🐠 catch shelf is gone, settings row included — «full delete but surgical»
test('orbit has no catch op: the schema names none, a call is refused as unknown', async ($, on) => {
    world(on);
    await start($);
    const props = schema.properties ?? {};
    const r = await orbit($, {
        op: 'catch',
        pieces: [{ hiddenNote: 'n', kind: '💡', text: 'f1' }],
    });
    expect([
        (props.op?.enum ?? []).includes('catch'),
        'pieces' in props || 'clear' in props,
        /\bcatch\b/.test(described),
        r.deny,
    ]).toEqual([
        false,
        false,
        false,
        expect.stringMatching(/op is .*got «catch»/),
    ]);
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

function keptState(on: On, state: Record<string, unknown> = {}) {
    let version = 0;
    on('state.get', (_$, e) => ({
        value: { value: state[e.key], version: e.key in state ? ++version : 0 },
    }));
    on('state.set', (_$, e) => {
        state[e.key] = e.value;
        return { value: { isSet: true, version: ++version } };
    });
    return state;
}

async function reload(
    $: Engine,
    ui: Board,
    state: Record<string, unknown>,
    card: string,
) {
    const left = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    await ui.press({ key: `fold:${card}` });
    await ui.press({ key: `fold:${card}` });
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, left);
    await start($);
    await ui.redraw();
}

const LANES = '/home/.claude/shelf/lanes.json';
const R3_CODIE = 'c9c9c9c9-codie';
const glide = (members: Record<string, string> = {}, id = 'l9') => ({
    [LANES]: JSON.stringify({
        lanes: [
            {
                current: 0,
                history: [],
                id,
                items: [
                    { isDone: false, text: 'a' },
                    { isDone: false, text: 'b' },
                ],
                members,
                movedAt: 0,
                title: 'reload lane',
            },
        ],
    }),
});
const boxValue = async (ui: Board, key: string) =>
    (await ui.find({ key, type: 'Input' }))?.props.value;

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

test("a lane member's steer box keeps what it mounted with across a reload", async ($, on) => {
    const w = world(on, glide({ codie: R3_CODIE }));
    w.store.set(`asks:${R3_CODIE}`, {
        asks: ['cut the probe?'],
        at: 1,
        items: [{ id: 'o3', pick: 'cut it', text: 'cut the probe?' }],
        label: 'frame',
    });
    const state = keptState(on);
    await start($);
    const ui = await board($);
    await ui.press({ key: 'fold:lane:l9:codie' });
    // a mocked state.set hides the write from the kit, so the board is drawn again by hand
    await ui.redraw();
    const key = 'lane:l9:codie:steer:o3';
    await ui.input({ key, kind: 'change', text: 'keep it' });
    await w.clock.advance(5_000);
    const before = await boxValue(ui, key);
    await reload($, ui, state, 'lane:l9:codie');
    expect([before, await boxValue(ui, key)]).toEqual(['', '']);
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

/* a sign ask's shape, refused at the press */

const SIGN_DENY = 'the shape x-mod-guard reads';
const denied = (r: unknown) => String((r as { deny?: string }).deny ?? '');

for (const pick of ['signed', 're-signed', 'signed as drafted'])
    test(`add refuses the pick «${pick}» on a text without the sign shape`, async ($, on) => {
        world(on);
        await start($);
        expect(denied(await add($, ['sign FRM-1 please', pick]))).toContain(
            SIGN_DENY,
        );
    });

for (const [text, pick] of [
    ['✍️ re-sign FRM-472: the rows', 're-sign: FRM-472 takes 22 rows'],
    ['FRM-491 siesta gate: re-sign the gate', 'yes: re-sign as built'],
    ['FRM-471 re-sign: the rows', 're-sign it'],
    ['sign FRM-1 please', 'sign: as drafted'],
    ['sign FRM-1 please', 'yes, sign it'],
    ['sign FRM-1 please', 'yes. sign it'],
    ['sign FRM-1 please', 'ok to sign'],
    ['sign FRM-1 please', 'signed-off'],
] as const)
    test(`add refuses the pick «${pick}» on a mis-shaped sign ask`, async ($, on) => {
        world(on);
        await start($);
        expect(denied(await add($, [text, pick]))).toContain(SIGN_DENY);
    });

for (const [what, text, pick] of [
    ['a pick holding sign-in', 'push FRM-1', 'sign-in flow first'],
    ['a pick holding signed-in', 'push FRM-1', 'signed-in flow first'],
    ['a pick reading signed in', 'push FRM-1', 'signed in already'],
    ['a pick with no need', 'push FRM-1', 'no need to re-sign'],
    ['one id', '✍️ sign FRM-1: the title', 'signed'],
    ['a batch', '✍️ sign FRM-1, BYT-2: the titles', 're-signed'],
    ['no sign word in the pick', 'push FRM-1', 'yes'],
    ['a word holding it', 'design FRM-1', 'designed as drawn'],
    ['a sign word that signs nothing', 'push FRM-1', 'sign in first'],
    ['a pick that never signs', 'push FRM-1', 'never signed'],
    ['a pick that does not sign', 'push FRM-1', 'not signed yet'],
    ['a pick that does not re-sign', 'push FRM-1', 'not re-signed yet'],
] as const)
    test(`add passes ${what}`, async ($, on) => {
        world(on);
        await start($);
        expect(denied(await add($, [text, pick]))).toBe('');
    });

test('follow refuses a sign pick on a text without the shape', async ($, on) => {
    world(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    const r = await orbit($, {
        id: 'o1',
        op: 'follow',
        pick: 'signed',
        text: 'sign it',
    });
    expect(denied(r)).toContain(SIGN_DENY);
});

test('follow refuses a text losing the shape under a kept sign pick', async ($, on) => {
    world(on);
    await start($);
    await add($, ['✍️ sign FRM-1: the title', 'signed']);
    const r = await orbit($, {
        id: 'o1',
        op: 'follow',
        text: 'sign it after all',
    });
    expect(denied(r)).toContain(SIGN_DENY);
});

test('follow passes the sign shape', async ($, on) => {
    world(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    const r = await orbit($, {
        id: 'o1',
        op: 'follow',
        pick: 'signed',
        text: '✍️ sign FRM-1: the title',
    });
    expect(denied(r)).toBe('');
});

/* a merge ask's shape, refused at the press */

const MERGE_DENY = 'the shape x-mod-guard reads for --dima-ok';
const URL = 'https://github.com/o/n/pull/7';

for (const pick of [
    'merge',
    'merge it',
    'Merge when green',
    'merged, as ticked',
    'yes, merge #7',
    'yes, merge the pr',
    'yes, merge it',
    'squash and merge',
    'ok to merge when green',
])
    test(`add refuses the pick «${pick}» on a text naming no pr`, async ($, on) => {
        world(on);
        await start($);
        expect(denied(await add($, ['merge frame#7 please', pick]))).toContain(
            MERGE_DENY,
        );
    });

for (const [what, text, pick] of [
    ['a url', `⚠️ merge ${URL}`, 'merge'],
    ['the ⚠️ shape', '⚠️ merge frame#7: the title', 'merge'],
    ['a word holding it', 'push FRM-1', 'submerge it'],
    ['a pick that does not merge', 'push FRM-1', 'do not merge yet'],
    ['a pick that holds the merge', 'push FRM-1', "don't merge yet"],
    ['a pick that holds it, typed curly', 'push FRM-1', 'don’t merge yet'],
    ['a pick that never merges', 'push FRM-1', 'never merge it'],
    ['a pick of no merge', 'push FRM-1', 'no merge tonight'],
    [
        'a sign ask whose pick names its merge',
        '✍️ sign FRM-511: the title',
        'signed, its merge on your word',
    ],
    [
        'a merge word that names no pr',
        'FRM-360 into FRM-387',
        'merge: you made 0 rows',
    ],
    [
        'a merge word mid pick',
        'one row each',
        'one merged before the next opens',
    ],
    ['no merge word in the pick', 'merge frame#7 please', 'yes'],
] as const)
    test(`add passes ${what}`, async ($, on) => {
        world(on);
        await start($);
        expect(denied(await add($, [text, pick]))).toBe('');
    });

test('follow refuses a merge pick on a text naming no pr', async ($, on) => {
    world(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    const r = await orbit($, {
        id: 'o1',
        op: 'follow',
        pick: 'merge',
        text: 'merge it',
    });
    expect(denied(r)).toContain(MERGE_DENY);
});

/* FRM-510: his press is never lost. every get of one dispatch reads one moment (engine.md), so a hook running while he
   presses reads the orbit from before the press; `frozen` serves that old copy, and writes keeps what landed */
function pressRace(on: On) {
    const race = {
        frozen: undefined as unknown,
        frozenTicks: undefined as unknown,
        last: undefined as unknown,
        lastTicks: undefined as unknown,
        onLock: undefined as (() => void) | undefined,
        onWrite: undefined as (() => void) | undefined,
        orbit: undefined as
            | { asks: { id: string; isLocked?: boolean; mark?: string }[] }
            | undefined,
        ticks: [] as { id: string }[],
    };
    on('state.get', async (_$, e, next) => {
        const isOrbit = e.key === 'orbit';
        if (!isOrbit && e.key !== 'ticks') return next(e as never);
        const held = isOrbit ? race.frozen : race.frozenTicks;
        if (held) return { value: held } as never;
        const r = (await next(e as never)) as { value?: unknown };
        if (isOrbit) race.last = r.value;
        else race.lastTicks = r.value;
        return r as never;
    });
    on('state.set', async (_$, e, next) => {
        if (e.key === 'orbit') {
            const value = e.value as NonNullable<typeof race.orbit>;
            const onLock = value.asks.some((a) => a.isLocked)
                ? race.onLock
                : undefined;
            const onRace = onLock ?? race.onWrite;
            if (onRace) {
                race.onLock = undefined;
                race.onWrite = undefined;
                onRace();
                for (let i = 0; i < 2000; i++) await Promise.resolve();
            }
            race.orbit = value;
        }
        if (e.key === 'ticks') race.ticks = e.value as typeof race.ticks;
        return next(e);
    });
    return race;
}
const askOf = (race: ReturnType<typeof pressRace>, id: string) =>
    race.orbit?.asks.find((a) => a.id === id);

for (const [site, act] of [
    ["his prompt's lock", ($: Engine) => say($, 'next')],
    [
        "a tool call's lock",
        ($: Engine) => $.tool.call({ command: 'ls', tool: 'Bash' }),
    ],
] as const) {
    test(`${site}, reading from before his press, keeps the mark and the tick`, async ($, on) => {
        world(on);
        const race = pressRace(on);
        await start($);
        const ui = await board($);
        await add($, ['push `origin`', 'yes'], ['push `backup`', 'yes']);
        await say($, 'run the long job');
        await ui.press({ key: 'orbit:accepted:o1' });
        await ui.find({ key: 'orbit:accepted:o1' });
        const stale = race.last;
        await ui.press({ key: 'orbit:accepted:o2' });
        race.frozen = stale;
        await act($);
        race.frozen = undefined;
        expect([
            askOf(race, 'o1')?.isLocked,
            askOf(race, 'o2')?.mark,
            race.ticks.map((t) => t.id),
        ]).toEqual([true, 'accepted', ['o1', 'o2']]);
    });

    test(`a press landing inside ${site}'s write stays marked`, async ($, on) => {
        world(on);
        const race = pressRace(on);
        await start($);
        const ui = await board($);
        await add($, ['push `origin`', 'yes'], ['push `backup`', 'yes']);
        await say($, 'run the long job');
        await ui.press({ key: 'orbit:accepted:o1' });
        race.onLock = () => void ui.press({ key: 'orbit:accepted:o2' });
        await act($);
        await ui.find({ key: 'orbit:accepted:o2' });
        expect([askOf(race, 'o1')?.isLocked, askOf(race, 'o2')?.mark]).toEqual([
            true,
            'accepted',
        ]);
    });
}

test("the idle wake's lock, reading from before his press, keeps the mark", async ($, on) => {
    const w = world(on);
    const race = pressRace(on);
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes'], ['push `backup`', 'yes']);
    await endTurn($);
    w.store.set(`marks:${SID}:o1`, { at: w.clock.now(), mark: 'accepted' });
    await w.clock.advance(5_000);
    await ui.find({ key: 'orbit:accepted:o1' });
    const stale = race.last;
    await ui.press({ key: 'orbit:accepted:o2' });
    w.store.set('dima-at', w.clock.now() + 1);
    race.frozen = stale;
    await w.clock.advance(5_000);
    race.frozen = undefined;
    expect([askOf(race, 'o1')?.isLocked, askOf(race, 'o2')?.mark]).toEqual([
        true,
        'accepted',
    ]);
});

test("a press reading from before a turn's lock leaves the lock", async ($, on) => {
    world(on);
    const race = pressRace(on);
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes'], ['push `backup`', 'yes']);
    await say($, 'run the long job');
    await ui.press({ key: 'orbit:accepted:o1' });
    await ui.find({ key: 'orbit:accepted:o1' });
    const stale = race.last;
    await $.tool.call({ command: 'ls', tool: 'Bash' });
    race.frozen = stale;
    await ui.press({ key: 'orbit:accepted:o2' });
    race.frozen = undefined;
    expect([askOf(race, 'o1')?.isLocked, askOf(race, 'o2')?.mark]).toEqual([
        true,
        'accepted',
    ]);
});

test('a second press reading ticks from before the first keeps both records', async ($, on) => {
    world(on);
    const race = pressRace(on);
    await start($);
    const ui = await board($);
    await add(
        $,
        ['push `origin`', 'yes'],
        ['push `backup`', 'yes'],
        ['push `third`', 'yes'],
    );
    await ui.press({ key: 'orbit:accepted:o3' });
    await ui.press({ key: 'orbit:accepted:o1' });
    race.frozenTicks = race.lastTicks;
    await ui.press({ key: 'orbit:accepted:o2' });
    race.frozenTicks = undefined;
    expect(race.ticks.map((t) => t.id)).toEqual(['o3', 'o1', 'o2']);
});

/* FRM-510: ✅ is his word on what it marks, one record per ask; a ⚠️ ask takes its own 🛎️ */
test('✅ writes one tick record per ask it marks', async ($, on) => {
    world(on);
    const writes = tickLog(on);
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes'], ['push `backup`', 'yes']);
    await ui.press({ key: 'orbit:all' });
    expect(
        (writes.at(-1) as { id: string; targets: string[] }[]).map((t) => [
            t.id,
            t.targets,
        ]),
    ).toEqual([
        ['o1', ['origin']],
        ['o2', ['backup']],
    ]);
});

test('✅ on an ask quoting nothing marks it, with a record that unlocks nothing', async ($, on) => {
    const w = world(on);
    const writes = tickLog(on);
    await start($);
    const ui = await board($);
    await add($, ['trash the probe', 'yes']);
    await ui.press({ key: 'orbit:all' });
    await say($, 'go');
    expect([
        (writes.at(-1) as { targets: string[] }[]).map((t) => t.targets),
        joined(w.contexts).join('\n'),
    ]).toEqual([[[]], expect.stringMatching(/o1 🛎️ accepted/)]);
});

test('✅ leaves a ⚠️ ask unmarked, with no record', async ($, on) => {
    const w = world(on);
    const writes = tickLog(on);
    await start($);
    const ui = await board($);
    await add(
        $,
        ['⚠️ mirror: `git push --mirror origin`', 'yes'],
        ['push `backup`', 'yes'],
    );
    await ui.press({ key: 'orbit:all' });
    await say($, 'go');
    expect([
        (writes.at(-1) as { id: string }[]).map((t) => t.id),
        joined(w.contexts)
            .join('\n')
            .match(/o\d 🛎️/g),
    ]).toEqual([['o2'], ['o2 🛎️']]);
});

test('✅ leaves a bare merge ask for its own 🛎️', async ($, on) => {
    world(on);
    const writes = tickLog(on);
    await start($);
    const ui = await board($);
    await add(
        $,
        ['merge https://github.com/o/r/pull/7', 'yes'],
        ['push `backup`', 'yes'],
    );
    await ui.press({ key: 'orbit:all' });
    expect((writes.at(-1) as { id: string }[]).map((t) => t.id)).toEqual([
        'o2',
    ]);
});

test('✅ names every ask it left unticked', async ($, on) => {
    world(on);
    const toasts: string[] = [];
    on('ui.toast', (_$, e) => {
        toasts.push(e.text);
        return { value: undefined };
    });
    await start($);
    const ui = await board($);
    await add(
        $,
        ['⚠️ merge bytes#104: the guard fix', 'merge it'],
        ['push `backup`', 'yes'],
    );
    await ui.press({ key: 'orbit:all' });
    expect([
        toasts,
        (await ui.find({ key: 'orbit:accepted:o1' }))?.text,
    ]).toEqual([
        ['✅ left unticked: o1 ⚠️ merge bytes#104: the guard fix'],
        '🛎️ tick',
    ]);
});

test('✅ is not drawn while only ⚠️ asks are left to mark', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['⚠️ mirror: `git push --mirror origin`', 'yes']);
    expect(await ui.find({ key: 'orbit:all' })).toBeUndefined();
});

test("a session's first presses, the second reading no ticks yet, keep both records", async ($, on) => {
    world(on);
    const race = pressRace(on);
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes'], ['push `backup`', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    race.frozenTicks = { value: undefined, version: 0 };
    await ui.press({ key: 'orbit:accepted:o2' });
    race.frozenTicks = undefined;
    expect(race.ticks.map((t) => t.id)).toEqual(['o1', 'o2']);
});

test('a mark whose orbit write is denied leaves no record', async ($, on) => {
    world(on);
    let ticks: unknown;
    let isDenied = false;
    on('state.set', (_$, e, next) => {
        if (e.key === 'ticks') ticks = e.value;
        return isDenied && e.key === 'orbit' ? { deny: 'disk full' } : next(e);
    });
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes']);
    isDenied = true;
    await ui.press({ key: 'orbit:accepted:o1' });
    expect(ticks).toEqual([]);
});

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

test('a press landing right after a follow on that ask keeps its mark and its record', async ($, on) => {
    world(on);
    const race = pressRace(on);
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    race.onWrite = () => void ui.press({ key: 'orbit:accepted:o1' });
    await orbit($, { id: 'o1', op: 'follow', pick: 'yes', text: 'push `new`' });
    await ui.find({ key: 'orbit:accepted:o1' });
    expect([
        askOf(race, 'o1')?.mark,
        race.ticks.map((t) => (t as { text?: string }).text),
    ]).toEqual(['accepted', ['push `new`']]);
});

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

test('✅ marks only the asks on the frame he pressed', async ($, on) => {
    const w = world(on);
    const writes = tickLog(on);
    // his 🛎️ waits inside its record read, so ✅ queues behind it and an ask lands before ✅ runs
    let open = () => {};
    let isHeld = false;
    const gate = new Promise<void>((resolve) => {
        open = resolve;
    });
    on('state.get', async (_$, e, next) => {
        if (isHeld && e.key === 'ticks') await gate;
        return next(e as never);
    });
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes'], ['push `backup`', 'yes']);
    isHeld = true;
    await ui.press({ key: 'orbit:accepted:o1' });
    const late = add($, ['push `late`', 'yes']);
    await ui.press({ key: 'orbit:all' });
    open();
    await late;
    await w.clock.advance(1);
    expect((writes.at(-1) as { id: string }[]).map((t) => t.id)).toEqual([
        'o1',
        'o2',
    ]);
});

test('✅ leaves an ask followed up since the frame he pressed', async ($, on) => {
    const w = world(on);
    const writes = tickLog(on);
    let open = () => {};
    let isHeld = false;
    const gate = new Promise<void>((resolve) => {
        open = resolve;
    });
    on('state.get', async (_$, e, next) => {
        if (isHeld && e.key === 'ticks') await gate;
        return next(e as never);
    });
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes'], ['push `backup`', 'yes']);
    isHeld = true;
    await ui.press({ key: 'orbit:accepted:o1' });
    const follow = orbit($, {
        id: 'o2',
        op: 'follow',
        pick: 'yes',
        text: 'push `late`',
    });
    await ui.press({ key: 'orbit:all' });
    open();
    await follow;
    await w.clock.advance(1);
    expect((writes.at(-1) as { id: string }[]).map((t) => t.id)).toEqual([
        'o1',
    ]);
});

for (const [site, act] of [
    ['a turn end', ($: Engine) => endTurn($)],
    ['an orbit op', ($: Engine) => add($, ['push `late`', 'yes'])],
    [
        'a follow dropping its tick',
        ($: Engine) =>
            orbit($, {
                id: 'o1',
                op: 'follow',
                pick: 'yes',
                text: 'push `new`',
            }),
    ],
] as const)
    test(`a press landing inside ${site}'s write stays marked, its record kept`, async ($, on) => {
        world(on);
        const race = pressRace(on);
        await start($);
        const ui = await board($);
        await add($, ['push `origin`', 'yes'], ['push `backup`', 'yes']);
        race.onWrite = () => void ui.press({ key: 'orbit:accepted:o2' });
        await act($);
        await ui.find({ key: 'orbit:accepted:o2' });
        expect([askOf(race, 'o2')?.mark, race.ticks.map((t) => t.id)]).toEqual([
            'accepted',
            ['o2'],
        ]);
    });

/* FRM-531: a thread switch on the desktop detaches the client and drops the board's view; the return attaches it, and
   the board draws fresh 2–20 ms later and again 76–131 ms after that (the desktop log, 2026-11-07: detach → attach → draw, a timer firing in between) */
const CLIENT = { clientId: 'desktop-2', surface: 'desktop' } as const;
const FIELD_SAVE = 1500;
type Clocked = { clock: { advance: (ms: number) => Promise<unknown> } };

async function switchThread($: Engine, w: Clocked, ui: Board, awayMs = 0) {
    await $.session.detach({ ...CLIENT, reason: 'detach' });
    await ui.unmount();
    if (awayMs) await w.clock.advance(awayMs);
    await $.session.attach(CLIENT);
    return board($);
}

// each row its own ask or lane id: module memory survives between tests
let switchRow = 2000;
const orbitSeed = () => ({ asks: [], next: ++switchRow, turns: 1 });

async function askBoxOnBoard($: Engine, on: On) {
    const w = world(on);
    const seed = orbitSeed();
    const state = keptState(on, { orbit: seed });
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await ui.redraw();
    const id = `o${seed.next}`;
    return { id, key: `orbit:steer:${id}`, state, ui, w };
}

const SWITCH_KINDS = {
    ask: askBoxOnBoard,
    assumption: async ($: Engine, on: On) => {
        const w = world(on);
        const state = keptState(on, { orbit: orbitSeed() });
        await start($);
        const ui = await board($);
        await assume($, 'kept the port');
        await ui.redraw();
        const id = (state.orbit as { assumed: { id: string }[] }).assumed[0]
            ?.id;
        return { key: `orbit:asteer:${id}`, ui, w };
    },
    glide: async ($: Engine, on: On) => {
        const lane = `l${++switchRow}`;
        const w = world(on, glide({}, lane));
        keptState(on);
        await start($);
        const ui = await board($);
        await ui.redraw();
        return { key: `lane:${lane}:steer`, ui, w };
    },
    member: async ($: Engine, on: On) => {
        const lane = `l${++switchRow}`;
        const sid = `c9c9c9c9-${lane}`;
        const w = world(on, glide({ codie: sid }, lane));
        w.store.set(`asks:${sid}`, {
            asks: ['cut the probe?'],
            at: 1,
            items: [{ id: 'o3', pick: 'cut it', text: 'cut the probe?' }],
            label: 'frame',
        });
        keptState(on);
        await start($);
        const ui = await board($);
        await ui.press({ key: `fold:lane:${lane}:codie` });
        await ui.redraw();
        return { key: `lane:${lane}:codie:steer:o3`, ui, w };
    },
} as const;

const SWITCH_TIMINGS = [
    ['0 ms', 0, 0],
    ['1 ms', 0, 1],
    ['just under the save delay', 0, FIELD_SAVE - 1],
    ['past the save delay while away', 0, FIELD_SAVE + 3500],
    ['a landed save before he left', FIELD_SAVE + 3500, 0],
] as const;
const SWITCH_TEXTS = [
    ['one line', 'a heron'],
    ['several lines', 'a heron\nand a stork'],
    ['non-latin', 'чапля 鷺 🐦‍🔥'],
] as const;

for (const [kind, setUp] of Object.entries(SWITCH_KINDS))
    for (const [timing, beforeMs, awayMs] of SWITCH_TIMINGS)
        for (const [name, text] of SWITCH_TEXTS)
            test(`a switch keeps every typed character: ${kind} box, ${timing}, ${name}`, async ($, on) => {
                const { key, ui, w } = await setUp($, on);
                await ui.input({ key, kind: 'change', text });
                if (beforeMs) await w.clock.advance(beforeMs);
                const back = await switchThread($, w, ui, awayMs);
                expect(await boxValue(back, key)).toBe(text);
            });

test("a mobile client coming and going leaves the desktop's box as drawn", async ($, on) => {
    const { key, ui, w } = await askBoxOnBoard($, on);
    await ui.input({ key, kind: 'change', text: 'a heron' });
    await w.clock.advance(5_000);
    const phone = { clientId: 'phone', surface: 'mobile' } as const;
    await $.session.attach(phone);
    await $.session.detach({ ...phone, reason: 'detach' });
    await ui.redraw();
    expect(await boxValue(ui, key)).toBe('');
});

for (const [when, beforeMs] of [
    ['at the flush', 0],
    ['at its timed save', FIELD_SAVE + 3500],
] as const) {
    test(`a glide save the store refused ${when} draws on across two switches, and lands at the next chance`, async ($, on) => {
        const lane = `l${++switchRow}`;
        const w = world(on, glide({}, lane));
        keptState(on);
        let isDown = true;
        w.taps.set = (key) =>
            isDown && key === `lane-steer:${lane}` ? 'store down' : undefined;
        await start($);
        const ui = await board($);
        await ui.redraw();
        const key = `lane:${lane}:steer`;
        await ui.input({ key, kind: 'change', text: 'cards first' });
        if (beforeMs) await w.clock.advance(beforeMs);
        const back = await switchThread($, w, ui);
        const first = await boxValue(back, key);
        const again = await switchThread($, w, back);
        const second = await boxValue(again, key);
        isDown = false;
        await say($, 'go');
        expect([
            first,
            second,
            (w.store.get(`lane-steer:${lane}`) as { steer?: string })?.steer,
        ]).toEqual(['cards first', 'cards first', 'cards first']);
    });

    test(`an ask's save $.state refused ${when} draws on across two switches, and lands at the next chance`, async ($, on) => {
        const w = world(on);
        const seed = orbitSeed();
        const state: Record<string, unknown> = { orbit: seed };
        let version = 0;
        let isDown = false;
        on('state.get', (_$, e) => ({
            value: {
                value: state[e.key],
                version: e.key in state ? ++version : 0,
            },
        }));
        on('state.set', (_$, e) => {
            if (isDown && e.key === 'orbit') return { deny: 'state down' };
            state[e.key] = e.value;
            return { value: { isSet: true, version: ++version } };
        });
        await start($);
        const ui = await board($);
        await add($, ['name a bird', 'pelican']);
        await ui.redraw();
        const key = `orbit:steer:o${seed.next}`;
        isDown = true;
        await ui.input({ key, kind: 'change', text: 'a heron' });
        if (beforeMs) await w.clock.advance(beforeMs);
        const back = await switchThread($, w, ui);
        const first = await boxValue(back, key);
        const again = await switchThread($, w, back);
        const second = await boxValue(again, key);
        isDown = false;
        await say($, 'go');
        await again.redraw();
        expect([
            first,
            second,
            (state.orbit as { asks: { steer?: string }[] }).asks[0]?.steer,
            await boxValue(again, key),
        ]).toEqual(['a heron', 'a heron', 'a heron', 'a heron']);
    });
}

const steerBoxOf = async (ui: Board, id: string) =>
    (await ui.findAll({ type: 'Input' })).find((n) =>
        n.key?.startsWith(`orbit:steer:${id}`),
    );

for (const [when, awayMs] of [
    ['inside the save delay', 0],
    ['past it', FIELD_SAVE + 3500],
] as const) {
    test(`more words after a return ${when} replace the kept text, and a send lands them once`, async ($, on) => {
        const { id, key, state, ui, w } = await askBoxOnBoard($, on);
        await ui.input({ key, kind: 'change', text: 'a heron' });
        const back = await switchThread($, w, ui, awayMs);
        await back.input({ key, kind: 'change', text: 'a heron in the reeds' });
        await w.clock.advance(FIELD_SAVE + 3500);
        await back.redraw();
        const shown = await boxValue(back, key);
        await back.press({ key: `orbit:accepted:${id}` });
        await say($, 'go');
        const sent = joined(w.contexts).join('\n');
        await endTurn($);
        await w.clock.advance(5_000);
        await back.redraw();
        const left = await steerBoxOf(back, id);
        await say($, 'and on');
        expect([
            shown,
            sent.split('a heron in the reeds').length - 1,
            left?.props.value,
            (state.orbit as { asks: { steer?: string }[] }).asks[0]?.steer,
            joined(w.contexts),
        ]).toEqual(['a heron', 1, '', undefined, []]);
    });

    test(`a send right after a return ${when} carries what the box shows, once`, async ($, on) => {
        const { id, key, ui, w } = await askBoxOnBoard($, on);
        await ui.input({ key, kind: 'change', text: 'a heron' });
        const back = await switchThread($, w, ui, awayMs);
        const shown = await boxValue(back, key);
        await back.press({ key: `orbit:accepted:${id}` });
        await say($, 'go');
        const sent = joined(w.contexts).join('\n');
        await endTurn($);
        await w.clock.advance(5_000);
        await back.redraw();
        expect([
            shown,
            sent.split('a heron').length - 1,
            (await steerBoxOf(back, id))?.props.value,
        ]).toEqual(['a heron', 1, '']);
    });

    test(`a box he emptied ${when} stays empty after a switch`, async ($, on) => {
        const { key, state, ui, w } = await askBoxOnBoard($, on);
        await ui.input({ key, kind: 'change', text: 'a heron' });
        await w.clock.advance(FIELD_SAVE + 3500);
        await ui.input({ key, kind: 'change', text: '' });
        if (awayMs) await w.clock.advance(awayMs);
        const back = await switchThread($, w, ui);
        expect([
            await boxValue(back, key),
            (state.orbit as { asks: { steer?: string }[] }).asks[0]?.steer,
            await back.find({ key: `kept:${key}`, type: 'Button' }),
        ]).toEqual(['', undefined, undefined]);
    });
}

test("a turn's clear while he was away empties the box, with nothing offered back", async ($, on) => {
    const { id, key, ui } = await askBoxOnBoard($, on);
    await ui.input({ key, kind: 'change', text: 'a heron' });
    await ui.press({ key: `orbit:accepted:${id}` });
    await say($, 'go');
    await $.session.detach({ ...CLIENT, reason: 'detach' });
    await ui.unmount();
    await endTurn($);
    await $.session.attach(CLIENT);
    const back = await board($);
    expect([
        (await steerBoxOf(back, id))?.props.value,
        await back.find({ key: `kept:${key}`, type: 'Button' }),
    ]).toEqual(['', undefined]);
});

test('a follow while he was away empties the box, with nothing offered back', async ($, on) => {
    const { id, key, ui, w } = await askBoxOnBoard($, on);
    await ui.input({ key, kind: 'change', text: 'a heron' });
    await w.clock.advance(5_000);
    await $.session.detach({ ...CLIENT, reason: 'detach' });
    await ui.unmount();
    await orbit($, {
        id,
        op: 'follow',
        pick: 'after ci',
        text: 'once ci is green',
    });
    await $.session.attach(CLIENT);
    const back = await board($);
    expect([
        (await steerBoxOf(back, id))?.props.value,
        await back.find({ key: `kept:${key}`, type: 'Button' }),
    ]).toEqual(['', undefined]);
});

for (const [when, beforeMs] of [
    ['inside the save delay', 0],
    ['past it', FIELD_SAVE + 3500],
] as const) {
    test(`another board's steer while he was away wins an ask's box, his text typed ${when} offered as kept`, async ($, on) => {
        const { id, key, ui, w } = await askBoxOnBoard($, on);
        await ui.input({ key, kind: 'change', text: 'a heron' });
        if (beforeMs) await w.clock.advance(beforeMs);
        await $.session.detach({ ...CLIENT, reason: 'detach' });
        await ui.unmount();
        w.store.set(`marks:${SID}:${id}`, {
            at: (w.clock as unknown as { now: () => number }).now(),
            isSteerEdit: true,
            steer: 'a swan',
        });
        await w.clock.advance(5_000);
        await $.session.attach(CLIENT);
        const back = await board($);
        expect([
            await boxValue(back, key),
            (await back.find({ key: `kept:${key}`, type: 'Button' }))?.text,
        ]).toEqual(['a swan', expect.stringContaining('a heron')]);
    });

    test(`another board's steer while he was away wins a glide box, his text typed ${when} offered as kept`, async ($, on) => {
        const lane = `l${++switchRow}`;
        const w = world(on, glide({}, lane));
        keptState(on);
        await start($);
        const ui = await board($);
        await ui.redraw();
        const key = `lane:${lane}:steer`;
        await ui.input({ key, kind: 'change', text: 'cards first' });
        if (beforeMs) await w.clock.advance(beforeMs);
        await $.session.detach({ ...CLIENT, reason: 'detach' });
        await ui.unmount();
        w.store.set(`lane-steer:${lane}`, { steer: 'bars first' });
        await w.clock.advance(5_000);
        await $.session.attach(CLIENT);
        const back = await board($);
        expect([
            await boxValue(back, key),
            (await back.find({ key: `kept:${key}`, type: 'Button' }))?.text,
        ]).toEqual(['bars first', expect.stringContaining('cards first')]);
    });
}

test('a steer another board wrote while he was here offers nothing at his next return', async ($, on) => {
    const { id, key, ui, w } = await askBoxOnBoard($, on);
    await ui.input({ key, kind: 'change', text: 'a heron' });
    await w.clock.advance(FIELD_SAVE + 3500);
    // a fold forgets the typing stamp, which reads the real clock and so never ages here
    await ui.press({ key: 'fold:orbit' });
    await ui.press({ key: 'fold:orbit' });
    w.store.set(`marks:${SID}:${id}`, {
        at: (w.clock as unknown as { now: () => number }).now(),
        isSteerEdit: true,
        steer: 'a swan',
    });
    await w.clock.advance(5_000);
    const back = await switchThread($, w, ui);
    expect([
        await boxValue(back, key),
        await back.find({ key: `kept:${key}`, type: 'Button' }),
    ]).toEqual(['a swan', undefined]);
});

test('a steer he emptied never comes back as an offer when another board writes while he is away', async ($, on) => {
    const { id, key, ui, w } = await askBoxOnBoard($, on);
    await ui.input({ key, kind: 'change', text: 'a heron' });
    await w.clock.advance(FIELD_SAVE + 3500);
    await ui.input({ key, kind: 'change', text: '' });
    await w.clock.advance(FIELD_SAVE + 3500);
    await $.session.detach({ ...CLIENT, reason: 'detach' });
    await ui.unmount();
    w.store.set(`marks:${SID}:${id}`, {
        at: (w.clock as unknown as { now: () => number }).now(),
        isSteerEdit: true,
        steer: 'a swan',
    });
    await w.clock.advance(5_000);
    await $.session.attach(CLIENT);
    const back = await board($);
    expect([
        await boxValue(back, key),
        await back.find({ key: `kept:${key}`, type: 'Button' }),
    ]).toEqual(['a swan', undefined]);
});

test('a text a remount held over never draws again once the store took it and the box was cleared', async ($, on) => {
    const lane = `l${++switchRow}`;
    const w = world(on, glide({}, lane));
    keptState(on);
    let isDown = true;
    w.taps.set = (key) =>
        isDown && key === `lane-steer:${lane}` ? 'store down' : undefined;
    await start($);
    const ui = await board($);
    await ui.redraw();
    const key = `lane:${lane}:steer`;
    await ui.input({ key, kind: 'change', text: 'cards first' });
    const back = await switchThread($, w, ui);
    isDown = false;
    await say($, 'go');
    w.store.delete(`lane-steer:${lane}`);
    await w.clock.advance(5_000);
    await back.redraw();
    await back.input({ key, kind: 'change', text: 'x' });
    await back.redraw();
    const boxes = (await back.findAll({ type: 'Input' })).filter((n) =>
        n.key?.startsWith(key),
    );
    expect(boxes.map((n) => n.props.value)).toEqual(['']);
});

function refusingOrbit(on: On) {
    const down = { isDown: false };
    const state: Record<string, unknown> = { orbit: orbitSeed() };
    let version = 0;
    on('state.get', (_$, e) => ({
        value: { value: state[e.key], version: e.key in state ? ++version : 0 },
    }));
    on('state.set', (_$, e) => {
        if (down.isDown && e.key === 'orbit') return { deny: 'state down' };
        state[e.key] = e.value;
        return { value: { isSet: true, version: ++version } };
    });
    return { down, state };
}

test('a held text that lands keeps drawing, and more words typed over it never reset the box', async ($, on) => {
    const w = world(on);
    const { down, state } = refusingOrbit(on);
    const id = `o${(state.orbit as { next: number }).next}`;
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await ui.redraw();
    const key = `orbit:steer:${id}`;
    down.isDown = true;
    await ui.input({ key, kind: 'change', text: 'a heron' });
    const back = await switchThread($, w, ui);
    down.isDown = false;
    await back.input({ key, kind: 'change', text: 'a heron in the reeds' });
    await w.clock.advance(FIELD_SAVE + 3500);
    await back.redraw();
    expect([
        await boxValue(back, key),
        (state.orbit as { asks: { steer?: string }[] }).asks[0]?.steer,
    ]).toEqual(['a heron', 'a heron in the reeds']);
});

test('a held text the store refused three times leaves the box for the offer, and never draws over new words', async ($, on) => {
    const w = world(on);
    const { down, state } = refusingOrbit(on);
    const id = `o${(state.orbit as { next: number }).next}`;
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await ui.redraw();
    const key = `orbit:steer:${id}`;
    down.isDown = true;
    await ui.input({ key, kind: 'change', text: 'a heron' });
    const back = await switchThread($, w, ui);
    for (const text of ['one', 'two', 'three']) await say($, text);
    down.isDown = false;
    await back.input({ key, kind: 'change', text: 'x' });
    await back.redraw();
    expect(await boxValue(back, key)).toBe('');
});

test('a steer another board wrote, still a mark at his return inside the poll, wins with his text offered', async ($, on) => {
    const { id, key, ui, w } = await askBoxOnBoard($, on);
    await ui.input({ key, kind: 'change', text: 'a heron' });
    await w.clock.advance(FIELD_SAVE + 100);
    await $.session.detach({ ...CLIENT, reason: 'detach' });
    await ui.unmount();
    w.store.set(`marks:${SID}:${id}`, {
        at: (w.clock as unknown as { now: () => number }).now(),
        isSteerEdit: true,
        steer: 'a swan',
    });
    await $.session.attach(CLIENT);
    const back = await board($);
    expect([
        await boxValue(back, key),
        (await back.find({ key: `kept:${key}`, type: 'Button' }))?.text,
    ]).toEqual(['a swan', expect.stringContaining('a heron')]);
});

test('a refused text that yields to a newer steer draws the steer, with his text offered once', async ($, on) => {
    const lane = `l${++switchRow}`;
    const w = world(on, glide({}, lane));
    keptState(on);
    let isDown = true;
    w.taps.set = (key) =>
        isDown && key === `lane-steer:${lane}` ? 'store down' : undefined;
    await start($);
    const ui = await board($);
    await ui.redraw();
    const key = `lane:${lane}:steer`;
    await ui.input({ key, kind: 'change', text: 'cards first' });
    const back = await switchThread($, w, ui);
    isDown = false;
    w.store.set(`lane-steer:${lane}`, { steer: 'bars first' });
    await say($, 'go');
    await w.clock.advance(5_000);
    const again = await switchThread($, w, back);
    const offer = await again.find({ key: `kept:${key}`, type: 'Button' });
    expect([await boxValue(again, key), offer?.text]).toEqual([
        'bars first',
        expect.stringMatching(/^↩️ kept «cards first»$/u),
    ]);
});

test('a refused text meets no offer of the steer it was typed over', async ($, on) => {
    const lane = `l${++switchRow}`;
    const w = world(on, glide({}, lane));
    w.store.set(`lane-steer:${lane}`, { steer: 'from another board' });
    keptState(on);
    let isDown = false;
    w.taps.set = (key) =>
        isDown && key === `lane-steer:${lane}` ? 'store down' : undefined;
    await start($);
    const ui = await board($);
    await ui.redraw();
    const key = `lane:${lane}:steer`;
    isDown = true;
    await ui.input({ key, kind: 'change', text: 'from another board, no' });
    await $.session.detach({ ...CLIENT, reason: 'detach' });
    await ui.unmount();
    w.store.set(`lane-steer:${lane}`, { steer: 'a third' });
    await w.clock.advance(5_000);
    await $.session.attach(CLIENT);
    const back = await board($);
    const offer = await back.find({ key: `kept:${key}`, type: 'Button' });
    expect(offer?.text ?? '').not.toContain('from another board»');
});

test('what the store held as he left is kept in $.state, so a reload while away still offers it', async ($, on) => {
    const { key, state, ui, w } = await askBoxOnBoard($, on);
    await ui.input({ key, kind: 'change', text: 'a heron' });
    await w.clock.advance(FIELD_SAVE + 3500);
    await $.session.detach({ ...CLIENT, reason: 'detach' });
    await ui.unmount();
    await w.clock.advance(0);
    expect((state.fields as Record<string, { left?: string }>)[key]?.left).toBe(
        'a heron',
    );
});

test('a reloaded module takes back what he left, and his return offers it over a newer steer', async ($, on) => {
    const id = `o${++switchRow}`;
    const key = `orbit:steer:${id}`;
    world(on);
    keptState(on, {
        fields: { [key]: { left: 'a heron' } },
        orbit: {
            asks: [
                { id, pick: 'pelican', steer: 'a swan', text: 'name a bird' },
            ],
            next: switchRow + 1,
            turns: 1,
        },
    });
    await start($);
    await $.session.attach(CLIENT);
    const back = await board($);
    expect(
        (await back.find({ key: `kept:${key}`, type: 'Button' }))?.text,
    ).toEqual(expect.stringContaining('a heron'));
});

test('a held text that yielded never draws over the words he types next', async ($, on) => {
    const w = world(on);
    const { down, state } = refusingOrbit(on);
    const id = `o${(state.orbit as { next: number }).next}`;
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await ui.redraw();
    const key = `orbit:steer:${id}`;
    down.isDown = true;
    await ui.input({ key, kind: 'change', text: 'a heron' });
    const back = await switchThread($, w, ui);
    down.isDown = false;
    w.store.set(`marks:${SID}:${id}`, {
        at: (w.clock as unknown as { now: () => number }).now(),
        isSteerEdit: true,
        steer: 'a swan',
    });
    await w.clock.advance(5_000);
    await say($, 'go');
    await back.input({ key, kind: 'change', text: 'a swan and' });
    await back.redraw();
    expect(await boxValue(back, key)).toBe('a swan');
});

/* FRM-531 sixth sense, round 1 */
test('a second steer refused after a sent one cleared keeps drawing, and lands at the next chance', async ($, on) => {
    const w = world(on);
    const { down, state } = refusingOrbit(on);
    const id = `o${(state.orbit as { next: number }).next}`;
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await ui.redraw();
    const key = `orbit:steer:${id}`;
    await ui.input({ key, kind: 'change', text: 'a heron' });
    await w.clock.advance(FIELD_SAVE + 3500);
    await ui.press({ key: `orbit:accepted:${id}` });
    await say($, 'go');
    await endTurn($);
    await w.clock.advance(5_000);
    await ui.redraw();
    const live = (await steerBoxOf(ui, id))?.key ?? key;
    down.isDown = true;
    await ui.input({ key: live, kind: 'change', text: 'a stork' });
    const back = await switchThread($, w, ui);
    const first = (await steerBoxOf(back, id))?.props.value;
    const again = await switchThread($, w, back);
    const second = (await steerBoxOf(again, id))?.props.value;
    down.isDown = false;
    await say($, 'next');
    await again.redraw();
    expect([
        first,
        second,
        (state.orbit as { asks: { steer?: string }[] }).asks[0]?.steer,
        (await steerBoxOf(again, id))?.props.value,
        await again.find({ key: `kept:${key}`, type: 'Button' }),
    ]).toEqual(['a stork', 'a stork', 'a stork', 'a stork', undefined]);
});

test('a text sent before he left is not offered back over a newer steer', async ($, on) => {
    const { id, key, ui, w } = await askBoxOnBoard($, on);
    await ui.input({ key, kind: 'change', text: 'a heron' });
    await ui.press({ key: `orbit:accepted:${id}` });
    await say($, 'go');
    await $.session.detach({ ...CLIENT, reason: 'detach' });
    await ui.unmount();
    await endTurn($);
    w.store.set(`marks:${SID}:${id}`, {
        at: (w.clock as unknown as { now: () => number }).now(),
        isSteerEdit: true,
        steer: 'a swan',
    });
    await $.session.attach(CLIENT);
    const back = await board($);
    expect(await back.find({ key: `kept:${key}`, type: 'Button' })).toBe(
        undefined,
    );
});

test('a text Enter saved, its timer dropped by a reload, is not offered beside itself', async ($, on) => {
    world(on);
    const seed = orbitSeed();
    const state = keptState(on, { orbit: seed });
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await ui.redraw();
    const key = `orbit:steer:o${seed.next}`;
    await ui.input({ key, kind: 'change', text: 'a heron' });
    await ui.input({ key, kind: 'submit', text: 'a heron' });
    await reload($, ui, state, 'orbit');
    await say($, 'go');
    await ui.redraw();
    expect(await ui.find({ key: `kept:${key}`, type: 'Button' })).toBe(
        undefined,
    );
});

for (const [kind, setUp] of Object.entries(SWITCH_KINDS))
    test(`a draw ahead of a slow attach reads every word: ${kind} box`, async ($, on) => {
        const { key, ui } = await setUp($, on);
        await ui.input({ key, kind: 'change', text: 'a heron' });
        await $.session.detach({ ...CLIENT, reason: 'detach' });
        await ui.unmount();
        let open = () => {};
        storeKeysGate = new Promise<void>((resolve) => {
            open = resolve;
        });
        const attaching = $.session.attach(CLIENT);
        const back = await board($);
        const first = await boxValue(back, key);
        open();
        storeKeysGate = undefined;
        await attaching;
        expect(first).toBe('a heron');
    });

test("a return's first draw ahead of a slow save at the detach reads every word", async ($, on) => {
    world(on);
    const seed = orbitSeed();
    const state: Record<string, unknown> = { orbit: seed };
    let version = 0;
    let isHeld = false;
    let open = () => {};
    const gate = new Promise<void>((resolve) => {
        open = resolve;
    });
    on('state.get', (_$, e) => ({
        value: { value: state[e.key], version: e.key in state ? ++version : 0 },
    }));
    on('state.set', async (_$, e) => {
        if (isHeld && e.key === 'orbit') await gate;
        state[e.key] = e.value;
        return { value: { isSet: true, version: ++version } };
    });
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await ui.redraw();
    const key = `orbit:steer:o${seed.next}`;
    await ui.input({ key, kind: 'change', text: 'a heron' });
    isHeld = true;
    const leaving = $.session.detach({ ...CLIENT, reason: 'detach' });
    await ui.unmount();
    const back = await board($);
    const first = await boxValue(back, key);
    isHeld = false;
    open();
    await leaving;
    await $.session.attach(CLIENT);
    await back.redraw();
    expect([first, await boxValue(back, key)]).toEqual(['a heron', 'a heron']);
});

/* FRM-531 sixth sense, round 2 */
test('a text a turn carried while he was away is not offered back over a newer steer', async ($, on) => {
    const { id, key, ui, w } = await askBoxOnBoard($, on);
    await ui.input({ key, kind: 'change', text: 'a heron' });
    await ui.press({ key: `orbit:accepted:${id}` });
    await $.session.detach({ ...CLIENT, reason: 'detach' });
    await ui.unmount();
    await say($, 'go');
    await endTurn($);
    w.store.set(`marks:${SID}:${id}`, {
        at: (w.clock as unknown as { now: () => number }).now(),
        isSteerEdit: true,
        steer: 'a swan',
    });
    await $.session.attach(CLIENT);
    const back = await board($);
    expect(await back.find({ key: `kept:${key}`, type: 'Button' })).toBe(
        undefined,
    );
});

test('a phases steer a turn carried while he was away is forgotten as his text left', async ($, on) => {
    const w = world(on);
    const state = keptState(on, { orbit: orbitSeed() });
    await start($);
    const ui = await board($);
    await orbit($, { lines: ['now: a'], op: 'plan' });
    await ui.redraw();
    await ui.input({ key: 'plan:steer', kind: 'change', text: 'a first' });
    await w.clock.advance(FIELD_SAVE + 3500);
    await ui.press({ key: 'plan:tick' });
    await $.session.detach({ ...CLIENT, reason: 'detach' });
    await ui.unmount();
    const left = (state.fields as Record<string, { left?: string }>)[
        'plan:steer'
    ]?.left;
    await say($, 'go');
    await w.clock.advance(0);
    expect([
        left,
        (state.fields as Record<string, { left?: string }>)['plan:steer']?.left,
    ]).toEqual(['a first', undefined]);
});

test("a phone attaching while he is away leaves the desktop's offer for his return", async ($, on) => {
    const { id, key, ui, w } = await askBoxOnBoard($, on);
    await ui.input({ key, kind: 'change', text: 'a heron' });
    await w.clock.advance(FIELD_SAVE + 3500);
    await $.session.detach({ ...CLIENT, reason: 'detach' });
    await ui.unmount();
    await $.session.attach({ clientId: 'phone', surface: 'mobile' });
    w.store.set(`marks:${SID}:${id}`, {
        at: (w.clock as unknown as { now: () => number }).now(),
        isSteerEdit: true,
        steer: 'a swan',
    });
    await $.session.attach(CLIENT);
    const back = await board($);
    expect(
        (await back.find({ key: `kept:${key}`, type: 'Button' }))?.text,
    ).toEqual(expect.stringContaining('a heron'));
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

// FRM-544 slice 2f: a first prompt «sign FRM-N» signs nothing at x-mod-guard, which keeps its ids for that prompt; the
// ✍️ sign ask joins orbit the same turn, so his one tick signs
function firstSign(on: On) {
    const kept = { value: null as { ids: string[]; at: number } | null };
    on('state.get', (_$, e, next) =>
        e.plugin === 'x-mod-guard' && e.key === 'firstSign'
            ? { value: { value: kept.value, version: 1 } }
            : next(e),
    );
    return kept;
}
// the board draws each id as its linear link, so the row reads «✍️ sign <url>FRM-544: …»
async function signRowShown(ui: Board, ...ids: string[]) {
    return (await ui.findAll({ type: 'Text' })).some(
        (t) =>
            /^o\d+: ✍️ sign .*: typed as this session's first prompt$/u.test(
                t.text ?? '',
            ) && ids.every((id) => t.text?.includes(id)),
    );
}

test("a first prompt's sign puts its ✍️ sign ask on his board", async ($, on) => {
    world(on);
    const first = firstSign(on);
    await start($);
    const ui = await board($);
    first.value = { at: 1, ids: ['FRM-544'] };
    await say($, 'sign FRM-544');
    await ui.redraw();
    expect([await asksShown(ui), await signRowShown(ui, 'FRM-544')]).toEqual([
        ['o1'],
        true,
    ]);
});

test('a batch first-prompt sign is one ask naming every id', async ($, on) => {
    world(on);
    const first = firstSign(on);
    await start($);
    const ui = await board($);
    first.value = { at: 1, ids: ['FRM-544', 'FRM-519'] };
    await say($, 'sign FRM-544 FRM-519');
    await ui.redraw();
    expect(await signRowShown(ui, 'FRM-544, ', 'FRM-519')).toBe(true);
});

test('a prompt with no first-prompt sign adds no ask', async ($, on) => {
    world(on);
    firstSign(on);
    await start($);
    const ui = await board($);
    await say($, 'sign FRM-544');
    await ui.redraw();
    expect(await asksShown(ui)).toEqual([]);
});

test('the same first-prompt sign read twice keeps one open ask', async ($, on) => {
    world(on);
    const first = firstSign(on);
    await start($);
    const ui = await board($);
    first.value = { at: 1, ids: ['FRM-544'] };
    await say($, 'sign FRM-544');
    await say($, 'go on');
    await ui.redraw();
    expect(await asksShown(ui)).toEqual(['o1']);
});

test('orbit switched off adds no first-prompt sign ask', async ($, on) => {
    const w = world(on);
    const first = firstSign(on);
    w.store.set('shown', { 'stash.orbit': false });
    await start($);
    first.value = { at: 1, ids: ['FRM-544'] };
    await say($, 'sign FRM-544');
    expect([...w.store.keys()].filter((k) => k.startsWith('asks:'))).toEqual(
        [],
    );
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

// r9, dima's 19:09 «warn me»: x-mod-guard keeps the second Herdr app start it refused; the ⚠️ ask joins his board at that
// call, so he saves his typed draft before his tick lets one start run
function herdrStart(on: On) {
    const kept = { value: null as { at: number; command: string } | null };
    on('state.get', (_$, e, next) =>
        e.plugin === 'x-mod-guard' && e.key === 'herdrStart'
            ? { value: { value: kept.value, version: 1 } }
            : next(e),
    );
    return kept;
}
async function herdrRowsShown(ui: Board) {
    return (await ui.findAll({ type: 'Text' })).filter((t) =>
        /^o\d+: ⚠️ a seat wants a second Herdr window: save your typed text first$/u.test(
            t.text ?? '',
        ),
    ).length;
}

test('a refused second Herdr start puts its ⚠️ ask on his board at that call', async ($, on) => {
    const w = world(on);
    const kept = herdrStart(on);
    await start($);
    const ui = await board($);
    kept.value = { at: w.clock.now(), command: 'open -na Herdr' };
    await $.tool.call({ command: 'open -na Herdr', tool: 'Bash' });
    await ui.redraw();
    expect(await herdrRowsShown(ui)).toBe(1);
});

test('a start refused before this call adds no ask, and a second refusal keeps one open ask', async ($, on) => {
    const w = world(on);
    const kept = herdrStart(on);
    await start($);
    const ui = await board($);
    kept.value = { at: w.clock.now() - 1, command: 'open -na Herdr' };
    await $.tool.call({ command: 'ls', tool: 'Bash' });
    await ui.redraw();
    const stale = await herdrRowsShown(ui);
    kept.value = { at: w.clock.now(), command: 'open -na Herdr' };
    await $.tool.call({ command: 'open -na Herdr', tool: 'Bash' });
    await $.tool.call({ command: 'open -na Herdr', tool: 'Bash' });
    await ui.redraw();
    expect([stale, await herdrRowsShown(ui)]).toEqual([0, 1]);
});

test('orbit switched off adds no Herdr start ask', async ($, on) => {
    const w = world(on);
    const kept = herdrStart(on);
    w.store.set('shown', { 'stash.orbit': false });
    await start($);
    kept.value = { at: w.clock.now(), command: 'open -na Herdr' };
    await $.tool.call({ command: 'open -na Herdr', tool: 'Bash' });
    expect([...w.store.keys()].filter((k) => k.startsWith('asks:'))).toEqual(
        [],
    );
});
