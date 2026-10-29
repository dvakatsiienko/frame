import { spawnSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const hook = join(
    import.meta.dirname,
    '../../home/.claude/shelf/hooks/reply-check.py',
);

function check(reply: string, lastMessage?: string, now = '12:00') {
    const dir = mkdtempSync(join(tmpdir(), 'reply-check-'));
    const transcript = join(dir, 'session.jsonl');
    const log = join(dir, 'log.tsv');
    const lines = [
        { message: { content: 'ask', role: 'user' }, type: 'user' },
        {
            message: {
                content: [{ text: reply, type: 'text' }],
                role: 'assistant',
            },
            type: 'assistant',
        },
    ];
    writeFileSync(
        transcript,
        lines.map((line) => JSON.stringify(line)).join('\n'),
    );
    spawnSync('python3', [hook], {
        env: {
            ...process.env,
            REPLY_CHECK_HOME: dir,
            REPLY_CHECK_LOG: log,
            REPLY_CHECK_NOW: now,
            REPLY_CHECK_REMIND: join(dir, 'remind'),
        },
        input: JSON.stringify({
            last_assistant_message: lastMessage,
            session_id: 'test',
            transcript_path: transcript,
        }),
    });
    if (!existsSync(log)) return [];
    return readFileSync(log, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => line.split('\t')[3]);
}

function stop(
    reply: string,
    now: string,
    active = false,
    home = mkdtempSync(join(tmpdir(), 'reply-check-')),
    session = 'test',
) {
    const run = spawnSync('python3', [hook], {
        encoding: 'utf8',
        env: {
            ...process.env,
            REPLY_CHECK_HOME: home,
            REPLY_CHECK_LOG: join(home, 'log.tsv'),
            REPLY_CHECK_NOW: now,
            REPLY_CHECK_REMIND: join(home, 'remind'),
        },
        input: JSON.stringify({
            last_assistant_message: reply,
            session_id: session,
            stop_hook_active: active,
        }),
    });
    const out = run.stdout.trim();
    return out
        ? (JSON.parse(out) as { decision: string; reason: string })
        : undefined;
}

// a home whose registry names the session and whose stash store mirrors its orbit asks, dima's marks as given
function fleet(name: string, marks: (string | undefined)[]) {
    const home = mkdtempSync(join(tmpdir(), 'reply-check-home-'));
    mkdirSync(join(home, '.claude/sessions'), { recursive: true });
    mkdirSync(join(home, '.claude/plugins/store'), { recursive: true });
    writeFileSync(
        join(home, '.claude/sessions/1.json'),
        JSON.stringify({ name, pid: 1, sessionId: 'sid-1' }),
    );
    writeFileSync(
        join(home, '.claude/plugins/store/x-mod-stash_inline-0.json'),
        JSON.stringify({
            'asks:sid-1': {
                asks: marks.map((_, i) => `ask ${i}`),
                at: Date.now(),
                items: marks.map((mark, i) => ({
                    id: `o${i + 1}`,
                    pick: 'yes',
                    text: `ask ${i}`,
                    ...(mark ? { mark } : {}),
                })),
            },
        }),
    );
    return home;
}

describe('reply-check: clio names dima in her 🔭 while his ask is open', () => {
    it('reminds, never blocks, her reply whose 🔭 omits dima while an ask waits on him', () => {
        const home = fleet('🦉 clio', [undefined]);
        const out = stop(
            'done.\n\n🔭 waiting on **🔧 coder**',
            '12:00',
            false,
            home,
            'sid-1',
        );
        expect(out).toBeUndefined();
        expect(readFileSync(join(home, 'remind/sid-1.txt'), 'utf8')).toMatch(
            /no 🔭 line naming/,
        );
    });

    it('passes her reply whose 🔭 names dima', () => {
        const home = fleet('🦉 clio', [undefined]);
        const out = stop(
            'done.\n\n🔭 waiting on **🙋‍♂️ dima**',
            '12:00',
            false,
            home,
            'sid-1',
        );
        expect(out).toBeUndefined();
    });

    it('passes her reply when every ask is already marked', () => {
        const home = fleet('🦉 clio', ['accepted']);
        expect(stop('done.', '12:00', false, home, 'sid-1')).toBeUndefined();
    });

    it('passes another session holding an open ask', () => {
        const home = fleet('☕️ 🔧 mods coder', [undefined]);
        expect(stop('done.', '12:00', false, home, 'sid-1')).toBeUndefined();
    });
});

describe('reply-check: an internal id carries a gloss at first use', () => {
    it('lets an unglossed id through: a style miss returns as a reminder, never a block', () => {
        expect(stop('ticked o56, moving on', '12:00')).toBeUndefined();
    });

    it('passes an id glossed in brackets, after a colon or a dash', () => {
        expect(
            stop(
                'o56 (the trash ask) landed; PK-50: quiet comms trial; I7 — the stale bars',
                '12:00',
            ),
        ).toBeUndefined();
    });

    it('passes a grill question label, which the reply itself prints', () => {
        expect(stop('Q1 a settings file wins', '12:00')).toBeUndefined();
    });

    it('judges only the first use: a later bare mention passes', () => {
        expect(
            stop('o56 (the trash ask) landed. o56 is closed.', '12:00'),
        ).toBeUndefined();
    });

    it('passes an id inside inline code or a link label', () => {
        expect(
            stop('see `o56` and [PK-50](https://example.com/pk)', '12:00'),
        ).toBeUndefined();
    });
});

describe('reply-check', () => {
    it('logs a markdown table', () => {
        expect(check('| a | b |\n| --- | --- |\n| 1 | 2 |')).toEqual(['table']);
    });

    it('logs a middot chain in a sentence', () => {
        expect(check('topic a · topic b · topic c')).toContain('middot');
    });

    it('passes the last-report footer', () => {
        expect(
            check('ok.\n📄 last report: **x**, 18:30', undefined, '18:45'),
        ).toEqual([]);
    });

    it('reads the stop event message over a lagging transcript', () => {
        expect(check('an earlier clean block', 'topic a · topic b')).toEqual([
            'middot',
        ]);
    });

    it('logs a commit hash in prose', () => {
        expect(check('it landed as c8f653f2 on main')).toEqual(['commit-hash']);
    });

    it('ignores everything inside a code fence', () => {
        expect(check('```\nFRM-12 | a |\nc8f653f2\n```')).toEqual([]);
    });

    it('logs a 📄 stamp later than the reply time', () => {
        expect(
            check('ok.\n📄 last report: **x**, 12:40', undefined, '12:05'),
        ).toEqual(['future-stamp']);
    });

    it('passes a 📄 stamp at or before the reply time', () => {
        expect(
            check('ok.\n📄 last report: **x**, 11:58', undefined, '12:05'),
        ).toEqual([]);
    });

    it('logs a 📄 stamp later than the reply time without blocking', () => {
        expect(
            stop('ok.\n📄 last report: **x**, 12:40', '12:05'),
        ).toBeUndefined();
        expect(
            check('ok.\n📄 last report: **x**, 12:40', undefined, '12:05'),
        ).toContain('future-stamp');
    });

    it('lets the stop through when a block already ran this stop', () => {
        expect(stop('ok.\n📄 last report: **x**, 12:40', '12:05', true)).toBe(
            undefined,
        );
    });

    it('lets the stop through on a clean stamp', () => {
        expect(stop('ok.\n📄 last report: **x**, 11:58', '12:05')).toBe(
            undefined,
        );
    });

    it('passes a 📄 stamp from before midnight after it', () => {
        expect(
            check('ok.\n📄 last report: **x**, 23:50', undefined, '00:10'),
        ).toEqual([]);
    });
});

describe('a relative link that resolves to nothing', () => {
    function stopIn(reply: string, cwd: string) {
        const home = mkdtempSync(join(tmpdir(), 'reply-check-'));
        const run = spawnSync('python3', [hook], {
            encoding: 'utf8',
            env: {
                ...process.env,
                REPLY_CHECK_HOME: home,
                REPLY_CHECK_LOG: join(home, 'log.tsv'),
                REPLY_CHECK_NOW: '12:00',
                REPLY_CHECK_REMIND: join(home, 'remind'),
            },
            input: JSON.stringify({
                cwd,
                last_assistant_message: reply,
                session_id: 'test',
            }),
        });
        const out = run.stdout.trim();
        return out ? (JSON.parse(out) as { reason: string }) : undefined;
    }
    const folder = mkdtempSync(join(tmpdir(), 'reply-check-cwd-'));
    mkdirSync(join(folder, 'docs'));
    writeFileSync(join(folder, 'docs/a b.md'), '');

    it('lets a link whose path is absent through: it returns as a reminder', () => {
        expect(stopIn('see [x](docs/gone.md)', folder)).toBeUndefined();
    });

    it('passes a present path, a line suffix and a percent-encoded space', () => {
        expect(
            stopIn('[a](docs/a%20b.md) and [b](docs/a%20b.md:3)', folder),
        ).toBe(undefined);
    });
});

describe('a link checked from the launch folder after a cd', () => {
    it('passes a link that resolves from CLAUDE_PROJECT_DIR while cwd moved', () => {
        const project = mkdtempSync(join(tmpdir(), 'reply-check-project-'));
        mkdirSync(join(project, 'docs'));
        mkdirSync(join(project, 'sub'));
        writeFileSync(join(project, 'docs/here.md'), '');
        const home = mkdtempSync(join(tmpdir(), 'reply-check-'));
        const out = spawnSync('python3', [hook], {
            encoding: 'utf8',
            env: {
                ...process.env,
                CLAUDE_PROJECT_DIR: project,
                REPLY_CHECK_HOME: home,
                REPLY_CHECK_LOG: join(home, 'log.tsv'),
                REPLY_CHECK_NOW: '12:00',
                REPLY_CHECK_REMIND: join(home, 'remind'),
            },
            input: JSON.stringify({
                cwd: join(project, 'sub'),
                last_assistant_message: 'see [x](docs/here.md)',
                session_id: 'test',
            }),
        }).stdout.trim();
        expect(out).toBe('');
    });
});

describe('a reply that is only the stamp', () => {
    it('reminds, never blocks, a reply whose lines are only 📄 and 🔭', () => {
        const home = mkdtempSync(join(tmpdir(), 'reply-check-'));
        expect(
            stop(
                '📄 last report: **x**, 11:58\n\n🔭 waiting on dima',
                '12:05',
                false,
                home,
            ),
        ).toBeUndefined();
        expect(readFileSync(join(home, 'remind/test.txt'), 'utf8')).toContain(
            'mid-turn block',
        );
    });

    it('passes a lone 🔭 line and a reply with an answer above the stamp', () => {
        expect(stop('🔭 waiting on dima', '12:05')).toBe(undefined);
        expect(
            stop('the answer is 42.\n\n📄 last report: **x**, 11:58', '12:05'),
        ).toBe(undefined);
    });
});
