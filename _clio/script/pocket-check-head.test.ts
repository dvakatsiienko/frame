import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { gitEnv } from '../../script/lib/git-fixture.ts';
import {
    auditAgainstHead,
    headFromGit,
    lostNoteLines,
} from './pocket-check.ts';

describe('lostNoteLines', () => {
    const notes = (lines: string) =>
        `## Implementation Notes\n\n<!-- SECTION:NOTES:BEGIN -->\n${lines}\n<!-- SECTION:NOTES:END -->\n`;

    test('an appended note loses nothing', () => {
        expect(
            lostNoteLines(
                notes('dima: «keep it»\n\nnew line'),
                notes('dima: «keep it»'),
            ),
        ).toEqual([]);
    });

    test('a replaced note names the line it dropped', () => {
        expect(lostNoteLines(notes('done'), notes('dima: «keep it»'))).toEqual([
            'dima: «keep it»',
        ]);
    });

    test('a note line that only lost its emoji joiner is not lost', () => {
        expect(
            lostNoteLines(
                notes('done: \u{1F426}⬛ crow grade'),
                notes('done: \u{1F426}‍⬛ crow grade'),
            ),
        ).toEqual([]);
    });

    test('a task with no notes at HEAD has nothing to lose', () => {
        expect(lostNoteLines(notes('done'), 'no notes here')).toEqual([]);
    });

    test('a note line that only gained its home prefix is not lost', () => {
        expect(
            lostNoteLines(
                notes('PK-1:W3 (2026-11-06 10:00, dima): keep'),
                notes('W3 (2026-11-06 10:00, dima): keep'),
                'PK-1',
            ),
        ).toEqual([]);
    });

    test('a note line that swapped to another home is lost', () => {
        expect(
            lostNoteLines(
                notes('PK-4:W3 (2026-11-06 10:00, dima): keep'),
                notes('PK-1:W3 (2026-11-06 10:00, dima): keep'),
                'PK-1',
            ),
        ).toEqual(['PK-1:W3 (2026-11-06 10:00, dima): keep']);
    });

    test('a note line removed beside a prefixed one is lost', () => {
        expect(
            lostNoteLines(
                notes('PK-1:W3 (2026-11-06 10:00, dima): keep'),
                notes(
                    'W3 (2026-11-06 10:00, dima): keep\nW4 (2026-11-06 10:01, dima): gone',
                ),
                'PK-1',
            ),
        ).toEqual(['W4 (2026-11-06 10:01, dima): gone']);
    });
});

