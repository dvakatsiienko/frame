import type { On } from 'claude-code';
import { type Engine, mock } from 'claude-code/testing';

import { THREADS_FILE, recordOf, threadsFile } from './threads.ts';

// 🐦‍🔥 second wind, the asked session's side (todo 16): the note rides its next turn, a cancel takes it back, and the
// op it calls with its handoff compacts and ingests at that turn's end

export const SID = 'w1w1w1w1-wind';
export const PID = 4646;
export const TOOL = 'mcp__x-mod-stash__orbit';
export const NOW = new Date(2026, 9, 13, 17, 40).getTime();
export const SLUG = 'mods-l14-2';

// what a row sets before its first `$` call; `world` gives each its start value back
export const fake = {
    // the engine refuses the compact, as it refuses an unknown command
    compactRefusal: undefined as string | undefined,
    // the context % a step reads live, through $.session.usage
    fillNow: undefined as number | undefined,
    // a session started with no plugin x skills (crow's pane, FRM-505) lists no ingest command
    hasIngestCommand: true,
    // what lands while the engine compacts: one `on` per event, so a test sets this before its first `$` call
    inCompact: undefined as (() => Promise<unknown>) | undefined,
    ingestRefusal: undefined as string | undefined,
    // the store refuses a write to the held store
    isHeldRefused: false,
    // the id the session answers; a /clear row moves it
    sidNow: SID,
    // the engine refuses the mod's own prompt
    submitRefusal: undefined as string | undefined,
};

