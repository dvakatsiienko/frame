import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

// 🐠 catch (FRM-386): the facts dima likely missed, parked under orbit by the orbit tool's catch op

const SID = 'c1c1c1c1-catch';
const TOOL = 'mcp__x-mod-stash__orbit';
const DAY = '2026-10-12';

// one session: each prompt's model-only context, each hidden appended message, the copies, the tool's description
function world(on: On) {
    const contexts: string[][] = [];
    const appended: string[] = [];
    const copies: string[] = [];
    const described: string[] = [];
    mock.clock(on, { now: new Date(`${DAY}T15:00:00Z`).getTime() });
    const store = new Map<string, unknown>();
    on('store.get', (_$, e) => ({ value: store.get(e.key) }));
    on('store.set', (_$, e) => {
        store.set(e.key, e.value);
        return { value: undefined };
    });
    on('store.keys', () => ({ value: [...store.keys()] }));
    on('store.delete', (_$, e) => {
        store.delete(e.key);
        return { value: undefined };
    });
    on('session.id', () => ({ value: SID }));
    on('env.get', () => ({ value: '/home' }));
    on('ui.log', () => ({ value: undefined }));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('ui.copy', (_$, e) => {
        copies.push(e.text);
        return { value: { isCopied: true } };
    });
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('session.repo', () => ({
        value: { internal: false, name: null, remote: null, root: '/tmp' },
    }));
    on('fs.list', () => ({ value: [] }));
    on('tool.register', (_$, e) => {
        described.push(e.description);
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
    return { appended, contexts, copies, described, store };
}

const start = ($: Engine) =>
    $.session.start({ cwd: '/tmp', isInteractive: true, surface: 'desktop' });

const catchOf = ($: Engine, ...texts: string[]) =>
    $.tool.call({
        op: 'catch',
        pieces: texts.map((text) => ({ hiddenNote: `from ${text}`, text })),
        tool: TOOL,
    } as never);

const say = ($: Engine, text: string) =>
    $.prompt.submit({ origin: { kind: 'composer' }, text, wait: false });

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
        requestId: 'fleet-board',
        surface: 'desktop',
    });

type Board = Awaited<ReturnType<typeof board>>;

async function piecesShown(ui: Board) {
    return (await ui.findAll({ type: 'Box' }))
        .filter((n) => n.key?.startsWith('orbit:catch:'))
        .map((n) => n.key?.slice('orbit:catch:'.length));
}

const thought = (lines: readonly string[]) =>
    lines.filter((c) => c.startsWith('🐠 catch: dima pressed 🤔')).join('\n');

// two pieces a turn: hold n of them over as many turns as it takes
async function hold($: Engine, n: number) {
    for (let i = 0; i < n; i += 2) {
        await say($, `turn ${i}`);
        await catchOf(
            $,
            ...[`fact ${i + 1}`, `fact ${i + 2}`].slice(0, Math.min(2, n - i)),
        );
        await endTurn($);
    }
}

/* exit 1 — the section */

test('caught pieces show under 🐠 catch, each with 🤔, copy, clear and a note box', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await catchOf($, 'the 5h window resets at 16:40', 'qc-recv never slept');
    const keys = (await ui.findAll({})).map((n) => n.key).filter(Boolean);
    expect([
        (await ui.find({ text: '🐠 catch', type: 'Text' }))?.text,
        await piecesShown(ui),
        [
            'orbit:think:c1',
            'orbit:copy:c1',
            'orbit:clear:c1',
            'orbit:cnote:c1',
        ].every((k) => keys.includes(k)),
    ]).toEqual(['🐠 catch', ['c1', 'c2'], true]);
});

test('with nothing caught the section is hidden', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    expect(await ui.find({ text: '🐠 catch', type: 'Text' })).toBe(undefined);
});

test("the tool's description says when to catch, at most 2 a turn, 0 normal", async ($, on) => {
    const w = world(on);
    await start($);
    expect(w.described.join('\n')).toMatch(
        /op catch.*already printed.*likely missed.*0 is normal, at most 2 a turn/s,
    );
});

