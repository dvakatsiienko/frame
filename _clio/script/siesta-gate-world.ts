import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { gitEnv } from '../../script/lib/git-fixture.ts';
import type { stop } from './siesta-gate.ts';

export const SID = 's-clio';
export const HOUR = 3_600_000;
export const NON_DIMA = [
    '<cross-session-message from="codie">hi</cross-session-message>',
    '<side-sessions-event>None of the sessions you started</side-sessions-event>',
    '<task-notification><status>completed</status></task-notification>',
    '[Cross-session idle notice] codie went idle',
    '[SYSTEM NOTIFICATION - NOT USER INPUT] a task event',
    '<system-reminder>a fork finished a turn</system-reminder>',
    'x-mod-stash waker: the 5h window reset',
];

export function stamp(at: Date) {
    return at.toLocaleString('sv').replace(' ', 'T');
}

export function fixtureHome() {
    const home = mkdtempSync(join(tmpdir(), 'siesta-'));
    mkdirSync(join(home, '.local/state/clio'), { recursive: true });
    writeFileSync(
        join(home, '.local/state/clio/siesta-last'),
        `${stamp(new Date(Date.now() - HOUR))}\n`,
    );
    const repo = join(home, 'frame');
    mkdirSync(repo);
    spawnSync('git', ['init', '-q'], {
        cwd: repo,
        env: gitEnv(),
        timeout: 10_000,
    });
    return home;
}

export function commit(
    home: string,
    files: number,
    agent: string,
    subject = '🔧 x',
    at = new Date(),
) {
    const repo = join(home, 'frame');
    for (let i = 0; i < files; i++)
        writeFileSync(join(repo, `${agent}-${subject.length}-${i}.txt`), 'x');
    spawnSync('git', ['add', '-A'], {
        cwd: repo,
        env: gitEnv(),
        timeout: 10_000,
    });
    spawnSync(
        'git',
        [
            'commit',
            '-q',
            '-m',
            `${subject}\n\nAgent: ${agent} · Claude Opus 5.5`,
        ],
        {
            cwd: repo,
            env: {
                ...gitEnv(),
                GIT_AUTHOR_DATE: at.toISOString(),
                GIT_COMMITTER_DATE: at.toISOString(),
            },
            timeout: 10_000,
        },
    );
}

function transcript(home: string, ...skills: string[]) {
    const file = join(home, 'transcript.jsonl');
    const rows = [
        { message: { content: 'an older turn' }, type: 'user' },
        {
            message: {
                content: [
                    {
                        input: { skill: 'clio:siesta' },
                        name: 'Skill',
                        type: 'tool_use',
                    },
                ],
            },
            type: 'assistant',
        },
        { message: { content: 'this turn' }, type: 'user' },
        ...skills.map((skill) => ({
            message: {
                content: [
                    { input: { skill }, name: 'Skill', type: 'tool_use' },
                ],
            },
            type: 'assistant',
        })),
    ];
    writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n'));
    return file;
}

export function stopInput(home: string, ...skills: string[]) {
    return {
        session_id: SID,
        stop_hook_active: false,
        transcript_path: transcript(home, ...skills),
    };
}

export function siesta(home: string) {
    return JSON.parse(
        readFileSync(join(home, '.local/state/clio/siesta.json'), 'utf8'),
    );
}

export function writeSiesta(home: string, value: object) {
    writeFileSync(
        join(home, '.local/state/clio/siesta.json'),
        JSON.stringify(value),
    );
}

export function store(home: string, value: object) {
    const dir = join(home, '.claude/plugins/store');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
        join(dir, 'x-mod-stash_inline-0000.json'),
        JSON.stringify(value),
    );
}

export const said = (out: ReturnType<typeof stop>) =>
    out && 'decision' in out
        ? out.reason
        : out?.hookSpecificOutput.additionalContext;

export function run(
    home: string,
    args: string[],
    input = '',
    env: Record<string, string> = {},
) {
    return spawnSync(
        'node',
        [join(import.meta.dirname, 'siesta-gate.ts'), ...args],
        {
            encoding: 'utf8',
            env: { ...gitEnv(), HOME: home, ...env },
            input,
            timeout: 10_000,
        },
    );
}
