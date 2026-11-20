import type { On } from 'claude-code';
import { type Engine, mock } from 'claude-code/testing';

import {
    THREADS_FILE,
    type ThreadRow,
    recordOf,
    threadsFile,
} from './threads.ts';

// the glide tests' shared world: one engine mock of the stash with its registry, store, files and x runs
export const SID = 'l1l1l1l1-lane';
export const TOOL = 'mcp__x-mod-stash__orbit';
export const FILE = '/home/.claude/shelf/lanes.json';
export const PID = 4242;
export const CLIO = '🦉 clio';

export function world(
    on: On,
    {
        files = {},
        name = CLIO,
        record = recordOf(name),
        peers = [],
    }: {
        files?: Record<string, string>;
        name?: string;
        // x's record for this session: its role and display, none for a session x never recorded
        record?: Omit<ThreadRow, 'sessionId'>;
        // other live sessions in the registry, as cc writes their files
        peers?: Record<string, unknown>[];
    } = {},
) {
    const contexts: string[][] = [];
    const texts: string[] = [];
    // `x lane plan-steps <path>`'s answer per plan path; a path with none fails the run, as x would
    const steps: Record<string, unknown[] | undefined> = {};
    const planRuns: string[] = [];
    // `x lane show <lane> --json`'s record per lane; a lane with none fails the run, as x would
    const shows: Record<string, unknown> = {};
    const showRuns: string[] = [];
    files[`/home/.claude/sessions/${PID}.json`] = JSON.stringify({
        name,
        pid: PID,
        sessionId: SID,
    });
    for (const p of peers)
        files[`/home/.claude/sessions/${p.pid}.json`] = JSON.stringify(p);
    files[THREADS_FILE] ??= threadsFile([
        { pid: PID, sessionId: SID, ...record },
    ]);
    const clock = mock.clock(on, {
        now: new Date(2026, 9, 11, 18, 30).getTime(),
    });
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
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('session.end', (_$, e) => ({ sessionId: e.sessionId }));
    on('session.repo', () => ({
        value: { internal: false, name: null, remote: null, root: '/tmp' },
    }));
    on('process.run', (_$, e) => {
        if (e.argv[1] === 'lane' && e.argv[2] === 'show') {
            showRuns.push(e.argv[3] ?? '');
            const record = shows[e.argv[3] ?? ''];
            return {
                value: {
                    exitCode: record ? 0 : 1,
                    isStderrTruncated: false,
                    isStdoutTruncated: false,
                    stderr: '',
                    stdout: JSON.stringify(
                        record
                            ? { data: record, ok: true }
                            : { error: 'no live thread', ok: false },
                    ),
                },
            };
        }
        if (e.argv[1] === 'lane' && e.argv[2] === 'plan-steps') {
            const path = e.argv[3] ?? '';
            planRuns.push(path);
            const answer = steps[path];
            return {
                value: {
                    exitCode: answer ? 0 : 1,
                    isStderrTruncated: false,
                    isStdoutTruncated: false,
                    stderr: '',
                    stdout: JSON.stringify(
                        answer
                            ? { data: { plan: path, steps: answer }, ok: true }
                            : { error: 'x failed', ok: false },
                    ),
                },
            };
        }
        return {
            value: {
                exitCode: 0,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout:
                    e.argv[0] === 'ps'
                        ? [PID, ...peers.map((p) => p.pid)].join('\n')
                        : `${PID}\nSat Oct 11 18:00:00 2026\n`,
            },
        };
    });
    // a file's mtime moves with its text, so a rewrite reads as a change and an untouched file as none
    const mtimeOf = (text: string) =>
        [...text].reduce((h, c) => (h * 31 + (c.codePointAt(0) ?? 0)) % 1e9, 7);
    on('fs.list', (_$, e) => ({
        value:
            e.path === '/home/.claude/sessions'
                ? [PID, ...peers.map((p) => p.pid)].map((pid) => ({
                      isLink: false,
                      kind: 'file' as const,
                      mtimeMs: 0,
                      name: `${pid}.json`,
                      size: 1,
                  }))
                : Object.keys(files)
                      .filter((f) => f.slice(0, f.lastIndexOf('/')) === e.path)
                      .map((f) => ({
                          isLink: false,
                          kind: 'file' as const,
                          mtimeMs: mtimeOf(files[f] ?? ''),
                          name: f.slice(f.lastIndexOf('/') + 1),
                          size: 1,
                      })),
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
    on('tool.register', (_$, e) => ({
        value: { tool: `mcp__x-mod-stash__${e.name}` },
    }));
    on('prompt.submit', (_$, e) => {
        contexts.push([...(e.context ?? [])]);
        texts.push(e.text);
        return { text: e.text };
    });
    on('turn.complete', () => ({ text: '' }));
    on('classic.Stop', () => ({}));
    on('tool.call', () => ({ result: {}, text: 'done' }));
    return {
        clock,
        contexts,
        files,
        planRuns,
        showRuns,
        shows,
        steps,
        store,
        texts,
    };
}

export const start = ($: Engine) =>
    $.session.start({ cwd: '/tmp', isInteractive: true, surface: 'desktop' });
export const lane = ($: Engine, input: Record<string, unknown>) =>
    $.tool.call({ op: 'glide', tool: TOOL, ...input } as never);
export const create = ($: Engine, input: Record<string, unknown> = {}) =>
    lane($, { act: 'create', items: ITEMS, title: 'mods settings', ...input });
export const ITEMS = [
    { text: 'shape the settings pane' },
    { text: 'the board in cards', ticket: 'FRM-391' },
    { text: 'guard rules' },
];
export const kept = (w: ReturnType<typeof world>) =>
    (JSON.parse(w.files[FILE] ?? '{"lanes":[]}') as { lanes: KeptLane[] })
        .lanes;
export const shelf = (...lanes: KeptLane[]) => ({
    [FILE]: JSON.stringify({ lanes }),
});
export const keptLane = (over: Partial<KeptLane> = {}): KeptLane => ({
    current: 0,
    history: [],
    id: 'l1',
    items: [
        { isDone: false, text: 'a' },
        { isDone: false, text: 'b' },
    ],
    members: {},
    movedAt: 0,
    title: 'kept',
    ...over,
});

/* exit 3 — the members' asks on the card */

export const CODIE = 'c0c0c0c0-codie';
/* Types */

export interface KeptLane {
    runner?: string;
    id: string;
    title: string;
    ticket?: string;
    items: { isDone: boolean; text: string; ticket?: string }[];
    current: number;
    movedAt: number;
    members: Record<string, string>;
    linkedIds?: Record<string, string>;
    steer?: string;
    isSteerTaken?: boolean;
    plan?: string;
    isPlanGone?: boolean;
    isPlanStale?: boolean;
    history: {
        act: string;
        at: number;
        by?: string;
        current: number;
        done: number;
    }[];
    endedAt?: number;
}

/* rider (clio's wisp, 18:01): a member is linked by its registry name, so its asks survive a /clear */

export const CODIE_NAME = '☕️ 🔧 codie: mods';
export const codieAt = (
    sessionId: string,
    more: Record<string, unknown> = {},
) => ({
    hostSessionId: 'local_94d65a2a',
    name: CODIE_NAME,
    pid: 5001,
    sessionId,
    ...more,
});

/* FRM-429 exit 1 — a glide card linked to its lane plan file moves on its own */

export const PLAN = '/home/.local/state/x/lanes/mods/lane-plan.md';
// a step as the test gives it: its mark, its ticket, its text
export type Step = readonly [
    mark: string,
    ticket: string | undefined,
    text: string,
];
export const marked = (marks: string): Step[] =>
    marks.split('').map((m, i) => [m, 'FRM-1', `step ${i + 1}`]);
// the plan file and `x lane plan-steps`' answer for it, both drawn from one list: the parse is x's, tested in x/go
export const plant = (
    w: ReturnType<typeof world>,
    steps: Step[],
    path = PLAN,
) => {
    w.files[path] = steps
        .map(
            ([m, t, text], i) =>
                `- [${m}] ${String(i + 1).padStart(2, '0')} · ${t ? `${t} ` : ''}${text}`,
        )
        .join('\n');
    w.steps[path] = steps.map(([m, t, text]) => ({
        done: m !== ' ',
        text,
        ...(t ? { ticket: t } : {}),
    }));
};
export const poll = (w: ReturnType<typeof world>) => w.clock.advance(5_000);
