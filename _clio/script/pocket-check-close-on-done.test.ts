import { execFileSync } from 'node:child_process';
import {
    mkdirSync,
    mkdtempSync,
    rmSync,
    utimesSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';

import { gitEnv } from '../../script/lib/git-fixture.ts';
import { closeOnDone } from './pocket-check.ts';
import { task } from './pocket-check-world.ts';

describe('close on done', () => {
    const repos: string[] = [];
    afterEach(() => {
        for (const repo of repos.splice(0))
            rmSync(repo, { force: true, recursive: true });
    });

    // one fixture repo: the item committed a day ago, then each given commit `at` seconds later (inside the 14-day window)
    const dayAgo = Math.floor(Date.now() / 1000) - 86_400;
    const redsFor = (
        fields: Record<string, string>,
        commits: { at: number; message: string; note?: boolean }[],
        uncommittedNoteAt?: number,
    ) => {
        const repo = mkdtempSync(join(tmpdir(), 'pocket-close-'));
        repos.push(repo);
        const tasks = join(repo, 'pocket', 'tasks');
        mkdirSync(tasks, { recursive: true });
        const item = task({ id: 'PK-443', ...fields });
        const git = (at: number, ...args: string[]) =>
            execFileSync('git', args, {
                cwd: repo,
                env: {
                    ...gitEnv(),
                    GIT_COMMITTER_DATE: `${dayAgo + at} +0000`,
                },
                stdio: 'ignore',
                timeout: 10_000,
            });
        git(0, 'init', '-q');
        writeFileSync(join(tasks, 'pk-443.md'), item.text);
        utimesSync(join(tasks, 'pk-443.md'), dayAgo, dayAgo);
        git(0, 'add', '.');
        git(0, 'commit', '-q', '-m', '📜 pocket: pk-443 (auto)');
        for (const { at, message, note } of commits) {
            const written = join(
                repo,
                note ? 'pocket/tasks/pk-443.md' : 'other.txt',
            );
            writeFileSync(written, `${item.text}${at}`);
            utimesSync(written, dayAgo + at, dayAgo + at);
            git(at, 'add', '.');
            git(at, 'commit', '-q', '-m', message);
        }
        if (uncommittedNoteAt !== undefined) {
            const noted = join(tasks, 'pk-443.md');
            writeFileSync(noted, `${item.text}note`);
            utimesSync(
                noted,
                dayAgo + uncommittedNoteAt,
                dayAgo + uncommittedNoteAt,
            );
        }
        return closeOnDone([{ ...item, name: 'pk-443.md' }], repo, gitEnv());
    };

    test('an open item named in a later commit goes red with its sha', () => {
        const [red] = redsFor({}, [
            { at: 200, message: '🐞 fix: pk-443 done' },
        ]);
        expect(red).toMatch(
            /^PK-443: named in [0-9a-f]{7} «🐞 fix: pk-443 done» — close it, or add a note on why it stays$/,
        );
    });

    test('a note written after that commit clears it', () => {
        expect(
            redsFor({}, [
                { at: 200, message: '🐞 fix: PK-443 done' },
                { at: 300, message: '📜 pocket: pk-443 (auto)', note: true },
            ]),
        ).toEqual([]);
    });

    test('a note written after that commit clears it before the pocket commit lands', () => {
        expect(
            redsFor({}, [{ at: 200, message: '🐞 fix: PK-443 done' }], 300),
        ).toEqual([]);
    });

    test('a pocket commit naming it is no red', () => {
        expect(
            redsFor({}, [{ at: 200, message: '📜 pocket: pk-443 (auto)' }]),
        ).toEqual([]);
    });

    test('a done item named is no red', () => {
        expect(
            redsFor({ status: 'done' }, [{ at: 200, message: 'fix PK-443' }]),
        ).toEqual([]);
    });

    test('a flyway item named is no red', () => {
        expect(
            redsFor({ title: 'flyway: main' }, [
                { at: 200, message: 'fix PK-443' },
            ]),
        ).toEqual([]);
    });

    test('an id inside a longer id is not named', () => {
        expect(redsFor({}, [{ at: 200, message: 'fix PK-4435' }])).toEqual([]);
    });
});
