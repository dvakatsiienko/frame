// a composer brief, linted before it goes out (PK-133): every anchor matches its file exactly once on one
// physical line, and no named path sits under another session's x-mod-holds hold
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

export function parseBrief(text: string) {
    const root =
        text.match(/paths under (\/\S+?)\/?[.\s]/)?.[1] ??
        path.join(homedir(), 'frame');
    const chores: Chore[] = [];
    for (const line of text.split('\n')) {
        const [, n, file] = line.match(/^(\d+)\s+(\S+)/) ?? [];
        if (n && file) {
            chores.push({ anchors: [], n: Number(n), path: file });
            continue;
        }
        const [, old] = line.match(/^- old: (.+)$/) ?? [];
        if (old) chores.at(-1)?.anchors.push(unwrap(old));
    }
    return { chores, root };
}

export function checkBrief(text: string, holds: Map<string, Hold>) {
    const { chores, root } = parseBrief(text);
    const reds: string[] = [];
    if (!/^done:/m.test(text))
        reds.push(
            'the brief has no done: line — composer proves a chore by it',
        );
    for (const chore of chores) {
        const file = path.resolve(root, chore.path);
        if (!existsSync(file)) {
            if (chore.anchors.length)
                reds.push(`${chore.n} ${chore.path}: no such file`);
            continue;
        }
        const body = readFileSync(file, 'utf8');
        for (const anchor of chore.anchors) {
            const count = body.split(anchor).length - 1;
            if (count > 1)
                reds.push(
                    `${chore.n} ${chore.path}: anchor matches ${count} times — «${clip(anchor)}»`,
                );
            else if (count === 0)
                reds.push(
                    `${chore.n} ${chore.path}: anchor ${spansLines(body, anchor) ? 'spans two lines' : 'is missing'} — «${clip(anchor)}»`,
                );
        }
        const hold = holds.get(realpathSync(file).toLowerCase());
        if (hold && !(hold.landed && isClean(root, file)))
            reds.push(
                `${chore.n} ${chore.path}: held by session ${hold.sid.slice(0, 8)} — commit it or wait`,
            );
    }
    return { count: chores.length, reds };
}

export function readHolds(storeDir: string) {
    const holds = new Map<string, Hold>();
    if (!existsSync(storeDir)) return holds;
    for (const name of readdirSync(storeDir)) {
        if (!name.startsWith('x-mod-holds_')) continue;
        const store = JSON.parse(
            readFileSync(path.join(storeDir, name), 'utf8'),
        ) as Record<string, { landed?: boolean }>;
        for (const [key, value] of Object.entries(store)) {
            const [, sid, file] = key.match(/^hold:([^:]+):(.+)$/) ?? [];
            if (sid && file) holds.set(file, { landed: value?.landed, sid });
        }
    }
    return holds;
}

function unwrap(raw: string) {
    const first = raw[0];
    return (first === '`' || first === '"') && raw.at(-1) === first
        ? raw.slice(1, -1)
        : raw;
}

function spansLines(body: string, anchor: string) {
    const flat = (s: string) => s.replace(/\s*\n\s*/g, ' ');
    return flat(body).includes(flat(anchor));
}

function isClean(root: string, file: string) {
    try {
        return (
            execFileSync(
                'git',
                ['-C', root, 'status', '--porcelain', '--', file],
                {
                    encoding: 'utf8',
                },
            ).trim() === ''
        );
    } catch {
        return false;
    }
}

function clip(s: string) {
    return s.length > 60 ? `${s.slice(0, 57)}…` : s;
}

if (import.meta.main) {
    const brief = process.argv[2];
    if (!brief) {
        console.error('usage: node composer-brief-check.ts <brief.md>');
        process.exit(2);
    }
    const store =
        process.env.HOLDS_STORE ??
        path.join(homedir(), '.claude/plugins/store');
    const { count, reds } = checkBrief(
        readFileSync(brief, 'utf8'),
        readHolds(store),
    );
    for (const red of reds) console.log(`🔴 ${red}`);
    console.log(
        `composer-brief-check: ${count} chores, ${reds.length ? `${reds.length} to fix before send` : 'clean'}`,
    );
    if (reds.length) process.exitCode = 1;
}

/* Types */

type Chore = { anchors: string[]; n: number; path: string };
type Hold = { landed?: boolean; sid: string };
