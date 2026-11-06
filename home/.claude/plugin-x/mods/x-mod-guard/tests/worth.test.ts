import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { answerPrompts } from './said.ts';
import { liveStore } from './store.ts';

// FRM-486: a cli or mods ticket is planned only with a `## ⚖️ worth it` section; a re-sign carries a changed one or says why not.
// enforced (its sixth sense said clean 2026-11-02). files: body files on disk; tickets: what `x linear read <id>` answers
const NOW = 1_000_000;
type Ticket = { description: string; milestone?: string; project?: string };
type Tick = { at: number; id: string; targets: string[]; text: string };

function world(
    on: On,
    files: Record<string, string> = {},
    tickets: Record<string, Ticket> = {},
    ticks: Tick[] = [],
    milestones: Record<string, string> = {},
) {
    mock.clock(on, { now: NOW });
    const store = liveStore(on);
    const ran: string[] = [];
    answerPrompts(on);
    on('state.get', (_$, e, next) =>
        e.plugin === 'x-mod-stash' && e.key === 'ticks'
            ? { value: { value: ticks, version: 1 } }
            : next(e),
    );
    on('session.id', () => ({ value: 'w1w1w1w1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('session.root', () => ({ value: '/repo' }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', (_$, e) => ({ value: e.path in files }));
    on('fs.list', () => ({ value: [] }));
    on('fs.read', (_$, e) => {
        const text = files[e.path];
        if (text === undefined) throw new Error(`ENOENT ${e.path}`);
        return { value: text };
    });
    on('ui.log', () => ({ value: undefined }));
    on('process.run', (_$, e) => {
        const argv = e.argv.join(' ');
        const id = e.argv.find((w) => /^FRM-\d+$/.test(w));
        const ticket = id ? tickets[id] : undefined;
        const milestoneId = argv.match(
            /projectMilestone\(id: \\?"([^"\\]+)/,
        )?.[1];
        const stdout =
            e.argv[0] === 'x' && e.argv.includes('read') && ticket
                ? JSON.stringify({ data: { tickets: [ticket] }, ok: true })
                : milestoneId && milestones[milestoneId]
                  ? JSON.stringify({
                        data: {
                            projectMilestone: { name: milestones[milestoneId] },
                        },
                    })
                  : '';
        return {
            value: {
                exitCode: stdout ? 0 : 1,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout,
            },
        };
    });
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran, store };
}

const bash = ($: Engine, command: string) =>
    $.tool.call({ command, tool: 'Bash' });
const refused = (r: { deny?: string }) => r.deny !== undefined;

const NO_WORTH = '## wish\n\nW1\n\n## why\n\na reason\n';
const WORTH =
    '## wish\n\nW1\n\n## ⚖️ worth it\n\nnone — fix\n\n## why\n\na reason\n';
const CREATE = (flags: string) =>
    `x as clio -- linear issue create --title t ${flags}`;

test('a cli create with no worth section is refused', async ($, on) => {
    const w = world(on, { '/repo/b.md': NO_WORTH });
    const command = CREATE(
        '--project cli --milestone v --description-file b.md',
    );
    const r = await bash($, command);
    expect([w.ran, refused(r)]).toEqual([[], true]);
});

