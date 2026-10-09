import {
    mkdtempSync,
    readFileSync,
    realpathSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    changed,
    pull,
    push,
} from '../../home/.claude/plugin-x/lib/scratch-edit.ts';

const dir = (prefix: string) =>
    realpathSync(mkdtempSync(join(tmpdir(), prefix)));

function setup() {
    const repo = dir('se-repo-');
    const scratch = dir('se-scratch-');
    writeFileSync(join(repo, 'a.ts'), 'one\n');
    pull(repo, scratch, ['a.ts']);
    return { repo, scratch };
}

describe('scratch-edit', () => {
    it('pushes an edited scratch copy back into the repo', () => {
        const { repo, scratch } = setup();
        writeFileSync(join(scratch, 'a.ts'), 'two\n');

        const result = push(repo, scratch);

        expect([result, readFileSync(join(repo, 'a.ts'), 'utf8')]).toEqual([
            [{ outcome: 'synced', path: 'a.ts' }],
            'two\n',
        ]);
    });

    it('refuses a file the repo changed since the pull, writing nothing', () => {
        const { repo, scratch } = setup();
        writeFileSync(join(scratch, 'a.ts'), 'mine\n');
        writeFileSync(join(repo, 'a.ts'), 'theirs\n');

        const result = push(repo, scratch);

        expect([
            result[0]?.outcome,
            readFileSync(join(repo, 'a.ts'), 'utf8'),
        ]).toEqual(['refused', 'theirs\n']);
    });

    it('writes a new file into a dir the repo does not have yet', () => {
        const { repo, scratch } = setup();
        pull(repo, scratch, ['types/new.d.ts']);
        writeFileSync(join(scratch, 'types/new.d.ts'), 'x\n');

        push(repo, scratch);

        expect(readFileSync(join(repo, 'types/new.d.ts'), 'utf8')).toBe('x\n');
    });

    it('lists only the files edited since the pull', () => {
        const { repo, scratch } = setup();
        writeFileSync(join(repo, 'b.ts'), 'b\n');
        pull(repo, scratch, ['b.ts']);
        writeFileSync(join(scratch, 'a.ts'), 'edited\n');

        expect(changed(scratch)).toEqual(['a.ts']);
    });
});
