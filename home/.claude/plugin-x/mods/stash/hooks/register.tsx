/* @jsx h */
import type { Register } from 'claude-code';

import { parseAsks } from './parse.ts';

// Mirrors the ⏳ block of every live session's last reply into $.store (one key per session) and
// draws all of them above the prompt: a quiet one-liner, opened by itself when a new ask lands.
// The reply stays the source of truth; this band only shows it and copies a thread's asks.

type Entry = { label: string; asks: string[]; at: number };

const PREFIX = 'asks:';
const POLL_MS = 4000;
const STALE_MS = 24 * 60 * 60 * 1000;
const MACHINE_ORIGINS = ['peer', 'task-notification', 'scheduled-trigger'];
const ACCENT = '#d97757';

let selfId: string | undefined;
let label = 'session';
let entries: Record<string, Entry> = {};
let known = new Set<string>();
let open = false;
let userTurn = false;
let polling = false;

const fp = (sid: string, ask: string) => `${sid}\u0000${ask}`;
const basename = (path: string) =>
    path.split('/').filter(Boolean).pop() ?? path;

type Store = {
    keys: () => Promise<string[]>;
    get: (k: string) => Promise<unknown>;
};
type Clock = { now: () => Promise<number> };

async function load($: { store: Store; clock: Clock }): Promise<boolean> {
    const now = await $.clock.now();
    const next: Record<string, Entry> = {};
    for (const key of await $.store.keys()) {
        if (!key.startsWith(PREFIX)) continue;
        const v = (await $.store.get(key)) as Entry | undefined;
        if (
            v &&
            Array.isArray(v.asks) &&
            v.asks.length &&
            now - v.at < STALE_MS
        )
            next[key.slice(PREFIX.length)] = v;
    }
    const fresh = Object.entries(next).flatMap(([sid, v]) =>
        v.asks.map((a) => fp(sid, a)),
    );
    const before = JSON.stringify(
        Object.entries(entries).map(([k, v]) => [k, v.asks]),
    );
    const after = JSON.stringify(
        Object.entries(next).map(([k, v]) => [k, v.asks]),
    );
    if (fresh.some((f) => !known.has(f))) open = true;
    known = new Set(fresh);
    entries = next;
    return before !== after;
}

export const register: Register = (on) => {
    // session.start fires at startup and again on every hot reload; the classic event only at startup
    on('session.start', async ($, e, next) => {
        selfId = await $.session.id();
        label = basename(e.cwd);
        await load($);
        if (!polling) {
            polling = true;
            const tick = () =>
                $.clock.after(POLL_MS, async () => {
                    if (await load($)) $.ui.invalidate('ui.render');
                    tick();
                });
            tick();
        }
        return next(e);
    });

    // a turn a peer, a task or a trigger woke is not dima's: its reply may drop the block
    on('prompt.submit', async (_$, e, next) => {
        userTurn =
            e.text.trim().length > 0 &&
            !MACHINE_ORIGINS.includes(e.origin.kind);
        return next(e);
    });

    on('classic.Stop', async ($, e, next) => {
        const r = await next(e);
        selfId ??= e.session_id;
        const asks = parseAsks(e.last_assistant_message ?? '');
        // a reply to dima with no block means nothing is open; a reply woken by a peer keeps the old list
        if (asks !== null || userTurn) {
            const key = PREFIX + e.session_id;
            if (asks?.length)
                await $.store.set(key, {
                    asks,
                    at: await $.clock.now(),
                    label: basename(e.cwd) || label,
                });
            else await $.store.delete(key);
            if (await load($)) $.ui.invalidate('ui.render');
        }
        userTurn = false;
        return r;
    });

    on('session.end', async ($, e, next) => {
        await $.store.delete(PREFIX + e.sessionId);
        return next(e);
    });

    on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
        if (e.surface !== 'terminal' && e.surface !== 'desktop') return next(e);
        const groups = Object.entries(entries).sort(([a], [b]) =>
            a === selfId ? -1 : b === selfId ? 1 : 0,
        );
        const total = groups.reduce((n, [, v]) => n + v.asks.length, 0);
        if (!total) return next(e);
        const { Box, Text, Button } = $.ui.resolve(e);
        const surface = e.surface;
        const counts = groups
            .map(
                ([sid, v]) =>
                    `${sid === selfId ? 'here' : v.label} ${v.asks.length}`,
            )
            .join(', ');
        const toggle = () => {
            open = !open;
            $.ui.invalidate('ui.render');
        };

        const head = (
            <Box flexDirection='row' gap={1}>
                <Text bold color={ACCENT}>
                    ⏳ {total} open
                </Text>
                <Text dimColor>{counts}</Text>
                <Button hotkey='o' key='stash-toggle' onPress={toggle} plain>
                    {open ? 'hide' : 'show'}
                </Button>
            </Box>
        );
        if (!open)
            return (
                <Box flexDirection='column'>
                    {head}
                    {await next(e)}
                </Box>
            );

        const rows = groups.flatMap(([sid, v]) => [
            <Box flexDirection='row' gap={1} key={`g:${sid}`}>
                <Text bold>
                    {sid === selfId ? `${v.label} (here)` : v.label}
                </Text>
                <Button
                    key={`copy:${sid}`}
                    onPress={() =>
                        void $.ui.copy({
                            surface,
                            text: [
                                'lane',
                                ...v.asks.map((a, i) => `${i + 1}. ${a}`),
                            ].join('\n'),
                        })
                    }
                    plain>
                    copy all
                </Button>
            </Box>,
            ...v.asks.map((ask, i) => (
                <Text key={`a:${sid}:${i + 1}`}>
                    {i + 1}. {ask}
                </Text>
            )),
        ]);
        const room = Math.max(1, e.props.maxRows - 1);
        const shown = rows.slice(0, room);
        return (
            <Box flexDirection='column'>
                {head}
                {shown}
                {rows.length > shown.length ? (
                    <Text dimColor>+{rows.length - shown.length} more</Text>
                ) : null}
                {await next(e)}
            </Box>
        );
    });
};