test('the worth note names the section and the plain-work words', async ($, on) => {
    world(on, { '/repo/b.md': NO_WORTH });
    const r = await bash(
        $,
        CREATE('--project cli --milestone v --description-file b.md'),
    );
    expect(r.deny).toMatch(/## ⚖️ worth it.*none — fix/s);
});

test('a section with no fleet wired line is named as such', async ($, on) => {
    world(on, { '/repo/b.md': '## ⚖️ worth it\n\nremoves the hand ping\n' });
    const r = await bash(
        $,
        CREATE('--project cli --milestone v --description-file b.md'),
    );
    expect(r.deny).toContain('names no `🔌 fleet wired:');
});

test('a body behind a variable is named as unreadable, not as empty', async ($, on) => {
    world(on);
    const r = await bash(
        $,
        CREATE('--project cli --milestone v --description "$B"'),
    );
    expect(r.deny).toContain('cannot be read before the call');
});

test('the refused create leaves a refused event under the worth rule', async ($, on) => {
    const { store } = world(on, { '/repo/b.md': NO_WORTH });
    await bash(
        $,
        CREATE('--project cli --milestone v --description-file b.md'),
    );
    expect(
        [...store.entries()]
            .filter(([k]) => k.startsWith('event:'))
            .map(([, v]) => v),
    ).toMatchObject([{ kind: 'refused', rule: 'worth' }]);
});

const FLAGGED = [
    [
        'the old heading, before ⚖️ worth it',
        CREATE('--project cli --milestone v --description-file b.md'),
        { '/repo/b.md': '## worth\n\nnone — fix\n' },
    ],
    [
        'a worth it section with no fleet wired line',
        CREATE('--project cli --milestone v --description-file b.md'),
        { '/repo/b.md': '## ⚖️ worth it\n\nremoves the hand ping\n' },
    ],
    [
        '--project=CLI, the name read case-blind',
        CREATE('--project=CLI --milestone v --description-file b.md'),
        { '/repo/b.md': NO_WORTH },
    ],
    [
        'a body file behind a cd',
        `cd /repo/sub && ${CREATE('--project cli --milestone v --description-file b.md')}`,
        { '/repo/b.md': WORTH, '/repo/sub/b.md': NO_WORTH },
    ],
    [
        'an empty worth section',
        CREATE('--project cli --milestone v --description-file b.md'),
        { '/repo/b.md': '## ⚖️ worth it\n\n\n## why\n\nx\n' },
    ],
    [
        'a worth heading inside a code fence',
        CREATE('--project cli --milestone v --description-file b.md'),
        { '/repo/b.md': '## wish\n\n```\n## ⚖️ worth it\n\nnone — fix\n```\n' },
    ],
    [
        'a body file that cannot be read',
        CREATE('--project cli --milestone v --description-file gone.md'),
        {},
    ],
    [
        'a body behind a variable',
        CREATE('--project cli --milestone v --description "$B"'),
        {},
    ],
    [
        'an inline body with no worth',
        CREATE("--project cli --milestone v --description '## wish\n\nW1\n'"),
        {},
    ],
    [
        'a fleet create in a mods milestone',
        CREATE(
            "--project fleet --milestone '🐋 safer, quieter mods' --description-file b.md",
        ),
        { '/repo/b.md': NO_WORTH },
    ],
] as const;

for (const [shape, command, files] of FLAGGED)
    test(`${shape} is refused`, async ($, on) => {
        world(on, { ...files });
        expect(refused(await bash($, command))).toBe(true);
    });

test('a fleet create whose milestone id resolves to a mods milestone is refused', async ($, on) => {
    const id = '3f2a9c10-0000-4000-8000-000000000001';
    world(on, { '/repo/b.md': NO_WORTH }, {}, [], {
        [id]: '🐋 safer, quieter mods',
    });
    expect(
        refused(
            await bash(
                $,
                CREATE(
                    `--project fleet --milestone ${id} --description-file b.md`,
                ),
            ),
        ),
    ).toBe(true);
});

const CLEAN = [
    [
        'a worth it section with its fleet wired line',
        CREATE('--project cli --milestone v --description-file b.md'),
        {
            '/repo/b.md':
                '## ⚖️ worth it\n\nremoves the hand ping\n- 🔌 fleet wired: clio:pm calls it at every sign\n',
        },
    ],
    [
        'a worth section with a line',
        CREATE('--project cli --milestone v --description-file b.md'),
        { '/repo/b.md': WORTH },
    ],
    [
        'a worth heading in another case',
        CREATE('--project cli --milestone v --description-file b.md'),
        {
            '/repo/b.md':
                '## ⚖️ Worth It\n\nremoves the hand ping\n🔌 fleet wired: clio:pm\n',
        },
    ],
    [
        'an inline body with a worth section',
        CREATE(
            "--project cli --milestone v --description '## ⚖️ worth it\n\nnone — chore\n'",
        ),
        {},
    ],
    [
        'a -d body with a worth section',
        CREATE(
            "--project cli --milestone v -d '## ⚖️ worth it\n\nnone — fix\n'",
        ),
        {},
    ],
    [
        'a body piped from a file with a worth section',
        `cat b.md | ${CREATE('--project cli --milestone v --description-file -')}`,
        { '/repo/b.md': WORTH },
    ],
    [
        'a heredoc body with a worth section',
        `${CREATE('--project cli --milestone v --description-file -')} <<'EOF'\n## ⚖️ worth it\n\nnone — chore\nEOF`,
        {},
    ],
    [
        'a body file behind a cd ~ && (the home dir expanded)',
        `cd ~/frame && ${CREATE('--project cli --milestone v --priority 3 --description-file _clio/.scratch/t/f.md')}`,
        { '/home/frame/_clio/.scratch/t/f.md': WORTH },
    ],
    [
        'a body file behind a cd ~; (the home dir expanded)',
        `cd ~/frame; ${CREATE('--project cli --milestone v --priority 3 --description-file _clio/.scratch/t/f.md')}`,
        { '/home/frame/_clio/.scratch/t/f.md': WORTH },
    ],
    [
        'a fleet create in another milestone',
        CREATE(
            "--project fleet --milestone 'make fleet good' --description-file b.md",
        ),
        { '/repo/b.md': NO_WORTH },
    ],
    [
        'a create into another project',
        CREATE('--project bytes --milestone v --description-file b.md'),
        { '/repo/b.md': NO_WORTH },
    ],
] as const;

for (const [shape, command, files] of CLEAN)
    test(`${shape} runs with no worth note`, async ($, on) => {
        const w = world(on, { ...files });
        const r = await bash($, command);
        expect(refused(r)).toBe(false);
        expect(w.ran).toEqual([command]);
    });

// a re-sign: the ticket's current body as linear holds it, and the new body with a ✍️ re-signed line it lacks
const SIGNED = `${WORTH}\n## signed\n\n✍️ signed 2026-11-01 — scope A · body 11112222\n`;
const RESIGN = (worth: string, note = '') =>
    `${SIGNED.replace('none — fix', worth)}✍️ re-signed 2026-11-02 — scope B${note} · body 33334444\n`;
const SIGN_TICK: Tick = {
    at: NOW - 1,
    id: 'o4',
    targets: [],
    text: '✍️ sign FRM-1: a cli verb',
};
const SET = 'x linear body FRM-1 --set /repo/b.md';

for (const [shape, next, ticket, isRefused] of [
    [
        'a re-sign whose worth is unchanged',
        RESIGN('none — fix'),
        { description: SIGNED, project: 'cli' },
        true,
    ],
    [
        'a re-sign whose worth only re-wraps',
        RESIGN('none  —\nfix'),
        { description: SIGNED, project: 'cli' },
        true,
    ],
    [
        'a re-sign with a changed worth',
        RESIGN('removes the hand ping'),
        { description: SIGNED, project: 'cli' },
        false,
    ],
    [
        'a re-sign saying why the worth stands',
        RESIGN('none — fix', ' · worth unchanged — the scope only narrowed'),
        { description: SIGNED, project: 'cli' },
        false,
    ],
    [
        'a re-sign on a ticket with no project',
        RESIGN('none — fix'),
        { description: SIGNED },
        false,
    ],
    [
        'a write that keeps an old re-sign line',
        `${RESIGN('none — fix')}✏️ changed 2026-11-03 — tiny · body 55556666\n`,
        { description: RESIGN('none — fix'), project: 'cli' },
        false,
    ],
    [
        'a re-sign over a body linear rewrote, its worth unchanged',
        RESIGN('* none — a fix_up'),
        {
            description: SIGNED.replace('none — fix', '- none — a fix\\_up'),
            project: 'cli',
        },
        true,
    ],
    [
        'a re-sign on a ticket out of scope',
        RESIGN('none — fix'),
        { description: SIGNED, project: 'bytes' },
        false,
    ],
    [
        'a re-sign on a mods-milestone fleet ticket',
        RESIGN('none — fix'),
        {
            description: SIGNED,
            milestone: '🐋 safer, quieter mods',
            project: 'fleet',
        },
        true,
    ],
] as const)
    test(`${shape} is ${isRefused ? 'refused' : 'run'}`, async ($, on) => {
        world(on, { '/repo/b.md': next }, { 'FRM-1': ticket }, [SIGN_TICK]);
        expect(refused(await bash($, SET))).toBe(isRefused);
    });

test('a re-sign behind a cd ~ reads its body file from the home dir', async ($, on) => {
    world(
        on,
        { '/home/frame/b.md': RESIGN('none — fix') },
        { 'FRM-1': { description: SIGNED, project: 'cli' } },
        [SIGN_TICK],
    );
    expect(
        refused(await bash($, 'cd ~/frame && x linear body FRM-1 --set b.md')),
    ).toBe(true);
});

test('a raw linear update re-signing with an unchanged worth is refused', async ($, on) => {
    world(
        on,
        { '/repo/b.md': RESIGN('none — fix') },
        { 'FRM-1': { description: SIGNED, project: 'cli' } },
    );
    expect(
        refused(
            await bash($, 'linear issue update FRM-1 --description-file b.md'),
        ),
    ).toBe(true);
});

test('a re-sign whose ticket linear cannot read is refused', async ($, on) => {
    world(on, { '/repo/b.md': RESIGN('removes the hand ping') }, {}, [
        SIGN_TICK,
    ]);
    expect(refused(await bash($, SET))).toBe(true);
});

test('the note on an unread ticket names the failed read', async ($, on) => {
    world(on, { '/repo/b.md': RESIGN('removes the hand ping') }, {}, [
        SIGN_TICK,
    ]);
    expect((await bash($, SET)).deny).toContain('could not read FRM-1');
});

const WRITTEN_BODY = `cat > /repo/b.md <<'EOF'\nbody\nEOF\nlinear issue update FRM-5 --description-file /repo/b.md`;

test('a body this command writes on a ticket out of scope runs', async ($, on) => {
    const { ran } = world(
        on,
        {},
        { 'FRM-5': { description: 'x', project: 'apps' } },
    );
    const r = await bash($, WRITTEN_BODY);
    expect([refused(r), ran]).toEqual([false, [WRITTEN_BODY]]);
});

test('a body this command writes in scope is told to split the write', async ($, on) => {
    world(on, {}, { 'FRM-5': { description: 'x', project: 'cli' } });
    const r = await bash($, WRITTEN_BODY);
    expect(r.deny).toContain('in a call of its own');
});

test('a re-sign body this command writes is refused as unread', async ($, on) => {
    world(on, {}, { 'FRM-1': { description: SIGNED, project: 'cli' } }, [
        SIGN_TICK,
    ]);
    const r = await bash(
        $,
        `cat > /repo/b.md <<'EOF'\n${RESIGN('removes the hand ping')}EOF\n${SET}`,
    );
    expect(r.deny).toContain('this command writes');
});

test('the x pocket pitch shape is answered with the plain-work door', async ($, on) => {
    const pitch =
        '## wish\n\nW1 a new x verb\n\n## why\n\nsaves a step\n\n## done test\n\nit runs\n';
    world(on, { '/repo/.scratch/pitch.md': pitch });
    const r = await bash(
        $,
        "x as clio -- linear issue create --project cli --milestone 'x verbs' --title 'x: a new verb' --description-file .scratch/pitch.md",
    );
    expect(r.deny).toMatch(/## ⚖️ worth it.*none — chore/s);
});
