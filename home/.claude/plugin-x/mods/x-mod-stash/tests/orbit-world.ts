import type { On } from 'claude-code';
import { type Engine, mock } from 'claude-code/testing';

export const SID = 'o1o1o1o1-orbit';
export const TOOL = 'mcp__x-mod-stash__orbit';

// the orbit test world (FRM-555 step 125, o147): orbit.test.ts runs on it, and a verifier's `--extra` rows import it
// instead of copying the mods tree. one session: `contexts` holds each prompt's model-only context, `appended` each
// hidden mid-turn message

// the orbit tool as the last start registered it
export const registered: {
    described: string;
    schema: {
        properties?: Record<
            string,
            {
                items?: { properties?: Record<string, unknown> };
                enum?: string[];
            }
        >;
    };
    isDeferred?: boolean;
} = { described: '', schema: {} };

// a test holds the store's key list shut, to keep a hook mid-way while a draw overtakes it
export const gates: { storeKeys?: Promise<void> } = {};

// `files`: what `$.fs.read` finds, such as the glide shelf file
export function world(on: On, files: Record<string, string> = {}) {
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
        await gates.storeKeys;
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
    // the registry dir lists the session files a test plants; every other dir reads empty
    on('fs.list', (_$, e) => ({
        value:
            e.path === '/home/.claude/sessions'
                ? Object.keys(files)
                      .filter((p) => p.startsWith(`${e.path}/`))
                      .map((p) => ({
                          isLink: false,
                          kind: 'file' as const,
                          mtimeMs: 0,
                          name: p.slice(e.path.length + 1),
                          size: 1,
                      }))
                : [],
    }));
    on('tool.register', (_$, e) => {
        registered.described = e.description;
        registered.schema = e.inputSchema as typeof registered.schema;
        registered.isDeferred = e.isDeferred;
        return { value: { tool: `mcp__x-mod-stash__${e.name}` } };
    });
    // a test flips it to drop the next prompts, as another plugin's hook would
    const prompts = { isDropped: false };
    on('prompt.submit', (_$, e) => {
        if (prompts.isDropped) return { drop: 'planted' };
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
    return { appended, clock, contexts, files, panes, prompts, store, taps };
}

export const start = ($: Engine) =>
    $.session.start({ cwd: '/tmp', isInteractive: true, surface: 'desktop' });

export const orbit = ($: Engine, input: Record<string, unknown>) =>
    $.tool.call({ tool: TOOL, ...input } as never);

export const add = ($: Engine, ...asks: [string, string][]) =>
    orbit($, {
        asks: asks.map(([text, pick]) => ({
            hiddenNote: `came from ${text}`,
            pick,
            text,
        })),
        op: 'add',
    });

export const say = ($: Engine, text: string, kind = 'composer' as const) =>
    $.prompt.submit({ origin: { kind }, text, wait: false });

export const endTurn = ($: Engine) =>
    $.turn.complete({
        answer: '',
        durationMs: 1,
        isAborted: false,
        reason: 'answer',
        turnId: 't',
    });

export const board = ($: Engine) =>
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

export type Board = Awaited<ReturnType<typeof board>>;

// orbit's ask ids as the mounted board shows them, in order
export async function asksShown(ui: Board) {
    return (await ui.findAll({ type: 'Box' }))
        .filter((n) => n.key?.startsWith('orbit:ask:'))
        .map((n) => n.key?.slice('orbit:ask:'.length));
}

export const joined = (contexts: string[][]) =>
    (contexts.at(-1) ?? []).filter((c) => c.startsWith('orbit: dima marked'));
