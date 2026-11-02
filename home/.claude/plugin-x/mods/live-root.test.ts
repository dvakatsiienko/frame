import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { loadCheck, modsOf, servedDirs, slotsOf } from './live-root.ts';

function mod(dir: string, name = dir.split('/').at(-1) ?? '') {
    mkdirSync(join(dir, '.claude-plugin'), { recursive: true });
    writeFileSync(
        join(dir, '.claude-plugin/plugin.json'),
        JSON.stringify({ name }),
    );
    return dir;
}

const fresh = () => mkdtempSync(join(tmpdir(), 'live-root-'));
// a second path to the same dir, the way /var and /private/var reach one tmp dir on macos
function linkTo(dir: string) {
    const link = join(fresh(), 'link');
    symlinkSync(dir, link);
    return link;
}

describe('modsOf', () => {
    it('serves a mod dir alone, its parent the root', () => {
        const root = fresh();
        const redact = mod(join(root, 'x-mod-redact'));
        expect(modsOf(redact)).toEqual({
            mods: [{ dir: redact, name: 'x-mod-redact' }],
            root,
        });
    });

    it('serves every mod of a mods root', () => {
        const root = fresh();
        mod(join(root, 'x-mod-redact'));
        mod(join(root, 'x-mod-guard'));
        mkdirSync(join(root, 'notes'));
        expect(modsOf(root)?.mods.map((m) => m.name)).toEqual([
            'x-mod-guard',
            'x-mod-redact',
        ]);
    });

    it("finds a frame tree's mods root under home/.claude/plugin-x/mods", () => {
        const tree = fresh();
        const root = join(tree, 'home/.claude/plugin-x/mods');
        mod(join(root, 'x-mod-redact'));
        expect(modsOf(tree)?.root).toBe(root);
    });

    it('finds nothing in a dir with no mods', () => {
        expect(modsOf(fresh())).toBeUndefined();
    });
});

describe('servedDirs', () => {
    it("puts each served mod in its live namesake's place and adds a new one last", () => {
        const live = ['/main/x-mod-guard', '/main/x-mod-redact'];
        const nameOf = (d: string) => d.split('/').at(-1);
        expect(
            servedDirs(
                live,
                [
                    { dir: '/tree/x-mod-redact', name: 'x-mod-redact' },
                    { dir: '/tree/x-mod-new', name: 'x-mod-new' },
                ],
                nameOf,
            ),
        ).toEqual([
            '/main/x-mod-guard',
            '/tree/x-mod-redact',
            '/tree/x-mod-new',
        ]);
    });
});

describe('loadCheck', () => {
    const line = (name: string, dir: string) =>
        `2026-11-02 [DEBUG] Read hooks.json for plugin ${name} (enabled=true): ${dir}/hooks/hooks.json`;
    const hooked = (dir: string) => {
        mkdirSync(join(dir, 'hooks'), { recursive: true });
        writeFileSync(join(dir, 'hooks/hooks.json'), '{}');
        return dir;
    };
    const MAIN = '/Users/dima/frame/home/.claude/plugin-x/mods/x-mod-redact';

    it("names a served mod the engine read from main's checkout", () => {
        const redact = hooked(mod(join(fresh(), 'x-mod-redact')));
        expect(
            loadCheck(
                [line('x-mod-redact', MAIN)],
                [{ dir: redact, name: 'x-mod-redact' }],
            ),
        ).toEqual({
            elsewhere: [`x-mod-redact loaded from ${MAIN}, not ${redact}`],
            unseen: [],
        });
    });

    it('passes a mod read from its served dir, through a symlinked tmp path', () => {
        const redact = hooked(mod(join(fresh(), 'x-mod-redact')));
        expect(
            loadCheck(
                [line('x-mod-redact', linkTo(redact))],
                [{ dir: redact, name: 'x-mod-redact' }],
            ),
        ).toEqual({ elsewhere: [], unseen: [] });
    });

    it('names a hooked mod with no load line as unseen, never as elsewhere', () => {
        const redact = hooked(mod(join(fresh(), 'x-mod-redact')));
        expect(loadCheck([], [{ dir: redact, name: 'x-mod-redact' }])).toEqual({
            elsewhere: [],
            unseen: ['x-mod-redact'],
        });
    });

    it('skips a mod with no hooks.json', () => {
        const plain = mod(join(fresh(), 'x-mod-plain'));
        expect(loadCheck([], [{ dir: plain, name: 'x-mod-plain' }])).toEqual({
            elsewhere: [],
            unseen: [],
        });
    });
});

describe('slotsOf', () => {
    it("tries a mod's own slot, then the slot of the root that holds it", () => {
        const root = fresh();
        const redact = mod(join(root, 'x-mod-redact'));
        mod(join(root, 'x-mod-guard'));
        const [own, whole] = slotsOf(modsOf(redact)!);
        expect([own, whole]).toEqual([
            'x-mod-redact',
            slotsOf(modsOf(root)!)[0],
        ]);
    });

    it('gives a root one slot, the same through a symlinked path', () => {
        const root = fresh();
        mod(join(root, 'x-mod-redact'));
        mod(join(root, 'x-mod-guard'));
        const linked = linkTo(root);
        expect(slotsOf(modsOf(root)!)).toEqual(slotsOf(modsOf(linked)!));
    });
});
