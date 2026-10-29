// dima's own typed lines (and orbit steers) from a session transcript: node chat-lines.ts [--transcript <jsonl>] [--since-stamp]
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { liveSessions, transcriptOf } from './session-registry.ts';

const CCLIO_NAME = '🦉 cclio';
const MAX_CHARS = 300;
const STAMP = '📄 last report:';
const STEER = /^- (o\d+) .*his steer: «(.*?)»(?: ·|$)/;

// «Side chat» sessions write to the same project dir, so the live «🦉 cclio» session is asked first
function defaultTranscript(): string {
    const live = liveSessions().find((session) => session.name === CCLIO_NAME);
    const own = live && transcriptOf(live.sessionId);
    if (own) return own;
    console.error(
        `no live «${CCLIO_NAME}» session: using the newest transcript`,
    );
    // read-both: the live dir since the 10-29 move, and the old one for history
    const files = ['-Users-dima-frame--clio', '-Users-dima-frame-cclio']
        .map((d) => join(homedir(), '.claude/projects', d))
        .filter((dir) => existsSync(dir))
        .flatMap((dir) =>
            readdirSync(dir)
                .filter((name) => name.endsWith('.jsonl'))
                .map((name) => join(dir, name)),
        );
    return (
        files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0] ?? ''
    );
}

function textOf(entry: Entry): string {
    return blocksText(entry.message?.content ?? '');
}

// a prompt carrying an image arrives as content blocks, not a string
function blocksText(content: string | Block[]): string {
    if (typeof content === 'string') return content;
    return content.map((block) => block.text ?? '').join('\n');
}

// the human's own words: a typed turn, or a line typed while a turn ran (a queued command)
function typedOf(entry: Entry): string {
    const queued = entry.attachment;
    const raw =
        entry.type === 'user' && entry.origin?.kind === 'human'
            ? textOf(entry)
            : queued?.type === 'queued_command' &&
                queued.origin?.kind === 'human'
              ? blocksText(queued.prompt ?? '')
              : '';
    const args = raw.match(/<command-args>([\s\S]*?)<\/command-args>/);
    if (args) return (args[1] ?? '').trim();
    return /^<(command-|local-command)/.test(raw) ? '' : raw.trim();
}

export function steersOf(entry: Entry): { id: string; text: string }[] {
    const content = entry.attachment?.content;
    return (Array.isArray(content) ? content : []).flatMap((chunk) =>
        chunk.split('\n').flatMap((row) => {
            const found = row.match(STEER);
            return found?.[1] && found[2]
                ? [{ id: found[1], text: found[2] }]
                : [];
        }),
    );
}

function lastStamp(entries: Entry[]): string {
    return (
        entries.findLast(
            (entry) =>
                entry.type === 'assistant' && textOf(entry).includes(STAMP),
        )?.timestamp ?? ''
    );
}

function clock(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

function show(iso: string, text: string, isFull: boolean): string {
    const flat = text.replaceAll('\n', '⏎');
    return `${clock(iso)} · ${isFull || flat.length <= MAX_CHARS ? flat : `${flat.slice(0, MAX_CHARS)}…`}`;
}

if (import.meta.main) {
    const { values } = parseArgs({
        options: {
            'since-stamp': { type: 'boolean' },
            transcript: { type: 'string' },
        },
    });
    const isFull = values['since-stamp'] ?? false;
    const path = values.transcript ?? defaultTranscript();
    const entries = readFileSync(path, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((row) => JSON.parse(row) as Entry);
    const after = values['since-stamp'] ? lastStamp(entries) : '';
    const seen = new Set<string>();
    for (const entry of entries) {
        const at = entry.timestamp ?? '';
        if (!at || at <= after) continue;
        const typed = typedOf(entry);
        if (typed) console.log(show(at, typed, isFull));
        for (const { id, text } of steersOf(entry)) {
            if (seen.has(id + text)) continue;
            seen.add(id + text);
            console.log(show(at, `[${id} steer] ${text}`, isFull));
        }
    }
}

/* Types */

interface Block {
    text?: string;
    type: string;
}

interface Entry {
    attachment?: {
        content?: string | string[];
        origin?: { kind?: string };
        prompt?: string | Block[];
        type?: string;
    };
    message?: { content?: string | Block[] };
    origin?: { kind?: string };
    timestamp?: string;
    type: string;
}