// the live peers a test's messages come from, as cc's registry names them and x's records give their roles
export const SENSE_NAMES = [
    '⚡ 🔎 sixth sense: mods',
    '⚡ 🔎 sixth sense: mods lane 6 | main',
];
export const PEERS = [
    { name: '🦉 clio', pid: 1, record: recordOf('🦉 clio') },
    {
        name: '🦉🪽 clio: wing 1',
        pid: 2,
        record: recordOf('🦉🪽 clio: wing 1'),
    },
    ...SENSE_NAMES.map((name, i) => ({
        name,
        pid: 3 + i,
        record: { display: name, role: 'sixth-sense' },
    })),
    // the 01:28 fork: clio's name, no record
    { name: '🦉 clio', pid: 90, record: {} },
];
// `name` is the session's registry name; `handoffs` the slugs `x handoff peek` finds
// `during` runs inside the compact, as a turn end that lands while it works would
// `role` is the role x's thread record gives the session, `null` for none
export function world(
    on: On,
    name = '☕️ 🔧 codie: mods',
    handoffs = [SLUG],
    during?: () => Promise<unknown>,
    role: string | null = 'codie',
) {
    fake.inCompact = undefined;
    fake.hasIngestCommand = true;
    fake.compactRefusal = undefined;
    fake.ingestRefusal = undefined;
    fake.submitRefusal = undefined;
    fake.isHeldRefused = false;
    fake.sidNow = SID;
    fake.fillNow = undefined;
    const prompts: string[] = [];
    const lines: string[] = [];
    const commands: string[] = [];
    const appended: string[] = [];
    const moves: string[] = [];
    const logs: string[] = [];
    const clock = mock.clock(on, { now: NOW });
    const store = new Map<string, unknown>();
    on('store.get', (_$, e) => ({ value: store.get(e.key) }));
    on('store.set', (_$, e) => {
        if (fake.isHeldRefused && e.key.startsWith('held:'))
            return { deny: 'disk full' };
        store.set(e.key, e.value);
        return { value: undefined };
    });
    on('store.keys', () => ({ value: [...store.keys()] }));
    on('store.delete', (_$, e) => {
        store.delete(e.key);
        return { value: undefined };
    });
    on('session.id', () => ({ value: fake.sidNow }));
    on('env.get', (_$, e) => ({ value: ENV[e.name] ?? '/home' }));
    on('process.run', (_$, e) => {
        const isPeek = e.argv[1] === 'handoff' && e.argv[2] === 'peek';
        // writeWhole's rename
        if (e.argv[0] === 'mv') {
            const [from = '', to = ''] = e.argv.slice(2);
            moves.push(to);
            files[to] = files[from] ?? '';
            delete files[from];
        }
        return {
            value: {
                exitCode: isPeek && !handoffs.includes(e.argv[3] ?? '') ? 1 : 0,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout: isPeek
                    ? ''
                    : e.argv[0] === 'ps'
                      ? [PID, ...PEERS.map((p) => p.pid)].join('\n')
                      : `${PID}\nMon Oct 13 17:00:00 2026\n`,
            },
        };
    });
    const files: Record<string, string> = {
        [`/home/.claude/sessions/${PID}.json`]: JSON.stringify({
            name,
            pid: PID,
        }),
        [THREADS_FILE]: threadsFile([
            {
                pid: PID,
                sessionId: SID,
                ...(role ? { display: name, role } : recordOf(name)),
            },
            ...PEERS.map((p) => ({
                pid: p.pid,
                sessionId: `peer-${p.pid}`,
                ...p.record,
            })),
        ]),
    };
    for (const p of PEERS)
        files[`/home/.claude/sessions/${p.pid}.json`] = JSON.stringify({
            name: p.name,
            pid: p.pid,
            sessionId: `peer-${p.pid}`,
        });
    on('fs.read', (_$, e) =>
        e.path in files
            ? { value: files[e.path] ?? '' }
            : { deny: 'no such file' },
    );
    on('fs.write', (_$, e) => {
        files[e.path] = e.text;
        return { value: undefined };
    });
    on('fs.list', (_$, e) => ({
        value:
            e.path === '/home/.claude/sessions'
                ? PEERS.map((p) => ({
                      isLink: false,
                      kind: 'file' as const,
                      mtimeMs: 0,
                      name: `${p.pid}.json`,
                      size: 1,
                  }))
                : [],
    }));
    on('ui.log', (_$, e) => {
        logs.push(e.text);
        return { value: undefined };
    });
    on('ui.toast', () => ({ value: undefined }));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('session.repo', () => ({
        value: { internal: false, name: null, remote: null, root: '/tmp' },
    }));
    on('tool.register', (_$, e) => ({
        value: { tool: `mcp__x-mod-stash__${e.name}` },
    }));
    on('prompt.submit', (_$, e) => {
        if (e.origin?.kind === 'plugin' && fake.submitRefusal)
            throw new Error(fake.submitRefusal);
        lines.push(...(e.context ?? []));
        if (e.origin?.kind === 'plugin') prompts.push(e.text);
        return { text: e.text };
    });
    on('session.usage', () => ({
        value: {
            context: {
                percent: fake.fillNow,
                tokens: (fake.fillNow ?? 0) * 10_000,
                window: 1_000_000,
            },
            rateLimits: [],
            startedAt: 0,
        },
    }));
    on('command.list', () => ({
        value: [
            { description: '', name: 'compact', source: 'builtin' as const },
            ...(fake.hasIngestCommand
                ? [
                      {
                          description: '',
                          name: 'x:handoff-ingest',
                          source: 'plugin' as const,
                      },
                  ]
                : []),
        ],
    }));
    on('command.run', async (_$, e) => {
        if (e.command === 'compact' && fake.compactRefusal)
            throw new Error(fake.compactRefusal);
        if (e.command === 'x:handoff-ingest' && fake.ingestRefusal)
            throw new Error(fake.ingestRefusal);
        commands.push(`/${e.command} ${e.args}`);
        if (e.command === 'compact') await during?.();
        return { text: '' };
    });
    on('turn.complete', () => ({ text: '' }));
    on('session.compact', async (_$, e) => {
        await fake.inCompact?.();
        return e.messages[0]?.text === 'veto'
            ? ({ skip: 'vetoed' } as never)
            : { messages: e.messages };
    });
    on('classic.Stop', () => ({}));
    on('tool.call', () => ({ result: {}, text: 'done' }));
    on('session.append', (_$, e, next) => {
        for (const c of e.message.content)
            if (c.type === 'text') appended.push(String(c.text));
        return next(e);
    });
    return {
        appended,
        clock,
        commands,
        files,
        lines,
        logs,
        moves,
        prompts,
        store,
    };
}

export const start = ($: Engine) =>
    $.session.start({ cwd: '/tmp', isInteractive: true, surface: 'desktop' });

export const say = ($: Engine, text = 'go', kind = 'composer') =>
    $.prompt.submit({ origin: { kind } as never, text, wait: false });

export const endTurn = ($: Engine) =>
    $.turn.complete({
        answer: '',
        durationMs: 1,
        isAborted: false,
        reason: 'answer',
        turnId: 't',
    });

