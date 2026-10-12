import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

// 🐠 catch v2 (PK-96, FRM-386): cclio's keep-in-mind shelf, seven kinds, the rules in dima's catch.md

const SID = 'c1c1c1c1-catch';
const PID = 4343;
const TOOL = 'mcp__x-mod-stash__orbit';
const DAY = '2026-10-12';
const NOW = new Date(`${DAY}T15:00:00Z`).getTime();
const MIN = 60_000;
const CCLIO = '🦉 cclio';

// one session, named `name` in the registry (cclio by default): each prompt's model-only context, the copies, the tool's
// description, the store; `rules` is catch.md as the file reads now
function world(
    on: On,
    {
        name = CCLIO,
        state = undefined as Record<string, unknown> | undefined,
    } = {},
) {
    const contexts: string[][] = [];
    const appended: string[] = [];
    const copies: string[] = [];
    const described: string[] = [];
    const files = { rules: 'CATCH RULES v1' };
    const clock = mock.clock(on, { now: NOW });
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
    if (state) {
        on('state.get', (_$, e) => ({
            value: { value: state[e.key], version: e.key in state ? 1 : 0 },
        }));
        on('state.set', (_$, e) => {
            state[e.key] = e.value;
            return { value: { isSet: true, version: 2 } };
        });
    }
    on('session.id', () => ({ value: SID }));
    on('env.get', () => ({ value: '/home' }));
    on('process.run', () => ({
        value: {
            exitCode: 0,
            isStderrTruncated: false,
            isStdoutTruncated: false,
            stderr: '',
            stdout: `${PID}\nMon Oct 12 15:00:00 2026\n`,
        },
    }));
    on('fs.read', (_$, e) => {
        if (e.path === `/home/.claude/sessions/${PID}.json`)
            return { value: JSON.stringify({ name, pid: PID }) };
        if (e.path.endsWith('/catch.md')) return { value: files.rules };
        return { deny: 'no such file' };
    });
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
    return { appended, clock, contexts, copies, described, files, store };
}

const start = ($: Engine) =>
    $.session.start({ cwd: '/tmp', isInteractive: true, surface: 'desktop' });

// the board pane open, so the poll publishes its clock and an age reads from it
const paneOpen = (on: On) =>
    on('ui.panes', () => ({
        value: [
            {
                id: 'fleet-board',
                isFocused: false,
                isPlaced: true,
                isShown: true,
                plugin: 'x-mod-stash',
                title: 'fleet board',
            },
        ],
    }));

type Piece = { kind?: string; text: string; hiddenNote?: string };
const catchOf = ($: Engine, ...pieces: (Piece | string)[]) =>
    $.tool.call({
        op: 'catch',
        pieces: pieces.map((p) =>
            typeof p === 'string'
                ? { hiddenNote: `from ${p}`, kind: '💡', text: p }
                : p,
        ),
        tool: TOOL,
    } as never) as Promise<{ deny?: string; result?: string }>;

const clearOf = ($: Engine, ...ids: string[]) =>
    $.tool.call({ clear: ids, op: 'catch', tool: TOOL } as never) as Promise<{
        deny?: string;
    }>;

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
        .map((n) => n.key?.match(/^orbit:catch:(c\d+)$/)?.[1])
        .filter(Boolean);
}

const thought = (lines: readonly string[]) =>
    lines.filter((c) => c.startsWith('🐠 catch: dima pressed 🤔')).join('\n');

const deny = (r: { deny?: string }) => r.deny;

/* exit 1 — catch.md reaches her context */

test("catch.md reaches cclio's first prompt once", async ($, on) => {
    const w = world(on);
    await start($);
    await say($, 'go');
    await say($, 'again');
    expect([
        w.contexts[0]?.includes('CATCH RULES v1'),
        w.contexts[1]?.includes('CATCH RULES v1'),
    ]).toEqual([true, false]);
});

test('catch.md is read when her first prompt goes, so an edit since the load shows', async ($, on) => {
    const w = world(on);
    await start($);
    w.files.rules = 'CATCH RULES v2';
    await say($, 'go');
    expect(w.contexts[0]).toContain('CATCH RULES v2');
});

test('a session not named cclio never reads catch.md', async ($, on) => {
    const w = world(on, { name: '☕️ 🔧 coder: mods' });
    await start($);
    await say($, 'go');
    expect(w.contexts[0]?.some((c) => c.includes('CATCH RULES'))).toBe(false);
});

/* exit 2 — cclio only, one line in the description */

test('a catch from a session not named cclio is refused, naming her', async ($, on) => {
    world(on, { name: '☕️ 🔧 coder: mods' });
    await start($);
    expect(deny(await catchOf($, 'a fact'))).toBe(
        `orbit catch: catch is ${CCLIO}'s alone; this session is not her`,
    );
});

