import { spawnSync } from 'node:child_process';
import {
    appendFileSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { gitEnv } from '../../script/lib/git-fixture.ts';
import { compact, gate, prompt, stop } from './siesta-gate.ts';

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

function commit(
    home: string,
    files: number,
    agent: string,
    subject = '🔧 x',
    at = new Date(),
) {
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
        {
            cwd: repo,
            env: {
                ...gitEnv(),
                GIT_AUTHOR_DATE: at.toISOString(),
                GIT_COMMITTER_DATE: at.toISOString(),
            },
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
    test('15 files of clio’s block the first stop of the epoch, then stay quiet', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        const first = stop(home, stopInput(home));
        expect(first).toMatchObject({ decision: 'block' });
        expect(said(first)).toContain('siesta due');
        expect(stop(home, stopInput(home))).toBeUndefined();
    });

    test('a new epoch nudges again', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio', '🔧 x', new Date(Date.now() - 60_000));
        stop(home, stopInput(home));
        run(home, ['open']);
        stop(home, stopInput(home));
        writeSiesta(home, { ...siesta(home), open: false });
        commit(
            home,
            15,
            'clio',
            '🐞 another batch',
            new Date(Date.now() + 5000),
        );
        expect(stop(home, stopInput(home))).toMatchObject({
            decision: 'block',
        });
    });

    test('a turn that loaded clio:siesta is not nudged', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        expect(stop(home, stopInput(home, 'clio:siesta'))).toBeUndefined();
    });

    test('a siesta waiting on his word counts nothing due', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        writeSiesta(home, { card_printed: true, highs: [], open: true });
        expect(stop(home, stopInput(home))).toBeUndefined();
    });

    test('a siesta opened but never carded is nudged by its next batch', () => {
        const home = fixtureHome();
        writeSiesta(home, { card_printed: false, highs: [], open: true });
        commit(home, 15, 'clio');
        expect(said(stop(home, stopInput(home)))).toContain('siesta due');
    });

    test('a skill load followed by its tool result and its meta text still counts as this turn’s', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        const input = stopInput(home, 'clio:siesta');
        appendFileSync(
            input.transcript_path,
            `\n${JSON.stringify({ message: { content: [{ type: 'tool_result' }] }, type: 'user' })}\n${JSON.stringify({ isMeta: true, message: { content: [{ text: 'Base directory for this skill', type: 'text' }] }, type: 'user' })}`,
        );
        expect(stop(home, input)).toBeUndefined();
    });

    test('odd files never crash the hook', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        const dir = join(home, '.local/state/clio');
        writeFileSync(join(dir, 'phases-done.jsonl'), '{"at": "2026-\n');
        writeFileSync(join(dir, 'siesta-last'), 'garbage\n');
        const input = stopInput(home);
        appendFileSync(input.transcript_path, '\n{"type": "us');
        mkdirSync(join(home, '.claude/plugins/store'), { recursive: true });
        writeFileSync(
            join(home, '.claude/plugins/store/x-mod-stash_inline-0000.json'),
            'null',
        );
        expect(said(stop(home, input))).toContain('siesta due');
        expect(prompt(home, { prompt: 'go on' })).toContain('siesta due');
    });

    test('nothing prints while the stop hook is already active, and the epoch’s nudge waits', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        const active = { ...stopInput(home), stop_hook_active: true };
        expect(stop(home, active)).toBeUndefined();
        expect(stop(home, stopInput(home))).toMatchObject({
            decision: 'block',
        });
    });

    test.each([
        '_clio/memory/craft-pm.md',
        'home/.claude/rules/code.md',
        '_clio/plugin-clio/skills/boot/SKILL.md',
    ])('one file of clio’s at «%s» makes it due', (file) => {
        const home = fixtureHome();
        const repo = join(home, 'frame');
        mkdirSync(join(repo, file, '..'), { recursive: true });
        writeFileSync(join(repo, file), 'x');
        commit(home, 0, 'clio');
        expect(said(stop(home, stopInput(home)))).toContain(
            'memory, rule or skill',
        );
    });

    test('another agent’s memory file makes none due', () => {
        const home = fixtureHome();
        const repo = join(home, 'frame');
        mkdirSync(join(repo, '_clio/memory'), { recursive: true });
        writeFileSync(join(repo, '_clio/memory/craft-pm.md'), 'x');
        commit(home, 0, 'codie');
        expect(stop(home, stopInput(home))).toBeUndefined();
    });

    test('14 files, another agent’s, or the pocket’s auto commits make none due', () => {
        const home = fixtureHome();
        commit(home, 14, 'clio');
        commit(home, 5, 'clio-side');
        commit(home, 5, 'codie');
        commit(home, 5, 'clio', '📜 pocket: pk-1 (auto)');
        expect(stop(home, stopInput(home))).toBeUndefined();
    });

    test('a phases-done row after the last siesta makes it due, an older one none', () => {
        const home = fixtureHome();
        const rows = join(home, '.local/state/clio/phases-done.jsonl');
        writeFileSync(
            rows,
            `${JSON.stringify({ at: new Date(Date.now() - 2 * HOUR).toISOString(), line: 'old' })}\n`,
        );
        expect(stop(home, stopInput(home))).toBeUndefined();
        appendFileSync(
            rows,
            `${JSON.stringify({ at: new Date().toISOString(), line: 'FRM-1 built' })}\n`,
        );
        expect(said(stop(home, stopInput(home)))).toContain('siesta due');
    });

    test.each([
        '[done] FRM-1 shipped, look card on the ticket',
        'final 1a2b3c4 — local review clean',
        'final main:231772ad f104a04d',
        '#12 f104a04 final',
    ])('a member’s ping «%s» makes it due', (ping) => {
        const home = fixtureHome();
        prompt(home, {
            prompt: `<cross-session-message from="uds:/tmp/cc-socks/1.sock" from-name="⚡ 🔧 codie: clio-lean | FRM-1">\n${ping}\n</cross-session-message>`,
        });
        expect(said(stop(home, stopInput(home)))).toContain('siesta due');
    });

    test.each([
        '⚡ 🔎 sixth sense: clio-lean | main',
        '🌗 🎨 designer: speak | BYT-1',
    ])('a done ping from «%s» makes it due', (name) => {
        const home = fixtureHome();
        prompt(home, {
            prompt: `<cross-session-message from="uds:/tmp/cc-socks/1.sock" from-name="${name}">\n[done] round 3 clean\n</cross-session-message>`,
        });
        expect(said(stop(home, stopInput(home)))).toContain('siesta due');
    });

    test.each(['🎀 helga', '🦉 clio (side)', '🐦 ⬛ crow'])(
        'a done ping from «%s» makes none due',
        (name) => {
            const home = fixtureHome();
            prompt(home, {
                prompt: `<cross-session-message from="uds:/tmp/cc-socks/1.sock" from-name="${name}">\n[done] chore 4: pocket write\n</cross-session-message>`,
            });
            expect(stop(home, stopInput(home))).toBeUndefined();
        },
    );

    test('a member’s «final draft» line makes none due', () => {
        const home = fixtureHome();
        prompt(home, {
            prompt: '<cross-session-message from-name="⚡ 🔧 codie: x">\nfinal draft attached\n</cross-session-message>',
        });
        expect(stop(home, stopInput(home))).toBeUndefined();
    });

    test('a member’s progress line makes none due', () => {
        const home = fixtureHome();
        prompt(home, {
            prompt: '<cross-session-message from="codie">\n[progress] step 2 of FRM-1 done\n</cross-session-message>',
        });
        expect(stop(home, stopInput(home))).toBeUndefined();
    });
});