// the op names what is still pending; «none» is the only word that lets it compact
export const ready = (
    $: Engine,
    slug?: string,
    pending: string | null = 'none',
) =>
    $.tool.call({
        op: 'second-wind',
        tool: TOOL,
        ...(slug === undefined ? {} : { slug }),
        ...(pending === null ? {} : { pending }),
    } as never) as Promise<{ deny?: string; result?: unknown }>;

export const DIMAS_WORDS =
    'a second wind is a graceful context refresh, a request, never urgent — the session and its coders resolve every subagent and park everything before the compact, so nothing is lost.';

export const notes = (lines: string[]) =>
    lines.filter((l) => l.includes('🐦‍🔥'));

// FRM-505: past 55 % a session hears the wind is coming; past 65 % the mod asks for it, a turn after the notice
export const NOTICE = /^🐦‍🔥 context at \d+ %/;
export const noticesOf = (lines: string[]) =>
    lines.filter((l) => NOTICE.test(l));
// the prompt path reads the fill the board shows; each prompt is one turn
export async function turnAt(
    $: Engine,
    w: ReturnType<typeof world>,
    fill: number,
) {
    w.store.set(`context:${SID}`, fill);
    await say($);
}

// FRM-634: dima's own text for the five notes and the applied values; an empty row is the default, an edit waits a poll
export const WIND_STORE = '/home/.claude/shelf/second-wind.json';
export const POLL_MS = 60_000;
export const ENV: Record<string, string> = { X_STASH_POLL_MS: `${POLL_MS}` };
export type World = ReturnType<typeof world>;
// what `pnpm mods:set second-wind-text <row> <text>` leaves in the mod's store
export const edit = (w: World, row: string, text: string) =>
    w.store.set('wind-text-edits', { [row]: text });
export const storeFile = (w: World) => JSON.parse(w.files[WIND_STORE] ?? '{}');
export const withSecondWind = (lines: string[]) =>
    lines.filter((l) => l.includes('second-wind'));

export const coordinator = (on: On) =>
    world(on, '🦉 clio', undefined, undefined, 'coordinator');

export const band = ($: Engine) =>
    $.ui.mount({
        component: 'AbovePrompt',
        plugin: 'x-mod-stash',
        props: {
            bodyColumns: 120,
            hasSurvey: false,
            isCollapsed: false,
            isWorking: false,
            maxRows: 12,
            scroll: { bodyRows: 40, offset: 0 },
            view: {},
        },
        surface: 'desktop',
    });

export const compact = (
    $: Engine,
    trigger: 'auto' | 'manual' | 'plugin' | 'precompute',
) =>
    $.session.compact({
        messages: [{ role: 'user', text: 'hi', toolUses: [] }],
        trigger,
    } as never);

// r5 (dima's o23): a coordinator's message to a codie past 55 % context waits for the codie's second wind
export const CLIO = '🦉 clio';
// FRM-583: one held store, `held:<sid>`, one entry per message id, for every reason a message waits; the old keys'
// lists are read at the land, so a fixture planted under one still holds
export const STORE = `held:${SID}`;
export const NAME_HELD = 'held:☕️🔧codie:mods';
export const OLD_HELD = 'steer-held:☕️🔧codie:mods';
export type Held = {
    isCompacted?: true;
    messages: { id: string; text: string }[];
};
export const receiveWorld = (on: On, name?: string, role = 'codie') => {
    const w = world(on, name, undefined, undefined, role);
    const queued: string[] = [];
    on('session.receive', (_$, e) => {
        queued.push(e.text);
        return { text: e.text };
    });
    return { ...w, queued };
};
// the socket is the sender's own, as cc writes it; the name is only what it signs with
export const fromPeer = (
    $: Engine,
    body: string,
    from = CLIO,
    pid = PEERS.find((p) => p.name === from)?.pid ?? 1,
) =>
    $.session.receive({
        origin: { kind: 'peer' },
        text: `<cross-session-message from="uds:/tmp/cc-socks/${pid}.sock" from-name="${from}" from-mode="bypass">\n${body}\n</cross-session-message>`,
    }) as Promise<{ consumed?: string; text?: string }>;
export const delivered = (lines: string[]) =>
    lines.filter((l) => l.startsWith('🐦‍🔥 held for your second wind'));