test("the description's catch line names cclio and catch.md and carries no kind rule", async ($, on) => {
    const w = world(on);
    await start($);
    const line = w.described
        .join('\n')
        .split('\n')
        .find((l) => l.startsWith('op catch'));
    expect(line).toBe(
        'op catch, pieces [{ kind, text, hiddenNote }], clear [ids]: cclio only, her rules come from catch.md.',
    );
});

/* exit 3 — the shape */

test('a piece past 60 chars is refused naming the limit', async ($, on) => {
    world(on);
    await start($);
    const r = await catchOf($, { kind: '💡', text: 'x'.repeat(61) });
    expect(deny(r)).toMatch(/is 61 chars; keep it ≤60/);
});

test('a kind outside the seven is refused naming them', async ($, on) => {
    world(on);
    await start($);
    const r = await catchOf($, { kind: '🔤', text: 'o56 = a gloss' });
    expect(deny(r)).toBe(
        'orbit catch: kind «🔤» is not one of 📍 🧷 ✅ 🎯 ⏰ 💡 📦; catch.md names them',
    );
});

test('a valid piece draws one row: its kind, its line, a dim age, 🤔 and ✖️', async ($, on) => {
    const w = world(on);
    paneOpen(on);
    await start($);
    const ui = await board($);
    await catchOf($, { kind: '📍', text: 'memory sweep: 01–03 done, next 04' });
    await w.clock.advance(12 * MIN);
    const age = await ui.find({ text: '12m', type: 'Text' });
    expect([
        (await ui.find({ key: 'orbit:catch:c1', type: 'Box' }))?.text,
        age?.props.dimColor,
    ]).toEqual(['📍 memory sweep: 01–03 done, next 0412m🤔✖️', true]);
});

test("a press on a piece's line opens its hidden note, copy and steer in place, and a second folds them", async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await catchOf($, 'qc-recv never slept');
    const before = await ui.find({ key: 'orbit:csteer:c1', type: 'Input' });
    await ui.press({ key: 'orbit:open:c1' });
    const open = (await ui.find({ key: 'orbit:catch:c1:open', type: 'Box' }))
        ?.text;
    await ui.press({ key: 'orbit:open:c1' });
    const after = await ui.find({ key: 'orbit:catch:c1:open', type: 'Box' });
    expect([
        before,
        open?.startsWith('from qc-recv never slept'),
        after,
    ]).toEqual([undefined, true, undefined]);
});

/* exit 4 — 5 rows, cap 7 */

test('7 pieces draw 5 rows and a +2 fold, which opens the rest', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await catchOf($, 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7');
    const folded = await piecesShown(ui);
    const more = (await ui.find({ key: 'fold:catch:more', type: 'Button' }))
        ?.text;
    await ui.press({ key: 'fold:catch:more' });
    expect([folded, more, (await piecesShown(ui)).length]).toEqual([
        ['c1', 'c2', 'c3', 'c4', 'c5'],
        '+2',
        7,
    ]);
});

test('an 8th piece drops the oldest 💡', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await catchOf(
        $,
        { kind: '🧷', text: 'r1' },
        'f2',
        'f3',
        { kind: '📍', text: 'e4' },
        'f5',
        'f6',
        'f7',
    );
    const r = await catchOf($, { kind: '⏰', text: 'ask about quiet comms' });
    await ui.press({ key: 'fold:catch:more' });
    expect([r.result, await piecesShown(ui)]).toEqual([
        expect.stringContaining('the cap dropped the oldest 💡: c2'),
        ['c1', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'],
    ]);
});

test('an 8th piece with no 💡 held is refused naming the cap, and nothing moves', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    const seven = ['📍', '🧷', '✅', '🎯', '⏰', '📦', '🧷'].map((kind, i) => ({
        kind,
        text: `p${i + 1}`,
    }));
    await catchOf($, ...seven);
    const r = await catchOf($, 'one more fact');
    await ui.press({ key: 'fold:catch:more' });
    expect([deny(r), (await piecesShown(ui)).length]).toEqual([
        'orbit catch: 7 held, the cap is 7 and no 💡 to drop; clear one first',
        7,
    ]);
});

/* exit 5 — the same pieces after a compaction or a new session */

test('a new cclio session draws the shelf her last one held', async ($, on) => {
    const w = world(on);
    w.store.set('catch-shelf:cclio', [
        {
            at: NOW - 5 * MIN,
            id: 'c4',
            kind: '🧷',
            text: 'crew-dna skill: PK-N, 3rd',
        },
    ]);
    await start($);
    const ui = await board($);
    await catchOf($, 'a fresh fact');
    expect(await piecesShown(ui)).toEqual(['c4', 'c5']);
});

test('every change to her pieces is kept on the shelf', async ($, on) => {
    const w = world(on);
    await start($);
    await catchOf($, 'f1', 'f2');
    await clearOf($, 'c1');
    expect(
        (w.store.get('catch-shelf:cclio') as { id: string }[]).map((x) => x.id),
    ).toEqual(['c2']);
});

