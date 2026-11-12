import { spawnSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import {
    dayBefore,
    helgaBootPrompt,
    liftStanding,
    newUnstamped,
    openStanding,
    rawPromptAt,
    strayRaws,
    tagStanding,
    ungroomedPrompts,
    ungroomedStamps,
    unnumberedAsks,
} from './prompt-groom.ts';

test('helga boots with her skill, then her passport', () => {
    const prompt = helgaBootPrompt(join(import.meta.dirname, '../..'));
    expect(prompt.startsWith('you are helga')).toBe(true);
    expect(prompt).toContain("# helga — clio's editing sidecar");
});

describe('a no-wish line on a minute with two prompts', () => {
    const day = '## 10:00\n\nfirst wish\n\n## 10:00\n\nsecond wish\n';
    const reds = (noWish: string) =>
        ungroomedPrompts(day, '2026-11-06', '11:00', noWish, () => false)
            .length;

    test('a plain line hides nothing', () => {
        expect(reds('10:00 — about the first\n')).toBe(1);
    });

    test('a line naming both clears the minute', () => {
        expect(reds('10:00 ×2 — both answered\n')).toBe(0);
    });

    test('a red prompt names the ×N key its no-wish line needs', () => {
        expect(
            ungroomedPrompts(day, '2026-11-06', '11:00', '', () => false)[0]
                ?.key,
        ).toBe('10:00 ×2');
    });

    test('a side note beside one prompt counts as one', () => {
        const noted =
            '## 10:00\n\na wish\n\n## 10:00\n\n<side-sessions-event>x</side-sessions-event>\n';
        expect(
            ungroomedPrompts(
                noted,
                '2026-11-06',
                '11:00',
                '10:00 — it\n',
                () => false,
            ),
        ).toEqual([]);
    });
});

describe('standing lines', () => {
    const groomed = () => {
        const dir = mkdtempSync(join(tmpdir(), 'groom-standing-'));
        writeFileSync(
            join(dir, '2026-11-01-1419.groomed.md'),
            'W1 (2026-11-01 14:19, dima): find some stuff to solve for yourself meanwhile. #standing\n',
        );
        writeFileSync(
            join(dir, '2026-11-02-1216.groomed.md'),
            'W2 (2026-11-02 12:16, dima): find some stuff to solve meanwhile. #standing\nW3 (2026-11-02 12:16, dima): why did mobile mode turn on? ❓\n',
        );
        writeFileSync(
            join(dir, '2026-11-02-1310.groomed.md'),
            'W4 (2026-11-02 13:10, dima): ask me a round at the end. #standing\n',
        );
        return dir;
    };

    test('only the day’s open standing lines are printed', () => {
        const dir = groomed();
        expect(openStanding('2026-11-02', dir).map((l) => l.id)).toEqual([
            'W2',
            'W4',
        ]);
        rmSync(dir, { recursive: true });
    });

    test('a lifted line stops printing and the others stay', () => {
        const dir = groomed();
        expect(liftStanding('2026-11-02', dir, 'W2')).toEqual(['W2']);
        expect(openStanding('2026-11-02', dir).map((l) => l.id)).toEqual([
            'W4',
        ]);
        expect(
            readFileSync(join(dir, '2026-11-02-1216.groomed.md'), 'utf8'),
        ).toContain('meanwhile. #lifted');
        rmSync(dir, { recursive: true });
    });

    test('lifting all leaves no open line that day and touches no other day', () => {
        const dir = groomed();
        expect(liftStanding('2026-11-02', dir, 'all')).toEqual(['W2', 'W4']);
        expect(openStanding('2026-11-02', dir)).toEqual([]);
        expect(openStanding('2026-11-01', dir).map((l) => l.id)).toEqual([
            'W1',
        ]);
        rmSync(dir, { recursive: true });
    });
});

describe('unnumberedAsks', () => {
    const day = '2026-11-01';
    const dir = mkdtempSync(join(tmpdir(), 'asks-'));
    writeFileSync(
        join(dir, `${day}-1419.groomed.md`),
        `W1 (${day} 14:19, dima): a wish\n❓ ask (${day} 14:19, dima): what is it?\nW2 (${day} 14:19, dima): a numbered one ❓\n`,
    );
    writeFileSync(
        join(dir, `${day}-inbox.groomed.md`),
        '❓ asks:\n  1. the inbox prep keeps its own shape ❓ ask\n',
    );
    test('a prompt groom’s ask with no W-id is named', () => {
        expect(unnumberedAsks(day, dir)).toEqual([
            [
                `${day}-1419.groomed.md`,
                `❓ ask (${day} 14:19, dima): what is it?`,
            ],
        ]);
    });
});

const day = '2026-10-26';

const steer = (id: string, text: string) =>
    JSON.stringify({
        attachment: { content: [`- ${id} · his steer: «${text}»`] },
        timestamp: '2026-10-26T09:15:00Z',
        type: 'attachment',
    });

describe('groomedOrUnlogged', () => {
    const day = '2020-01-02';
    const load = async () => {
        const dir = mkdtempSync(join(tmpdir(), 'prompt-log-'));
        writeFileSync(join(dir, `${day}.md`), '## 09:12\n\na prompt\n');
        vi.stubEnv('PROMPT_RAW_DIR', dir);
        vi.stubEnv('CLIO_SEAT', '');
        vi.resetModules();
        const { groomedOrUnlogged } = await import('./prompt-groom.ts');
        vi.unstubAllEnvs();
        return groomedOrUnlogged;
    };

    test('a logged minute with no groom still owes one', async () => {
        expect((await load())(day, '09:12', '')).toBe(false);
    });

    test("a wing's minute, absent from the log, owes none", async () => {
        expect((await load())(day, '17:47', '')).toBe(true);
    });

    test('an orbit steer stays owed, the log never holds one', async () => {
        expect((await load())(day, 'o34', '')).toBe(false);
    });
});

describe('ungroomedStamps', () => {
    const text = [
        'W301 (2026-10-26 09:12, dima): fold this',
        '* W302 (2026-10-26 09:12, dima, on Q2): and this',
        'W303 (2026-10-26 10:40, dima): a second prompt',
        'W305 an unstamped line',
    ].join('\n');

    test('names each prompt time born that day with no groom, once', () => {
        expect(ungroomedStamps(text, day, () => false)).toEqual([
            '09:12',
            '10:40',
        ]);
    });

    test('an inbox stamp reds until that day inbox is groomed', () => {
        const inbox = 'W306 (2026-10-26 inbox, dima): from the vault';
        expect(ungroomedStamps(inbox, day, () => false)).toEqual(['inbox']);
        expect(ungroomedStamps(inbox, '2026-10-27', () => false)).toEqual([
            'inbox --date 2026-10-26',
        ]);
        expect(
            ungroomedStamps(
                inbox,
                day,
                (d, hhmm) => d === day && hhmm === 'inbox',
            ),
        ).toEqual([]);
        expect(newUnstamped(`${inbox}\n`, '')).toEqual([]);
    });

    test('helga’s W<n> · text (stamp) shape reads like the stamp-first one', () => {
        const drift = 'W7 · fold this one (2026-10-26 09:12, dima)';
        expect(ungroomedStamps(drift, day, () => false)).toEqual(['09:12']);
        expect(newUnstamped(`${drift}\n`, '')).toEqual([]);
    });

    test('a groomed prompt time stays quiet', () => {
        expect(
            ungroomedStamps(text, day, (_, hhmm) => hhmm === '09:12'),
        ).toEqual(['10:40']);
    });

    test('an earlier day since the rules start is checked and names its date', () => {
        const earlier = 'W304 (2026-10-25 22:00, dima): before midnight';
        expect(ungroomedStamps(earlier, day, () => false)).toEqual([
            '22:00 --date 2026-10-25',
        ]);
        expect(
            ungroomedStamps(earlier, day, (d) => d === '2026-10-25'),
        ).toEqual([]);
    });

    test('a stamp dated after today is not checked', () => {
        expect(
            ungroomedStamps('W1 (2026-10-27 09:00, dima): x', day, () => false),
        ).toEqual([]);
    });

    test('a stamp before the rule start is never checked', () => {
        expect(
            ungroomedStamps(
                'W1 (2026-10-21 14:00, dima): old',
                '2026-10-25',
                () => false,
            ),
        ).toEqual([]);
    });

    test('on the rule day, only a prompt from 14:50 on is checked', () => {
        const both =
            'W1 (2026-10-25 14:40, dima): before\nW2 (2026-10-25 15:00, dima): after';
        expect(ungroomedStamps(both, '2026-10-25', () => false)).toEqual([
            '15:00',
        ]);
    });
});

describe('strayRaws', () => {
    const now = new Date('2026-10-26T12:00:00');

    test('a raw older than 10 minutes with no groomed twin is named', () => {
        expect(strayRaws(['2026-10-26-1100.raw.md'], now)).toEqual([
            '2026-10-26-1100.raw.md',
        ]);
    });

    test('a groomed twin clears it', () => {
        expect(
            strayRaws(
                ['2026-10-26-1100.raw.md', '2026-10-26-1100.groomed.md'],
                now,
            ),
        ).toEqual([]);
    });

    test('a raw younger than 10 minutes waits', () => {
        expect(strayRaws(['2026-10-26-1155.raw.md'], now)).toEqual([]);
    });

    test('a raw from before the rules start is never named', () => {
        expect(strayRaws(['2026-10-25-1440.raw.md'], now)).toEqual([]);
    });
});

describe('--check against a groom file on disk', () => {
    const folded = 'W1 (2026-10-25 15:00, dima): ship the exact words\n';

    function check(groomed: string) {
        const root = mkdtempSync(join(tmpdir(), 'prompt-groom-'));
        try {
            writeFileSync(join(root, '2026-10-25-1500.groomed.md'), groomed);
            writeFileSync(join(root, 'body.md'), folded);
            return spawnSync(
                process.execPath,
                [
                    join(import.meta.dirname, 'prompt-groom.ts'),
                    '--check',
                    join(root, 'body.md'),
                ],
                {
                    encoding: 'utf8',
                    env: {
                        ...process.env,
                        CLIO_SEAT: '',
                        PROMPT_GROOM_DIR: root,
                    },
                    timeout: 10_000,
                },
            ).status;
        } finally {
            rmSync(root, { force: true, recursive: true });
        }
    }

    test('a placeholder groom file reds', () => {
        expect(check('todo\n')).toBe(1);
    });

    test('a groom with a W-line of the same stamp passes though the fold’s words differ', () => {
        expect(
            check('W1 (2026-10-25 15:00, dima): composed other words\n'),
        ).toBe(0);
    });

    test('a groom stamped for another minute reds', () => {
        expect(
            check('W1 (2026-10-25 15:01, dima): ship the exact words\n'),
        ).toBe(1);
    });
});

describe('--check on an inbox stamp', () => {
    const body = [
        'W9 (2026-10-26 inbox, dima): finish the round',
        'raw drop (2026-10-26 inbox, dima): 1. finish the round, if not finished',
    ].join('\n');

    function check(prep: string | undefined) {
        const root = mkdtempSync(join(tmpdir(), 'prompt-groom-'));
        try {
            if (prep !== undefined)
                writeFileSync(join(root, '2026-10-26-inbox.groomed.md'), prep);
            writeFileSync(join(root, 'body.md'), body);
            return spawnSync(
                process.execPath,
                [
                    join(import.meta.dirname, 'prompt-groom.ts'),
                    '--check',
                    join(root, 'body.md'),
                ],
                {
                    encoding: 'utf8',
                    env: {
                        ...process.env,
                        CLIO_SEAT: '',
                        PROMPT_GROOM_DIR: root,
                    },
                    timeout: 10_000,
                },
            );
        } finally {
            rmSync(root, { force: true, recursive: true });
        }
    }

    test('with no prep copy the red names the copy step, not a command that cannot work', () => {
        const out = check(undefined);
        expect(out.status).toBe(1);
        expect(out.stdout).toContain('inbox-helga.md');
        expect(out.stdout).not.toContain('node script/prompt-groom.ts inbox');
    });

    test('a prep copy that quotes the item’s raw drop passes', () => {
        expect(check('> 1. finish the round, if not finished\n').status).toBe(
            0,
        );
    });

    test('a prep copy without the item’s raw drop reds, though the file exists', () => {
        expect(check('> 1. some other ask\n').status).toBe(1);
    });
});

describe('--day', () => {
    const dayFile = '## 10:00\n\nship the thing\n\n';

    function run(opts: {
        grooms?: Record<string, string>;
        isLinearDown?: boolean;
        linear?: string;
        now?: string | null;
        pocket?: Record<string, string>;
        prompts?: string;
        seatTranscripts?: Record<string, string[]>;
        sessionId?: string;
        steers?: string[] | null;
    }) {
        const root = mkdtempSync(join(tmpdir(), 'prompt-groom-'));
        try {
            // linear is stubbed: x prints one ticket body, or fails when it is down
            mkdirSync(join(root, 'bin'));
            writeFileSync(
                join(root, 'bin', 'x'),
                opts.isLinearDown
                    ? '#!/bin/sh\nexit 1\n'
                    : `#!/bin/sh\necho '${JSON.stringify({ data: { issues: { nodes: [{ description: opts.linear ?? '', identifier: 'FRM-1' }] } } })}'\n`,
                { mode: 0o755 },
            );
            const transcript = join(root, 't.jsonl');
            writeFileSync(transcript, (opts.steers ?? []).join('\n'));
            for (const [file, rows] of Object.entries(
                opts.seatTranscripts ?? {},
            )) {
                const at = join(root, '.claude/projects', file);
                mkdirSync(join(at, '..'), { recursive: true });
                writeFileSync(at, rows.join('\n'));
            }
            for (const [dir, files] of [
                ['grooms', opts.grooms],
                ['pocket', opts.pocket],
            ] as const) {
                mkdirSync(join(root, dir));
                for (const [name, text] of Object.entries(files ?? {}))
                    writeFileSync(join(root, dir, name), text);
            }
            mkdirSync(join(root, 'prompts'));
            writeFileSync(
                join(root, 'prompts', `${day}.md`),
                opts.prompts ?? dayFile,
            );
            return spawnSync(
                process.execPath,
                [
                    join(import.meta.dirname, 'prompt-groom.ts'),
                    '--day',
                    day,
                    ...(opts.now === null
                        ? []
                        : ['--now', opts.now ?? '10:30']),
                    ...(opts.steers === null
                        ? []
                        : ['--transcript', transcript]),
                ],
                {
                    encoding: 'utf8',
                    env: {
                        ...process.env,
                        CLAUDE_CODE_SESSION_ID: opts.sessionId ?? '',
                        CLIO_SEAT: '',
                        HOME: root,
                        PATH: `${join(root, 'bin')}:${process.env.PATH}`,
                        POCKET_DIR: join(root, 'pocket'),
                        PROMPT_GROOM_DIR: join(root, 'grooms'),
                        PROMPT_RAW_DIR: join(root, 'prompts'),
                        TZ: 'UTC',
                    },
                    timeout: 10_000,
                },
            );
        } finally {
            rmSync(root, { force: true, recursive: true });
        }
    }

    const groomed = (id = 'W1') => ({
        [`${day}-1000.groomed.md`]: `${id} (${day} 10:00, dima): ship it\n`,
    });

    test('a lifted W-line keeps the home it had before the lift', () => {
        const out = run({
            grooms: {
                [`${day}-1000.groomed.md`]: `W1 (${day} 10:00, dima): ship it #lifted\n`,
            },
            pocket: { 'pk-1.md': `W1 (${day} 10:00, dima): ship it\n` },
        });
        expect(out.status).toBe(0);
    });

    test('an old ungroomed prompt reds with the fix', () => {
        const out = run({});
        expect(out.status).toBe(1);
        expect(out.stdout).toContain('10:00 — no groom: ship the thing');
        expect(out.stdout).toContain('prompt-groom.ts 10:00');
    });

    test('a groomed prompt passes', () => {
        expect(
            run({ grooms: groomed(), pocket: { 'a.md': 'W1 ship it' } }).status,
        ).toBe(0);
    });

    test('a no-wish line passes the prompt', () => {
        expect(
            run({
                grooms: { [`${day}.no-wish.md`]: '10:00 — just a thanks\n' },
            }).status,
        ).toBe(0);
    });

    test('a prompt under 10 minutes old passes', () => {
        expect(run({ now: '10:10' }).status).toBe(0);
    });

    test('a prompt of a slash command alone passes', () => {
        expect(
            run({ prompts: '## 10:00\n\n/x:mobile-mode 10min\n\n' }).status,
        ).toBe(0);
    });

    test('a prep note opening with a W-id is no W-line', () => {
        const out = run({
            grooms: {
                ...groomed(),
                [`${day}-inbox.groomed.md`]:
                    '- W1 has no bold title in his file\n',
            },
            pocket: { 'a.md': 'W1 ship it' },
        });
        expect(out.status).toBe(0);
    });

    test('a groomed W-id with no home reds', () => {
        const out = run({ grooms: groomed('W7'), pocket: { 'a.md': 'W8' } });
        expect(out.status).toBe(1);
        expect(out.stdout).toContain(`W7 (${day}-1000.groomed.md) — no home`);
    });

    test('a groomed W-line whose id and text share a line of a recent linear body passes', () => {
        expect(
            run({ grooms: groomed('W7'), linear: '* W7 folded: ship it here' })
                .status,
        ).toBe(0);
    });

    test('a W-line text found without its id does not home it', () => {
        const out = run({
            grooms: groomed('W7'),
            linear: 'folded ship it here',
        });
        expect(out.status).toBe(1);
        expect(out.stdout).toContain(`W7 (${day}-1000.groomed.md) — no home`);
    });

    test('a W-id alone does not home a W-line, ids repeat across items', () => {
        const out = run({
            grooms: groomed('W7'),
            pocket: { 'a.md': 'W7 (2026-10-01 08:00, dima): another thing' },
        });
        expect(out.status).toBe(1);
        expect(out.stdout).toContain('W7');
    });

    test('a sibling line sharing the stamp does not home a W-line', () => {
        const out = run({
            grooms: groomed('W7'),
            pocket: { 'a.md': `W2 (${day} 10:00, dima): another line` },
        });
        expect(out.status).toBe(1);
        expect(out.stdout).toContain(`W7 (${day}-1000.groomed.md) — no home`);
    });

    test('an ungroomed steer of the day reds in the prompt shape', () => {
        const out = run({
            prompts: '',
            steers: [steer('o69', 'ship it now')],
        });
        expect(out.status).toBe(1);
        expect(out.stdout).toContain('o69 — no groom: ship it now');
        expect(out.stdout).toContain('prompt-groom.ts o69');
    });

    test('a groomed steer and a no-wish steer pass', () => {
        expect(
            run({
                grooms: {
                    [`${day}-o68.groomed.md`]: `W1 (${day} 09:15, dima, o68 steer): other wish\n`,
                    [`${day}.no-wish.md`]: 'o69 — just a thanks\n',
                },
                pocket: { 'a.md': 'W1 other wish' },
                prompts: '',
                steers: [steer('o68', 'other'), steer('o69', 'thanks')],
            }).status,
        ).toBe(0);
    });

    const otherSeat = {
        '-Users-dima-frame--clio/other-seat.jsonl': [
            steer('o4', 'another board steer'),
        ],
    };

    test('with no transcript and no session id, another seat’s steer is owed nothing', () => {
        const out = run({
            prompts: '',
            seatTranscripts: otherSeat,
            steers: null,
        });
        expect(out.stdout).not.toContain('o4');
        expect(out.status).toBe(0);
    });

    test('with no transcript, the session id names this thread’s own', () => {
        const out = run({
            prompts: '',
            seatTranscripts: {
                ...otherSeat,
                '-Users-dima-frame--claude-worktrees-clio-wing-1--clio/abc.jsonl':
                    [steer('o5', 'this board steer')],
            },
            sessionId: 'abc',
            steers: null,
        });
        expect(out.stdout).toContain('o5 — no groom: this board steer');
        expect(out.stdout).not.toContain('o4');
    });

    test('a steer of another day is not checked', () => {
        expect(
            run({
                prompts: '',
                steers: [steer('o69', 'x').replace('10-26', '10-25')],
            }).status,
        ).toBe(0);
    });

    test('a past day counts every prompt as old without --now', () => {
        const out = run({ now: null, prompts: '## 23:45\n\nlate wish\n\n' });
        expect(out.status).toBe(1);
        expect(out.stdout).toContain('23:45 — no groom: late wish');
    });

    test('linear down: one 🟡 line, the prompt reds still print, exit 1', () => {
        const out = run({ isLinearDown: true });
        expect(out.status).toBe(1);
        expect(out.stderr).toContain('🟡 linear not read');
        expect(out.stdout).toContain('10:00 — no groom: ship the thing');
    });

    test('a prompt of a harness event alone passes', () => {
        expect(
            run({
                prompts:
                    '## 10:00\n\n<side-sessions-event>no session works\nnow</side-sessions-event>\n\n',
            }).status,
        ).toBe(0);
    });

    test('a harness event beside dima’s own text still reds', () => {
        expect(
            run({
                prompts:
                    '## 10:00\n\n<task-notification>done</task-notification>\nship the thing\n\n',
            }).status,
        ).toBe(1);
    });

    test('a groomed W-id in a pocket file passes', () => {
        expect(
            run({
                grooms: groomed('W7'),
                pocket: { 'a.md': 'W7 see ship it here' },
            }).status,
        ).toBe(0);
    });
});

describe('prompt-groom inbox', () => {
    test('the verb refuses an inbox with the copy step', () => {
        const out = spawnSync(
            process.execPath,
            [join(import.meta.dirname, 'prompt-groom.ts'), 'inbox'],
            { encoding: 'utf8', timeout: 10_000 },
        );
        expect(out.status).toBe(1);
        expect(out.stderr).toContain('inbox-helga.md');
    });
});

describe('prompt-groom oN (FRM-451)', () => {
    function groom(id: string) {
        const root = mkdtempSync(join(tmpdir(), 'prompt-groom-'));
        try {
            const grooms = join(root, 'grooms');
            mkdirSync(join(root, 'bin'));
            // helga is stubbed up, so nothing is spawned
            writeFileSync(
                join(root, 'bin', 'claude'),
                `#!/bin/sh\necho '[{"name":"helga","status":"idle"}]'\n`,
                { mode: 0o755 },
            );
            const transcript = join(root, 't.jsonl');
            writeFileSync(
                transcript,
                [
                    steer('o68', 'first word'),
                    steer('o69', 'ship it'),
                    steer('o68', 'second word'),
                    steer('o68', 'second word'),
                ].join('\n'),
            );
            const out = spawnSync(
                process.execPath,
                [
                    join(import.meta.dirname, 'prompt-groom.ts'),
                    id,
                    '--date',
                    day,
                    '--transcript',
                    transcript,
                ],
                {
                    encoding: 'utf8',
                    env: {
                        ...process.env,
                        CLIO_SEAT: '',
                        PATH: `${join(root, 'bin')}:${process.env.PATH}`,
                        PROMPT_GROOM_DIR: grooms,
                    },
                    timeout: 10_000,
                },
            );
            const rawFile = join(grooms, `${day}-${id}.raw.md`);
            return {
                out,
                raw: existsSync(rawFile) && readFileSync(rawFile, 'utf8'),
            };
        } finally {
            rmSync(root, { force: true, recursive: true });
        }
    }

    test('cuts the steer into grooms/<day>-oN.raw.md and prints the chore', () => {
        const { out, raw } = groom('o69');
        expect(out.status).toBe(0);
        expect(raw).toBe('ship it\n');
        expect(out.stdout).toContain(`${day}-o69.groomed.md`);
    });

    test('an id with two steers cuts both, a redelivered one once', () => {
        expect(groom('o68').raw).toBe('first word\nsecond word\n');
    });

    test('an id the transcript lacks refuses', () => {
        const { out } = groom('o70');
        expect(out.status).toBe(1);
        expect(out.stderr).toContain('o70');
    });
});

describe('--linear, with a stubbed x', () => {
    test('a stray raw prompt reds under the halt’s door too', () => {
        const root = mkdtempSync(join(tmpdir(), 'prompt-groom-'));
        try {
            const grooms = join(root, 'grooms');
            mkdirSync(grooms);
            writeFileSync(join(grooms, '2026-10-25-1450.raw.md'), 'raw');
            mkdirSync(join(root, 'bin'));
            writeFileSync(
                join(root, 'bin', 'x'),
                `#!/bin/sh\necho '{"data":{"issues":{"nodes":[]}}}'\n`,
                { mode: 0o755 },
            );
            const result = spawnSync(
                process.execPath,
                [join(import.meta.dirname, 'prompt-groom.ts'), '--linear'],
                {
                    encoding: 'utf8',
                    env: {
                        ...process.env,
                        CLIO_SEAT: '',
                        PATH: `${join(root, 'bin')}:${process.env.PATH}`,
                        PROMPT_GROOM_DIR: grooms,
                        // UTC+14 keeps the fixture's 2026-10-25 14:50 in the past on any CI clock
                        TZ: 'Pacific/Kiritimati',
                    },
                    timeout: 10_000,
                },
            );
            expect(result.status).toBe(1);
            expect(result.stdout).toContain('2026-10-25-1450.raw.md');
        } finally {
            rmSync(root, { force: true, recursive: true });
        }
    });
});

describe('dayBefore', () => {
    test('steps back one day across a month edge', () => {
        expect(dayBefore('2026-11-01')).toBe('2026-10-31');
    });
});

describe('rawPromptAt', () => {
    const file =
        '## 09:12\n\nfirst prompt\nsecond line\n\n## 10:40\n\nanother\n\n';

    test('cuts the block under its time head', () => {
        expect(rawPromptAt(file, '09:12')).toBe('first prompt\nsecond line');
    });

    test('every prompt of one minute comes back, the second wish included', () => {
        const twice =
            '## 14:01\n\nproceed\n\n## 14:01\n\nalso look at tldraw\n\n';
        expect(rawPromptAt(twice, '14:01')).toBe(
            'proceed\n\n---\n\nalso look at tldraw',
        );
    });

    test('a time with no head returns undefined', () => {
        expect(rawPromptAt(file, '11:00')).toBeUndefined();
    });
});

describe('newUnstamped', () => {
    const head = 'W1 an old unstamped line\n';

    test('a W-line added since HEAD with no stamp is named', () => {
        expect(newUnstamped(`${head}W2 a fresh fold\n`, head)).toEqual([
            'W2 a fresh fold',
        ]);
    });

    test('a stamped new line and an old unstamped one pass', () => {
        expect(
            newUnstamped(`${head}W2 (2026-10-26 09:12, dima): stamped\n`, head),
        ).toEqual([]);
    });
});

describe('full wish ids in the groom checks', () => {
    const head = 'W1 an old unstamped line\n';

    test.each([
        ['stamp-first', 'PK-3:W2 (2026-11-06 10:00, dima): words'],
        ['bulleted', '* FRM-9:W2 (2026-11-06 10:00, dima): words'],
        ['inbox', 'PK-3:W2 (2026-11-06 inbox, dima): words'],
        ['drift', 'PK-3:W2 · words (2026-11-06 10:00, dima)'],
    ])('a %s full-id stamped line passes', (_name, line) => {
        expect(newUnstamped(`${head}${line}\n`, head)).toEqual([]);
    });

    test('an old unstamped line that only gained a prefix is not new', () => {
        expect(
            newUnstamped('PK-3:W1 an old unstamped line\n', head, 'PK-3'),
        ).toEqual([]);
    });

    test('an old unstamped line that swapped to another home is new', () => {
        expect(
            newUnstamped('PK-4:W1 an old unstamped line\n', head, 'PK-3'),
        ).toEqual(['PK-4:W1 an old unstamped line']);
    });

    test('a new bare line reds, an old one and a full one pass', async () => {
        const { newBare } = await import('./prompt-groom.ts');
        const old = 'W1 (2026-11-05 10:00, dima): old\n';
        expect(
            newBare(`${old}W2 (2026-11-06 10:00, dima): new\n`, old, 'PK-3'),
        ).toEqual(['W2 (2026-11-06 10:00, dima): new']);
        expect(
            newBare(
                `${old}PK-3:W2 (2026-11-06 10:00, dima): new\n`,
                old,
                'PK-3',
            ),
        ).toEqual([]);
        expect(
            newBare('PK-3:W1 (2026-11-05 10:00, dima): old\n', old, 'PK-3'),
        ).toEqual([]);
    });

    test("a full argument leaves another home's line of that number alone", () => {
        const dir = mkdtempSync(join(tmpdir(), 'groom-tag-'));
        const file = join(dir, '2026-11-06-1000.groomed.md');
        writeFileSync(file, 'PK-3:W1 (x): mine\nFRM-9:W1 (x): theirs\n');
        expect(tagStanding('2026-11-06', dir, 'PK-3:W1')).toEqual(['W1']);
        expect(readFileSync(file, 'utf8')).toBe(
            'PK-3:W1 (x): mine #standing\nFRM-9:W1 (x): theirs\n',
        );
    });

    test("a move refuses another home's id and a home numbering twice, and skips a quoted line", async () => {
        const { moveWishes } = await import('./prompt-groom.ts');
        const ticket = '* FRM-9:W6 (x): six\n';
        expect(() =>
            moveWishes('PK-3:W1 (x): a\n', ticket, 'PK-3', 'FRM-9', [
                'PK-4:W1',
            ]),
        ).toThrow(/PK-4:W1/);
        expect(() =>
            moveWishes('W1 (x): a\nPK-3:W1 (y): b\n', ticket, 'PK-3', 'FRM-9', [
                'W1',
            ]),
        ).toThrow(/twice/);
        expect(
            moveWishes(
                'PK-3:W1 (y): mine\nPK-4:W1 (x): quote\n',
                ticket,
                'PK-3',
                'FRM-9',
                ['W1'],
            ).lines,
        ).toEqual(['* FRM-9:W7 (y): mine']);
    });

    test('a blank line above an old bare line never makes it new', async () => {
        const { newBare } = await import('./prompt-groom.ts');
        const old = 'a note\nW1 (2026-11-05 10:00, dima): old\n';
        expect(
            newBare(
                'a note\n\nW1 (2026-11-05 10:00, dima): old\n',
                old,
                'PK-3',
            ),
        ).toEqual([]);
    });

    test('a bare id two homes answer to is refused, nothing lifted', () => {
        const dir = mkdtempSync(join(tmpdir(), 'groom-lift-'));
        const file = join(dir, '2026-11-06-1000.groomed.md');
        const body = 'PK-3:W1 (x): a #standing\nFRM-9:W1 (x): b #standing\n';
        writeFileSync(file, body);
        expect(() => liftStanding('2026-11-06', dir, 'W1')).toThrow(/full id/);
        expect(readFileSync(file, 'utf8')).toBe(body);
    });

    test('a brand new unstamped full line is new', () => {
        expect(newUnstamped(`${head}PK-3:W2 a fresh fold\n`, head)).toEqual([
            'PK-3:W2 a fresh fold',
        ]);
    });

    test.each([
        ['a full argument', 'PK-3:W1'],
        ['a bare argument', 'W1'],
    ])(
        'tagStanding takes %s and tags a full line and a bare line',
        (_name, id) => {
            const dir = mkdtempSync(join(tmpdir(), 'groom-tag-'));
            const full = join(dir, '2026-11-06-1000.groomed.md');
            const bare = join(dir, '2026-11-06-1100.groomed.md');
            writeFileSync(full, 'PK-3:W1 (2026-11-06 10:00, dima): full\n');
            writeFileSync(
                bare,
                'W1 (2026-11-06 11:00, dima): bare\nW2 (2026-11-06 11:00, dima): other\n',
            );
            expect(tagStanding('2026-11-06', dir, id)).toEqual(['W1', 'W1']);
            expect(readFileSync(full, 'utf8')).toBe(
                'PK-3:W1 (2026-11-06 10:00, dima): full #standing\n',
            );
            expect(readFileSync(bare, 'utf8')).toBe(
                'W1 (2026-11-06 11:00, dima): bare #standing\nW2 (2026-11-06 11:00, dima): other\n',
            );
            rmSync(dir, { recursive: true });
        },
    );

    test('liftStanding takes a full argument too', () => {
        const dir = mkdtempSync(join(tmpdir(), 'groom-lift-'));
        writeFileSync(
            join(dir, '2026-11-06-1000.groomed.md'),
            'PK-3:W1 (2026-11-06 10:00, dima): full #standing\n',
        );
        expect(liftStanding('2026-11-06', dir, 'PK-3:W1')).toEqual(['W1']);
        rmSync(dir, { recursive: true });
    });
});

describe('the next wish id of a home (PK-312)', () => {
    test('a home with W-lines numbers on from its own highest', async () => {
        const { nextWishId } = await import('./prompt-groom.ts');
        expect(
            nextWishId('W1 a\n* W12 b\nprose W40 cited, not a line', 'pk-3'),
        ).toBe('PK-3:W13');
    });

    test('a groom not yet appended to its home counts', async () => {
        const { nextWishId } = await import('./prompt-groom.ts');
        expect(
            nextWishId('PK-3:W12 a\n', 'PK-3', [
                'PK-3:W18 (2026-11-11 19:21, dima): b\nPK-4:W40 (x): c\n',
            ]),
        ).toBe('PK-3:W19');
    });

    test('a home with no W-lines starts at one', async () => {
        const { nextWishId } = await import('./prompt-groom.ts');
        expect(nextWishId('## notes\nnothing yet', 'PK-3')).toBe('PK-3:W1');
    });

    test.each([
        ['full', 'PK-3:W4 a\n* PK-3:W12 b\n'],
        ['mixed', 'W4 a\n* PK-3:W12 b\n'],
        ['autolinked', '* [FRM-9](https://linear.app/x/FRM-9):W12 b\n'],
    ])('a %s home numbers on from its highest', async (_name, text) => {
        const { nextWishId } = await import('./prompt-groom.ts');
        expect(nextWishId(text, 'PK-3')).toBe('PK-3:W13');
    });
});

describe('a pocket wish moving to a ticket is renumbered into its series (PK-312, o98)', () => {
    const pocket =
        'W1912 (2026-11-03 19:16, dima): and sharpen shift even more.\nW1975 (2026-11-03 20:26, dima) [re: Q8]: no spam, by nature. ❓\n';
    const ticket =
        '## wish\n\n* W1 (2026-11-03 16:39, dima): good idea.\n* W6 (2026-11-03 16:35, dima): six.\n';

    test('the moved lines take the ticket next ids, text and stamp kept whole', async () => {
        const { moveWishes } = await import('./prompt-groom.ts');
        const { lines } = moveWishes(pocket, ticket, 'PK-3', 'FRM-9', [
            'W1975',
            'W1912',
        ]);
        expect(lines).toEqual([
            '* FRM-9:W7 (2026-11-03 20:26, dima) [re: Q8]: no spam, by nature. ❓',
            '* FRM-9:W8 (2026-11-03 19:16, dima): and sharpen shift even more.',
        ]);
    });

    test('the pocket keeps a moved line naming each old and new id', async () => {
        const { moveWishes } = await import('./prompt-groom.ts');
        const { note } = moveWishes(pocket, ticket, 'PK-3', 'FRM-9', [
            'W1975',
            'W1912',
        ]);
        expect(note).toBe(
            'moved: PK-3:W1975 → FRM-9:W7, PK-3:W1912 → FRM-9:W8',
        );
    });

    test.each([
        ['a bare id', 'W1'],
        ['a full id', 'PK-3:W1'],
    ])('a full-id pocket line moves when asked by %s', async (_name, id) => {
        const { moveWishes } = await import('./prompt-groom.ts');
        const { lines } = moveWishes(
            'PK-3:W1 (2026-11-06 10:00, dima): words\n',
            'FRM-9:W6 (2026-11-03 16:35, dima): six.\n',
            'PK-3',
            'FRM-9',
            [id],
        );
        expect(lines).toEqual(['* FRM-9:W7 (2026-11-06 10:00, dima): words']);
    });

    test('an id the pocket item does not hold is refused, nothing moved', async () => {
        const { moveWishes } = await import('./prompt-groom.ts');
        expect(() =>
            moveWishes(pocket, ticket, 'PK-3', 'FRM-9', ['W1912', 'W5']),
        ).toThrow(/W5/);
    });
});

describe('ungroomedSteersToday', () => {
    test('with no transcript named, no steer is owed', async () => {
        const home = mkdtempSync(join(tmpdir(), 'steer-home-'));
        const dir = join(home, '.claude/projects/-Users-dima-frame--clio');
        mkdirSync(dir, { recursive: true });
        writeFileSync(
            join(dir, 'other-seat.jsonl'),
            `${steer('o4', 'another seat steer')}\n`,
        );
        vi.stubEnv('HOME', home);
        vi.resetModules();
        const groom = await import('./prompt-groom.ts');
        vi.unstubAllEnvs();
        expect(groom.ungroomedSteersToday('2026-10-26', '')).toEqual([]);
    });
});

describe('a groom from another seat', () => {
    test('a wing finds a groom main made at the root', async () => {
        const root = mkdtempSync(join(tmpdir(), 'grooms-'));
        writeFileSync(
            join(root, '2026-11-09-1412.groomed.md'),
            'PK-1:W1 (2026-11-09 14:12, dima): ship it\n',
        );
        vi.stubEnv('PROMPT_GROOM_DIR', root);
        vi.stubEnv('CLIO_SEAT', 'wing-1');
        vi.resetModules();
        const groom = await import('./prompt-groom.ts');
        vi.unstubAllEnvs();
        expect(groom.groomedOnDisk('2026-11-09', '14:12', '')).toBe(true);
    });
});

describe('helga is up by her record (FRM-579)', () => {
    test('a thread named «🎀 helga» with no record is not helga', async () => {
        const { isCopyistLive } = await import('./prompt-groom.ts');
        expect([
            isCopyistLive([{ name: '🎀 helga' }]),
            isCopyistLive([{ name: 'any name', role: 'copyist' }]),
        ]).toEqual([false, true]);
    });
});

test('a --bg helga job maps to its own session id, never the newest file (FRM-579)', async () => {
    const { sessionOfJob } = await import('./prompt-groom.ts');
    const dir = mkdtempSync(join(tmpdir(), 'helga-jobs-'));
    writeFileSync(
        join(dir, '11.json'),
        JSON.stringify({ jobId: 'aaaa1111', sessionId: 'sid-helga' }),
    );
    writeFileSync(
        join(dir, '22.json'),
        JSON.stringify({ jobId: 'bbbb2222', sessionId: 'sid-other' }),
    );
    expect([
        sessionOfJob('aaaa1111', dir),
        sessionOfJob('cccc3333', dir),
    ]).toEqual(['sid-helga', undefined]);
    rmSync(dir, { recursive: true });
});