describe('an ignored siesta comes back', () => {
    test('after the epoch’s block, his own prompts carry the reminder until it opens', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        expect(stop(home, stopInput(home))).toMatchObject({
            decision: 'block',
        });
        expect(stop(home, stopInput(home))).toBeUndefined();
        expect(prompt(home, { prompt: 'next thing' })).toContain('siesta due');
        expect(prompt(home, { prompt: 'and another' })).toContain('siesta due');
        run(home, ['open']);
        expect(prompt(home, { prompt: 'go on' })).toBeUndefined();
    });

    test('a siesta opened and dropped before its card is reminded on his prompts too', () => {
        const home = fixtureHome();
        writeSiesta(home, { card_printed: false, highs: [], open: true });
        commit(home, 15, 'clio');
        expect(stop(home, stopInput(home))).toMatchObject({
            decision: 'block',
        });
        expect(prompt(home, { prompt: 'next thing' })).toContain('siesta due');
    });

    test('a member’s turn never carries it', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        stop(home, stopInput(home));
        expect(prompt(home, { prompt: NON_DIMA[0] ?? '' })).toBeUndefined();
    });

    test('the prompt door prints the reminder on stdout', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        stop(home, stopInput(home));
        expect(
            run(home, ['prompt'], JSON.stringify({ prompt: 'hi' })).stdout,
        ).toContain('siesta due');
    });
});

describe('the warn-only undo', () => {
    test('with the block off, the epoch’s first stop warns instead', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        gate.isBlocking = false;
        try {
            const out = stop(home, stopInput(home));
            expect(out).not.toHaveProperty('decision');
            expect(said(out)).toContain('siesta due');
        } finally {
            gate.isBlocking = true;
        }
    });
});

describe('the state file', () => {
    test('keeps only the keys the gate reads', () => {
        const home = fixtureHome();
        writeSiesta(home, { blocked_epoch: 3, last_turn: 'dima', open: false });
        stop(home, stopInput(home));
        expect(Object.keys(siesta(home))).not.toContain('blocked_epoch');
        expect(Object.keys(siesta(home))).not.toContain('last_turn');
    });
});

