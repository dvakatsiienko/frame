import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const hook = join(
    import.meta.dirname,
    '../../home/.claude/shelf/hooks/reply-check.py',
);

function check(reply: string) {
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
        env: { ...process.env, REPLY_CHECK_LOG: log },
        input: JSON.stringify({
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

describe('reply-check', () => {
    it('logs a ticket id outside a linear link', () => {
        expect(check('closed FRM-12 today')).toEqual(['bare-ticket']);
    });

    it('passes a ticket id inside a linear link', () => {
        expect(
            check('[FRM-12](https://linear.app/x-com/issue/FRM-12): closed'),
        ).toEqual([]);
    });

    it('logs a markdown table', () => {
        expect(check('| a | b |\n| --- | --- |\n| 1 | 2 |')).toEqual(['table']);
    });

    it('logs a middot chain in a sentence', () => {
        expect(check('topic a · topic b · topic c')).toContain('middot');
    });

    it('passes the last-report footer middot', () => {
        expect(check('📄 last report: **x** · 18:30')).toEqual([]);
    });

    it('logs a commit hash in prose', () => {
        expect(check('it landed as c8f653f2 on main')).toEqual(['commit-hash']);
    });

    it('ignores everything inside a code fence', () => {
        expect(check('```\nFRM-12 | a |\nc8f653f2\n```')).toEqual([]);
    });

    it('logs circled digits', () => {
        expect(check('① read ② write')).toEqual([
            'circled-digits',
            'circled-digits',
        ]);
    });
});
