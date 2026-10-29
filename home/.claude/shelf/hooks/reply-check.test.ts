import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const HOOK = join(import.meta.dirname, 'reply-check.py');
const REMIND = mkdtempSync(join(tmpdir(), 'rc-remind-'));
const SESSION = 'rc-test';

// the line the next prompt carries after a style miss; reading it consumes it, as the real prompt does
const nextPrompt = () =>
    execFileSync('python3', [HOOK, '--prompt'], {
        encoding: 'utf8',
        env: { ...process.env, REPLY_CHECK_REMIND: REMIND },
        input: JSON.stringify({ session_id: SESSION }),
    });

// the hook's stdout for one ended reply: empty when it lets the stop through
const stop = (reply: string) =>
    execFileSync('python3', [HOOK], {
        encoding: 'utf8',
        env: {
            ...process.env,
            REPLY_CHECK_LOG: join(mkdtempSync(join(tmpdir(), 'rc-')), 'log.tsv'),
            REPLY_CHECK_NOW: '15:10',
            REPLY_CHECK_REMIND: REMIND,
        },
        input: JSON.stringify({
            last_assistant_message: reply,
            session_id: SESSION,
        }),
    });

describe('the · rule', () => {
    it('lets a ·-joined list through and reminds at the next prompt, once', () => {
        expect(stop('the crew: 🐜 chores · 🐝 researcher · 🦡 retro')).toBe('');
        expect(nextPrompt()).toContain('one bullet per item');
        expect(nextPrompt()).toBe('');
    });

    it('passes the same items as bullets', () => {
        expect(stop('the crew:\n- 🐜 chores\n- 🐝 researcher\n- 🦡 retro')).toBe('');
    });

    it('passes a · inside a fence, inline code or the 📄 line', () => {
        const reply = [
            'done.',
            '```\nlane\n1. a · b ➡️ yes\n```',
            'the hook printed `a · b` as asked.',
            '📄 last report: **mods** · 15:09',
        ].join('\n\n');
        expect(stop(reply)).toBe('');
    });

    it('never blocks a 🔭 line on a ccrow wake, and reminds at the next prompt', () => {
        expect(stop('done.\n\n🔭 waiting on 🐦‍⬛ ccrow’s 22:16 wake')).toBe('');
        expect(nextPrompt()).toContain('a wake never holds the session');
    });

    it('passes prose that mentions the 🔭 rule and ccrow', () => {
        expect(stop('🔔 ccrow: my 🔭 line named its wake, and a wake holds nothing.')).toBe('');
    });

    it('passes a 🔭 line that waits on a real block', () => {
        expect(stop('done.\n\n🔭 waiting on ci for the pushed head')).toBe('');
    });

    it('never blocks a markdown table, and reminds at the next prompt', () => {
        expect(stop('| a | b |\n| --- | --- |\n| 1 | 2 |')).toBe('');
        expect(nextPrompt()).toContain('a markdown table');
    });

    it('never blocks a reply holding only the stamp and the 🔭 line, and reminds', () => {
        expect(stop('📄 last report: **mods**, 15:09\n🔭 waiting on ci')).toBe('');
        expect(nextPrompt()).toContain('mid-turn block');
    });
});

// a transcript whose last prompt carried the prompt hook's clock
const promptedAt = (now: string) => {
    const path = join(mkdtempSync(join(tmpdir(), 'rc-')), 't.jsonl');
    const line = {
        attachment: { hookEvent: 'UserPromptSubmit' },
        rendered: [{ content: `prompt.submit hook additional context: now ${now}` }],
        type: 'attachment',
    };
    writeFileSync(path, `${JSON.stringify(line)}\n`);
    return path;
};

const stopAfter = (reply: string, transcript: string) =>
    execFileSync('python3', [HOOK], {
        encoding: 'utf8',
        env: {
            ...process.env,
            REPLY_CHECK_LOG: join(mkdtempSync(join(tmpdir(), 'rc-')), 'log.tsv'),
            REPLY_CHECK_NOW: '15:10',
            REPLY_CHECK_REMIND: REMIND,
        },
        input: JSON.stringify({ last_assistant_message: reply, session_id: SESSION, transcript_path: transcript }),
    });

