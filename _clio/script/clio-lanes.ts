#!/usr/bin/env node
// every clio lane at a glance, read from what each lane already keeps (PK-351:W22, W24, W76)
// usage: node clio-lanes.ts          the view
//        node clio-lanes.ts --hook   SessionStart: the same, silent for a parked sidecar
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const claudeDir = process.env.CLIO_LANES_CLAUDE ?? join(homedir(), '.claude');
const root = process.env.CLIO_LANES_ROOT ?? join(homedir(), 'frame');
const unread: string[] = [];
// inside the hook's 10 s, so a slow tree reads «unread» and the view still prints
const gitDeadline = Date.now() + 7000;

const sessions = readSessions();

if (process.argv.includes('--hook') && isSidecar(readFileSync(0, 'utf8'))) {
    process.exit(0);
}

const store = readStore();
const seats = new Map<string, Seat>();
placeSessions();
placeFlyways();
placeCards();
const orphanTrees = placeTrees();

const blocks = sortedSeats().map(renderSeat);
if (orphanTrees.length > 0) {
    blocks.push(`trees outside a seat:\n${bullets(orphanTrees)}`);
}
if (unread.length > 0) {
    blocks.push(
        `📌 unread, so this view may miss things: ${unread.join(', ')}`,
    );
}
console.log(
    `🛫 every clio lane, read live by \`node ~/frame/_clio/script/clio-lanes.ts\`; a seat's tickets, which this skips: \`x linear list --team FRM --label clio-wing-<N>\`\n\n${blocks.join('\n\n')}`,
);

function readJson(path: string): unknown {
    try {
        return JSON.parse(readFileSync(path, 'utf8'));
    } catch {
        unread.push(path);
        return undefined;
    }
}

function readText(path: string) {
    try {
        return readFileSync(path, 'utf8');
    } catch {
        unread.push(path);
        return '';
    }
}

function listDir(path: string): string[] {
    try {
        return readdirSync(path);
    } catch {
        unread.push(path);
        return [];
    }
}

function readSessions() {
    const dir = join(claudeDir, 'sessions');
    return listDir(dir)
        .filter((file) => file.endsWith('.json'))
        .map((file) => readJson(join(dir, file)) as Session | undefined)
        .filter((session) => session !== undefined);
}

function isSidecar(hookInput: string) {
    const match = /"session_id":\s*"([^"]+)/.exec(hookInput);
    return sessions.some((session) => {
        return session.sessionId === match?.[1] && session.kind === 'bg';
    });
}

function readStore() {
    const dir = join(claudeDir, 'plugins', 'store');
    const files = listDir(dir).filter((file) => {
        return file.startsWith('x-mod-stash_inline-');
    });
    if (files.length === 0) {
        unread.push('the board store');
    }
    const merged: Store = {};
    for (const file of files) {
        Object.assign(merged, readJson(join(dir, file)));
    }
    return merged;
}

function seatKey(name: string | null | undefined) {
    const match = /^🦉🪽? clio(?:: (wing \d+))?$/u.exec(name ?? '');
    return match && (match[1] ?? 'main');
}

function seat(key: string) {
    let found = seats.get(key);
    if (!found) {
        found = { cards: [], flyway: [], key, trees: [] };
        seats.set(key, found);
    }
    return found;
}

function isAlive(session: Session) {
    try {
        process.kill(session.pid, 0);
    } catch {
        return false;
    }
    if (!session.procStart) {
        return true;
    }
    // a pid gets reused, and a stale registry file would then read alive; the registry writes this in utc
    const started = spawnSync('ps', ['-o', 'lstart=', '-p', `${session.pid}`], {
        encoding: 'utf8',
        env: { ...process.env, LC_ALL: 'C', TZ: 'UTC' },
    }).stdout;
    return started.trim() === session.procStart;
}

function placeSessions() {
    for (const session of sessions) {
        const key = seatKey(session.name);
        if (!key || session.kind === 'bg') {
            continue;
        }
        const held = seat(key);
        const isLive = isAlive(session);
        const isNewer =
            session.statusUpdatedAt > (held.session?.statusUpdatedAt ?? 0);
        if (
            !held.session ||
            (isLive && !held.isAlive) ||
            (isLive === held.isAlive && isNewer)
        ) {
            held.session = session;
            held.isAlive = isLive;
        }
    }
}

