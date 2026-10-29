// the halt's fixed sweeps (inbox reset, github notifications, shelf retention, until-notes list): node halt-sweep.ts [--apply] [--only inbox,notifications,retention,until-notes]; dry run without --apply
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const HQ = join(
    homedir(),
    "Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian Dima's Vault/_hq",
);
const BRANCH_RUN = /for (.+) branch$/;
const PARTS = ['inbox', 'notifications', 'retention', 'until-notes'] as const;
export const UNTIL_NOTE = /until: (FRM|BYT|PK)-[0-9]+/;

function run(command: string, args: string[]): string {
    return execFileSync(command, args, {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
    });
}

function gh(args: string[]): unknown {
    return JSON.parse(run('gh', ['api', ...args]) || 'null');
}

// a content line is anything that is not blank, not the template's own text, and not under a ✅ line;
// a ✅ line covers itself and the indented lines right under it, never an unindented one (a drop typed after the parse);
// a line that sits verbatim in composer's prepped inbox is handled too, a line typed after the prep never is
export function unhandledLines(
    inbox: string,
    template: string,
    prepped = '',
): string[] {
    const own = new Set(template.split('\n').map((line) => line.trim()));
    const preppedLines = new Set(
        prepped
            .split('\n')
            .map((line) => bareLine(line.trim().replace(/^> ?/, ''))),
    );
    let isHandled = false;
    const open: string[] = [];
    for (const line of inbox.split('\n')) {
        const text = line.trim();
        if (!text) {
            isHandled = false;
            continue;
        }
        if (own.has(text)) isHandled = false;
        else if (preppedLines.has(bareLine(text))) continue;
        else if (/^\s*(?:\d+\.|[-*])?\s*✅/.test(text)) isHandled = true;
        else if (!isHandled || !/^\s/.test(line)) {
            isHandled = false;
            open.push(line);
        }
    }
    return open;
}

// a line without its list marker and its «✅ PK-N» stamp: the shape composer's prep holds
const bareLine = (text: string) =>
    text.replace(/^(?:\d+\.|[-*])\s+/, '').replace(/^✅\s+PK-\d+\s+/, '');

function inboxParts(apply: boolean) {
    const composer = join(HQ, 'inbox-composer.md');
    const inbox = join(HQ, 'inbox.md');
    const template = join(HQ, 'inbox-template.md');
    console.log(
        `inbox: reset inbox.md from inbox-template.md · trash inbox-composer.md (${existsSync(composer) ? 'exists' : 'absent'})`,
    );
    const open = unhandledLines(
        readFileSync(inbox, 'utf8'),
        readFileSync(template, 'utf8'),
        existsSync(composer) ? readFileSync(composer, 'utf8') : '',
    );
    if (open.length > 0) {
        console.log(
            `inbox: ${apply ? 'REFUSED' : 'would refuse'}, ${open.length} line(s) without a ✅:`,
        );
        for (const line of open) console.log(`  ${line}`);
        if (apply) process.exitCode = 1;
    }
    if (!apply || open.length > 0) return;
    copyFileSync(template, inbox);
    if (existsSync(composer)) run('trash', [composer]);
}

function hasOpenPr(repo: string, branch: string, call: Gh): boolean {
    const owner = repo.split('/')[0];
    const open = call([
        `repos/${repo}/pulls?state=open&head=${owner}:${encodeURIComponent(branch)}`,
    ]) as unknown[];
    return open.length > 0;
}

export function isSettled(note: Notification, call: Gh = gh): boolean {
    const { type, title, url } = note.subject;
    if (type === 'PullRequest' && url)
        return (call([url]) as { state: string }).state !== 'open';
    const branch = title.match(BRANCH_RUN)?.[1];
    return (
        type === 'CheckSuite' &&
        !!branch &&
        !hasOpenPr(note.repository.full_name, branch, call)
    );
}

function notificationParts(apply: boolean) {
    const notes = (
        gh(['notifications', '--paginate', '--slurp']) as Notification[][]
    ).flat();
    const settled = notes.filter((note) => isSettled(note));
    console.log(
        `github notifications: ${settled.length} of ${notes.length} settled (merged or closed pr, ci run of a branch without an open pr)`,
    );
    for (const note of settled) {
        console.log(
            `  ${note.id} ${note.repository.full_name} · ${note.subject.title}`,
        );
        if (apply)
            gh(['--method', 'PATCH', `notifications/threads/${note.id}`]);
    }
}

function retentionParts(apply: boolean) {
    const shelves = [
        {
            args: ['-name', '*.md', '-mtime', '+30'],
            dir: '~/.claude/shelf/flawlog',
        },
        { args: ['-type', 'f', '-mtime', '+14'], dir: '~/.local/state/looks' },
    ];
    for (const { args, dir } of shelves) {
        const path = dir.replace('~', homedir());
        const old = existsSync(path)
            ? run('find', [path, ...args])
                  .split('\n')
                  .filter(Boolean)
            : [];
        console.log(`retention ${dir}: ${old.length} file(s) to trash`);
        // one trash call per 500 paths: a single argv past the os limit dies with E2BIG
        if (apply)
            for (let i = 0; i < old.length; i += 500)
                run('trash', old.slice(i, i + 500));
    }
}

function untilNotes() {
    const roots = [
        join(homedir(), 'frame/_clio/memory'),
        join(homedir(), '.claude/rules'),
    ];
    let lines: string[] = [];
    try {
        lines = run('rg', ['-n', UNTIL_NOTE.source, ...roots])
            .split('\n')
            .filter(Boolean);
    } catch {} // rg exits 1 on no match
    console.log(
        `until-notes: ${lines.length} line(s), each ticket's state is for the halt to check`,
    );
    for (const line of lines) console.log(`  ${line.slice(0, 200)}`);
}

if (import.meta.main) {
    const { values } = parseArgs({
        options: { apply: { type: 'boolean' }, only: { type: 'string' } },
    });
    const apply = values.apply ?? false;
    const only = values.only?.split(',') ?? [...PARTS];
    const unknown = only.filter(
        (part) => !PARTS.some((known) => known === part),
    );
    if (unknown.length > 0)
        throw new Error(
            `unknown part: ${unknown.join(', ')} (${PARTS.join(', ')})`,
        );
    console.log(apply ? 'APPLY' : 'DRY RUN (pass --apply to act)');
    if (only.includes('inbox')) inboxParts(apply);
    if (only.includes('notifications')) notificationParts(apply);
    if (only.includes('retention')) retentionParts(apply);
    if (only.includes('until-notes')) untilNotes();
}

/* Types */

type Gh = (args: string[]) => unknown;

export interface Notification {
    id: string;
    repository: { full_name: string };
    subject: { title: string; type: string; url?: string };
}
