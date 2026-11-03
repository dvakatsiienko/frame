import { spawnSync } from 'node:child_process';
import {
    appendFileSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { gitEnv } from '../../script/lib/git-fixture.ts';
import { compact, prompt, stop } from './siesta-gate.ts';

const SID = 's-clio';
const HOUR = 3_600_000;
const NON_DIMA = [
    '<cross-session-message from="codie">hi</cross-session-message>',
    '<side-sessions-event>None of the sessions you started</side-sessions-event>',
    '<task-notification><status>completed</status></task-notification>',
    '[Cross-session idle notice] codie went idle',
    '[SYSTEM NOTIFICATION - NOT USER INPUT] a task event',
    '<system-reminder>a fork finished a turn</system-reminder>',
    'x-mod-stash waker: the 5h window reset',
];

function stamp(at: Date) {
    return at.toLocaleString('sv').replace(' ', 'T');
}

function fixtureHome() {
    const home = mkdtempSync(join(tmpdir(), 'siesta-'));
    mkdirSync(join(home, '.local/state/clio'), { recursive: true });
    writeFileSync(
        join(home, '.local/state/clio/siesta-last'),
        `${stamp(new Date(Date.now() - HOUR))}\n`,
    );
    const repo = join(home, 'frame');
    mkdirSync(repo);
    spawnSync('git', ['init', '-q'], { cwd: repo, env: gitEnv() });
    return home;
}

function commit(home: string, files: number, agent: string, subject = '🔧 x') {
    const repo = join(home, 'frame');
    for (let i = 0; i < files; i++)
        writeFileSync(join(repo, `${agent}-${subject.length}-${i}.txt`), 'x');
    spawnSync('git', ['add', '-A'], { cwd: repo, env: gitEnv() });
    spawnSync(
        'git',
        [
            'commit',
            '-q',
            '-m',
            `${subject}\n\nAgent: ${agent} · Claude Opus 5.5`,
        ],
        { cwd: repo, env: gitEnv() },
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

function stopInput(home: string, ...skills: string[]) {
    return {
        session_id: SID,
        stop_hook_active: false,
        transcript_path: transcript(home, ...skills),
    };
}

function siesta(home: string) {
    return JSON.parse(
        readFileSync(join(home, '.local/state/clio/siesta.json'), 'utf8'),
    );
}

function writeSiesta(home: string, value: object) {
    writeFileSync(
        join(home, '.local/state/clio/siesta.json'),
        JSON.stringify(value),
    );
}

function store(home: string, value: object) {
    const dir = join(home, '.claude/plugins/store');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
        join(dir, 'x-mod-stash_inline-0000.json'),
        JSON.stringify(value),
    );
}

const said = (out: ReturnType<typeof stop>) =>
    out && 'decision' in out
        ? out.reason
        : out?.hookSpecificOutput.additionalContext;

describe('the siesta comes due', () => {
    test('15 files of clio’s block the first stop of the epoch, then warn', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        const first = stop(home, stopInput(home), true);
        expect(first).toMatchObject({ decision: 'block' });
        expect(said(first)).toContain('siesta due');
        const second = stop(home, stopInput(home), true);
        expect(second).not.toHaveProperty('decision');
        expect(said(second)).toContain('siesta due');
    });

    test('warn-only, the first stop also only warns', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        const out = stop(home, stopInput(home));
        expect(out).not.toHaveProperty('decision');
        expect(said(out)).toContain('siesta due');
    });

    test('a turn that loaded clio:siesta is not nudged', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        expect(
            stop(home, stopInput(home, 'clio:siesta'), true),
        ).toBeUndefined();
    });

    test('an open siesta counts nothing due', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        writeSiesta(home, { card_printed: false, highs: [], open: true });
        expect(stop(home, stopInput(home), true)).toBeUndefined();
    });

    test('a block never fires while the stop hook is already active', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        const out = stop(
            home,
            { ...stopInput(home), stop_hook_active: true },
            true,
        );
        expect(out).not.toHaveProperty('decision');
    });

    test('14 files, another agent’s, or the pocket’s auto commits make none due', () => {
        const home = fixtureHome();
        commit(home, 14, 'clio');
        commit(home, 5, 'clio-side');
        commit(home, 5, 'codie');
        commit(home, 5, 'clio', '📜 pocket: pk-1 (auto)');
        expect(stop(home, stopInput(home), true)).toBeUndefined();
    });

    test('a phases-done row after the last siesta makes it due, an older one none', () => {
        const home = fixtureHome();
        const rows = join(home, '.local/state/clio/phases-done.jsonl');
        writeFileSync(
            rows,
            `${JSON.stringify({ at: new Date(Date.now() - 2 * HOUR).toISOString(), line: 'old' })}\n`,
        );
        expect(stop(home, stopInput(home), true)).toBeUndefined();
        appendFileSync(
            rows,
            `${JSON.stringify({ at: new Date().toISOString(), line: 'FRM-1 built' })}\n`,
        );
        expect(said(stop(home, stopInput(home), true))).toContain('siesta due');
    });

    test.each([
        '[done] FRM-1 shipped, look card on the ticket',
        'final 1a2b3c4 — local review clean',
    ])('a member’s ping «%s» makes it due', (ping) => {
        const home = fixtureHome();
        prompt(home, {
            prompt: `<cross-session-message from="codie">\n${ping}\n</cross-session-message>`,
        });
        expect(said(stop(home, stopInput(home), true))).toContain('siesta due');
    });

    test('a member’s progress line makes none due', () => {
        const home = fixtureHome();
        prompt(home, {
            prompt: '<cross-session-message from="codie">\n[progress] step 2 of FRM-1 done\n</cross-session-message>',
        });
        expect(stop(home, stopInput(home), true)).toBeUndefined();
    });
});

