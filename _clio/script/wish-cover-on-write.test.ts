import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
const wishes: Record<string, string> = {
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
function runOn(spec: string) {
    const dir = join(root, `.scratch-${count++}`, '.scratch', 'x');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'spec.md');
    writeFileSync(file, spec);
    const out = spawnSync('bash', [hook], {
        encoding: 'utf8',
        env: {
            ...process.env,
            PATH: `${join(root, 'bin')}:${process.env.PATH}`,
        },
        input: JSON.stringify({ tool_input: { file_path: file } }),
    }).stdout.trim();
    return out
        ? (JSON.parse(out) as { decision?: string; reason: string })
        : undefined;
}

describe('wish-cover on a .scratch spec write', () => {
    test('a spec with no wish line blocks', () => {
        const out = runOn('# spec\n\nno wish here\n');
        expect(out?.decision).toBe('block');
        expect(out?.reason).toContain('no wish line');
    });

    test('wish: none is silent', () => {
        expect(runOn('wish: none\n\n# spec\n')).toBeUndefined();
    });

    test('wish: none does not exempt a later section that names a wish', () => {
        const filler = '\n'.repeat(12);
        const out = runOn(`wish: none\n${filler}wish: FRM-9\nW1 reworded\n`);
        expect(out?.decision).toBe('block');
        expect(out?.reason).toContain('✗ W1 text missing: the exact words');
    });

    test('a section whose wish line is a ticket link is checked against its own ticket', () => {
        const linked = (words: string) =>
            `wish: FRM-9\nW1 the exact words\n\nwish: [FRM-8](https://linear.app/x-com/issue/FRM-8)\nW1 ${words}\n`;
        expect(runOn(linked('other words'))).toBeUndefined();
        expect(runOn(linked('reworded'))?.reason).toContain(
            '✗ W1 text missing: other words',
        );
    });

    test('a spec copying W1 verbatim is silent', () => {
        expect(
            runOn('wish: FRM-9\n\nW1 the exact words\n\n# spec\n'),
        ).toBeUndefined();
    });

    test('a spec missing the words of W1 blocks', () => {
        const out = runOn('wish: FRM-9\n\nW1 reworded\n\n# spec\n');
        expect(out?.decision).toBe('block');
        expect(out?.reason).toContain('✗ W1 text missing: the exact words');
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
