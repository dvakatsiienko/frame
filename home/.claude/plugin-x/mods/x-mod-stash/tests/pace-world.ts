import type { On } from 'claude-code';
import { type Engine, mock } from 'claude-code/testing';

import { pollSkip } from './poll-skip.ts';
import { appendLog } from './quiet-helpers.ts';
import { THREADS_FILE, recordOf, threadsFile } from './threads.ts';

// the pace watch (FRM-500): a line to the session that keeps `pace:<id>`, only when the 5h window changes its rung

export const SID = 'p4c3p4c3-clio';
export const PID = 4242;
export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const NOW = new Date(2026, 10, 3, 14, 0).getTime();
export const METER = '/home/.claude/shelf/cc-usage-window.json';
export const WATCH = { [`pace:${SID}`]: { since: NOW } };
// the poll this file asks for through X_STASH_POLL_MS: 5× fewer ticks than the live 4 s
export const POLL = 20_000;

export function world(
    on: On,
    initial: Record<string, unknown> = {},
    now = NOW,
    poll = POLL,
) {
    const skipPolls = pollSkip(on, poll);
    const clock = mock.clock(on, { now });
    const store = new Map<string, unknown>(Object.entries(initial));
    const files: Record<string, string> = {
        [`/home/.claude/sessions/${PID}.json`]: JSON.stringify({
            name: '🦉 clio',
            pid: PID,
            sessionId: SID,
        }),
        [THREADS_FILE]: threadsFile([
            { pid: PID, sessionId: SID, ...recordOf('🦉 clio') },
        ]),
    };
    const turns: string[] = [];
    const state = {
        gate: undefined as Promise<void> | undefined,
        isRefused: false,
        refusedKey: undefined as string | undefined,
        refusesRung: false,
    };
    on('store.get', (_$, e) => ({ value: store.get(e.key) }));
    on('store.set', (_$, e) => {
        if (state.refusesRung && e.key.startsWith('pace-rung:'))
            return { deny: 'refused' };
        if (e.key === state.refusedKey) {
            state.refusedKey = undefined;
            return { deny: 'refused' };
        }
        store.set(e.key, e.value);
        return { value: undefined };
    });
    on('store.keys', () => ({ value: [...store.keys()] }));
    on('store.delete', (_$, e) => {
        store.delete(e.key);
        return { value: undefined };
    });
    on('session.id', () => ({ value: SID }));
    on('session.cwd', () => ({ value: '/tmp' }));
    on('session.repo', () => ({
        value: { internal: false, name: null, remote: null, root: '/tmp' },
    }));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('command.run', () => ({ text: '' }));
    on('ui.log', () => ({ value: undefined }));
    on('session.receive', (_$, e) => ({ text: e.text }));
    on('env.get', (_$, e) => ({
        value: e.name === 'X_STASH_POLL_MS' ? String(poll) : '/home',
    }));
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
                ? [
                      {
                          isLink: false,
                          kind: 'file' as const,
                          mtimeMs: 0,
                          name: `${PID}.json`,
                          size: 1,
                      },
                  ]
                : [],
    }));
    on('process.run', (_$, e) => {
        appendLog(files, e.argv);
        return {
            value: {
                exitCode: 0,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout: `${PID}\nMon Oct 12 15:00:00 2026\n`,
            },
        };
    });
    on('tool.register', (_$, e) => ({
        value: { tool: `mcp__x-mod-stash__${e.name}` },
    }));
    on('tool.call', () => ({ result: {}, text: 'done' }));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('turn.complete', () => ({ text: '' }));
    on('classic.Stop', () => ({}));
    on('prompt.submit', async (_$, e) => {
        if (e.origin?.kind !== 'plugin') return { text: e.text };
        if (state.isRefused) return { drop: 'refused' };
        turns.push(e.text);
        await state.gate;
        return { text: e.text };
    });
    const meter = (used: number, left: number, age = 0, at?: number) => {
        const t = at ?? NOW;
        files[METER] = JSON.stringify({
            rate_limits: {
                five_hour: {
                    resets_at: Math.round((t + left) / 1000),
                    used_percentage: used,
                },
            },
            written_at: Math.round((t - age) / 1000),
        });
    };
    const skip = (ms: number) => skipPolls(clock, ms);
    return { clock, files, meter, skip, state, store, turns };
}

export const start = ($: Engine) =>
    $.session.start({ cwd: '/tmp', isInteractive: true, surface: 'desktop' });

// x's thread record carries the role; a seat given none has no record
export const seat = (
    w: ReturnType<typeof world>,
    name: string,
    role?: string,
) => {
    w.files[`/home/.claude/sessions/${PID}.json`] = JSON.stringify({
        name,
        pid: PID,
        sessionId: SID,
    });
    w.files[THREADS_FILE] = threadsFile([
        {
            pid: PID,
            sessionId: SID,
            ...(role ? { display: name, role } : recordOf(name)),
        },
    ]);
};
export const MEMBER = '⚡ 🔧 codie: mods lane 4';

export const endTurn = ($: Engine) =>
    $.turn.complete({
        answer: 'ok',
        durationMs: 1,
        isAborted: false,
        reason: 'answer',
        turnId: 't',
    });

// three hours left is a pace of 40
export const LEFT = 3 * HOUR;
export const paces = (w: ReturnType<typeof world>) =>
    w.turns.filter((t) => t.startsWith('🔋 '));
export const rungs = (w: ReturnType<typeof world>) =>
    paces(w).map((t) => t.match(/^🔋 (.*?):/)?.[1]);

export const settings = ($: Engine) =>
    $.ui.mount({
        component: 'Pane',
        plugin: 'x-mod-stash',
        props: {
            bodyColumns: 80,
            isFocused: false,
            placement: 'dock',
            scroll: { bodyRows: 40, offset: 0 },
            title: '🎛️ settings',
            view: {},
        },
        requestId: 'stash-settings',
        surface: 'desktop',
    } as never);

export const band = ($: Engine) =>
    $.ui.mount({
        component: 'AbovePrompt',
        plugin: 'x-mod-stash',
        props: {
            bodyColumns: 140,
            hasSurvey: false,
            isCollapsed: false,
            isWorking: false,
            maxRows: 12,
            scroll: { bodyRows: 40, offset: 0 },
            view: {},
        },
        surface: 'desktop',
    } as never);
