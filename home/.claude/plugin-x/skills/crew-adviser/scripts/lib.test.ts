import { spawnSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    utimesSync,
    writeFileSync,
} from 'node:fs';
import { type Server, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';

import {
    type Note,
    type PlanReview,
    appendNoteOnce,
    blindPrompt,
    blindSections,
    charterHash,
    clioThreadOf,
    dropStaleRelay,
    heldForAfterTurn,
    heldUnsent,
    isHeldDue,
    isLocated,
    isParked,
    ledgerLine,
    meterLine,
    noneReceipt,
    planNotes,
    planPrompt,
    readCharter,
    sessionOfJob,
    setHot,
    stashModOf,
    takesSocketLines,
    threadOfNoteId,
    wakeLine,
} from './lib.ts';
import { buildPacket } from './packet.ts';
import { fixtures, lines } from './test-rows.ts';
import { readLines, transcriptDelta } from './transcript.ts';

test('the boot prompt is the x:crew-adviser skill body, frontmatter cut', () => {
    const charter = readCharter();
    expect(charter.startsWith('you are crow')).toBe(true);
    expect(charter).toContain('the silence bar');
});

test('the boot prompt carries the passport after the skill', () => {
    expect(readCharter()).toContain("# crow — clio's parked adviser");
});

test('a wake line names a charter a cleared session can read', () => {
    const line = wakeLine({ id: '202610100900', mode: 'day', phase: 'live' });
    const [, hash, charter] = /· charter (\w{8}) (\S+)$/.exec(line) ?? [];
    expect(hash).toBe(charterHash());
    expect(existsSync(charter ?? '')).toBe(true);
});

test('_crow/AGENTS.md holds the mechanics, never the hunts', () => {
    const agents = readFileSync(
        join(import.meta.dirname, '../../../../../../_crow/AGENTS.md'),
        'utf8',
    );
    expect(agents).not.toMatch(/a dropped ask|the silence bar/);
});

describe('appendNoteOnce', () => {
    test('a second note with the same id is not appended', () => {
        const path = join(mkdtempSync(join(tmpdir(), 'crow-')), 'notes.jsonl');
        const note = {
            at: '2026-10-21T10:53:45Z',
            channel: 'session',
            id: 'w1-opus',
            note: 'x',
        } as Note;
        appendNoteOnce(path, note);
        appendNoteOnce(path, note);
        expect(readLines(path)).toHaveLength(1);
    });

    test('a racer that read the file before the first write still writes nothing', () => {
        const path = join(mkdtempSync(join(tmpdir(), 'crow-')), 'notes.jsonl');
        mkdirSync(`${path}.ids`);
        writeFileSync(join(`${path}.ids`, 'w1-opus'), '');
        appendNoteOnce(path, { id: 'w1-opus', note: 'x' } as Note);
        expect(existsSync(path)).toBe(false);
    });
});

describe('isParked', () => {
    const now = new Date('2026-11-04T12:00:00Z');
    const reset = (hoursLeft: number) =>
        now.getTime() / 1000 + hoursLeft * 3600;
    const meter = (usedPercentage: number, hoursLeft: number) => {
        const path = join(mkdtempSync(join(tmpdir(), 'crow-')), 'u.json');
        writeFileSync(
            path,
            JSON.stringify({
                rate_limits: {
                    five_hour: {
                        resets_at: reset(hoursLeft),
                        used_percentage: usedPercentage,
                    },
                },
            }),
        );
        return path;
    };

    test.each([
        ['6 over pace', 56, 2.5, true],
        ['exactly 5 over pace', 55, 2.5, true],
        ['on pace', 50, 2.5, false],
        ['90 % with more than an hour left', 90, 1.5, true],
        ['91 % with half an hour left, under pace', 91, 0.5, false],
        ['a burn: 95 % with 50 min left, 12 over pace', 95, 50 / 60, false],
        ['55 min left is a burn', 89, 55 / 60, false],
        ['56 min left is still a park', 89, 56 / 60, true],
        ['his 58 min, 89 % is still a park', 89, 58 / 60, true],
        ['the 97 % reserve with 20 min left', 97, 1 / 3, true],
        ['a window past its reset', 99, -1, false],
    ] as const)('%s', (_label, used, left, expected) => {
        expect(isParked(now, meter(used, left))).toBe(expected);
    });

    test('no meter file is no park', () => {
        expect(isParked(now, '/nope/u.json')).toBe(false);
    });
});

describe('stashModOf', () => {
    test('picks the plugin dir named stash, whatever the dir is called', () => {
        const home = mkdtempSync(join(tmpdir(), 'crow-mods-'));
        for (const [dir, name] of [
            ['breather', 'breather'],
            ['renamed', 'x-mod-stash'],
        ] as const) {
            mkdirSync(join(home, dir, '.claude-plugin'), { recursive: true });
            writeFileSync(
                join(home, dir, '.claude-plugin/plugin.json'),
                JSON.stringify({ name }),
            );
        }
        expect(stashModOf('~/breather:~/renamed', home)).toEqual({
            dir: join(home, 'renamed'),
            name: 'x-mod-stash',
        });
    });
});

describe('setHot', () => {
    test('adds the session hot key beside the keys already stored', () => {
        const store = join(
            mkdtempSync(join(tmpdir(), 'crow-store-')),
            's.json',
        );
        writeFileSync(store, JSON.stringify({ afk: false }));
        setHot(store, 'abc', 5);
        expect(JSON.parse(readFileSync(store, 'utf8'))).toEqual({
            afk: false,
            'hot:abc': { since: 5 },
        });
    });
});

const plan = readFileSync(join(fixtures, 'plan.md'), 'utf8');

describe('plan prompts', () => {
    test('carry no line of clio’s transcript and no earlier verdict', () => {
        const earlier = [
            'the rename finding was right, dima took it',
            'store writes race under two shells',
        ];
        const prompts = [
            blindPrompt(blindSections(plan)),
            planPrompt(plan, 'a blind take'),
        ].join('\n');
        const transcriptLines = transcriptDelta(lines, 0)
            .text.split('\n')
            .filter((line) => line.trim() && !line.startsWith('## '));
        expect(transcriptLines.length).toBeGreaterThan(0);
        expect(
            [...transcriptLines, ...earlier].filter((line) =>
                prompts.includes(line),
            ),
        ).toEqual([]);
    });
});

describe('blindSections', () => {
    test('keeps every want, not and done-test section', () => {
        const blind = blindSections(plan);
        expect(
            [
                'one keystroke per count',
                'not a habit tracker',
                'then it prints 4',
            ].filter((line) => !blind.includes(line)),
        ).toEqual([]);
    });

    test('drops the build sections, their subsections too', () => {
        const blind = blindSections(plan);
        expect(
            ['a go binary', 'temp file and a rename'].filter((line) =>
                blind.includes(line),
            ),
        ).toEqual([]);
    });

    test('reads a # line inside a code fence as text, never a heading', () => {
        const fenced =
            '## the want\n\n```sh\n# the build\n```\n\nstill the want';
        expect(blindSections(fenced)).toContain('still the want');
    });
});

describe('isLocated', () => {
    test('finds a quote copied with its bullet and new spacing', () => {
        expect(
            isLocated(plan, '- writes go  through a temp file and a rename'),
        ).toBe(true);
    });

    test('rejects a quote the plan does not hold', () => {
        expect(isLocated(plan, 'writes go straight to the file')).toBe(false);
    });
});

describe('planNotes', () => {
    const run = {
        arm: 'fable',
        at: '2026-10-06T20:00:00.000Z',
        costUsd: 0.4,
        effort: 'high',
        model: 'claude-fable-5-1',
        plan: '/p/plan.md',
        planText: plan,
        runId: '202610062000',
        seconds: 90,
        tokensIn: 10,
        tokensOut: 5,
    } as const;
    const review = {
        againstDecisions: [],
        findings: [],
        fragileAssumptions: [],
        missing: [],
        noMaterialObjection: true,
        openQuestions: [],
        preMortem: [],
        problemAreas: [],
        verdict: 'proceed',
    } satisfies PlanReview;

    test('logs a clean run as one line with no finding', () => {
        expect(planNotes(run, { ...review, findings: [] })).toMatchObject([
            { channel: 'plan', finding: null, id: 'plan-202610062000-0' },
        ]);
    });

    test('logs the run row plus one line per finding, the cost once', () => {
        const finding = {
            problem: 'p',
            severity: 'high',
            test: 't',
        } as const;
        const notes = planNotes(run, {
            ...review,
            findings: [
                { ...finding, quote: 'a go binary, state in one json file' },
                { ...finding, quote: 'an invented line' },
            ],
            noMaterialObjection: false,
            verdict: 'revise',
        });
        expect(
            notes.map(({ arm, costUsd, finding: f, id }) => ({
                arm,
                costUsd,
                id,
                located: f?.located,
            })),
        ).toEqual([
            {
                arm: 'fable',
                costUsd: 0.4,
                id: 'plan-202610062000-0',
                located: undefined,
            },
            {
                arm: 'fable',
                costUsd: undefined,
                id: 'plan-202610062000-1',
                located: true,
            },
            {
                arm: 'fable',
                costUsd: undefined,
                id: 'plan-202610062000-2',
                located: false,
            },
        ]);
    });

    test('five findings sum to the cost of the run', () => {
        const finding = {
            problem: 'p',
            quote: 'q',
            severity: 'high',
            test: 't',
        } as const;
        const notes = planNotes(run, {
            ...review,
            findings: Array.from({ length: 5 }, () => finding),
        });
        expect(notes.reduce((sum, n) => sum + (n.costUsd ?? 0), 0)).toBe(0.4);
    });
});

// FRM-579: x's records, as `x thread list` answers them, name the thread; a name with no record names none
describe('clioThreadOf', () => {
    const threads = [
        { display: '🌗 🔧 mods | FRM-1', role: 'codie', sessionId: 'bbb' },
        { display: '🦉 clio', role: 'coordinator', sessionId: 'aaa' },
        {
            display: '🦉🪽 clio: wing 12',
            role: 'wing',
            sessionId: 'ccc',
            wing: 12,
        },
        // a record-less thread whose drawn name reads as clio's
        { display: '🦉 clio', sessionId: 'ddd' },
    ];

    test("the coordinator's record is the main thread", () => {
        expect(clioThreadOf('/p/aaa.jsonl', threads)).toEqual({
            id: 'main',
            name: '🦉 clio',
        });
    });

    test('any wing is its own thread, read from its number', () => {
        expect(clioThreadOf('/p/ccc.jsonl', threads)?.id).toBe('wing-12');
    });

    test('a coder transcript under the clio dir is no thread', () => {
        expect(clioThreadOf('/p/bbb.jsonl', threads)).toBeUndefined();
    });

    test("a fork carrying main's name holds no record, so it is no thread", () => {
        expect(clioThreadOf('/p/ddd.jsonl', threads)).toBeUndefined();
    });
});

describe('threadOfNoteId', () => {
    test('a note id names its thread', () => {
        expect([
            threadOfNoteId('202611072240-opus'),
            threadOfNoteId('202611072240w2-opus'),
            threadOfNoteId('202611072240d05w12-opus'),
            threadOfNoteId('202611072240d05-opus'),
            threadOfNoteId('plan-20261106150807-3'),
        ]).toEqual(['main', 'wing-2', 'wing-12', 'main', 'main']);
    });
});

describe('meterLine', () => {
    const NOW = new Date(Date.UTC(2026, 9, 12, 11, 0));
    const sec = (ms: number) => Math.floor(ms / 1000);
    test('prints both windows, their resets and the reading age', () => {
        const path = join(mkdtempSync(join(tmpdir(), 'crow-meter-')), 'u.json');
        writeFileSync(
            path,
            JSON.stringify({
                rate_limits: {
                    five_hour: {
                        resets_at: sec(NOW.getTime() + 3 * 36e5),
                        used_percentage: 6,
                    },
                    seven_day: {
                        resets_at: sec(NOW.getTime() + 160 * 36e5),
                        used_percentage: 1,
                    },
                },
                written_at: sec(NOW.getTime() - 4 * 6e4),
            }),
        );
        expect(meterLine(NOW, path)).toBe(
            '⏱️ 5h 6 %, resets in 3 h | weekly 1 %, resets in 160 h | read 4 min ago',
        );
    });
    test('a missing usage file prints nothing', () => {
        expect(meterLine(NOW, '/nonexistent/u.json')).toBe('');
    });
});

describe('heldUnsent', () => {
    const NOW = new Date(2026, 10, 3, 13, 0);
    const ago = (min: number) =>
        new Date(NOW.getTime() - min * 60_000).toISOString();
    const session = (note: string, min: number) => ({
        at: ago(min),
        channel: 'session',
        id: `n${min}`,
        note,
    });
    function notes(...rows: object[]) {
        const path = join(mkdtempSync(join(tmpdir(), 'crow-held-')), 'n.jsonl');
        writeFileSync(path, rows.map((r) => JSON.stringify(r)).join('\n'));
        return path;
    }
    const HELD = '🟡 held: until the break';

    test('a held note with nothing sent after it comes back', () => {
        expect(
            heldUnsent(NOW, notes(session(HELD, 10))).map((n) => n.id),
        ).toEqual(['n10']);
    });
    test('a note sent after it settles it, so a sent note is never resent', () => {
        expect(
            heldUnsent(NOW, notes(session(HELD, 10), session('🔴 sent: x', 5))),
        ).toEqual([]);
    });
    test('a none after it settles nothing', () => {
        expect(
            heldUnsent(NOW, notes(session(HELD, 10), session('none', 5))),
        ).toHaveLength(1);
    });
    test('past 60 min it is gone, and another channel never counts', () => {
        expect(heldUnsent(NOW, notes(session(HELD, 61)))).toEqual([]);
        expect(
            heldUnsent(NOW, notes({ ...session(HELD, 10), channel: 'plan' })),
        ).toEqual([]);
    });
    test('no notes file is none', () => {
        expect(heldUnsent(NOW, '/nope/n.jsonl')).toEqual([]);
    });
    test("a thread's packet holds only its own notes, and another thread's send settles none", () => {
        const wingHeld = { ...session(HELD, 10), id: '202611031250w2-opus' };
        const path = notes(wingHeld, session('🔴 sent: x', 5));
        expect([
            heldUnsent(NOW, path, 'wing-2').map((n) => n.id),
            heldUnsent(NOW, path),
        ]).toEqual([['202611031250w2-opus'], []]);
    });
    test('the packet carries the section, and a wake with none leaves it out', () => {
        const dir = join(mkdtempSync(join(tmpdir(), 'crow-')), 'packet');
        buildPacket({
            deltaText: 'x',
            dir,
            held: [{ at: ago(10), id: 'n10', note: HELD }],
            leaves: [],
            missing: [],
        });
        const text = readFileSync(join(dir, 'packet.md'), 'utf8');
        expect(text).toContain('## held by the last crow');
        expect(text).toContain(HELD);
        buildPacket({ deltaText: 'x', dir, leaves: [], missing: [] });
        expect(readFileSync(join(dir, 'packet.md'), 'utf8')).not.toContain(
            'held by the last crow',
        );
    });
});

describe('ledgerLine', () => {
    const NOW = new Date(2026, 9, 11, 21, 0);
    const at = (h: number, m: number, day = 11) =>
        new Date(2026, 9, day, h, m).toISOString();
    function files(notes: object[], verdicts: object[] = []) {
        const dir = mkdtempSync(join(tmpdir(), 'crow-ledger-'));
        const jsonl = (rows: object[]) =>
            rows.map((r) => JSON.stringify(r)).join('\n');
        writeFileSync(join(dir, 'notes.jsonl'), jsonl(notes));
        writeFileSync(join(dir, 'verdicts.jsonl'), jsonl(verdicts));
        return [join(dir, 'notes.jsonl'), join(dir, 'verdicts.jsonl')] as const;
    }
    const session = (note: string, time: string) => ({
        at: time,
        channel: 'session',
        note,
    });

    test('counts today sent notes, never a none, a holdout or another day', () => {
        const [n, v] = files([
            session('🐦‍⬛ **a** | sent | x', at(9, 0)),
            session('none', at(10, 0)),
            session('🐦‍⬛ **b** | held | y\nholdout', at(11, 0)),
            session('🐦‍⬛ 21:10 wake 1\n🟡 held: one finding', at(21, 10)),
            session('🐦‍⬛ **c** | sent | z', at(9, 0, 10)),
            { at: at(12, 0), channel: 'plan', note: 'p' },
            session('🐦‍⬛ **d** | sent | w', at(20, 56)),
        ]);
        expect(ledgerLine(NOW, n, v)).toBe(
            '📒 2 sent today | last 20:56 | 🎯 0 ok today',
        );
    });

    test("counts only today's ok verdicts", () => {
        const [n, v] = files(
            [],
            [
                { at: at(9, 0), id: 'a', value: 'ok' },
                { at: at(9, 0), id: 'b', value: 'miss' },
                { at: at(9, 0, 10), id: 'c', value: 'ok' },
            ],
        );
        expect(ledgerLine(NOW, n, v)).toBe(
            '📒 0 sent today | last none | 🎯 1 ok today',
        );
    });
});

// relay.ts: a wake x-mod-stash has not sent yet stays parked for its next poll; clio's prompt hook prints nothing
test('an unsent parked wake stays parked and puts nothing in clio’s context', () => {
    const state = mkdtempSync(join(tmpdir(), 'crow-state-'));
    const relay = join(state, 'relay.json');
    writeFileSync(
        relay,
        JSON.stringify({
            id: 'w1',
            line: 'wake w1',
            mode: 'day',
            phase: 'live',
        }),
    );
    const run = spawnSync('node', [join(import.meta.dirname, 'relay.ts')], {
        encoding: 'utf8',
        env: { ...process.env, CROW_STATE_DIR: state },
        timeout: 10_000,
    });
    expect([run.status, run.stdout, existsSync(relay)]).toEqual([0, '', true]);
});

describe('dropStaleRelay', () => {
    const parked = () => {
        const path = join(mkdtempSync(join(tmpdir(), 'relay-')), 'relay.json');
        writeFileSync(path, '{}');
        return path;
    };

    test('drops a wake parked longer than the gap', () => {
        const path = parked();
        const old = new Date(Date.now() - 31 * 60_000);
        utimesSync(path, old, old);
        expect(dropStaleRelay(path)).toBe(true);
        expect(existsSync(path)).toBe(false);
    });

    test('keeps a wake parked inside the gap', () => {
        const path = parked();
        expect(dropStaleRelay(path)).toBe(false);
        expect(existsSync(path)).toBe(true);
    });

    test('is quiet with no parked wake', () => {
        expect(dropStaleRelay(join(tmpdir(), 'no-relay-here.json'))).toBe(
            false,
        );
    });
});

describe('heldForAfterTurn', () => {
    const state = (heldFor: string, leavesFor: string) => ({
        heldFor,
        leavesFor,
        offsets: {},
    });

    test('a turn in the packed transcript settles it', () => {
        expect(heldForAfterTurn(state('t1', 't2'), 't2', false)).toBe('t2');
    });

    test('a /clear relay with no note leaves it due for the new transcript', () => {
        expect(heldForAfterTurn(state('t1', 't1'), 't2', false)).toBe('t1');
    });

    test('a /clear relay that carried the note settles it, no second copy', () => {
        expect(heldForAfterTurn(state('t0', 't1'), 't2', true)).toBe('t2');
    });
});

test('before any heldFor, the crow that read the leaves keeps its own hold', () => {
    expect(isHeldDue({ leavesFor: 't1', offsets: {} }, 't1')).toBe(false);
    expect(isHeldDue({ leavesFor: 't1', offsets: {} }, 't2')).toBe(true);
});

describe('takesSocketLines', () => {
    test('a --bg session with a job id takes them', () => {
        expect(takesSocketLines({ jobId: 'abc' })).toBe(true);
    });
    test('a cli session in a herdr pane takes them', () => {
        expect(takesSocketLines({ entrypoint: 'cli' })).toBe(true);
    });
    test('a desktop tab does not', () => {
        expect(takesSocketLines({ entrypoint: 'claude-desktop' })).toBe(false);
    });
});

// FRM-579: a --bg crow is recorded by the session its own job started, never the newest registry file
test('a --bg job maps to its own session id, two starts at once never swap', () => {
    const dir = mkdtempSync(join(tmpdir(), 'crow-jobs-'));
    writeFileSync(
        join(dir, '11.json'),
        JSON.stringify({ jobId: 'aaaa1111', sessionId: 'sid-crow' }),
    );
    writeFileSync(
        join(dir, '22.json'),
        JSON.stringify({ jobId: 'bbbb2222', sessionId: 'sid-other' }),
    );
    expect([
        sessionOfJob('aaaa1111', dir),
        sessionOfJob('cccc3333', dir),
    ]).toEqual(['sid-crow', undefined]);
});

// clio holds a grill round for crow's note or 3 min, and a clean read is a `none` that only reached the notes log
describe('a proposal wake that crow answers none', () => {
    const proposal = '/frame/.scratch/x/grill-2-proposal.md';
    const servers: Server[] = [];

    // a clio thread's session: its record in the thread list, its file in the sessions dir, a socket that records lines
    function clioThread(
        sessionId: string,
        role: 'coordinator' | 'wing',
        wing?: number,
    ) {
        const dir = mkdtempSync(join(tmpdir(), 'crow-none-'));
        const socket = join(dir, `${sessionId}.sock`);
        const heard: string[] = [];
        servers.push(
            createServer((conn) => {
                let buffer = '';
                conn.on('data', (chunk) => {
                    buffer += chunk;
                });
                conn.on('end', () =>
                    heard.push(JSON.parse(buffer).message.content),
                );
            }).listen(socket),
        );
        return { heard, record: { role, sessionId, wing }, socket };
    }

    function sessionsOf(...threads: ReturnType<typeof clioThread>[]) {
        const dir = mkdtempSync(join(tmpdir(), 'crow-sessions-'));
        for (const [index, thread] of threads.entries()) {
            writeFileSync(
                join(dir, `${index + 1}.json`),
                JSON.stringify({
                    cwd: '/frame/_clio',
                    messagingSocketPath: thread.socket,
                    pid: process.pid,
                    sessionId: thread.record.sessionId,
                }),
            );
        }
        return dir;
    }

    const settle = () => new Promise((done) => setTimeout(done, 50));

    afterAll(() => {
        for (const server of servers) server.close();
    });

    test('reaches its reply-to thread as one line, and no other thread', async () => {
        const main = clioThread('sid-main', 'coordinator');
        const wing = clioThread('sid-wing', 'wing', 1);
        const otherWing = clioThread('sid-wing2', 'wing', 2);

        const sent = await noneReceipt({
            note: 'none',
            proposal,
            sessionsDir: sessionsOf(main, otherWing, wing),
            thread: 'wing-1',
            threads: [main.record, otherWing.record, wing.record],
        });
        await settle();

        expect([sent, wing.heard, main.heard, otherWing.heard]).toEqual([
            true,
            [`🐦‍⬛ crow: none on ${proposal}`],
            [],
            [],
        ]);
    });

    test('a real note, or a wake with no proposal, sends nothing', async () => {
        const main = clioThread('sid-main', 'coordinator');
        const sessionsDir = sessionsOf(main);
        const threads = [main.record];

        const realNote = await noneReceipt({
            note: 'the gate reads wrong',
            proposal,
            sessionsDir,
            thread: 'main',
            threads,
        });
        const otherWake = await noneReceipt({
            note: 'none',
            sessionsDir,
            thread: 'main',
            threads,
        });
        await settle();

        expect([realNote, otherWake, main.heard]).toEqual([false, false, []]);
    });
});