describe('the siesta closes on dima’s word', () => {
    test.each(NON_DIMA)('an open siesta stays open on «%s»', (text) => {
        const home = fixtureHome();
        writeSiesta(home, { card_printed: true, highs: [], open: true });
        prompt(home, { prompt: text });
        expect(siesta(home)).toMatchObject({ last_turn: 'other', open: true });
    });

    test('his prompt after the card closes it, a reminder before it never deciding', () => {
        const home = fixtureHome();
        writeSiesta(home, { card_printed: true, highs: [], open: true });
        prompt(home, {
            prompt: '<system-reminder>a fork finished</system-reminder>\ngo on',
        });
        expect(siesta(home)).toMatchObject({ last_turn: 'dima', open: false });
    });

    test('his prompt before the card leaves it open', () => {
        const home = fixtureHome();
        writeSiesta(home, { card_printed: false, highs: [], open: true });
        prompt(home, { prompt: 'how is it going' });
        expect(siesta(home).open).toBe(true);
    });

    test('afk, an open high keeps it open; fixed or parked with a why closes it', () => {
        const home = fixtureHome();
        store(home, { afk: { on: true } });
        const card = (state: string, why?: string) =>
            writeSiesta(home, {
                card_printed: true,
                highs: [{ state, text: 'a hole', ...(why ? { why } : {}) }],
                open: true,
            });
        card('open');
        prompt(home, { prompt: 'still there?' });
        expect(siesta(home).open).toBe(true);
        card('parked');
        prompt(home, { prompt: 'still there?' });
        expect(siesta(home).open).toBe(true);
        card('parked', 'FRM-9 holds it');
        prompt(home, { prompt: 'still there?' });
        expect(siesta(home).open).toBe(false);
        card('fixed');
        prompt(home, { prompt: 'still there?' });
        expect(siesta(home).open).toBe(false);
    });

    test('afk, a settled card closes at her own turn end', () => {
        const home = fixtureHome();
        store(home, { afk: { on: true } });
        writeSiesta(home, {
            card_printed: true,
            highs: [{ state: 'fixed', text: 'a hole' }],
            open: true,
        });
        stop(home, stopInput(home), true);
        expect(siesta(home).open).toBe(false);
    });

    test('the 11-02 shape: three member turns, one block, closed only by him', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        const outs = [0, 1, 2].map(() => {
            prompt(home, { prompt: NON_DIMA[0] ?? '' });
            return stop(home, stopInput(home), true);
        });
        expect(outs.map((o) => o && 'decision' in o)).toEqual([
            true,
            false,
            false,
        ]);
        expect(outs.every((o) => said(o)?.includes('siesta due'))).toBe(true);
        run(home, ['open']);
        run(home, ['card']);
        prompt(home, { prompt: NON_DIMA[0] ?? '' });
        expect(siesta(home).open).toBe(true);
        prompt(home, { prompt: 'ok, next' });
        expect(siesta(home).open).toBe(false);
    });
});

