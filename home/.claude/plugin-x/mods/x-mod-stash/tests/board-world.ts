import type { FsEntry, On } from 'claude-code';
import { type Engine, mock } from 'claude-code/testing';

import { logFile, logText } from './quiet-helpers.ts';
import {
    THREADS_FILE,
    type ThreadRow,
    recordOf,
    threadsFile,
} from './threads.ts';

export const NOW = 10_000_000;
export const MIN = 60 * 1000;
export const DAY = new Date(NOW).toISOString().slice(0, 10);
const LOG_FILE = logFile(DAY);
export const HERE = 'h1h1h1h1-here';
export const PEER = 'p2p2p2p2-peer';
export const GONE = 'g3g3g3g3-gone';
export const PING =
    'x-mod-stash keep-hot ping: answer with one character, nothing else.';
export const REGISTRY: Record<string, Record<string, unknown>> = {
    '/home/.claude/sessions/1.json': {
        hostSessionId: 'local_abc-1',
        name: '🦉 clio',
        pid: 1,
        sessionId: HERE,
        status: 'busy',
        statusUpdatedAt: NOW - 3 * MIN,
    },
    '/home/.claude/sessions/2.json': {
        jobId: 'fef31d31',
        name: '☕️ 🔧 FRM-1 code: x',
        pid: 2,
        sessionId: PEER,
        status: 'idle',
        statusUpdatedAt: NOW - 12 * MIN,
    },
    '/home/.claude/sessions/3.json': { name: 'gone', pid: 3, sessionId: GONE },
};

// three registry files, the `alive` pids running (1 and 2 by default), `bg` of them background sessions, `patch` merged into an entry by pid
export function fleet(
    on: On,
    store: Record<string, unknown> = {},
    {
        alive = [1, 2],
        bg = [] as number[],
        patch = {} as Record<number, Record<string, unknown>>,
        isBoardOpen = true,
        files = undefined as string[] | undefined,
        reads = {} as Record<string, string>,
        // x's thread records, as the store file carries them
        threads = [] as ThreadRow[],
        dirs = {} as Record<string, FsEntry[]>,
        isOwner = false,
        sends = {} as Record<string, string[]>,
        // a transcript's birth, epoch seconds by path, as `stat -f %B` prints it
        born = {} as Record<string, number>,
        // the day's quiet log
        log = [] as unknown[],
    } = {},
) {
    const runs: string[][] = [];
    if (files) on('fs.exists', (_$, e) => ({ value: files.includes(e.path) }));
    const clock = mock.clock(on, { now: NOW });
    // a store in memory the test reads back: what the ledger wrote is the contract now that no card draws it
    const kept = new Map<string, unknown>(Object.entries(store));
    on('store.get', (_$, e) => ({ value: kept.get(e.key) }));
    on('store.set', (_$, e) => {
        kept.set(e.key, e.value);
        return { value: undefined };
    });
    on('store.keys', () => ({ value: [...kept.keys()] }));
    on('store.delete', (_$, e) => {
        kept.delete(e.key);
        return { value: undefined };
    });
    on('session.id', () => ({ value: HERE }));
    on('env.get', () => ({ value: '/home' }));
    on('prompt.submit', (_$, e) => ({ text: e.text }));
    on('classic.Stop', () => ({}));
    on('session.measure', (_$, e) => ({ changed: e.changed }));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('ui.log', () => ({ value: undefined }));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('session.repo', () => ({
        value: { internal: false, name: null, remote: null, root: '/tmp' },
    }));
    if (isBoardOpen) panes(on, true);
    on('fs.list', (_$, e) => ({
        value:
            dirs[e.path] ??
            ['1.json', '2.json', '3.json', 'x.key'].map((name) => ({
                isLink: false,
                kind: 'file' as const,
                mtimeMs: 0,
                name,
                size: 1,
            })),
    }));
    on('fs.read', (_$, e) => {
        if (e.path === THREADS_FILE) {
            // a record per registry session as x would have written it, a test's own row for a session winning
            const own = new Set(threads.map((t) => t.sessionId));
            const rows = Object.values(REGISTRY)
                .map((entry) => ({ ...entry, ...patch[entry.pid as number] }))
                .filter((entry) => !own.has(String(entry.sessionId)))
                .map((entry) => ({
                    pid: entry.pid as number,
                    sessionId: String(entry.sessionId),
                    ...recordOf(String(entry.name)),
                }));
            return { value: threadsFile([...rows, ...threads]) };
        }
        const extra =
            e.path === LOG_FILE && log.length ? logText(log) : reads[e.path];
        if (extra !== undefined) return { value: extra };
        const entry = REGISTRY[e.path];
        if (!entry) return { deny: 'no such file' };
        const pid = entry.pid as number;
        return {
            value: JSON.stringify({
                ...entry,
                kind: bg.includes(pid) ? 'bg' : 'interactive',
                ...patch[pid],
            }),
        };
    });
    on('process.run', (_$, e) => {
        runs.push([...e.argv]);
        return {
            value: {
                exitCode: e.argv[0] === 'ps' ? 1 : 0,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                // `sh` is the board's own pid lookup: pid 1, the registry's clio, when the board is hers
                stdout:
                    e.argv[0] === 'stat'
                        ? `${born[e.argv.at(-1) ?? ''] ?? ''}\n`
                        : e.argv[0] === 'ps'
                          ? alive.map((p) => `    ${p}\n`).join('')
                          : e.argv[0] !== 'sh'
                            ? ''
                            : e.argv[2]?.includes('PPID')
                              ? isOwner
                                  ? '1\nMon Oct 12 15:00:00 2026\n'
                                  : ''
                              : (sends[e.argv[5] ?? ''] ?? []).join('\n'),
            },
        };
    });
    return { clock, runs, store: kept };
}

