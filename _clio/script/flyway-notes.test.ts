import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { appendArchive, archivePath, splitNotes } from './flyway-notes.ts';

const item = (notes: string) =>
    `---\nid: PK-1\n---\n<!-- SECTION:NOTES:BEGIN -->\n${notes}\n<!-- SECTION:NOTES:END -->\n`;
const today = '2026-11-25';

describe('splitNotes', () => {
    test('a block dated before today moves, one dated today stays', () => {
        const { kept, moved } = splitNotes(
            item(
                'done 2026-11-24 10:00: f1 old\n\nhoist 2026-11-25 08:00: f2 new',
            ),
            today,
        );
        expect(moved).toEqual(['done 2026-11-24 10:00: f1 old']);
        expect(kept).toBe(item('hoist 2026-11-25 08:00: f2 new'));
    });

    test('a W-line block takes its day from its stamp', () => {
        const { moved } = splitNotes(
            item(
                'PK-1:W1 (2026-11-24 10:00, dima): old\n\nPK-1:W2 (2026-11-25 10:00, dima): new',
            ),
            today,
        );
        expect(moved).toEqual(['PK-1:W1 (2026-11-24 10:00, dima): old']);
    });

    test('a block with no day takes the day of the block before it', () => {
        const kept = splitNotes(
            item(
                'done 2026-11-25 10:00: f1 a\n\n13:36 f52: no day of its own\n\ndone 2026-11-24 10:00: f2 b\n\n14:00 also undated',
            ),
            today,
        );
        expect(kept.moved).toEqual([
            'done 2026-11-24 10:00: f2 b',
            '14:00 also undated',
        ]);
        expect(kept.kept).toBe(
            item('done 2026-11-25 10:00: f1 a\n\n13:36 f52: no day of its own'),
        );
    });

    test('a leading undated block goes with the first day after it, and stays when no block has one', () => {
        expect(splitNotes(item('17:24 mine'), today).moved).toEqual([]);
        expect(
            splitNotes(item('17:24 mine\n\ndone 2026-11-24 10:00: f1 a'), today)
                .moved,
        ).toEqual(['17:24 mine', 'done 2026-11-24 10:00: f1 a']);
        expect(
            splitNotes(item('17:24 mine\n\ndone 2026-11-25 10:00: f1 a'), today)
                .moved,
        ).toEqual([]);
    });

    test('a hoist line carries its month and day', () => {
        const { kept, moved } = splitNotes(
            item(
                'done 2026-11-24 10:00: f1 a\n\nhoist 11-24: done\n\nhoist 11-25: proposing',
            ),
            today,
        );
        expect(moved).toEqual([
            'done 2026-11-24 10:00: f1 a',
            'hoist 11-24: done',
        ]);
        expect(kept).toBe(item('hoist 11-25: proposing'));
    });

    test('nothing to move returns the text as it was', () => {
        const text = item('done 2026-11-25 10:00: f1 a\n\n\n\nb');
        expect(splitNotes(text, today)).toEqual({ kept: text, moved: [] });
        expect(splitNotes('no notes here', today).moved).toEqual([]);
    });
});

describe('appendArchive', () => {
    test('a block the archive already holds is not appended again', () => {
        const pocket = mkdtempSync(join(tmpdir(), 'flyway-notes-'));
        appendArchive(pocket, 'PK-7', ['a\nb', 'c']);
        appendArchive(pocket, 'PK-7', ['b', 'c\nd']);
        expect(readFileSync(archivePath(pocket, 'PK-7'), 'utf8')).toBe(
            '# pk-7: notes moved out of the flyway, oldest first\n\na\nb\n\nc\n\nc\nd\n\n',
        );
    });
});