describe('the composed clock', () => {
    it('reminds of a 📄 stamp more than 2 minutes before the prompt hook’s now', () => {
        expect(stopAfter('done.\n\n📄 last report: **mods**, 14:58', promptedAt('15:06'))).toBe('');
        expect(nextPrompt()).toContain('📄 stamp 14:58 was off the clock');
    });

    it('passes a 📄 stamp copied from the prompt hook’s now', () => {
        expect(stopAfter('done.\n\n📄 last report: **mods**, 15:06', promptedAt('15:06'))).toBe('');
    });

    it('passes a rewind reprint of an old report', () => {
        const transcript = promptedAt('15:06');
        writeFileSync(
            transcript,
            `${JSON.stringify({ message: { content: 'rewind', role: 'user' }, type: 'user' })}\n`,
            { flag: 'a' },
        );
        expect(stopAfter('the report.\n\n📄 last report: **mods**, 14:22', transcript)).toBe('');
    });

    it('passes a past time quoted in prose', () => {
        expect(stopAfter('the reset landed at 14:40, the commit at 14:11.', promptedAt('15:06'))).toBe('');
    });
});

describe('the grill answer fence', () => {
    it('reminds of a fence pre-filled with grill answers', () => {
        expect(stop('round 1.\n\n```\nQ1 b\nQ2 a\nQ3 a\n```')).toBe('');
        expect(nextPrompt()).toContain('grill picks go to orbit');
    });

    it('passes a Q line in prose between two command fences', () => {
        expect(stop('run:\n\n```\npnpm a\n```\n\nQ1 a settings file wins\n\n```\npnpm b\n```')).toBe('');
    });

    it('passes a fence that only quotes a command', () => {
        expect(stop('run:\n\n```\npnpm mods:test\n```')).toBe('');
    });
});

// the log line for one ended reply, with the session's folder as cwd
const logged = (reply: string, cwd: string) => {
    const log = join(mkdtempSync(join(tmpdir(), 'rc-')), 'log.tsv');
    execFileSync('python3', [HOOK], {
        encoding: 'utf8',
        env: { ...process.env, REPLY_CHECK_LOG: log, REPLY_CHECK_NOW: '15:10' },
        input: JSON.stringify({ cwd, last_assistant_message: reply }),
    });
    try {
        return readFileSync(log, 'utf8');
    } catch {
        return '';
    }
};

describe('the dead-link rule, log-only', () => {
    const home = mkdtempSync(join(tmpdir(), 'rc-home-'));
    writeFileSync(join(home, 'real.md'), 'x');

    it('logs a relative link that does not resolve from the session folder', () => {
        expect(logged('see [list](recipes/last/groom-list.md)', home)).toContain(
            'dead-link\trecipes/last/groom-list.md',
        );
    });

    it('passes a link that resolves, with or without a :line suffix, an absolute one, and a url', () => {
        const reply = [
            '[a](real.md)',
            '[b](real.md:12)',
            `[c](${join(home, 'real.md')})`,
            '[d](https://linear.app/x-com/issue/FRM-1)',
            '[e](#terminal/3)',
        ].join('\n');
        expect(logged(reply, home)).toBe('');
    });
});

describe('the unproven can’t, log-only', () => {
    it('logs a can’t with no command in its paragraph', () => {
        expect(logged('the hook cannot see that tool.', mkdtempSync(join(tmpdir(), 'rc-')))).toContain(
            'unproven-cant\tcannot',
        );
    });

    it('passes a can’t that names its command', () => {
        expect(logged('it cannot: `claude --bare` fails on our login.', mkdtempSync(join(tmpdir(), 'rc-')))).toBe('');
    });
});

describe('the wide claim, log-only', () => {
    it('logs an «every … kept» with no command in its paragraph', () => {
        expect(logged('every quote is kept whole.', mkdtempSync(join(tmpdir(), 'rc-')))).toContain('wide-claim');
    });

    it('passes a claim that names its command', () => {
        expect(logged('every quote is kept: `quote-diff.py HEAD` printed 0 gone.', mkdtempSync(join(tmpdir(), 'rc-')))).toBe('');
    });
});