describe('a delivered tick is resolved', () => {
    const ask = (id: string, isLocked: boolean) => ({
        id,
        pick: 'yes',
        text: 'an ask',
        ...(isLocked ? { isLocked } : {}),
    });

    test('a delivered, unresolved tick is named', () => {
        const home = fixtureHome();
        store(home, {
            [`asks:${SID}`]: { items: [ask('o7', true), ask('o8', false)] },
        });
        const out = stop(home, stopInput(home), true);
        expect(said(out)).toContain('o7');
        expect(said(out)).not.toContain('o8');
        expect(out).not.toHaveProperty('decision');
    });

    test('another session’s tick and a resolved one warn nothing', () => {
        const home = fixtureHome();
        store(home, { 'asks:s-other': { items: [ask('o7', true)] } });
        expect(stop(home, stopInput(home), true)).toBeUndefined();
    });

    test('a due siesta and a tick print one line naming both, 3 stops in a row', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        store(home, { [`asks:${SID}`]: { items: [ask('o7', true)] } });
        for (let i = 0; i < 3; i++) {
            const line = said(stop(home, stopInput(home), true)) ?? '';
            expect(line.split('\n')).toHaveLength(1);
            expect(line).toContain('siesta due');
            expect(line).toContain('o7');
        }
    });
});

describe('a compaction is logged', () => {
    test('one line per compaction, with its time', () => {
        const home = fixtureHome();
        compact(home, { session_id: SID, trigger: 'auto' });
        const log = join(home, '.local/state/clio/compactions.log');
        const lines = readFileSync(log, 'utf8').trim().split('\n');
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d/);
        compact(home, { session_id: SID, trigger: 'manual' });
        expect(readFileSync(log, 'utf8').trim().split('\n')).toHaveLength(2);
    });
});

describe('the cli', () => {
    test('stop reads the hook json on stdin and prints its verdict', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        const out = run(home, ['stop'], JSON.stringify(stopInput(home)));
        expect(out.status).toBe(0);
        expect(JSON.parse(out.stdout)).toMatchObject({
            hookSpecificOutput: { hookEventName: 'Stop' },
        });
    });

    test('open stamps siesta-last and opens; card marks it printed with its highs', () => {
        const home = fixtureHome();
        run(home, ['open']);
        expect(siesta(home)).toMatchObject({ card_printed: false, open: true });
        expect(existsSync(join(home, '.local/state/clio/siesta-last'))).toBe(
            true,
        );
        run(home, ['card', 'a hole', 'a gap']);
        expect(siesta(home)).toMatchObject({
            card_printed: true,
            highs: [
                { state: 'open', text: 'a hole' },
                { state: 'open', text: 'a gap' },
            ],
        });
        run(home, ['high', '2', 'parked', 'FRM-9 holds it']);
        expect(siesta(home).highs[1]).toEqual({
            state: 'parked',
            text: 'a gap',
            why: 'FRM-9 holds it',
        });
    });
});

function run(home: string, args: string[], input = '') {
    return spawnSync(
        'node',
        [join(import.meta.dirname, 'siesta-gate.ts'), ...args],
        { encoding: 'utf8', env: { ...gitEnv(), HOME: home }, input },
    );
}
