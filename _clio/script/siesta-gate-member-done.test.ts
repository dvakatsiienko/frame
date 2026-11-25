import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import { prompt, stop } from './siesta-gate.ts';
import { fixtureHome, said, siesta, stopInput } from './siesta-gate-world.ts';

describe('the siesta comes due', () => {
    test.each([
        '[done] FRM-1 shipped, look card on the ticket',
        'final 1a2b3c4 — local review clean',
        'final main:231772ad f104a04d',
        '#12 f104a04 final',
    ])('a member’s ping «%s» makes it due', (ping) => {
        const home = fixtureHome();
        prompt(home, {
            prompt: `<cross-session-message from="uds:/tmp/cc-socks/1.sock" from-name="⚡ 🔧 codie: clio-lean | FRM-1">\n${ping}\n</cross-session-message>`,
        });
        expect(said(stop(home, stopInput(home)))).toContain('siesta due');
    });

    test.each([
        '⚡ 🔎 sixth sense: clio-lean | main',
        '🌗 🎨 designer: speak | BYT-1',
    ])('a done ping from «%s» makes it due', (name) => {
        const home = fixtureHome();
        prompt(home, {
            prompt: `<cross-session-message from="uds:/tmp/cc-socks/1.sock" from-name="${name}">\n[done] round 3 clean\n</cross-session-message>`,
        });
        expect(said(stop(home, stopInput(home)))).toContain('siesta due');
    });

    const liveDone = (home: string, body = '[done] a wisp fixed') => {
        mkdirSync(join(home, '.local/state/clio'), { recursive: true });
        writeFileSync(
            join(home, '.local/state/clio/live-lanes'),
            'herdr lane\n',
        );
        return prompt(home, {
            prompt: `<cross-session-message from="uds:/tmp/cc-socks/1.sock" from-name="⚡ 🔧 codie: herdr lane | PK-363">\n${body}\n</cross-session-message>`,
        });
    };

    test('a lane not listed as live-steered is due at its first done, a pocket id in its name or not', () => {
        const home = fixtureHome();
        liveDone(home);
        prompt(home, {
            prompt: '<cross-session-message from="uds:/tmp/cc-socks/2.sock" from-name="⚡ 🔧 codie: mods lane | PK-363">\n[done] FRM-544 slice 0\n</cross-session-message>',
        });
        expect(said(stop(home, stopInput(home)))).toContain(
            '1 member done ping(s)',
        );
    });

    test('a live-steered lane’s dones batch: two make none due, the third does', () => {
        const home = fixtureHome();
        liveDone(home);
        liveDone(home);
        expect(said(stop(home, stopInput(home)))).toBeUndefined();
        liveDone(home);
        expect(said(stop(home, stopInput(home)))).toContain(
            '3 member done ping(s)',
        );
    });

    test('a live-steered lane’s one done is due once it is an hour old', () => {
        const home = fixtureHome();
        liveDone(home);
        vi.useFakeTimers({ now: Date.now() + 61 * 60_000 });
        try {
            expect(said(stop(home, stopInput(home)))).toContain('siesta due');
        } finally {
            vi.useRealTimers();
        }
    });

    test('a live-steered lane’s «final» beside a sha is due at once', () => {
        const home = fixtureHome();
        liveDone(home, 'final main:231772ad f104a04d');
        expect(said(stop(home, stopInput(home)))).toContain('siesta due');
    });

    test.each(['🎀 helga', '🦉 clio (side)', '🐦 ⬛ crow'])(
        'a done ping from «%s» makes none due',
        (name) => {
            const home = fixtureHome();
            prompt(home, {
                prompt: `<cross-session-message from="uds:/tmp/cc-socks/1.sock" from-name="${name}">\n[done] chore 4: pocket write\n</cross-session-message>`,
            });
            expect(stop(home, stopInput(home))).toBeUndefined();
        },
    );

    test('a member’s «final draft» line makes none due', () => {
        const home = fixtureHome();
        prompt(home, {
            prompt: '<cross-session-message from-name="⚡ 🔧 codie: x">\nfinal draft attached\n</cross-session-message>',
        });
        expect(stop(home, stopInput(home))).toBeUndefined();
    });

    test('a member’s progress line makes none due', () => {
        const home = fixtureHome();
        prompt(home, {
            prompt: '<cross-session-message from="codie">\n[progress] step 2 of FRM-1 done\n</cross-session-message>',
        });
        expect(stop(home, stopInput(home))).toBeUndefined();
    });
});

describe('every clio on its own stamp', () => {
    test("a member's done still counts through the app's peer prefix", () => {
        const home = fixtureHome();
        prompt(home, {
            prompt: 'Another Claude session sent a message:\n<cross-session-message from-name="🔧 codie: x">[done] landed</cross-session-message>',
        });
        expect(siesta(home).pings).toHaveLength(1);
    });
});