// the board as the poll leaves it: a session start reads the registry into the view, then the pane draws it
export async function board($: Engine) {
    await $.session.start({
        cwd: '/tmp',
        isInteractive: true,
        surface: 'desktop',
    });
    return $.ui.mount({
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
}

// each member's whole row as one string, from one mount
export async function rowsBySid($: Engine) {
    const ui = await board($);
    const rows: Record<string, string> = {};
    for (const n of await ui.findAll({ type: 'Box' }))
        if (n.key?.startsWith('m:')) rows[n.key.slice(2)] = n.text ?? '';
    return rows;
}

export const row = async ($: Engine, sid: string) =>
    (await rowsBySid($))[sid] ?? 'no row';

export const stop = ($: Engine, reply: string) =>
    $.classic.Stop({
        last_assistant_message: reply,
        session_id: HERE,
        stop_hook_active: false,
    });

export const held = (from: string, text: string, ago: number) => ({
    at: NOW - ago * MIN,
    from,
    text,
});

export function band($: Engine) {
    return $.ui.mount({
        component: 'AbovePrompt',
        plugin: 'x-mod-stash',
        props: {
            bodyColumns: 100,
            hasSurvey: false,
            isCollapsed: false,
            isWorking: false,
            maxRows: 12,
            scroll: { bodyRows: 40, offset: 0 },
            view: {},
        },
        surface: 'desktop',
    });
}

export function panes(on: On, isOpen: boolean) {
    const calls: string[] = [];
    on('ui.panes', () => ({
        value: isOpen
            ? [
                  {
                      id: 'x-cc-deck',
                      isFocused: false,
                      isPlaced: true,
                      isShown: true,
                      plugin: 'x-mod-stash',
                      title: 'fleet board',
                  },
              ]
            : [],
    }));
    on('ui.open', (_$, e) => {
        calls.push(`open ${e.id}`);
        return { value: { isPlaced: true as const } };
    });
    on('ui.close', (_$, e) => {
        calls.push(`close ${e.id}`);
        return { value: undefined };
    });
    return calls;
}

// every Text the board draws with colour on, by its text, with its colour and dim
export async function colourTexts($: Engine) {
    const ui = await board($);
    const texts = await ui.findAll({ type: 'Text' });
    return texts.map((t) => ({
        color: t.props.color,
        dim: t.props.dimColor === true,
        text: t.text,
    }));
}