describe('the grill-drift rule', () => {
    const withAsks = (texts: string[]) => {
        const home = mkdtempSync(join(tmpdir(), 'rc-home-'));
        mkdirSync(join(home, '.claude/plugins/store'), { recursive: true });
        const items = texts.map((text, i) => ({ id: `o${i}`, pick: 'p', text }));
        writeFileSync(
            join(home, '.claude/plugins/store/x-mod-stash_a.json'),
            JSON.stringify({ [`asks:${SESSION}`]: { at: Date.now(), items } }),
        );
        return (reply: string) =>
            execFileSync('python3', [HOOK], {
                encoding: 'utf8',
                env: { ...process.env, REPLY_CHECK_HOME: home, REPLY_CHECK_LOG: join(home, 'log.tsv'), REPLY_CHECK_REMIND: REMIND },
                input: JSON.stringify({ last_assistant_message: reply, session_id: SESSION }),
            });
    };
    const grill = '🔥 grill: x\n1. **a?** one\n2. **b?** two\n\n🔭 waiting on **🙋‍♂️ dima**';

    it('reminds when orbit holds a question the reply does not', () => {
        withAsks(['x Q1 a', 'x Q2 b', 'x Q3 c'])(grill);
        expect(nextPrompt()).toContain('the grill drifted from orbit');
    });

    it('passes when the numbers match', () => {
        withAsks(['x Q1 a', 'x Q2 b'])(grill);
        expect(nextPrompt()).not.toContain('grill drifted');
    });

    it('passes a reply with no grill', () => {
        withAsks(['x Q1 a', 'x Q2 b', 'x Q3 c'])('plain answer\n\n🔭 waiting on **🙋‍♂️ dima**');
        expect(nextPrompt()).not.toContain('grill drifted');
    });
});

// a turn as transcript lines: the prompt, then one assistant message per call list, each with its result
const turnWith = (...messages: { id: string; calls: { name: string; card?: string; input?: object }[] }[]) => {
    const path = join(mkdtempSync(join(tmpdir(), 'rc-')), 't.jsonl');
    const lines: unknown[] = [{ message: { content: 'proceed', role: 'user' }, type: 'user' }];
    for (const { id, calls } of messages) {
        lines.push({
            message: {
                content: calls.map(({ name, card, input }) => ({
                    input: input ?? (card ? { subagent_type: card } : {}),
                    name,
                    type: 'tool_use',
                })),
                id,
            },
            type: 'assistant',
        });
        lines.push({ message: { content: [{ type: 'tool_result' }] }, type: 'user' });
    }
    writeFileSync(path, `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`);
    return path;
};
const wishkeeper = { card: 'wishkeeper', name: 'Agent' };

// a turn whose first assistant message prints text before a tool call, then the final reply
const turnWithText = (midText: string) => {
    const path = join(mkdtempSync(join(tmpdir(), 'rc-')), 't.jsonl');
    const lines: unknown[] = [
        { message: { content: 'proceed', role: 'user' }, type: 'user' },
        { message: { content: [{ text: midText, type: 'text' }, { input: {}, name: 'Bash', type: 'tool_use' }], id: 'm1' }, type: 'assistant' },
        { message: { content: [{ type: 'tool_result' }] }, type: 'user' },
    ];
    writeFileSync(path, `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`);
    return path;
};
const longList = ['1. the first step of the plan, spelled out', '2. the second step of the plan, spelled out', '3. the third step of the plan, spelled out', 'x'.repeat(200)].join('\n');

describe('the never-reached text', () => {
    it('reminds when a long mid-turn block is missing from the last message', () => {
        stopAfter('done, all steps ran.', turnWithText(longList));
        expect(nextPrompt()).toContain('never reached dima');
    });

    it('passes when the last message repeats a line of it', () => {
        stopAfter('done:\n- the second step of the plan, spelled out', turnWithText(longList));
        expect(nextPrompt()).not.toContain('never reached dima');
    });

    it('passes a short mid-turn update', () => {
        stopAfter('done.', turnWithText('checking the gate now, then the commit.'));
        expect(nextPrompt()).not.toContain('never reached dima');
    });
});