describe('auditAgainstHead', () => {
    const file = (name: string, status: string, notes = '', wishes = '') => ({
        name,
        text: `---\nstatus: ${status}\n---\n\n<!-- SECTION:DESCRIPTION:BEGIN -->\n${wishes}\n<!-- SECTION:DESCRIPTION:END -->\n<!-- SECTION:NOTES:BEGIN -->\n${notes}\n<!-- SECTION:NOTES:END -->\n`,
    });
    const head = (
        names: string[],
        texts: Record<string, string> = {},
        archiveNames: string[] = [],
    ) => ({
        archiveNames,
        names,
        text: (dir: string, name: string) => texts[`${dir}/${name}`] ?? '',
    });
    const left =
        'PK-5: left the tasks dir without being done and closed — restore it or close it with a close: line';

    test('an item gone from tasks and absent from the archive goes red', () => {
        expect(auditAgainstHead([], [], head(['pk-5 - gone.md']))).toEqual([
            left,
        ]);
    });

    test('an item archived while still open goes red', () => {
        expect(
            auditAgainstHead(
                [],
                [file('pk-5 - gone.md', 'open')],
                head(['pk-5 - gone.md']),
            ),
        ).toEqual([left]);
    });

    test('a done item with W-lines archived without a close: line goes red', () => {
        const wished = file('pk-5 - gone.md', 'done', '', '- W1 a wish');
        expect(
            auditAgainstHead([], [wished], head(['pk-5 - gone.md'])),
        ).toEqual([left]);
    });

    test('a done item with a close: line archived under a new slug passes', () => {
        const closed = file(
            'pk-5 - renamed.md',
            'done',
            'close: W1 done',
            '- W1 a wish',
        );
        expect(
            auditAgainstHead([], [closed], head(['pk-5 - gone.md'])),
        ).toEqual([]);
    });

    test('an archived file gone from the archive goes red', () => {
        expect(
            auditAgainstHead([], [], head([], {}, ['pk-265 - raw drops.md'])),
        ).toEqual([
            'PK-265: left the archive — restore it from `git show HEAD:`',
        ]);
    });

    test('an archived file renamed in the archive or back into tasks is not gone', () => {
        const archiveNames = ['pk-265 - raw drops.md'];
        expect(
            auditAgainstHead(
                [],
                [file('pk-265 - new slug.md', 'done')],
                head([], {}, archiveNames),
            ),
        ).toEqual([]);
        expect(
            auditAgainstHead(
                [file('pk-265 - new slug.md', 'open')],
                [],
                head([], {}, archiveNames),
            ),
        ).toEqual([]);
    });

    test('a task renamed in place keeps its prefix and is not gone', () => {
        expect(
            auditAgainstHead(
                [file('pk-5 - new slug.md', 'open')],
                [],
                head(['pk-5 - gone.md']),
            ),
        ).toEqual([]);
    });

    test('the real git path: a committed task deleted afterwards goes red', () => {
        const repo = mkdtempSync(join(tmpdir(), 'pocket-git-'));
        try {
            const root = join(repo, 'clio');
            const tasks = join(root, 'pocket', 'tasks');
            const archive = join(root, 'pocket', 'archive', 'tasks');
            mkdirSync(tasks, { recursive: true });
            mkdirSync(archive, { recursive: true });
            writeFileSync(join(tasks, 'pk-5 - gone.md'), 'x');
            writeFileSync(join(archive, 'pk-6 - old.md'), 'y');
            const noted = file('pk-7 - kept.md', 'done', 'dima: «keep it»');
            writeFileSync(join(archive, noted.name), noted.text);
            const git = (...args: string[]) =>
                execFileSync(
                    'git',
                    [
                        '-c',
                        'user.name=t',
                        '-c',
                        'user.email=t@t',
                        '-c',
                        'commit.gpgsign=false',
                        ...args,
                    ],
                    {
                        cwd: repo,
                        env: gitEnv(),
                        stdio: 'ignore',
                        timeout: 10_000,
                    },
                );
            git('init', '-q');
            git('add', '.');
            git('commit', '-q', '-m', 'seed');
            rmSync(join(tasks, 'pk-5 - gone.md'));
            rmSync(join(archive, 'pk-6 - old.md'));
            const wiped = file(noted.name, 'done', 'done');
            expect(
                auditAgainstHead([], [wiped], headFromGit(root, gitEnv())),
            ).toEqual([
                'pk-7: 1 note line(s) gone since HEAD — a close appends (`--append-notes`); restore from `git show HEAD:`',
                'PK-6: left the archive — restore it from `git show HEAD:`',
                left,
            ]);
        } finally {
            rmSync(repo, { force: true, recursive: true });
        }
    });

    test('an item still in tasks is not gone', () => {
        expect(
            auditAgainstHead(
                [file('pk-5 - gone.md', 'open')],
                [],
                head(['pk-5 - gone.md']),
            ),
        ).toEqual([]);
    });

    test('an item archived with its notes wiped in one step goes red', () => {
        const archived = file('pk-5 - renamed.md', 'done', 'done');
        const was = file('pk-5 - gone.md', 'done', 'dima: «keep it»').text;
        expect(
            auditAgainstHead(
                [],
                [archived],
                head(['pk-5 - gone.md'], { 'tasks/pk-5 - gone.md': was }),
            ),
        ).toEqual([
            'pk-5: 1 note line(s) gone since HEAD — a close appends (`--append-notes`); restore from `git show HEAD:`',
        ]);
    });

    test('an archived item that lost a note line since HEAD goes red', () => {
        const archived = file('pk-5 - gone.md', 'done', 'done');
        const was = file('pk-5 - gone.md', 'done', 'dima: «keep it»').text;
        expect(
            auditAgainstHead(
                [],
                [archived],
                head([], { 'archive/pk-5 - gone.md': was }),
            ),
        ).toEqual([
            'pk-5: 1 note line(s) gone since HEAD — a close appends (`--append-notes`); restore from `git show HEAD:`',
        ]);
    });
});
