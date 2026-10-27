import { spawnSync } from 'node:child_process';
import {
    copyFileSync,
    mkdirSync,
    mkdtempSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import {
    citedIds,
    itemsForTicket,
    missingText,
    repeatedIds,
    sectionsFor,
    uncovered,
    wishBlock,
    wishLines,
} from './wish-cover.ts';

const item = [
    '## Description',
    '- W1 hunt what feels off',
    '- W2 ❓ can it tour the x cli source?',
    '- W3 plain words, no tech overload',
    '- W4 you gain too',
].join('\n');

describe('sectionsFor', () => {
    const spec = [
        'wish: FRM-450',
        'chunk one',
        '',
        'wish: FRM-452',
        'chunk two',
    ].join('\n');

    test('an id gets only the sections under its own wish line', () => {
        expect(sectionsFor(spec, 'FRM-452')).toBe('wish: FRM-452\nchunk two');
        expect(sectionsFor(spec, 'frm-450')).not.toContain('chunk two');
    });

    test('a BYT id splits like an FRM one, and a draft without wish lines stays whole', () => {
        expect(sectionsFor('wish: BYT-9\nx\nwish: FRM-1\ny', 'BYT-9')).toBe(
            'wish: BYT-9\nx\n',
        );
        expect(sectionsFor('no wish line', 'FRM-1')).toBe('no wish line');
    });
});

describe('repeatedIds', () => {
    test('names a W number a joined wish reused', () => {
        expect(repeatedIds(`${item}\n- W3 a joined ask of his`)).toEqual([
            'W3',
        ]);
    });

    test('a block numbered once passes', () => {
        expect(repeatedIds(item)).toEqual([]);
    });
});

describe('wish-cover', () => {
    test('passes a cited line copied verbatim', () => {
        expect(missingText(item, ['Q1 W1 hunt what feels off — why?'])).toEqual(
            [],
        );
    });

    test('reds a cited line that is paraphrased', () => {
        expect(
            missingText(item, ['W1 look for things that seem wrong']).map(
                ([id]) => id,
            ),
        ).toEqual(['W1']);
    });

    test('normalizes quotes, whitespace and case', () => {
        const quoted = '- W1 she said «Go   Now» and “stop”';
        expect(
            missingText(quoted, ['W1 SHE said "go\nnow" and "stop"']),
        ).toEqual([]);
    });

    test('a bulleted line cites its id', () => {
        expect([...citedIds('- W3 plain words, no tech overload')]).toEqual([
            'W3',
        ]);
    });

    test('a source tag is not part of the wish text', () => {
        const tagged = '- W5 (Q1) keep my voice';
        expect(missingText(tagged, ['- W5 keep my voice'])).toEqual([]);
    });

    test('a range cites nothing', () => {
        expect([...citedIds('settles W1–W3, W2-W4')]).toEqual([]);
    });

    test('single ids across a draft are all cited', () => {
        expect([...citedIds('(W1, W2) and W4')]).toEqual(['W1', 'W2', 'W4']);
    });

    test('--all reds a line no draft cites', () => {
        expect(uncovered(item, ['W1 W2', 'W4']).map(([id]) => id)).toEqual([
            'W3',
        ]);
    });

    test('an FRM id finds the pocket items whose ticket line names it', () => {
        const items: [string, string][] = [
            ['pk-7 - a.md', 'ticket: FRM-40 (lane 1)'],
            ['pk-8 - b.md', 'ticket: FRM-403'],
            ['pk-9 - c.md', 'see FRM-40 in passing'],
        ];
        expect(itemsForTicket(items, 'FRM-40')).toEqual(['PK-7']);
    });

    test('reds a cited id the item does not hold', () => {
        expect(missingText(item, ['W9 made up']).map(([id]) => id)).toEqual([
            'W9',
        ]);
    });

    test('a «moved to linear:» line links a pocket item to its ticket', () => {
        const items: [string, string][] = [
            ['pk-7 - a.md', 'moved to linear: FRM-366, a live input'],
            ['pk-8 - b.md', 'ticket: FRM-367'],
        ];
        expect(itemsForTicket(items, 'FRM-366')).toEqual(['PK-7']);
    });

    test('a bulleted ticket line links a pocket item to its ticket', () => {
        const items: [string, string][] = [
            ['pk-7 - a.md', 'body\n  - ticket: FRM-366'],
        ];
        expect(itemsForTicket(items, 'FRM-366')).toEqual(['PK-7']);
    });

    test.each([
        ['a bare url', 'https://a.dev/x'],
        ['an angle-bracket link', '[https://a.dev/x](<https://a.dev/x>)'],
        ['a plain markdown link', '[https://a.dev/x](https://a.dev/x)'],
        ['an autolink', '<https://a.dev/x>'],
    ])('a url W-line matches %s in a linear body, both ways', (_, form) => {
        expect(
            missingText('- W1 see https://a.dev/x now', [`W1 see ${form} now`]),
        ).toEqual([]);
        expect(
            missingText(`- W1 see ${form} now`, ['W1 see https://a.dev/x now']),
        ).toEqual([]);
    });

    test('a ticket body gives its W-lines from the wish block only', () => {
        const body = [
            '## goal',
            '* W1 not in the block',
            '## wish',
            '',
            'PK-103 settles:',
            '* W13 the board first',
            '* W14 topic to review',
            '## notes',
            '* W15 after the block',
        ].join('\n');
        expect([...wishLines(wishBlock(body))]).toEqual([
            ['W13', 'the board first'],
            ['W14', 'topic to review'],
        ]);
    });

    test('a body with no wish block holds no W-lines', () => {
        expect(wishLines(wishBlock('## goal\n* W1 x')).size).toBe(0);
    });

    test('a stamp and its colon are not part of the wish text', () => {
        const stamped = '- W1 (2026-10-25 13:47, dima): ❓ why is it so';
        expect(wishLines(stamped).get('W1')).toBe('❓ why is it so');
        expect(missingText(stamped, ['W1 — ❓ why is it so'])).toEqual([]);
    });

    describe('the cli, on a copy with a stubbed x', () => {
        const here = import.meta.dirname;
        const ticketItem = (n: number, ticket: string, wish: string) =>
            `---\nid: PK-${n}\n---\nticket: ${ticket}\n- ${wish}\n`;
        const run = (ticketBody: string, draft: string, owners = 2) => {
            const root = mkdtempSync(join(tmpdir(), 'wish-cover-'));
            try {
                mkdirSync(join(root, 'script'));
                for (const file of [
                    'wish-cover.ts',
                    'pocket-check.ts',
                    'prompt-groom.ts',
                ])
                    copyFileSync(join(here, file), join(root, 'script', file));
                const tasks = join(root, 'pocket', 'tasks');
                mkdirSync(tasks, { recursive: true });
                mkdirSync(join(root, 'pocket', 'archive', 'tasks'), {
                    recursive: true,
                });
                writeFileSync(
                    join(tasks, 'pk-1 - a.md'),
                    ticketItem(1, 'FRM-9', 'W1 pocket words'),
                );
                if (owners > 1)
                    writeFileSync(
                        join(tasks, 'pk-2 - b.md'),
                        ticketItem(2, 'FRM-9', 'W1 other pocket words'),
                    );
                mkdirSync(join(root, 'bin'));
                writeFileSync(
                    join(root, 'bin', 'x'),
                    `#!/bin/sh\ncat <<'EOF'\n${JSON.stringify({ data: { tickets: [{ description: ticketBody }] } })}\nEOF\n`,
                    { mode: 0o755 },
                );
                writeFileSync(join(root, 'draft.md'), draft);
                return spawnSync(
                    process.execPath,
                    [
                        join(root, 'script', 'wish-cover.ts'),
                        'FRM-9',
                        join(root, 'draft.md'),
                    ],
                    {
                        encoding: 'utf8',
                        env: {
                            ...process.env,
                            PATH: `${join(root, 'bin')}:${process.env.PATH}`,
                        },
                    },
                );
            } finally {
                rmSync(root, { force: true, recursive: true });
            }
        };

        test('several pocket items carrying the ticket do not block', () => {
            const result = run(
                '## wish\n\n* W1 ticket words\n',
                'W1 ticket words',
            );
            expect(result.status).toBe(0);
        });

        test('the ticket block wins over the one pocket item that carries it', () => {
            const result = run(
                '## wish\n\n* W1 ticket words\n',
                'W1 ticket words',
                1,
            );
            expect(result.status).toBe(0);
        });

        test('a block with no W-lines exits 2 even when the draft cites none', () => {
            const result = run('## wish\n\nno W-lines here\n', 'plain draft');
            expect(result.status).toBe(2);
            expect(result.stderr).toContain(
                "number the ticket's wish block into W1… lines first",
            );
        });
    });

    test('reds a cited W-line with empty text', () => {
        expect(
            missingText('- W7\n- W8 real words', ['W7 W8 real words']),
        ).toEqual([['W7', '']]);
    });
});
