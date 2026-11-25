import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { gitEnv } from '../../script/lib/git-fixture.ts';
import { prompt, stop } from './siesta-gate.ts';
import {
    SID,
    commit,
    fixtureHome,
    said,
    siesta,
    stopInput,
} from './siesta-gate-world.ts';

describe('every clio on its own stamp', () => {
    const WING = 'w-2';
    const wingDir = (home: string) =>
        join(home, '.local/state/clio/threads/wing-2');
    const threaded = (home: string) => {
        const dir = join(home, '.claude/sessions');
        mkdirSync(dir, { recursive: true });
        const add = (sessionId: string, name: string, kind = 'interactive') =>
            writeFileSync(
                join(dir, `${sessionId}.json`),
                JSON.stringify({ kind, name, sessionId }),
            );
        add(SID, '🦉 clio');
        add(WING, '🦉🪽 clio: wing 2');
        add('s-helga', '🎀 helga', 'bg');
    };
    const asWing = (home: string) => ({
        ...stopInput(home),
        session_id: WING,
    });

    test("a wing's commits make the wing due, never main", () => {
        const home = fixtureHome();
        threaded(home);
        commit(home, 15, 'clio-wing-2');
        expect(said(stop(home, stopInput(home)))).toBeUndefined();
        expect(said(stop(home, asWing(home)))).toContain('siesta due');
    });

    test("main's commits make main due, never a wing", () => {
        const home = fixtureHome();
        threaded(home);
        commit(home, 15, 'clio');
        expect(said(stop(home, asWing(home)))).toBeUndefined();
        expect(said(stop(home, stopInput(home)))).toContain('siesta due');
    });

    test("a wing's unlanded branch counts for it", () => {
        const home = fixtureHome();
        threaded(home);
        commit(home, 1, 'dima');
        const repo = join(home, 'frame');
        const git = (...args: string[]) =>
            spawnSync('git', args, {
                cwd: repo,
                env: gitEnv(),
                timeout: 10_000,
            });
        git('checkout', '-q', '-b', 'clio-wing-2');
        commit(home, 15, 'clio-wing-2');
        git('checkout', '-q', '-');
        expect(said(stop(home, asWing(home)))).toContain('siesta due');
    });

    test("a wing's state and stamp live apart from main's", () => {
        const home = fixtureHome();
        threaded(home);
        const before = siesta;
        commit(home, 15, 'clio-wing-2');
        stop(home, stopInput(home));
        const main = before(home);
        stop(home, asWing(home));
        expect(before(home)).toEqual(main);
        const out = spawnSync(
            'node',
            [join(import.meta.dirname, 'siesta-gate.ts'), 'open'],
            {
                encoding: 'utf8',
                env: {
                    ...gitEnv(),
                    CLAUDE_CODE_SESSION_ID: WING,
                    HOME: home,
                },
                timeout: 10_000,
            },
        );
        expect(out.stdout).toContain('last siesta: none');
        expect(before(home)).toEqual(main);
        expect(
            JSON.parse(
                readFileSync(join(wingDir(home), 'siesta.json'), 'utf8'),
            ),
        ).toMatchObject({ open: true });
    });

    test('a session that is not the recorded main holds no thread, even unnamed', () => {
        const home = fixtureHome();
        threaded(home);
        writeFileSync(
            join(home, '.local/state/clio/main-session'),
            `pid=1\nsession=${SID}\n`,
        );
        commit(home, 15, 'clio');
        const stranger = { ...stopInput(home), session_id: 's-stranger' };
        expect(stop(home, stranger)).toBeUndefined();
        expect(said(stop(home, stopInput(home)))).toContain('siesta due');
        const out = spawnSync(
            'node',
            [join(import.meta.dirname, 'siesta-gate.ts'), 'open'],
            {
                encoding: 'utf8',
                env: {
                    ...gitEnv(),
                    CLAUDE_CODE_SESSION_ID: 's-stranger',
                    HOME: home,
                },
                timeout: 10_000,
            },
        );
        expect(out.status).not.toBe(0);
        expect(siesta(home).open).toBeFalsy();
    });

    test('a parked sidecar has no thread: no nudge, no state', () => {
        const home = fixtureHome();
        threaded(home);
        commit(home, 15, 'clio');
        expect(
            stop(home, { ...stopInput(home), session_id: 's-helga' }),
        ).toBeUndefined();
        expect(
            prompt(home, { prompt: 'go', session_id: 's-helga' }),
        ).toBeUndefined();
    });
});