// the log a reply leaves when its turn's transcript is known
const loggedAfter = (reply: string, transcript: string) => {
    const log = join(mkdtempSync(join(tmpdir(), 'rc-')), 'log.tsv');
    execFileSync('python3', [HOOK], {
        encoding: 'utf8',
        env: { ...process.env, REPLY_CHECK_LOG: log, REPLY_CHECK_NOW: '15:10', REPLY_CHECK_REMIND: REMIND },
        input: JSON.stringify({ last_assistant_message: reply, session_id: SESSION, transcript_path: transcript }),
    });
    try {
        return readFileSync(log, 'utf8');
    } catch {
        return '';
    }
};
const noCalls = turnWith();

describe('the door claim with no source (PK-224)', () => {
    it('logs a claim of how a door works with nothing beside it', () => {
        expect(logged('the async api takes no commit message, so the squash keeps the title.', mkdtempSync(join(tmpdir(), 'rc-')))).toContain('door-claim\t');
    });

    it('passes the same claim with a file, command or link beside it', () => {
        for (const source of ['(`x/go/gh.go:42`)', '[the docs](https://docs.github.com/x)', 'https://docs.github.com/x']) {
            expect(logged(`the async api takes no commit message ${source}.`, mkdtempSync(join(tmpdir(), 'rc-')))).toBe('');
        }
    });

    it('passes prose that only names a door', () => {
        expect(logged('the cli lists every family; the plugin loads at start.', mkdtempSync(join(tmpdir(), 'rc-')))).toBe('');
    });
});

describe('a checked claim with no evidence call (FRM-429)', () => {
    it.each(['the files are copied whole.', 'I checked the files.', 'I verified the files.', 'proven: the files match.', 'the table is verified by read-back.'])(
        'logs «%s» in a turn with no evidence call',
        (reply) => {
            expect(loggedAfter(reply, noCalls)).toContain('unevidenced\t');
        },
    );

    it.each(['Bash', 'Read', 'Grep', 'mcp__linear__get_issue'])('passes the same word in a turn with a %s call', (name) => {
        expect(loggedAfter('I verified the files.', turnWith({ calls: [{ name }], id: 'm1' }))).toBe('');
    });

    it('does not count an MCP write named with «get» in its server as evidence', () => {
        expect(loggedAfter('I verified the files.', turnWith({ calls: [{ name: 'mcp__getting_started__post_thread' }], id: 'm1' }))).toContain('unevidenced\t');
    });

    it('passes «unverified», «verifier» and a disclosure like «not checked»', () => {
        for (const reply of ['the claim is unverified.', 'the verifier ran.', 'not checked: the desktop look.', 'never verified live.', 'the verifier passed it, so it is verified clean.', 'a parse proven on one build fails on the other.']) {
            expect(loggedAfter(reply, noCalls)).toBe('');
        }
    });

    it.each([
        'the rule was briefed and proven by me.',
        'it went out as checked with no command.',
        'Checked: the desktop look.',
        'Verified — the parse.',
        'I proved nothing yet.',
        'the build was checked against the spec.',
    ])('passes «%s», a form the re-signed line does not name', (reply) => {
        expect(loggedAfter(reply, noCalls)).toBe('');
    });

    it('passes the word inside a fence or inline code', () => {
        expect(loggedAfter('run `x verified`.\n```\nchecked\n```', noCalls)).toBe('');
    });
});

