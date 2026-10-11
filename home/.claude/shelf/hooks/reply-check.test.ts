import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const HOOK = join(import.meta.dirname, 'reply-check.py');

// the hook's stdout for one ended reply: empty when it lets the stop through
const stop = (reply: string, isActive = false) =>
    execFileSync('python3', [HOOK], {
        encoding: 'utf8',
        env: {
            ...process.env,
            REPLY_CHECK_LOG: join(mkdtempSync(join(tmpdir(), 'rc-')), 'log.tsv'),
            REPLY_CHECK_NOW: '15:10',
        },
        input: JSON.stringify({
            last_assistant_message: reply,
            stop_hook_active: isActive,
        }),
    });

describe('the · rule', () => {
    it('blocks a one-line list joined by ·', () => {
        expect(stop('the crew: 🐜 chores · 🐝 researcher · 🦡 retro')).toContain(
            'three things in a row are three bullets',
        );
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

    it('blocks a 🔭 line that waits on a ccrow wake', () => {
        expect(stop('done.\n\n🔭 waiting on 🐦‍⬛ ccrow’s 22:16 wake')).toContain(
            'a wake never holds the session',
        );
    });

    it('passes prose that mentions the 🔭 rule and ccrow', () => {
        expect(stop('🔔 ccrow: my 🔭 line named its wake, and a wake holds nothing.')).toBe('');
    });

    it('passes a 🔭 line that waits on a real block', () => {
        expect(stop('done.\n\n🔭 waiting on ci for the pushed head')).toBe('');
    });

    it('lets a second stop through, so a block never loops', () => {
        expect(stop('a · b · c', true)).toBe('');
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
        },
        input: JSON.stringify({ last_assistant_message: reply, transcript_path: transcript }),
    });

describe('the composed clock', () => {
    it('blocks a 📄 stamp more than 2 minutes before the prompt hook’s now', () => {
        expect(stopAfter('done.\n\n📄 last report: **mods**, 14:58', promptedAt('15:06'))).toContain(
            '14:58 and 15:06',
        );
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
    it('blocks a fence pre-filled with grill answers', () => {
        expect(stop('round 1.\n\n```\nQ1 b\nQ2 a\nQ3 a\n```')).toContain(
            'grill answers go to orbit',
        );
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
