import { spawnSync } from 'node:child_process';
import {
    copyFileSync,
    mkdirSync,
    mkdtempSync,
    rmSync,
    utimesSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import {
    citedIds,
    draftSections,
    itemsForTicket,
    missingText,
    normalize,
    prefixWish,
    repeatedIds,
    sectionsFor,
    uncovered,
    unwrapIds,
    weekDrafts,
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

    test('a wish line written as a ticket link opens its own section', () => {
        const linked = [
            'wish: FRM-450',
            'chunk one',
            'wish: [FRM-452](https://linear.app/x-com/issue/FRM-452)',
            'chunk two',
        ].join('\n');
        expect(sectionsFor(linked, 'FRM-452')).toBe(
            'wish: [FRM-452](https://linear.app/x-com/issue/FRM-452)\nchunk two',
        );
        expect(sectionsFor(linked, 'FRM-450')).toBe(
            'wish: FRM-450\nchunk one\n',
        );
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

    test("another item's id is not cited as this item's", () => {
        expect([...citedIds('from PK-159:W3, and W4 here')]).toEqual(['W4']);
    });

    test('a range cites nothing', () => {
        expect([...citedIds('settles W1–W3, W2-W4')]).toEqual([]);
    });

    test('a bullet under a line ending in a digit is still cited', () => {
        expect([...citedIds('wish: FRM-450\n- W3 his words')]).toEqual(['W3']);
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

    test('an id inside a copied W-line is its words, not a cite', () => {
        const moved = '- W1 can rows fold? (moved here as its W17)';
        expect(
            missingText(moved, ['W1 can rows fold? (moved here as its W17)']),
        ).toEqual([]);
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
                    'flyway-done.ts',
                    'pocket-check.ts',
                    'prompt-groom.ts',
                    'chat-lines.ts',
                    'session-registry.ts',
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
                        timeout: 10_000,
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
                'wish block into FRM-9:W1… lines first',
            );
        });
    });

    test('reds a cited W-line with empty text', () => {
        expect(
            missingText('- W7\n- W8 real words', ['W7 W8 real words']),
        ).toEqual([['W7', '']]);
    });
});

describe('normalize, against linear’s rewrites of a body', () => {
    test('an autolinked domain reads as the word that was written', () => {
        expect(normalize('the [draw.io](<http://draw.io>) mini flow')).toBe(
            normalize('the draw.io mini flow'),
        );
    });
    test('an escaped bracket or tilde reads as written', () => {
        expect(normalize('W201 (13:34) \\[pasted\\] the \\~35 % loss')).toBe(
            normalize('W201 (13:34) [pasted] the ~35 % loss'),
        );
    });
});

describe('wish ids in both shapes', () => {
    test.each([
        [
            'an old line',
            '- W1 hunt what feels off',
            [['W1', 'hunt what feels off']],
        ],
        [
            'a full-id line',
            'PK-3:W1 (2026-11-06 10:00, dima): new words',
            [['W1', 'new words']],
        ],
        [
            'a bulleted full-id line',
            '* FRM-9:W2 (2026-11-06 10:00, dima): more words',
            [['W2', 'more words']],
        ],
    ])('wishLines reads %s', (_name, block, want) => {
        expect([...wishLines(block)]).toEqual(want);
    });

    test('repeatedIds names a number used once bare and once full', () => {
        expect(
            repeatedIds('* W1 old\n* PK-3:W1 (2026-11-06 10:00, dima): new'),
        ).toEqual(['W1']);
    });

    test.each([
        ['bare ids', 'W1 and W2', [], ['W1', 'W2']],
        ['an own-home prefix', 'PK-3:W1 ok', ['PK-3'], ['W1']],
        ['a home matched case-insensitively', 'PK-3:W1', ['pk-3'], ['W1']],
        ['another home is ignored', 'PK-4:W2 PK-3:W1', ['PK-3'], ['W1']],
        ['a prefixed cite with no homes', 'PK-3:W1', [], []],
        [
            'both range shapes cite nothing',
            'W1–W3 PK-3:W5–PK-3:W7',
            ['PK-3'],
            [],
        ],
        ['a range end beside a single id', 'W1–W3 W5', [], ['W5']],
        ['a colon-glued word', 'foo:W3', ['PK-3'], []],
    ])('citedIds reads %s', (_name, draft, homes, want) => {
        expect([...citedIds(draft, homes)]).toEqual(want);
    });

    test('unwrapIds unwraps a linked id before :W4 and leaves a linked id elsewhere', () => {
        expect(
            unwrapIds('[FRM-9](https://linear.app/x/issue/FRM-9):W4 words'),
        ).toBe('FRM-9:W4 words');
        const elsewhere =
            'see [FRM-9](https://linear.app/x/issue/FRM-9) for W4';
        expect(unwrapIds(elsewhere)).toBe(elsewhere);
    });

    test('wishBlock hands back a linked id plain', () => {
        expect(
            wishBlock('## wish\n\n* [FRM-9](https://x.io/FRM-9):W4 a\n\n## b'),
        ).toContain('* FRM-9:W4 a');
    });

    test('prefixWish gives a bare head its home and leaves a full head alone', () => {
        expect(prefixWish('* W1 (x): y', 'PK-3')).toBe('* PK-3:W1 (x): y');
        expect(prefixWish('PK-4:W1 (x): y', 'PK-3')).toBe('PK-4:W1 (x): y');
    });

    test('a head from another home is a quote, never this item line', () => {
        const item = 'PK-329:W9 (x): theirs\nPK-323:W9 (x): mine\n';
        expect(wishLines(item, ['PK-323']).get('W9')).toBe('mine');
        expect(repeatedIds(item, ['PK-323'])).toEqual([]);
    });

    test('an owner item cite never collides with the ticket line of that number', () => {
        const block =
            '* FRM-9:W1 (x): ticket words\n* FRM-9:W7 (x): moved words\n';
        expect(
            missingText(
                block,
                ['FRM-9:W1 ticket words\nPK-3:W1 a paraphrase'],
                ['FRM-9'],
            ),
        ).toEqual([]);
        expect(citedIds('PK-3:W1 a paraphrase', ['FRM-9']).size).toBe(0);
    });

    test('a linked or lowercase own cite counts', () => {
        expect([
            ...citedIds('[FRM-9](https://x.y/z):W4 words', ['FRM-9']),
        ]).toEqual(['W4']);
        expect([...citedIds('frm-9:W4 words', ['FRM-9'])]).toEqual(['W4']);
    });

    test('a full-id line is covered by a draft citing it under its home', () => {
        const block = '* PK-3:W1 (2026-11-06 10:00, dima): the words';
        expect(missingText(block, ['PK-3:W1 the words'], ['PK-3'])).toEqual([]);
        expect(uncovered(block, ['PK-4:W1 the words'], ['PK-3'])).toEqual([
            ['W1', 'the words'],
        ]);
    });
});

describe('the weekly audit', () => {
    test('a week finds fresh grills, briefs and specs, never an older one or a plain note', () => {
        const root = mkdtempSync(join(tmpdir(), 'audit-week-'));
        const dir = join(root, '.scratch/lane');
        mkdirSync(dir, { recursive: true });
        for (const name of [
            'grill-1-proposal.md',
            'brief.md',
            'spec.md',
            'notes.md',
            'old-brief.md',
        ])
            writeFileSync(join(dir, name), 'wish: PK-1\n');
        const old = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000);
        utimesSync(join(dir, 'old-brief.md'), old, old);
        expect(weekDrafts([root]).map((f) => f.slice(dir.length + 1))).toEqual([
            'brief.md',
            'grill-1-proposal.md',
            'spec.md',
        ]);
    });

    test('a later chunk section past line 12 is its own home', () => {
        const filler = Array.from({ length: 15 }, (_, i) => `line ${i}`).join(
            '\n',
        );
        const spec = `# lane\n\nwish: FRM-1\nfirst\n${filler}\n## FRM-2\nwish: FRM-2\nsecond\n`;
        const sections = draftSections(spec);
        expect(sections).toBeInstanceOf(Map);
        if (!(sections instanceof Map)) return;
        expect([...sections.keys()]).toEqual(['FRM-1', 'FRM-2']);
        expect(sections.get('FRM-1')).toContain('# lane');
        expect(sections.get('FRM-2')).toContain('second');
        expect(sections.get('FRM-2')).not.toContain('first');
    });

    test('an id beside another on one wish line is checked against the whole draft', () => {
        const draft = 'wish: PK-1, FRM-2\nbody\n';
        const sections = draftSections(draft);
        expect(sections instanceof Map && sections.get('FRM-2')).toBe(draft);
    });

    test.each([
        ['wish: none — a mechanical chore\n', 'none'],
        ['# a title with no wish line\n', undefined],
        ['wish: none\nlater\nwish: FRM-3\n', 'map'],
    ])('a draft «%s» reads as %s', (draft, want) => {
        const got = draftSections(draft);
        expect(got instanceof Map ? 'map' : got).toBe(want);
    });
});