describe('a grill ask with no printed question (dima o18)', () => {
    const grillAdd = (text: string) => turnWith({ calls: [{ input: { asks: [{ pick: 'a', text }], op: 'add' }, name: 'mcp__x-mod-stash__orbit' }], id: 'm1' });

    it.each(['Q3 which lane first?', 'grill round 2: keep the card?'])('logs an orbit ask «%s» added with no ❓ **Q<n>** line', (text) => {
        expect(loggedAfter('asked in orbit.', grillAdd(text))).toContain('grill-unprinted\t');
    });

    it.each(['❓ **Q3** which lane first?', '❓ **Q3, lane order**: which first?', '❓ **Q3 - lane order**: which first?'])(
        'passes the same ask beside a printed «%s» line',
        (line) => {
            expect(loggedAfter(`🔥 grill:\n${line}`, grillAdd('Q3 which lane first?'))).toBe('');
        },
    );

    it('logs an ask naming Q3 when the reply prints only ❓ **Q4**', () => {
        expect(loggedAfter('🔥 grill:\n❓ **Q4** which lane first?', grillAdd('Q3 which lane first?'))).toContain('grill-unprinted\t');
    });

    it('logs a lowercase «q3» ask when the reply prints only ❓ **Q4**', () => {
        expect(loggedAfter('🔥 grill:\n❓ **Q4** which lane first?', grillAdd('q3 which lane first?'))).toContain('grill-unprinted\t');
    });

    it('passes an orbit ask that names no grill round or Q number, a verifier round included', () => {
        expect(loggedAfter('asked.', grillAdd('push FRM-1?'))).toBe('');
        expect(loggedAfter('asked.', grillAdd('close round 6 as the last of slice (a)?'))).toBe('');
    });
});

describe('the siesta freebie', () => {
    it('reminds when the wishkeeper spawn is followed only by orbit and wrap-up', () => {
        const t = turnWith({ calls: [wishkeeper], id: 'm1' }, { calls: [{ name: 'mcp__x-mod-stash__orbit' }, { name: 'mcp__ccd_turn__wrap_up' }], id: 'm2' });
        stopAfter('siesta running.', t);
        expect(nextPrompt()).toContain('start the siesta freebie');
    });

    it('passes a freebie started in the same message as the spawn', () => {
        const t = turnWith({ calls: [{ name: 'Bash' }, wishkeeper], id: 'm1' }, { calls: [{ name: 'mcp__ccd_turn__wrap_up' }], id: 'm2' });
        stopAfter('siesta running.', t);
        expect(nextPrompt()).not.toContain('siesta freebie');
    });

    it('passes a freebie started after the spawn', () => {
        const t = turnWith({ calls: [wishkeeper], id: 'm1' }, { calls: [{ name: 'Edit' }], id: 'm2' });
        stopAfter('siesta running.', t);
        expect(nextPrompt()).not.toContain('siesta freebie');
    });

    it('passes a turn with no wishkeeper, and a helper spawn alone', () => {
        stopAfter('done.', turnWith({ calls: [{ card: 'helper-lite', name: 'Agent' }], id: 'm1' }));
        expect(nextPrompt()).not.toContain('siesta freebie');
    });
});

// FRM-427's rider (10-25): a promise lands with its call — «proposed in orbit» needs an orbit add that turn, «now reds» a command
describe('a promise lands with its call', () => {
    const ORBIT = 'mcp__x-mod-stash__orbit';
    it('reminds when «proposed in orbit» rides a turn with no orbit add', () => {
        stopAfter('the rename is proposed in orbit.', turnWith({ calls: [{ input: { op: 'plan' }, name: ORBIT }], id: 'm1' }));
        expect(nextPrompt()).toContain('proposed in orbit');
    });

    it('passes «proposed in orbit» beside an add, alone or inside ops', () => {
        for (const input of [{ op: 'add' }, { ops: [{ op: 'plan' }, { op: 'add' }] }]) {
            stopAfter('the rename is proposed in orbit.', turnWith({ calls: [{ input, name: ORBIT }], id: 'm1' }));
            expect(nextPrompt()).not.toContain('proposed in orbit');
        }
    });

    it('reminds when «now reds» rides a turn that ran no command', () => {
        stopAfter('the gate now reds on it.', turnWith({ calls: [{ name: 'Edit' }], id: 'm1' }));
        expect(nextPrompt()).toContain('now reds');
    });

    it('passes «now reds» beside a Bash call', () => {
        stopAfter('the gate now reds on it.', turnWith({ calls: [{ name: 'Bash' }], id: 'm1' }));
        expect(nextPrompt()).not.toContain('now reds');
    });
});