describe('the siesta closes on dima’s word', () => {
    test.each(NON_DIMA)('an open siesta stays open on «%s»', (text) => {
        const home = fixtureHome();
        writeSiesta(home, { card_printed: true, highs: [], open: true });
        prompt(home, { prompt: text });
        expect(siesta(home).open).toBe(true);
    });

    test('his prompt after the card closes it, a reminder before it never deciding', () => {
        const home = fixtureHome();
        writeSiesta(home, { card_printed: true, highs: [], open: true });
        prompt(home, {
            prompt: '<system-reminder>a fork finished</system-reminder>\ngo on',
        });
        expect(siesta(home).open).toBe(false);
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

    test('afk, a siesta whose card is not printed stays open at her turn end', () => {
        const home = fixtureHome();
        store(home, { afk: { on: true } });
        writeSiesta(home, { card_printed: false, highs: [], open: true });
        stop(home, stopInput(home));
        expect(siesta(home).open).toBe(true);
    });

    test('afk, a settled card closes at her own turn end', () => {
        const home = fixtureHome();
        store(home, { afk: { on: true } });
        writeSiesta(home, {
            card_printed: true,
            highs: [{ state: 'fixed', text: 'a hole' }],
            open: true,
        });
        stop(home, stopInput(home));
        expect(siesta(home).open).toBe(false);
    });

    test('the 11-02 shape: three member turns, one block, closed only by him', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        const outs = [0, 1, 2].map(() => {
            prompt(home, { prompt: NON_DIMA[0] ?? '' });
            return stop(home, stopInput(home));
        });
        expect(said(outs[0])).toContain('siesta due');
        expect(outs.map((o) => o && 'decision' in o)).toEqual([
            true,
            undefined,
            undefined,
        ]);
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
        const out = stop(home, stopInput(home));
        expect(said(out)).toContain('o7');
        expect(said(out)).not.toContain('o8');
        expect(out).not.toHaveProperty('decision');
    });

    test('the store is the inline json, never a sibling file beside it', () => {
        const home = fixtureHome();
        store(home, { [`asks:${SID}`]: { items: [ask('o7', true)] } });
        writeFileSync(
            join(home, '.claude/plugins/store/x-mod-stash_aaa.lock'),
            '{}',
        );
        expect(said(stop(home, stopInput(home)))).toContain('o7');
    });

    test('a store caught mid-write keeps the ticks already nudged', () => {
        const home = fixtureHome();
        store(home, { [`asks:${SID}`]: { items: [ask('o7', true)] } });
        stop(home, stopInput(home));
        writeFileSync(
            join(home, '.claude/plugins/store/x-mod-stash_inline-0000.json'),
            '{"asks:',
        );
        stop(home, stopInput(home));
        store(home, { [`asks:${SID}`]: { items: [ask('o7', true)] } });
        expect(stop(home, stopInput(home))).toBeUndefined();
    });

    test('another session’s tick and a resolved one warn nothing', () => {
        const home = fixtureHome();
        store(home, { 'asks:s-other': { items: [ask('o7', true)] } });
        expect(stop(home, stopInput(home))).toBeUndefined();
    });

    test('a due siesta and a tick print one line naming both, then nothing until a new tick', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        store(home, { [`asks:${SID}`]: { items: [ask('o7', true)] } });
        const line = said(stop(home, stopInput(home))) ?? '';
        expect(line.split('\n')).toHaveLength(1);
        expect(line).toContain('siesta due');
        expect(line).toContain('o7');
        expect(stop(home, stopInput(home))).toBeUndefined();
        store(home, {
            [`asks:${SID}`]: { items: [ask('o7', true), ask('o9', true)] },
        });
        const next = stop(home, stopInput(home));
        expect(said(next)).toContain('o9');
        expect(said(next)).not.toContain('o7');
        expect(next).not.toHaveProperty('decision');
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
    test('a stdin that is not json leaves the hook silent and whole', () => {
        const home = fixtureHome();
        const out = run(home, ['stop'], 'not json');
        expect(out.status).toBe(0);
    });

    test('stop reads the hook json on stdin and prints its verdict', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        const out = run(home, ['stop'], JSON.stringify(stopInput(home)));
        expect(out.status).toBe(0);
        expect(JSON.parse(out.stdout)).toMatchObject({ decision: 'block' });
    });

    test('open stamps siesta-last and opens; card marks it printed with its highs', () => {
        const home = fixtureHome();
        run(home, ['open']);
        expect(siesta(home)).toMatchObject({ card_printed: false, open: true });
        expect(
            new Date(
                readFileSync(
                    join(home, '.local/state/clio/siesta-last'),
                    'utf8',
                ).trim(),
            ).getTime(),
        ).toBeGreaterThan(Date.now() - 60_000);
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
