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
import { flyway } from './pocket-check-world.ts';

const notes = (lines: string) =>
    `---\nstatus: open\n---\n<!-- SECTION:NOTES:BEGIN -->\n${lines}\n<!-- SECTION:NOTES:END -->\n`;
const named = 'pk-5 - a.md';
const head = (headNotes: string, archived = '') => ({
    archiveNames: [],
    names: [named],
    noteNames: archived ? ['pk-5.md'] : [],
    text: (dir: string, name: string) =>
        dir === 'tasks' && name === named
            ? notes(headNotes)
            : dir === 'notes'
              ? archived
              : '',
});

describe('a flyway whose notes moved to its archive', () => {
    test('a note line of HEAD found in the archive is not lost', () => {
        expect(
            lostNoteLines(notes('kept'), notes('kept\nmoved'), '', 'moved\n'),
        ).toEqual([]);
        expect(
            auditAgainstHead(
                [{ name: named, text: notes('kept') }],
                [],
                head('kept\nmoved'),
                [{ name: 'pk-5.md', text: 'moved\n' }],
            ),
        ).toEqual([]);
    });

    test('a note line of HEAD in neither the item nor its archive is red', () => {
        expect(
            auditAgainstHead(
                [{ name: named, text: notes('kept') }],
                [],
                head('kept\nmoved'),
                [{ name: 'pk-5.md', text: 'other\n' }],
            ),
        ).toEqual([
            'pk-5: 1 note line(s) gone since HEAD — a close appends (`--append-notes`); restore from `git show HEAD:`',
        ]);
    });

    test('a line of the archive at HEAD gone from it is red, a kept one is not', () => {
        const tasks = [{ name: named, text: notes('kept') }];
        expect(
            auditAgainstHead(tasks, [], head('kept', 'a\nb\n'), [
                { name: 'pk-5.md', text: 'a\nb\nc\n' },
            ]),
        ).toEqual([]);
        expect(
            auditAgainstHead(tasks, [], head('kept', 'a\nb\n'), [
                { name: 'pk-5.md', text: 'a\n' },
            ]),
        ).toEqual([
            'PK-5: 1 archived note line(s) gone since HEAD — the notes archive only grows; restore from `git show HEAD:`',
        ]);
        expect(auditAgainstHead(tasks, [], head('kept', 'a\n'), [])).toEqual([
            'PK-5: 1 archived note line(s) gone since HEAD — the notes archive only grows; restore from `git show HEAD:`',
        ]);
    });

    test('a flyway file over 300 lines is red, naming the sweep', () => {
        expect(flyway({}, 'note\n'.repeat(300))).toMatch(
            /^PK-1: flyway is 3\d\d lines, the cap is 300: node script\/flyway-done\.ts --sweep$/m,
        );
        expect(flyway({}, 'note\n'.repeat(100))).toBe('');
    });

    test('HEAD reads the archive beside the tasks', () => {
        const repo = mkdtempSync(join(tmpdir(), 'pocket-notes-'));
        try {
            const dir = join(repo, 'pocket', 'archive', 'notes');
            mkdirSync(dir, { recursive: true });
            mkdirSync(join(repo, 'pocket', 'tasks'), { recursive: true });
            writeFileSync(join(dir, 'pk-5.md'), 'a\nb\n');
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
            const read = headFromGit(repo, gitEnv());
            expect(read.noteNames).toEqual(['pk-5.md']);
            expect(read.text('notes', 'pk-5.md')).toBe('a\nb\n');
        } finally {
            rmSync(repo, { force: true, recursive: true });
        }
    });
});
