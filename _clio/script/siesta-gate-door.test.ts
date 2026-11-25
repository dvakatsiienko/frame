import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { SID, fixtureHome, run, siesta } from './siesta-gate-world.ts';

describe('the cli', () => {
    test('open stamps siesta-last and opens; card marks it printed with its highs', () => {
        const home = fixtureHome();
        run(home, ['open']);
        expect(siesta(home)).toMatchObject({ card_printed: false, open: true });
        expect(
            new Date(
                readFileSync(
                    join(home, '.local/state/clio/siesta-last'),
                    'utf8',
                ).trim(),
            ).getTime(),
        ).toBeGreaterThan(Date.now() - 60_000);
        run(home, ['skip', 'only groom bookkeeping since the last read']);
        run(home, ['card', 'a hole', 'a gap']);
        expect(siesta(home)).toMatchObject({
            card_printed: true,
            highs: [
                { state: 'open', text: 'a hole' },
                { state: 'open', text: 'a gap' },
            ],
        });
        run(home, ['high', '2', 'parked', 'FRM-9 holds it']);
        expect(siesta(home).highs[1]).toEqual({
            state: 'parked',
            text: 'a gap',
            why: 'FRM-9 holds it',
        });
    });
});

describe('a siesta runs wishkeeper or logs why not', () => {
    test('a card with no wishkeeper and no skip is refused', () => {
        const home = fixtureHome();
        run(home, ['open']);
        const out = run(home, ['card']);
        expect(out.status).not.toBe(0);
        expect(out.stderr).toContain('no wishkeeper ran');
        expect(siesta(home).card_printed).toBe(false);
    });

    test('a skip logs its why and lets the card print', () => {
        const home = fixtureHome();
        run(home, ['open']);
        run(home, ['skip', 'no reply to dima and no commit since the stamp']);
        expect(run(home, ['card']).status).toBe(0);
        expect(
            readFileSync(
                join(home, '.local/state/clio/wishkeeper-skips.log'),
                'utf8',
            ),
        ).toMatch(/\tclio\tno reply to dima and no commit since the stamp\n$/);
    });

    test('a wishkeeper spawned since the open lets the card print', () => {
        const home = fixtureHome();
        run(home, ['open']);
        const dir = join(home, '.claude/projects/-x');
        mkdirSync(dir, { recursive: true });
        writeFileSync(
            join(dir, `${SID}.jsonl`),
            JSON.stringify({
                message: {
                    content: [
                        {
                            input: { subagent_type: 'wishkeeper' },
                            name: 'Agent',
                            type: 'tool_use',
                        },
                    ],
                },
                timestamp: new Date(Date.now() + 1000).toISOString(),
                type: 'assistant',
            }),
        );
        const out = run(home, ['card'], '', { CLAUDE_CODE_SESSION_ID: SID });
        expect(out.status).toBe(0);
    });

    test('a next open clears the last skip', () => {
        const home = fixtureHome();
        run(home, ['open']);
        run(home, ['skip', 'nothing new']);
        run(home, ['open']);
        expect(run(home, ['card']).status).not.toBe(0);
    });
});

describe('every clio on its own stamp', () => {
    test('a new siesta prints the last stamp and the high left open', () => {
        const home = fixtureHome();
        run(home, ['open']);
        run(home, ['skip', 'a fixture with no transcript']);
        run(home, ['card', 'a hole']);
        const out = run(home, ['open']);
        expect(out.stdout).toMatch(/last siesta: 20/);
        expect(out.stdout).toContain('unsettled high of the last card: a hole');
    });
});
