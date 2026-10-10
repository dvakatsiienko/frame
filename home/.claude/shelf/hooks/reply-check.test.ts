import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
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
