import { spawnSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';

const hook = join(
    import.meta.dirname,
    '../.claude/hooks/wish-cover-on-write.sh',
);

const root = mkdtempSync(join(tmpdir(), 'wish-cover-hook-'));
afterAll(() => rmSync(root, { force: true, recursive: true }));

// a stubbed x answers `x linear read <id>` with a ticket whose wish block holds one W-line
const stamp = (daysAgo: number) =>
    new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
const wishes: Record<string, string> = {
    'FRM-10': `first words\n* W2 (${stamp(30)} 09:00, dima) left out long ago`,
    'FRM-11': `first words\n* W2 (${stamp(1)} 09:00, dima) moved on → FRM-585`,
    'FRM-6': `first words\n* W2 (${stamp(0)} 09:00, dima) cited too`,
    'FRM-7': `first words\n* W2 (${stamp(1)} 09:00, dima) left out`,
    'FRM-8': 'other words',
    'FRM-9': 'the exact words',
};
mkdirSync(join(root, 'bin'));
writeFileSync(
    join(root, 'bin', 'x'),
    `#!/bin/sh\ncase "$3" in\n${Object.entries(wishes)
        .map(
            ([id, words]) =>
                `${id}) printf '%s\\n' '${JSON.stringify({ data: { tickets: [{ description: `## wish\n\n* W1 ${words}\n`, id }] } })}' ;;`,
        )
        .join('\n')}\nesac\n`,
    { mode: 0o755 },
);

let count = 0;
function runOn(spec: string, name = 'spec.md') {
    const dir = join(root, `.scratch-${count++}`, '.scratch', 'x');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, name);
    writeFileSync(file, spec);
    const out = spawnSync('bash', [hook], {
        encoding: 'utf8',
        env: {
            ...process.env,
            PATH: `${join(root, 'bin')}:${process.env.PATH}`,
        },
        input: JSON.stringify({ tool_input: { file_path: file } }),
        timeout: 10_000,
    }).stdout.trim();
    return out
        ? (JSON.parse(out) as {
              decision?: string;
              hookSpecificOutput?: {
                  additionalContext: string;
                  hookEventName: string;
              };
              reason: string;
          })
        : undefined;
}

describe('wish-cover on a .scratch spec write', () => {
    test('its section dir is gone at exit, and never reaches the Trash', () => {
        const scratch = join(root, 'scratch');
        mkdirSync(scratch);
        const trashed = join(root, 'trashed');
        writeFileSync(
            join(root, 'bin', 'trash'),
            `#!/bin/sh\ntouch "${trashed}"\n`,
            { mode: 0o755 },
        );
        const dir = join(root, '.scratch-sections', '.scratch', 'x');
        mkdirSync(dir, { recursive: true });
        const file = join(dir, 'spec.md');
        writeFileSync(file, 'wish: FRM-9\n\nW1 the exact words\n');
        spawnSync('bash', [hook], {
            encoding: 'utf8',
            env: {
                ...process.env,
                PATH: `${join(root, 'bin')}:${process.env.PATH}`,
                TMPDIR: scratch,
            },
            input: JSON.stringify({ tool_input: { file_path: file } }),
            timeout: 10_000,
        });
        expect(readdirSync(scratch)).toEqual([]);
        expect(existsSync(trashed)).toBe(false);
    });

    test('a spec with no wish line blocks', () => {
        const out = runOn('# spec\n\nno wish here\n');
        expect(out?.decision).toBe('block');
        expect(out?.reason).toContain('no wish line');
    });

    test('a brief in a lane folder with no wish line blocks', () => {
        const out = runOn('# brief\n\nno wish here\n', 'brief-codie.md');
        expect(out?.decision).toBe('block');
        expect(out?.reason).toContain('no wish line');
    });

    test('an unrelated notes.md is not watched', () => {
        expect(runOn('no wish here\n', 'notes.md')).toBeUndefined();
    });

    test('wish: none is silent', () => {
        expect(runOn('wish: none\n\n# spec\n')).toBeUndefined();
    });

    test('wish: none does not exempt a later section that names a wish', () => {
        const filler = '\n'.repeat(12);
        const out = runOn(`wish: none\n${filler}wish: FRM-9\nW1 reworded\n`);
        expect(out?.decision).toBe('block');
        expect(out?.reason).toContain(':W1 text missing: the exact words');
    });

    test('a section whose wish line is a ticket link is checked against its own ticket', () => {
        const linked = (words: string) =>
            `wish: FRM-9\nW1 the exact words\n\nwish: [FRM-8](https://linear.app/x-com/issue/FRM-8)\nW1 ${words}\n`;
        expect(runOn(linked('other words'))).toBeUndefined();
        expect(runOn(linked('reworded'))?.reason).toContain(
            ':W1 text missing: other words',
        );
    });

    describe('a wish left out of the draft', () => {
        test('a recent uncited line is named beside the id, never blocking', () => {
            const out = runOn('wish: FRM-7\nW1 first words\n');
            expect(out?.decision).toBeUndefined();
            expect(out?.hookSpecificOutput).toEqual({
                additionalContext:
                    "wish-cover: FRM-7 • not in the draft: W2. name each left-out wish in the spec's out or tell dima",
                hookEventName: 'PostToolUse',
            });
        });

        test.each([
            ['an older line', 'wish: FRM-10\nW1 first words\n'],
            ['a settled line', 'wish: FRM-11\nW1 first words\n'],
            ['a cited line', 'wish: FRM-6\nW1 first words\nW2 cited too\n'],
        ])('%s is silent', (_name, spec) => {
            expect(runOn(spec)).toBeUndefined();
        });

        test('a red wins over a note in another section', () => {
            const out = runOn(
                'wish: FRM-7\nW1 first words\n\nwish: FRM-9\nW1 reworded\n',
            );
            expect(out?.decision).toBe('block');
            expect(out?.hookSpecificOutput).toBeUndefined();
        });

        test('two sections with a note each give one json', () => {
            const out = runOn(
                'wish: FRM-7\nW1 first words\n\nwish: FRM-6\nW1 first words\n',
            );
            expect(out?.hookSpecificOutput?.additionalContext).toContain(
                'FRM-7 • not in the draft: W2',
            );
            expect(out?.hookSpecificOutput?.additionalContext).toContain(
                'FRM-6 • not in the draft: W2',
            );
        });
    });

    test('a spec copying W1 verbatim is silent', () => {
        expect(
            runOn('wish: FRM-9\n\nW1 the exact words\n\n# spec\n'),
        ).toBeUndefined();
    });

    test('a spec missing the words of W1 blocks', () => {
        const out = runOn('wish: FRM-9\n\nW1 reworded\n\n# spec\n');
        expect(out?.decision).toBe('block');
        expect(out?.reason).toContain(':W1 text missing: the exact words');
    });

    test('each section is checked against its own wish id', () => {
        const swapped =
            'wish: FRM-9\nW1 other words\n\nwish: FRM-8\nW1 the exact words\n';
        const out = runOn(swapped);
        expect(out?.decision).toBe('block');
        expect(out?.reason).toContain('the exact words');
        expect(out?.reason).toContain('other words');
        expect(
            runOn(
                'wish: FRM-9\nW1 the exact words\n\nwish: FRM-8\nW1 other words\n',
            ),
        ).toBeUndefined();
    });
});