test('pieces held in her state survive a reload, and one kept before the kinds reads as a 💡 born at the load', async ($, on) => {
    paneOpen(on);
    world(on, {
        state: {
            orbit: {
                asks: [],
                caught: [{ at: 1, id: 'c4', text: 'kept across a reload' }],
                next: 5,
                turns: 2,
            },
        },
    });
    await start($);
    const ui = await board($);
    expect((await ui.find({ key: 'orbit:catch:c4', type: 'Box' }))?.text).toBe(
        '💡 kept across a reload0m🤔✖️',
    );
});

test("a piece's text kept as «note» before the steer rename is drawn in its steer field after a reload", async ($, on) => {
    world(on, {
        state: {
            // the piece opened, as a press leaves it: a mocked state redraws nothing on a write
            folds: { 'catch:c4': false },
            orbit: {
                asks: [],
                caught: [
                    { at: 1, id: 'c4', note: 'why so early?', text: 'kept' },
                ],
                next: 5,
                turns: 2,
            },
        },
    });
    await start($);
    const ui = await board($);
    expect(
        (await ui.find({ key: 'orbit:csteer:c4', type: 'Input' }))?.props.value,
    ).toBe('why so early?');
});

/* exit 6 — a receipt lives in catch alone */

test('a 🧷 receipt sits in catch, and no orbit ask or phases line carries it', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await catchOf($, { kind: '🧷', text: 'crew-dna skill: PK-N, 3rd' });
    const all = (await ui.findAll({ type: 'Text' })).map((n) => n.text ?? '');
    expect([
        await piecesShown(ui),
        all.filter((t) => t.includes('crew-dna skill')).length,
        await ui.find({ text: /phases/, type: 'Text' }),
    ]).toEqual([['c1'], 0, undefined]);
});

/* her clears */

test('cclio clears a piece by id when its lifetime ends', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await catchOf($, 'f1', 'f2');
    await clearOf($, 'c1');
    expect(await piecesShown(ui)).toEqual(['c2']);
});

test('a clear of an id not held is refused naming the held ones', async ($, on) => {
    world(on);
    await start($);
    await catchOf($, 'f1');
    expect(deny(await clearOf($, 'c9'))).toBe(
        'orbit catch: no piece c9; held: c1',
    );
});

test('her prompt reminder names the held ids, so a compacted cclio can still clear them', async ($, on) => {
    const w = world(on);
    await start($);
    await catchOf($, 'f1', 'f2');
    await say($, 'go');
    expect(w.contexts.at(-1)?.join('\n')).toContain('🐠 catch holds c1, c2');
});

/* 🤔, clear, copy, the counts — kept from v1 */

test('🤔 while a turn runs joins it at the next tool result and starts no turn', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await catchOf($, 'the 5h window resets at 16:40');
    await say($, 'go');
    await ui.press({ key: 'orbit:think:c1' });
    await ui.press({ key: 'orbit:open:c1' });
    await ui.input({
        key: 'orbit:csteer:c1',
        kind: 'change',
        text: 'why so early?',
    });
    const r = await $.tool.call({ command: 'ls', tool: 'Bash' });
    expect([thought(r.context ?? []), w.contexts.length, w.appended]).toEqual([
        expect.stringContaining(
            '- c1: the 5h window resets at 16:40 · your note: «from the 5h window resets at 16:40» · his steer: «why so early?»',
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

test("dima's ✖️ removes the piece from the section and from orbit", async ($, on) => {
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

test("copy, opened from the piece's line, puts its text on the clipboard", async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await catchOf($, 'the 5h window resets at 16:40');
    await ui.press({ key: 'orbit:open:c1' });
    await ui.press({ key: 'orbit:copy:c1' });
    expect(w.copies).toEqual(['the 5h window resets at 16:40']);
});

test("the store counts the day's 🤔 presses, clears and refused adds", async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await catchOf($, 'a', 'b');
    await catchOf($, { kind: '🔤', text: 'c' });
    await ui.press({ key: 'orbit:think:c1' });
    await ui.press({ key: 'orbit:clear:c2' });
    expect(w.store.get(`catch-count:${DAY}`)).toEqual({
        clears: 1,
        refused: 1,
        thinks: 1,
    });
});

test('with nothing caught the section is hidden', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    expect(await ui.find({ text: '🐠 catch', type: 'Text' })).toBe(undefined);
});

test('the 🐠 catch switch in settings hides the shelf on the board', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await catchOf($, 'f1');
    const shown = (await piecesShown(ui)).length;
    w.store.set('shown', { 'stash.catch': false });
    await w.clock.advance(4000);
    expect([shown, (await piecesShown(ui)).length]).toEqual([1, 0]);
});
