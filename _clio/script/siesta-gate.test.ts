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
import { describe, expect, test, vi } from 'vitest';

import { gitEnv } from '../../script/lib/git-fixture.ts';
import { cardLines, compact, gate, prompt, sent, stop } from './siesta-gate.ts';

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
    spawnSync('git', ['init', '-q'], {
        cwd: repo,
        env: gitEnv(),
        timeout: 10_000,
    });
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
        writeSiesta(home, {
            card_at: new Date().toISOString(),
            card_printed: true,
            highs: [],
            open: true,
        });
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

    const plant = (home: string, files: string[]) => {
        const repo = join(home, 'frame');
        for (const file of files) {
            mkdirSync(join(repo, file, '..'), { recursive: true });
            writeFileSync(join(repo, file), 'x');
        }
        commit(home, 0, 'clio');
    };

    test('three memory, rule or skill text files of clio’s make it due', () => {
        const home = fixtureHome();
        plant(home, [
            '_clio/memory/craft-pm.md',
            'home/.claude/rules/code.md',
            '_clio/plugin-clio/skills/boot/SKILL.md',
        ]);
        expect(said(stop(home, stopInput(home)))).toContain(
            '3 memory, rule or skill text files',
        );
    });

    test('two memory or rule text files of clio’s make none due', () => {
        const home = fixtureHome();
        plant(home, ['_clio/memory/craft-pm.md', 'home/.claude/rules/code.md']);
        expect(stop(home, stopInput(home))).toBeUndefined();
    });

    test('a skill’s code files never count as memory text', () => {
        const home = fixtureHome();
        plant(home, [
            'home/.claude/plugin-x/skills/crew-adviser/scripts/wake.ts',
            'home/.claude/plugin-x/skills/crew-adviser/scripts/wake.test.ts',
            'home/.claude/plugin-x/skills/crew-adviser/scripts/decision.ts',
        ]);
        expect(stop(home, stopInput(home))).toBeUndefined();
    });

    test.each([
        'x linear set FRM-9 --state Done',
        "x linear set FRM-9 --state 'Canceled'",
        "node script/ticket-sign.ts FRM-9 re-signed 'why'",
        'x lane landed FRM-9 --pr 161 --apply',
    ])('clio’s «%s» since the stamp makes it due', (command) => {
        const home = fixtureHome();
        const input = stopInput(home);
        appendFileSync(
            input.transcript_path,
            `\n${JSON.stringify({ message: { content: [{ input: { command }, name: 'Bash', type: 'tool_use' }] }, timestamp: new Date().toISOString(), type: 'assistant' })}`,
        );
        expect(said(stop(home, input))).toContain('ticket close(s) or sign(s)');
    });

    test.each([
        'x linear set FRM-9 --state Todo',
        "node script/ticket-sign.ts FRM-9 changed 'tiny'",
        'x lane landed FRM-9 --pr 161',
    ])('clio’s «%s» makes none due', (command) => {
        const home = fixtureHome();
        const input = stopInput(home);
        appendFileSync(
            input.transcript_path,
            `\n${JSON.stringify({ message: { content: [{ input: { command }, name: 'Bash', type: 'tool_use' }] }, timestamp: new Date().toISOString(), type: 'assistant' })}`,
        );
        expect(stop(home, input)).toBeUndefined();
    });

    test('a ticket close within 30 min of the stamp makes none due', () => {
        const home = fixtureHome();
        writeFileSync(
            join(home, '.local/state/clio/siesta-last'),
            `${stamp(new Date(Date.now() - 10 * 60_000))}\n`,
        );
        const input = stopInput(home);
        appendFileSync(
            input.transcript_path,
            `\n${JSON.stringify({ message: { content: [{ input: { command: 'x linear set FRM-9 --state Done' }, name: 'Bash', type: 'tool_use' }] }, timestamp: new Date().toISOString(), type: 'assistant' })}`,
        );
        expect(stop(home, input)).toBeUndefined();
    });

    test.each([
        [
            'two ticket closes',
            [
                'x linear set FRM-9 --state Done',
                'x linear set FRM-8 --state Done',
            ],
        ],
        ['a landed lane', ['x lane landed FRM-9 --pr 161 --apply']],
    ])('%s within 30 min of the stamp makes it due', (_name, commands) => {
        const home = fixtureHome();
        writeFileSync(
            join(home, '.local/state/clio/siesta-last'),
            `${stamp(new Date(Date.now() - 10 * 60_000))}\n`,
        );
        const input = stopInput(home);
        for (const command of commands)
            appendFileSync(
                input.transcript_path,
                `\n${JSON.stringify({ message: { content: [{ input: { command }, name: 'Bash', type: 'tool_use' }] }, timestamp: new Date().toISOString(), type: 'assistant' })}`,
            );
        expect(said(stop(home, input))).toContain('ticket close(s) or sign(s)');
    });

    test('a ticket close before the stamp makes none due', () => {
        const home = fixtureHome();
        const input = stopInput(home);
        appendFileSync(
            input.transcript_path,
            `\n${JSON.stringify({ message: { content: [{ input: { command: 'x linear set FRM-9 --state Done' }, name: 'Bash', type: 'tool_use' }] }, timestamp: new Date(Date.now() - 2 * HOUR).toISOString(), type: 'assistant' })}`,
        );
        expect(stop(home, input)).toBeUndefined();
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

    const liveDone = (home: string, body = '[done] a wisp fixed') => {
        mkdirSync(join(home, '.local/state/clio'), { recursive: true });
        writeFileSync(
            join(home, '.local/state/clio/live-lanes'),
            'herdr lane\n',
        );
        return prompt(home, {
            prompt: `<cross-session-message from="uds:/tmp/cc-socks/1.sock" from-name="⚡ 🔧 codie: herdr lane | PK-363">\n${body}\n</cross-session-message>`,
        });
    };

    test('a lane not listed as live-steered is due at its first done, a pocket id in its name or not', () => {
        const home = fixtureHome();
        liveDone(home);
        prompt(home, {
            prompt: '<cross-session-message from="uds:/tmp/cc-socks/2.sock" from-name="⚡ 🔧 codie: mods lane | PK-363">\n[done] FRM-544 slice 0\n</cross-session-message>',
        });
        expect(said(stop(home, stopInput(home)))).toContain(
            '1 member done ping(s)',
        );
    });

    test('a live-steered lane’s dones batch: two make none due, the third does', () => {
        const home = fixtureHome();
        liveDone(home);
        liveDone(home);
        expect(said(stop(home, stopInput(home)))).toBeUndefined();
        liveDone(home);
        expect(said(stop(home, stopInput(home)))).toContain(
            '3 member done ping(s)',
        );
    });

    test('a live-steered lane’s one done is due once it is an hour old', () => {
        const home = fixtureHome();
        liveDone(home);
        vi.useFakeTimers({ now: Date.now() + 61 * 60_000 });
        try {
            expect(said(stop(home, stopInput(home)))).toContain('siesta due');
        } finally {
            vi.useRealTimers();
        }
    });

    test('a live-steered lane’s «final» beside a sha is due at once', () => {
        const home = fixtureHome();
        liveDone(home, 'final main:231772ad f104a04d');
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

    test('a fix landed before the close is no new batch; the next files are', () => {
        const home = fixtureHome();
        writeSiesta(home, { card_printed: true, highs: [], open: true });
        commit(home, 15, 'clio', '🔧 fix', new Date(Date.now() - 5000));
        prompt(home, { prompt: 'go on' });
        expect(stop(home, stopInput(home))).toBeUndefined();
        commit(home, 15, 'clio', '🔧 next batch', new Date(Date.now() + 5000));
        expect(siesta(home).due).toBe(false);
        stop(home, stopInput(home));
        expect(siesta(home).due).toBe(true);
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
        run(home, ['skip', 'a fixture with no transcript']);
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
        run(home, ['skip', 'only groom bookkeeping since the last read']);
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

describe('a siesta runs wishkeeper or logs why not', () => {
    test('a card with no wishkeeper and no skip is refused', () => {
        const home = fixtureHome();
        run(home, ['open']);
        const out = run(home, ['card']);
        expect(out.status).not.toBe(0);
        expect(out.stderr).toContain('no wishkeeper ran');
        expect(siesta(home).card_printed).toBe(false);
    });

    test('a skip logs its why and lets the card print', () => {
        const home = fixtureHome();
        run(home, ['open']);
        run(home, ['skip', 'no reply to dima and no commit since the stamp']);
        expect(run(home, ['card']).status).toBe(0);
        expect(
            readFileSync(
                join(home, '.local/state/clio/wishkeeper-skips.log'),
                'utf8',
            ),
        ).toMatch(/\tclio\tno reply to dima and no commit since the stamp\n$/);
    });

    test('a wishkeeper spawned since the open lets the card print', () => {
        const home = fixtureHome();
        run(home, ['open']);
        const dir = join(home, '.claude/projects/-x');
        mkdirSync(dir, { recursive: true });
        writeFileSync(
            join(dir, `${SID}.jsonl`),
            JSON.stringify({
                message: {
                    content: [
                        {
                            input: { subagent_type: 'wishkeeper' },
                            name: 'Agent',
                            type: 'tool_use',
                        },
                    ],
                },
                timestamp: new Date(Date.now() + 1000).toISOString(),
                type: 'assistant',
            }),
        );
        const out = run(home, ['card'], '', { CLAUDE_CODE_SESSION_ID: SID });
        expect(out.status).toBe(0);
    });

    test('a next open clears the last skip', () => {
        const home = fixtureHome();
        run(home, ['open']);
        run(home, ['skip', 'nothing new']);
        run(home, ['open']);
        expect(run(home, ['card']).status).not.toBe(0);
    });
});

function run(
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

describe('the card’s chore lines', () => {
    const groomDir = (home: string) => join(home, '.local/state/clio/grooms');
    const sentTo = (to: string, message: string) => ({
        tool_input: { message, to },
        tool_name: 'SendMessage',
    });

    test('a chore sent to helga is one sent.log line; a message to anyone else none', () => {
        const home = fixtureHome();
        sent(
            home,
            sentTo(
                '🎀 helga',
                'prompt-groom chore (non-blocking) from 🦉 clio: …',
            ),
        );
        sent(home, sentTo('⚡ 🔧 codie: x', 'resume'));
        const lines = readFileSync(join(groomDir(home), 'sent.log'), 'utf8')
            .trim()
            .split('\n');
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain('\tprompt-groom\t');
    });

    test.each([
        [
            'groom chore (non-blocking) from 🦉 clio: dima’s 11:16 prompt',
            'prompt-groom',
        ],
        ['halt chore: prompt-groom 14:02 and 14:05', 'prompt-groom'],
        ['chore: prompt-groom for 10:43', 'prompt-groom'],
        ['clio: prompt-groom chore 10:37', 'prompt-groom'],
        ['pocket-write (dima o78): PK-306 fields', 'pocket-write'],
    ])('a real chore send «%s» logs the class helga writes', (message, cls) => {
        const home = fixtureHome();
        sent(home, sentTo('🎀 helga', message));
        expect(
            readFileSync(join(groomDir(home), 'sent.log'), 'utf8'),
        ).toContain(`\t${cls}\t`);
    });

    test.each([
        'pause — clio is checkpointing, hold every message',
        'resume — clio’s second wind is done',
        'clio: thanks, green received',
    ])('a message that names no chore class logs nothing: «%s»', (message) => {
        const home = fixtureHome();
        sent(home, sentTo('🎀 helga', message));
        expect(() =>
            readFileSync(join(groomDir(home), 'sent.log'), 'utf8'),
        ).toThrow();
    });

    test('a send before the last siesta is never missed again', () => {
        const home = fixtureHome();
        mkdirSync(groomDir(home), { recursive: true });
        writeFileSync(
            join(groomDir(home), 'sent.log'),
            `${new Date(Date.now() - 3 * 3_600_000).toISOString()}\tpocket-write\tpk-1\n`,
        );
        expect(cardLines(home).join('\n')).not.toContain('missed receipt');
    });

    test('a numbered batch logs one line per chore', () => {
        const home = fixtureHome();
        sent(
            home,
            sentTo(
                '🎀 helga',
                'batch b7\n1 pocket-write PK-1 …\n2 bulk-replace a.md …',
            ),
        );
        expect(
            readFileSync(join(groomDir(home), 'sent.log'), 'utf8')
                .trim()
                .split('\n'),
        ).toHaveLength(2);
    });

    test('a sent chore with no receipt past 30 minutes is a missed receipt; a received one is not', () => {
        const home = fixtureHome();
        mkdirSync(groomDir(home), { recursive: true });
        const old = new Date(Date.now() - 40 * 60_000).toISOString();
        const older = new Date(Date.now() - 50 * 60_000).toISOString();
        writeFileSync(
            join(groomDir(home), 'sent.log'),
            `${older}\tprompt-groom\tgroom 10:17\n${old}\tpocket-write\tpk-1\n`,
        );
        writeFileSync(
            join(groomDir(home), 'receipts.log'),
            `${new Date(Date.now() - 45 * 60_000).toISOString()}\tprompt-groom\t1\t0\tW1-W3\n`,
        );
        const lines = cardLines(home);
        expect(lines.filter((l) => l.includes('missed receipt'))).toHaveLength(
            1,
        );
        expect(lines.join('\n')).toContain('pocket-write');
    });

    test('a receipt answers only its own class, and only one send', () => {
        const home = fixtureHome();
        mkdirSync(groomDir(home), { recursive: true });
        const at = (m: number) =>
            new Date(Date.now() - m * 60_000).toISOString();
        writeFileSync(
            join(groomDir(home), 'sent.log'),
            `${at(60)}\tprompt-groom\tgroom a\n${at(55)}\tprompt-groom\tgroom b\n${at(50)}\tbulk-replace\tswap\n`,
        );
        writeFileSync(
            join(groomDir(home), 'receipts.log'),
            `${at(45)}\tprompt-groom\t1\t0\tW1\n${at(44)}\tpocket-write\t1\t0\tPK-1\n`,
        );
        const missed = cardLines(home).filter((l) =>
            l.includes('missed receipt'),
        );
        expect(missed).toHaveLength(2);
        expect(missed.join('\n')).toContain('bulk-replace');
        expect(missed.join('\n')).toContain('groom b');
    });

    test('a chore sent a minute ago is not missed yet', () => {
        const home = fixtureHome();
        mkdirSync(groomDir(home), { recursive: true });
        writeFileSync(
            join(groomDir(home), 'sent.log'),
            `${new Date().toISOString()}\tpocket-write\tpk-1\n`,
        );
        expect(cardLines(home).join('\n')).not.toContain('missed receipt');
    });

    test('pocket writes by hand count clio’s own pocket writes today, never a read or helga’s', () => {
        const home = fixtureHome();
        const t = join(home, 'clio.jsonl');
        const use = (
            input: object,
            name: string,
            timestamp = new Date().toISOString(),
        ) =>
            JSON.stringify({
                message: { content: [{ input, name, type: 'tool_use' }] },
                timestamp,
                type: 'assistant',
            });
        writeFileSync(
            t,
            [
                use(
                    { command: 'node script/pocket-add.ts "a" --size s' },
                    'Bash',
                ),
                use(
                    {
                        file_path:
                            '/Users/dima/frame/_clio/pocket/tasks/pk-1.md',
                    },
                    'Edit',
                ),
                use(
                    { command: "backlog task edit 307 --append-notes 'x'" },
                    'Bash',
                ),
                use(
                    { command: 'backlog task list --plain --sort ordinal' },
                    'Bash',
                ),
                use(
                    {
                        file_path:
                            '/Users/dima/frame/_clio/pocket/tasks/pk-1.md',
                    },
                    'Read',
                ),
                use(
                    { message: 'pocket-write PK-9 fields …', to: '🎀 helga' },
                    'SendMessage',
                ),
                use(
                    { command: 'node script/pocket-add.ts "b"' },
                    'Bash',
                    '2026-01-01T10:00:00Z',
                ),
            ].join('\n'),
        );
        expect(cardLines(home, t)).toContain('pocket writes by hand: 3');
    });

    test('a re-appended row or a read of the pocket script counts nothing more', () => {
        const home = fixtureHome();
        const t = join(home, 'clio.jsonl');
        const now = new Date().toISOString();
        const row = (id: string, command: string) =>
            JSON.stringify({
                message: {
                    content: [
                        {
                            id,
                            input: { command },
                            name: 'Bash',
                            type: 'tool_use',
                        },
                    ],
                },
                timestamp: now,
                type: 'assistant',
                uuid: `u-${id}`,
            });
        writeFileSync(
            t,
            [
                row('t1', 'node script/pocket-add.ts "a"'),
                row('t1', 'node script/pocket-add.ts "a"'),
                row('t2', 'sed -n 40,110p script/pocket-add.ts | grep ordinal'),
                row('t3', 'rg -n backlog task edit _clio/memory'),
                row('t4', 'for p in 288 291; do backlog task archive $p; done'),
            ].join('\n'),
        );
        expect(cardLines(home, t)).toContain('pocket writes by hand: 2');
    });

    test('a re-appended helga message wakes once', () => {
        const home = fixtureHome();
        const t = join(home, 'clio.jsonl');
        const wake = JSON.stringify({
            message: {
                content:
                    'Another Claude session sent a message:\n<cross-session-message from="x" from-name="🎀 helga">Chore 6 receipt: green</cross-session-message>',
            },
            timestamp: new Date().toISOString(),
            type: 'user',
            uuid: 'u-w1',
        });
        writeFileSync(t, [wake, wake].join('\n'));
        expect(cardLines(home, t)).toContain(
            'receipt wakes since the last siesta: 1',
        );
    });

    test.each(['Receipt: 3 chores green', 'Chore 4 receipt: PK-1 written'])(
        'a capitalised receipt «%s» counts as a wake',
        (body) => {
            const home = fixtureHome();
            const t = join(home, 'clio.jsonl');
            writeFileSync(
                t,
                JSON.stringify({
                    message: {
                        content: `Another Claude session sent a message:\n<cross-session-message from="x" from-name="🎀 helga">${body}</cross-session-message>`,
                    },
                    timestamp: new Date().toISOString(),
                    type: 'user',
                }),
            );
            expect(cardLines(home, t)).toContain(
                'receipt wakes since the last siesta: 1',
            );
        },
    );

    test('a send to codie is never logged as a chore', () => {
        const home = fixtureHome();
        sent(home, sentTo('⚡ 🔧 codie: x', 'pocket-write chore PK-1'));
        expect(() =>
            readFileSync(join(groomDir(home), 'sent.log'), 'utf8'),
        ).toThrow();
    });

    test('a receipt older than its send never answers it', () => {
        const home = fixtureHome();
        mkdirSync(groomDir(home), { recursive: true });
        const at = (m: number) =>
            new Date(Date.now() - m * 60_000).toISOString();
        writeFileSync(
            join(groomDir(home), 'sent.log'),
            `${at(40)}\tpocket-write\tpk-1\n`,
        );
        writeFileSync(
            join(groomDir(home), 'receipts.log'),
            `${at(50)}\tpocket-write\t1\t0\tPK-0\n`,
        );
        expect(cardLines(home).join('\n')).toContain('missed receipt');
    });

    test('the 11-03 replay: helga’s receipts woke no turn, a woken one is counted', () => {
        const home = fixtureHome();
        const t = join(home, 'clio.jsonl');
        const at = (m: number) =>
            new Date(Date.now() - m * 60_000).toISOString();
        const row = (timestamp: string, content: string) =>
            JSON.stringify({ message: { content }, timestamp, type: 'user' });
        writeFileSync(
            t,
            [
                row(
                    at(30),
                    '<cross-session-message from="x" from-name="⚡ 🔧 codie: y">[progress] step 1</cross-session-message>',
                ),
                row(at(20), 'dima: go on'),
            ].join('\n'),
        );
        appendFileSync(
            t,
            `\n${row(at(15), '<cross-session-message from="x" from-name="🎀 helga">[ask] consult 2: anchor matches twice</cross-session-message>')}`,
        );
        expect(cardLines(home, t)).toContain(
            'receipt wakes since the last siesta: 0',
        );
        appendFileSync(
            t,
            `\n${row(at(12), 'Another Claude session sent a message:\n<cross-session-message from="x" from-name="🎀 helga">[done] receipt boot\n1 inbox-prep · exit 0</cross-session-message>')}`,
        );
        expect(cardLines(home, t)).toContain(
            'receipt wakes since the last siesta: 0',
        );
        appendFileSync(
            t,
            `\n${row(at(10), 'Another Claude session sent a message:\n<cross-session-message from="x" from-name="🎀 helga">[progress] receipt b3\n1 prompt-groom · exit 0</cross-session-message>')}`,
        );
        expect(cardLines(home, t)).toContain(
            'receipt wakes since the last siesta: 1',
        );
    });
});

describe('a resume reads the 5h window', () => {
    const turn = (home: string, ...tools: object[]) => {
        const file = join(home, 'resume.jsonl');
        const rows = [
            { message: { content: 'resume the lane' }, type: 'user' },
            ...tools.map((t) => ({
                message: { content: [{ type: 'tool_use', ...t }] },
                type: 'assistant',
            })),
        ];
        writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n'));
        return {
            session_id: SID,
            stop_hook_active: false,
            transcript_path: file,
        };
    };
    const resume = (id: string, to = '⚡ 🔧 codie: clio-lean | FRM-494') => ({
        id,
        input: { message: 'resume — the window is back on pace', to },
        name: 'SendMessage',
    });

    test('a resume to a lane member with no window read in the turn is named', () => {
        const home = fixtureHome();
        const out = stop(home, turn(home, resume('t1')));
        expect(out).not.toHaveProperty('decision');
        expect(said(out)).toContain('5h window');
    });

    test.each([
        {
            input: {
                command: 'jq .five_hour ~/.claude/shelf/cc-usage-window.json',
            },
            name: 'Bash',
        },
        { input: {}, name: 'mcp__ccd_session_mgmt__get_usage' },
        {
            input: {
                file_path: '/Users/dima/.claude/shelf/cc-usage-window.json',
            },
            name: 'Read',
        },
    ])('a window read in the same turn clears it', (read) => {
        const home = fixtureHome();
        expect(
            stop(home, turn(home, { id: 'r1', ...read }, resume('t1'))),
        ).toBeUndefined();
    });

    test('a resume to a member’s session id is a lane member’s too', () => {
        const home = fixtureHome();
        const out = stop(home, turn(home, resume('t1', 'local_d02d1c75-aaaa')));
        expect(said(out)).toContain('5h window');
    });

    test('a resume to helga or a plain message to a member warns nothing', () => {
        const home = fixtureHome();
        const steer = {
            id: 't2',
            input: { message: 'next: FRM-495', to: '⚡ 🔧 codie: x' },
            name: 'SendMessage',
        };
        expect(
            stop(home, turn(home, resume('t1', '🎀 helga'), steer)),
        ).toBeUndefined();
    });

    test('the same resume is named once', () => {
        const home = fixtureHome();
        const input = turn(home, resume('t1'));
        expect(said(stop(home, input))).toContain('5h window');
        expect(stop(home, input)).toBeUndefined();
    });
});

describe('every clio on its own stamp', () => {
    const WING = 'w-2';
    const wingDir = (home: string) =>
        join(home, '.local/state/clio/threads/wing-2');
    const threaded = (home: string) => {
        const dir = join(home, '.claude/sessions');
        mkdirSync(dir, { recursive: true });
        const add = (sessionId: string, name: string, kind = 'interactive') =>
            writeFileSync(
                join(dir, `${sessionId}.json`),
                JSON.stringify({ kind, name, sessionId }),
            );
        add(SID, '🦉 clio');
        add(WING, '🦉🪽 clio: wing 2');
        add('s-helga', '🎀 helga', 'bg');
    };
    const asWing = (home: string) => ({
        ...stopInput(home),
        session_id: WING,
    });

    test("a wing's commits make the wing due, never main", () => {
        const home = fixtureHome();
        threaded(home);
        commit(home, 15, 'clio-wing-2');
        expect(said(stop(home, stopInput(home)))).toBeUndefined();
        expect(said(stop(home, asWing(home)))).toContain('siesta due');
    });

    test("main's commits make main due, never a wing", () => {
        const home = fixtureHome();
        threaded(home);
        commit(home, 15, 'clio');
        expect(said(stop(home, asWing(home)))).toBeUndefined();
        expect(said(stop(home, stopInput(home)))).toContain('siesta due');
    });

    test("a wing's unlanded branch counts for it", () => {
        const home = fixtureHome();
        threaded(home);
        commit(home, 1, 'dima');
        const repo = join(home, 'frame');
        const git = (...args: string[]) =>
            spawnSync('git', args, {
                cwd: repo,
                env: gitEnv(),
                timeout: 10_000,
            });
        git('checkout', '-q', '-b', 'clio-wing-2');
        commit(home, 15, 'clio-wing-2');
        git('checkout', '-q', '-');
        expect(said(stop(home, asWing(home)))).toContain('siesta due');
    });

    test("a wing's state and stamp live apart from main's", () => {
        const home = fixtureHome();
        threaded(home);
        const before = siesta;
        commit(home, 15, 'clio-wing-2');
        stop(home, stopInput(home));
        const main = before(home);
        stop(home, asWing(home));
        expect(before(home)).toEqual(main);
        const out = spawnSync(
            'node',
            [join(import.meta.dirname, 'siesta-gate.ts'), 'open'],
            {
                encoding: 'utf8',
                env: {
                    ...gitEnv(),
                    CLAUDE_CODE_SESSION_ID: WING,
                    HOME: home,
                },
                timeout: 10_000,
            },
        );
        expect(out.stdout).toContain('last siesta: none');
        expect(before(home)).toEqual(main);
        expect(
            JSON.parse(
                readFileSync(join(wingDir(home), 'siesta.json'), 'utf8'),
            ),
        ).toMatchObject({ open: true });
    });

    test('a session that is not the recorded main holds no thread, even unnamed', () => {
        const home = fixtureHome();
        threaded(home);
        writeFileSync(
            join(home, '.local/state/clio/main-session'),
            `pid=1\nsession=${SID}\n`,
        );
        commit(home, 15, 'clio');
        const stranger = { ...stopInput(home), session_id: 's-stranger' };
        expect(stop(home, stranger)).toBeUndefined();
        expect(said(stop(home, stopInput(home)))).toContain('siesta due');
        const out = spawnSync(
            'node',
            [join(import.meta.dirname, 'siesta-gate.ts'), 'open'],
            {
                encoding: 'utf8',
                env: {
                    ...gitEnv(),
                    CLAUDE_CODE_SESSION_ID: 's-stranger',
                    HOME: home,
                },
                timeout: 10_000,
            },
        );
        expect(out.status).not.toBe(0);
        expect(siesta(home).open).toBeFalsy();
    });

    test('a parked sidecar has no thread: no nudge, no state', () => {
        const home = fixtureHome();
        threaded(home);
        commit(home, 15, 'clio');
        expect(
            stop(home, { ...stopInput(home), session_id: 's-helga' }),
        ).toBeUndefined();
        expect(
            prompt(home, { prompt: 'go', session_id: 's-helga' }),
        ).toBeUndefined();
    });

    test('an ignored nudge blocks again after an hour, not before', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        expect(said(stop(home, stopInput(home)))).toContain('siesta due');
        expect(said(stop(home, stopInput(home)))).toBeUndefined();
        writeSiesta(home, {
            ...siesta(home),
            nudged_at: new Date(Date.now() - 2 * HOUR).toISOString(),
        });
        expect(stop(home, stopInput(home))).toMatchObject({
            decision: 'block',
        });
    });

    test('a card left over an hour stops pausing the count', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        writeSiesta(home, {
            card_at: new Date(Date.now() - 2 * HOUR).toISOString(),
            card_printed: true,
            highs: [{ state: 'open', text: 'a hole' }],
            open: true,
        });
        expect(said(stop(home, stopInput(home)))).toContain('siesta due');
    });

    test('a new siesta prints the last stamp and the high left open', () => {
        const home = fixtureHome();
        run(home, ['open']);
        run(home, ['skip', 'a fixture with no transcript']);
        run(home, ['card', 'a hole']);
        const out = run(home, ['open']);
        expect(out.stdout).toMatch(/last siesta: 20/);
        expect(out.stdout).toContain('unsettled high of the last card: a hole');
    });

    test('a siesta just opened waits for its read, past 30 min its batch nudges', () => {
        const home = fixtureHome();
        commit(home, 15, 'clio');
        const open = (minutes: number) =>
            writeSiesta(home, {
                highs: [],
                open: true,
                opened_at: new Date(
                    Date.now() - minutes * 60_000,
                ).toISOString(),
            });
        open(5);
        expect(said(stop(home, stopInput(home)))).toBeUndefined();
        open(45);
        expect(said(stop(home, stopInput(home)))).toContain('siesta due');
    });

    test("a member's done still counts through the app's peer prefix", () => {
        const home = fixtureHome();
        prompt(home, {
            prompt: 'Another Claude session sent a message:\n<cross-session-message from-name="🔧 codie: x">[done] landed</cross-session-message>',
        });
        expect(siesta(home).pings).toHaveLength(1);
    });
});