function placeFlyways() {
    const dir = join(root, '_clio', 'pocket', 'tasks');
    for (const file of listDir(dir)) {
        const text = readText(join(dir, file));
        const key = /^title: ['"]?flyway: (main|wing \d+)['"]?$/m.exec(
            text,
        )?.[1];
        if (!key) {
            continue;
        }
        const open = [...text.matchAll(/^- \[ \] #\d+ (.+)$/gm)].flatMap(
            (match) => {
                return match[1] ?? [];
            },
        );
        seat(key).flyway = [
            ...open.filter((line) => line.startsWith('standing:')),
            ...open.filter((line) => !line.startsWith('standing:')),
        ];
    }
}

function placeCards() {
    const board = readJson(join(claudeDir, 'shelf', 'lanes.json')) as
        | { lanes: Card[] }
        | undefined;
    for (const card of board?.lanes ?? []) {
        // a card with no runner is main's, from before cards named one
        const key = card.runner ? seatKey(card.runner) : 'main';
        if (key && !card.endedAt) {
            seat(key).cards.push(card);
        }
    }
}

function placeTrees() {
    const dir = join(root, '.claude', 'worktrees');
    if (!existsSync(dir)) {
        return [];
    }
    const orphans: string[] = [];
    for (const name of readdirSync(dir)) {
        const wing = /^clio-wing-(\d+)$/.exec(name)?.[1];
        const fork = /^fork-(.+)$/.exec(name)?.[1];
        if (!wing && !fork) {
            continue;
        }
        const line = renderTree(name, join(dir, name));
        const holder = wing
            ? seat(`wing ${wing}`)
            : [...seats.values()].find((held) => {
                  return held.session?.sessionId.startsWith(fork ?? '');
              });
        const other = sessions.find((session) => {
            return session.sessionId.startsWith(fork ?? '\0');
        });
        if (holder) {
            holder.trees.push(line);
        } else {
            orphans.push(other?.name ? `${line}, ${other.name}` : line);
        }
    }
    return orphans;
}

function git(tree: string, ...args: string[]) {
    const timeout = gitDeadline - Date.now();
    if (timeout <= 0) {
        return undefined;
    }
    // a read must never take the index lock from the seat working in that tree
    const run = spawnSync('git', ['--no-optional-locks', '-C', tree, ...args], {
        encoding: 'utf8',
        timeout,
    });
    return run.status === 0 ? run.stdout.trim() : undefined;
}

function renderTree(name: string, tree: string) {
    const counts = git(
        tree,
        'rev-list',
        '--left-right',
        '--count',
        'refs/heads/main...HEAD',
    );
    const dirty = git(tree, 'status', '--porcelain');
    if (counts === undefined || dirty === undefined) {
        return `tree ${name}: unread`;
    }
    const [behind, ahead] = counts.split(/\s+/);
    const edited = dirty === '' ? 0 : dirty.split('\n').length;
    const parts = [
        behind !== '0' && `${behind} behind main`,
        ahead !== '0' && `${ahead} not on main`,
        edited > 0 && `${edited} uncommitted`,
    ].filter(Boolean);
    return `tree ${name}: ${parts.join(', ') || 'level with main, clean'}`;
}

function sortedSeats() {
    const rank = (key: string) => {
        return key === 'main' ? 0 : Number(key.replace('wing ', ''));
    };
    return [...seats.values()].sort((a, b) => rank(a.key) - rank(b.key));
}

function bullets(lines: string[]) {
    return lines.map((line) => `  - ${line}`).join('\n');
}

function renderHead(held: Seat) {
    const name = held.key === 'main' ? '🦉 clio' : `🦉🪽 clio: ${held.key}`;
    if (!held.session || !held.isAlive) {
        return `${name}: dead`;
    }
    const minutes = Math.round(
        (Date.now() - held.session.statusUpdatedAt) / 60_000,
    );
    return `${name}: alive, ${held.session.status} ${minutes} min`;
}

function renderCard(card: Card) {
    const members = Object.values(card.members ?? {}).join(', ');
    const item = card.items[card.current];
    const step = item
        ? `step ${card.current + 1} of ${card.items.length}, ${item.text}`
        : `all ${card.items.length} steps done`;
    return `${card.title}: ${step}${members && `; ${members}`}`;
}

function renderSeat(held: Seat) {
    const sid = held.session?.sessionId;
    const phases = held.isAlive
        ? store[`kept:${sid}`]?.orbit?.plan?.lines
        : undefined;
    const waits = held.isAlive ? store[`reply:${sid}`]?.wait : undefined;
    const parts = [renderHead(held)];
    if (phases?.length) {
        parts.push(`phases:\n${bullets(phases)}`);
    }
    if (waits) {
        parts.push(`waits: ${waits}`);
    }
    if (held.flyway.length > 0) {
        parts.push(
            `${held.isAlive ? 'flyway' : 'flyway, parked'}:\n${bullets(held.flyway)}`,
        );
    }
    if (held.cards.length > 0) {
        parts.push(`lanes:\n${bullets(held.cards.map(renderCard))}`);
    }
    parts.push(...held.trees);
    return parts.join('\n');
}

/* Types */
interface Session {
    kind: string;
    name?: string;
    pid: number;
    procStart?: string;
    sessionId: string;
    status: string;
    statusUpdatedAt: number;
}
interface Card {
    current: number;
    endedAt?: number;
    items: { text: string }[];
    members?: Record<string, string>;
    runner?: string | null;
    title: string;
}
interface Seat {
    cards: Card[];
    flyway: string[];
    isAlive?: boolean;
    key: string;
    session?: Session;
    trees: string[];
}
type Store = Record<
    string,
    { orbit?: { plan?: { lines?: string[] } }; wait?: string }
>;
