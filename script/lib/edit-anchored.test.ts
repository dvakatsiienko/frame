import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { editAnchored } from '../../home/.claude/plugin-x/lib/edit-anchored.ts';

const source = `one
two
three
two
`;

describe('editAnchored', () => {
    it('replaces an anchor that appears exactly once', () => {
        const edited = editAnchored(source, 'three', 'THREE');

        expect(edited.error).toBeNull();
        expect(edited.text).toBe('one\ntwo\nTHREE\ntwo\n');
    });

    it('reports the line the anchor started on', () => {
        expect(editAnchored(source, 'three', 'THREE').line).toBe(3);
    });

    it('refuses an anchor that appears nowhere', () => {
        const edited = editAnchored(source, 'four', 'FOUR');

        expect(edited.error).toMatch(/0 times/);
        expect(edited.text).toBeNull();
    });

    it('refuses an anchor that appears twice', () => {
        const edited = editAnchored(source, 'two', 'TWO');

        expect(edited.error).toMatch(/2 times/);
        expect(edited.text).toBeNull();
    });

    it('refuses a replacement identical to its anchor', () => {
        expect(editAnchored(source, 'three', 'three').error).toMatch(
            /changes nothing/,
        );
    });
});

// The pure function is the contract; this is the half that can still lie — a tool that writes
// the file and reports success without the bytes landing is the exact failure it exists to kill.
describe('the edit-anchored executable', () => {
    const run = (body: string, anchor: string, replacement: string) => {
        const dir = mkdtempSync(join(tmpdir(), 'edit-anchored-'));
        const target = join(dir, 'target.txt');
        const anchorPath = join(dir, 'anchor.txt');
        const replacementPath = join(dir, 'replacement.txt');
        writeFileSync(target, body);
        writeFileSync(anchorPath, anchor);
        writeFileSync(replacementPath, replacement);

        try {
            const stdout = execFileSync(
                join(
                    import.meta.dirname,
                    '../../home/.claude/plugin-x/bin/edit-anchored',
                ),
                [target, anchorPath, replacementPath],
                { encoding: 'utf8' },
            );
            return { code: 0, read: readFileSync(target, 'utf8'), stdout };
        } catch (error) {
            const failure = error as { status: number };
            return {
                code: failure.status,
                read: readFileSync(target, 'utf8'),
                stdout: '',
            };
        }
    };

    it('writes the file and names the line it landed on', () => {
        const { code, read, stdout } = run(source, 'three', 'THREE');

        expect(code).toBe(0);
        expect(read).toBe('one\ntwo\nTHREE\ntwo\n');
        expect(stdout).toMatch(/:3\b/);
    });

    it('leaves the file untouched when the anchor is not unique', () => {
        const { code, read } = run(source, 'two', 'TWO');

        expect(code).not.toBe(0);
        expect(read).toBe(source);
    });
});
