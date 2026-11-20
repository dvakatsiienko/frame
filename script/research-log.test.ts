import { execFileSync } from 'node:child_process';
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = join(import.meta.dirname, 'research-log.ts');
const today = new Date().toLocaleDateString('sv-SE');

function setup() {
    const root = mkdtempSync(join(tmpdir(), 'research-log-'));
    const logDir = join(root, 'log');
    mkdirSync(logDir);
    const brief = join(root, 'brief.md');
    writeFileSync(
        brief,
        '# ui sdk refresh\n\nwish: PK-9\ntopics: ui-sdk, shadcn\n',
    );
    const run = (...args: string[]) =>
        execFileSync('node', [script, ...args], {
            encoding: 'utf8',
            env: { ...process.env, RESEARCH_LOG_DIR: logDir },
        });
    const entry = (
        file: string,
        topics: string,
        follows: string,
        verdict: string,
        body: string,
    ) =>
        writeFileSync(
            join(logDir, file),
            `---\ndate: ${file.slice(0, 10)}\ntopics: ${topics}\nverdict: ${verdict}\nfollows: ${follows}\n---\n\n${body}\n`,
        );
    return { brief, entry, logDir, run };
}

describe('research-log', () => {
    it('prints only the newest entry of a chain on the brief topics, never an unrelated one', () => {
        const { brief, entry, run } = setup();
        entry(
            '2026-09-01-ui-sdk.md',
            'ui-sdk',
            'none',
            'raw beta',
            'the first look',
        );
        entry(
            '2026-11-01-ui-sdk.md',
            'ui-sdk',
            '2026-09-01-ui-sdk.md',
            'still beta',
            'the second look',
        );
        entry(
            '2026-10-01-kokoro.md',
            'kokoro',
            'none',
            'kept',
            'a voice engine',
        );
        const prior = run('prior', brief);
        expect(prior).toContain('the second look');
        expect(prior).not.toContain('the first look');
        expect(prior).not.toContain('a voice engine');
    });

    it('prints nothing when no entry shares a topic', () => {
        const { brief, entry, run } = setup();
        entry(
            '2026-10-01-kokoro.md',
            'kokoro',
            'none',
            'kept',
            'a voice engine',
        );
        expect(run('prior', brief)).toBe('');
    });

    it('writes a pending stub that follows the newest entry on its topics', () => {
        const { brief, entry, logDir, run } = setup();
        entry(
            '2026-11-01-ui-sdk.md',
            'ui-sdk',
            'none',
            'still beta',
            'the second look',
        );
        const path = run('stub', brief).trim();
        expect(path).toBe(join(logDir, `${today}-ui-sdk.md`));
        const text = readFileSync(path, 'utf8');
        expect(text).toContain('verdict: pending');
        expect(text).toContain('follows: 2026-11-01-ui-sdk.md');
        expect(text).toContain('wish: PK-9');
        run('stub', brief);
        expect(readdirSync(logDir)).toContain(`${today}-ui-sdk-2.md`);
    });

    it('refuses a brief with no topics line', () => {
        const { run } = setup();
        const bare = join(mkdtempSync(join(tmpdir(), 'research-log-')), 'b.md');
        writeFileSync(bare, '# no topics\n');
        expect(() => run('stub', bare)).toThrow(/topics/);
    });

    it('check reds a stub pending from an earlier day and passes one from today', () => {
        const { entry, run } = setup();
        entry(`${today}-ui-sdk.md`, 'ui-sdk', 'none', 'pending', '');
        expect(run('check')).toBe('');
        entry('2026-01-01-old.md', 'old', 'none', 'pending', '');
        expect(() => run('check')).toThrow(
            /2026-01-01-old\.md is still pending/,
        );
    });
});
