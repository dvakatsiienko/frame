import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { LANES_SHELF } from './lanes-shelf.ts';
import { THREADS_FILE, recordOf, threadsFile } from './threads.ts';

// the writer's half of the lanes.json contract (FRM-659): every field the stash writes is one the shared fixture holds,
// so the deck's reader test runs against the shape this mod really writes
const SID = 's1s1s1s1-shelf';
const PID = 4343;
const FILE = '/home/.claude/shelf/lanes.json';

function world(on: On) {
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
    mock.clock(on, { now: new Date(2026, 10, 19, 14, 30).getTime() });
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
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('session.repo', () => ({
        value: { internal: false, name: null, remote: null, root: '/tmp' },
    }));
    on('process.run', (_$, e) => ({
        value: {
            exitCode: 0,
            isStderrTruncated: false,
            isStdoutTruncated: false,
            stderr: '',
            stdout: e.argv[0] === 'ps' ? `${PID}` : '',
        },
    }));
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
    on('tool.call', () => ({ result: {}, text: 'done' }));
    return files;
}

const glide = ($: Engine, input: Record<string, unknown>) =>
    $.tool.call({
        op: 'glide',
        tool: 'mcp__x-mod-stash__orbit',
        ...input,
    } as never);

const keysOf = (rows: object[]) => new Set(rows.flatMap((r) => Object.keys(r)));

test('every field the stash writes to lanes.json is in the shared fixture', async ($, on) => {
    const files = world(on);
    await $.session.start({
        cwd: '/tmp',
        isInteractive: true,
        surface: 'desktop',
    });
    await glide($, {
        act: 'create',
        items: [{ text: 'one', ticket: 'FRM-1' }, { text: 'two' }],
        // a title naming a ticket makes the lane's own ticket field
        title: 'herdr — FRM-1 kept',
    });
    await glide($, { act: 'step', current: 1, id: 'l1' });
    await glide($, {
        act: 'create',
        items: [{ text: 'three' }],
        title: 'ended',
    });
    await glide($, { act: 'end', id: 'l2' });
    const written = (JSON.parse(files[FILE] ?? '{}') as typeof LANES_SHELF)
        .lanes;
    const shelf = LANES_SHELF.lanes;
    const missing = (have: Set<string>, wrote: Set<string>) =>
        [...wrote].filter((k) => !have.has(k));
    expect([
        written.length,
        missing(keysOf(shelf), keysOf(written)),
        missing(
            keysOf(shelf.flatMap((l) => l.items)),
            keysOf(written.flatMap((l) => l.items)),
        ),
    ]).toEqual([2, [], []]);
});
