import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { cardLines, sent } from './siesta-gate.ts';
import { fixtureHome } from './siesta-gate-world.ts';

describe('the card’s chore lines', () => {
    const groomDir = (home: string) => join(home, '.local/state/clio/grooms');
    const sentTo = (to: string, message: string) => ({
        tool_input: { message, to },
        tool_name: 'SendMessage',
    });

    test('a chore sent to helga is one sent.log line; a message to anyone else none', () => {
        const home = fixtureHome();
        sent(
            home,
            sentTo(
                '🎀 helga',
                'prompt-groom chore (non-blocking) from 🦉 clio: …',
            ),
        );
        sent(home, sentTo('⚡ 🔧 codie: x', 'resume'));
        const lines = readFileSync(join(groomDir(home), 'sent.log'), 'utf8')
            .trim()
            .split('\n');
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain('\tprompt-groom\t');
    });

    test.each([
        [
            'groom chore (non-blocking) from 🦉 clio: dima’s 11:16 prompt',
            'prompt-groom',
        ],
        ['halt chore: prompt-groom 14:02 and 14:05', 'prompt-groom'],
        ['chore: prompt-groom for 10:43', 'prompt-groom'],
        ['clio: prompt-groom chore 10:37', 'prompt-groom'],
        ['pocket-write (dima o78): PK-306 fields', 'pocket-write'],
    ])('a real chore send «%s» logs the class helga writes', (message, cls) => {
        const home = fixtureHome();
        sent(home, sentTo('🎀 helga', message));
        expect(
            readFileSync(join(groomDir(home), 'sent.log'), 'utf8'),
        ).toContain(`\t${cls}\t`);
    });

    test.each([
        'pause — clio is checkpointing, hold every message',
        'resume — clio’s second wind is done',
        'clio: thanks, green received',
    ])('a message that names no chore class logs nothing: «%s»', (message) => {
        const home = fixtureHome();
        sent(home, sentTo('🎀 helga', message));
        expect(() =>
            readFileSync(join(groomDir(home), 'sent.log'), 'utf8'),
        ).toThrow();
    });

    test('a send before the last siesta is never missed again', () => {
        const home = fixtureHome();
        mkdirSync(groomDir(home), { recursive: true });
        writeFileSync(
            join(groomDir(home), 'sent.log'),
            `${new Date(Date.now() - 3 * 3_600_000).toISOString()}\tpocket-write\tpk-1\n`,
        );
        expect(cardLines(home).join('\n')).not.toContain('missed receipt');
    });

    test('a numbered batch logs one line per chore', () => {
        const home = fixtureHome();
        sent(
            home,
            sentTo(
                '🎀 helga',
                'batch b7\n1 pocket-write PK-1 …\n2 bulk-replace a.md …',
            ),
        );
        expect(
            readFileSync(join(groomDir(home), 'sent.log'), 'utf8')
                .trim()
                .split('\n'),
        ).toHaveLength(2);
    });

    test('a sent chore with no receipt past 30 minutes is a missed receipt; a received one is not', () => {
        const home = fixtureHome();
        mkdirSync(groomDir(home), { recursive: true });
        const old = new Date(Date.now() - 40 * 60_000).toISOString();
        const older = new Date(Date.now() - 50 * 60_000).toISOString();
        writeFileSync(
            join(groomDir(home), 'sent.log'),
            `${older}\tprompt-groom\tgroom 10:17\n${old}\tpocket-write\tpk-1\n`,
        );
        writeFileSync(
            join(groomDir(home), 'receipts.log'),
            `${new Date(Date.now() - 45 * 60_000).toISOString()}\tprompt-groom\t1\t0\tW1-W3\n`,
        );
        const lines = cardLines(home);
        expect(lines.filter((l) => l.includes('missed receipt'))).toHaveLength(
            1,
        );
        expect(lines.join('\n')).toContain('pocket-write');
    });

    test('a receipt answers only its own class, and only one send', () => {
        const home = fixtureHome();
        mkdirSync(groomDir(home), { recursive: true });
        const at = (m: number) =>
            new Date(Date.now() - m * 60_000).toISOString();
        writeFileSync(
            join(groomDir(home), 'sent.log'),
            `${at(60)}\tprompt-groom\tgroom a\n${at(55)}\tprompt-groom\tgroom b\n${at(50)}\tbulk-replace\tswap\n`,
        );
        writeFileSync(
            join(groomDir(home), 'receipts.log'),
            `${at(45)}\tprompt-groom\t1\t0\tW1\n${at(44)}\tpocket-write\t1\t0\tPK-1\n`,
        );
        const missed = cardLines(home).filter((l) =>
            l.includes('missed receipt'),
        );
        expect(missed).toHaveLength(2);
        expect(missed.join('\n')).toContain('bulk-replace');
        expect(missed.join('\n')).toContain('groom b');
    });

    test('a chore sent a minute ago is not missed yet', () => {
        const home = fixtureHome();
        mkdirSync(groomDir(home), { recursive: true });
        writeFileSync(
            join(groomDir(home), 'sent.log'),
            `${new Date().toISOString()}\tpocket-write\tpk-1\n`,
        );
        expect(cardLines(home).join('\n')).not.toContain('missed receipt');
    });

    test('a send to codie is never logged as a chore', () => {
        const home = fixtureHome();
        sent(home, sentTo('⚡ 🔧 codie: x', 'pocket-write chore PK-1'));
        expect(() =>
            readFileSync(join(groomDir(home), 'sent.log'), 'utf8'),
        ).toThrow();
    });

    test('a receipt older than its send never answers it', () => {
        const home = fixtureHome();
        mkdirSync(groomDir(home), { recursive: true });
        const at = (m: number) =>
            new Date(Date.now() - m * 60_000).toISOString();
        writeFileSync(
            join(groomDir(home), 'sent.log'),
            `${at(40)}\tpocket-write\tpk-1\n`,
        );
        writeFileSync(
            join(groomDir(home), 'receipts.log'),
            `${at(50)}\tpocket-write\t1\t0\tPK-0\n`,
        );
        expect(cardLines(home).join('\n')).toContain('missed receipt');
    });
});