/* exit 2 — the caps */

test('a catch of 3 pieces is refused in one line', async ($, on) => {
    world(on);
    await start($);
    await say($, 'go');
    const r = await catchOf($, 'a', 'b', 'c');
    expect((r as { deny?: string }).deny).toMatch(
        /^orbit catch: at most 2 a turn/,
    );
});

test('a 6th piece with 5 held is refused with «clear one first» and nothing leaves', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await hold($, 5);
    await say($, 'one more');
    const r = await catchOf($, 'fact 6');
    expect([(r as { deny?: string }).deny, await piecesShown(ui)]).toEqual([
        expect.stringContaining('clear one first'),
        ['c1', 'c2', 'c3', 'c4', 'c5'],
    ]);
});

/* exit 3 — 🤔 joins, never starts a turn */

test('🤔 while a turn runs joins it at the next tool result and starts no turn', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await catchOf($, 'the 5h window resets at 16:40');
    await say($, 'go');
    await ui.press({ key: 'orbit:think:c1' });
    await ui.input({
        key: 'orbit:cnote:c1',
        kind: 'change',
        text: 'why so early?',
    });
    const r = await $.tool.call({ command: 'ls', tool: 'Bash' });
    expect([thought(r.context ?? []), w.contexts.length, w.appended]).toEqual([
        expect.stringContaining(
            '- c1: the 5h window resets at 16:40 · your note: «from the 5h window resets at 16:40» · his note: «why so early?»',
        ),
        1,
        [],
    ]);
});

test('🤔 while idle joins his next prompt, model-only', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await catchOf($, 'qc-recv never slept');
    await ui.press({ key: 'orbit:think:c1' });
    await say($, 'next');
    expect(thought(w.contexts.at(-1) ?? [])).toContain(
        '- c1: qc-recv never slept',
    );
});

test('a 🤔 joins one turn only, and the piece stays until cleared', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await catchOf($, 'qc-recv never slept');
    await ui.press({ key: 'orbit:think:c1' });
    await say($, 'next');
    await endTurn($);
    await say($, 'and then');
    expect([thought(w.contexts.at(-1) ?? []), await piecesShown(ui)]).toEqual([
        '',
        ['c1'],
    ]);
});

/* exit 4 — clear, copy, the counts */

test('clear removes the piece from the section and from orbit', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await catchOf($, 'a', 'b');
    await ui.press({ key: 'orbit:clear:c1' });
    await ui.press({ key: 'orbit:think:c2' });
    await say($, 'next');
    const joinedText = thought(w.contexts.at(-1) ?? []);
    expect([
        await piecesShown(ui),
        joinedText.includes('c2:'),
        joinedText.includes('c1:'),
    ]).toEqual([['c2'], true, false]);
});

test('copy puts the piece text on the clipboard', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await catchOf($, 'the 5h window resets at 16:40');
    await ui.press({ key: 'orbit:copy:c1' });
    expect(w.copies).toEqual(['the 5h window resets at 16:40']);
});

test("the store counts the day's 🤔 presses, clears and refused adds", async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await say($, 'go');
    await catchOf($, 'a', 'b');
    await catchOf($, 'c');
    await ui.press({ key: 'orbit:think:c1' });
    await ui.press({ key: 'orbit:clear:c2' });
    expect(w.store.get(`catch-count:${DAY}`)).toEqual({
        clears: 1,
        refused: 1,
        thinks: 1,
    });
});

/* exit 5 — a reload keeps them */

test('held pieces survive a reload', async ($, on) => {
    world(on);
    const state: Record<string, unknown> = {
        orbit: {
            asks: [],
            caught: [{ at: 1, id: 'c4', text: 'kept across a reload' }],
            next: 5,
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
    const ui = await board($);
    expect(await piecesShown(ui)).toEqual(['c4']);
});
