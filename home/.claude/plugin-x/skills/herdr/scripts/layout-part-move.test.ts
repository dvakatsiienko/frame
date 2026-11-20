import { spawnSync } from 'node:child_process';
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { planPartMove } from './layout-part-move.ts';

// a copy of dima's itrout.json (20 Nov), its deck block wrapped in a `deck` column holding `orbit`
const sidebar = readFileSync(
    fileURLToPath(new URL('./fixtures/itrout.json.txt', import.meta.url)),
    'utf8',
);
const script = fileURLToPath(new URL('./layout-part-move.ts', import.meta.url));

type Node = { id: string; children?: Node[]; [key: string]: unknown };
const find = (node: Node, id: string): Node | undefined =>
    node.id === id
        ? node
        : node.children?.map((c) => find(c, id)).find(Boolean);

/** the deck layout as the spec draws it: antenna 279 px and glide above orbit, the emptied sidebar hidden */
function deckTree() {
    const tree: Node = JSON.parse(sidebar);
    const side = find(tree, 'sidebar') as Node;
    const [antenna, glide] = side.children as [Node, Node];
    side.children = [];
    side.hidden = true;
    antenna.size = { px: 279 };
    const deck = find(tree, 'deck') as Node;
    deck.children = [antenna, glide, ...(deck.children as Node[])];
    return tree;
}

function moved(text: string, ...moves: PartMove[]) {
    return moves.reduce((t, move) => {
        const plan = planPartMove(t, move);
        if ('error' in plan) throw new Error(plan.error);
        return plan.text;
    }, text);
}

/** the lines of `a` that `b` lacks, counting repeats: a moved line is in both */
function minus(a: string[], b: string[]) {
    const left = [...b];
    return a.filter((line) => {
        const at = left.indexOf(line);
        if (at < 0) return true;
        left.splice(at, 1);
        return false;
    });
}

const toDeck: [PartMove, PartMove] = [
    { before: 'orbit', part: 'antenna', size: { px: 279 }, target: 'deck' },
    { before: 'orbit', part: 'glide', target: 'deck' },
];
const toSidebar: [PartMove, PartMove] = [
    { part: 'antenna', size: { weight: 1 }, target: 'sidebar' },
    { part: 'glide', target: 'sidebar' },
];

describe('planPartMove', () => {
    it('antenna, then glide, to the deck: the tree is the deck layout', () => {
        expect(JSON.parse(moved(sidebar, ...toDeck))).toEqual(deckTree());
    });

    it('run back to the sidebar, the file is byte for byte the original', () => {
        expect(moved(moved(sidebar, ...toDeck), ...toSidebar)).toBe(sidebar);
    });

    it('one move changes only the moved block: antenna to the deck keeps every line but its size', () => {
        const before = sidebar.split('\n');
        const after = moved(sidebar, toDeck[0]).split('\n');
        expect(minus(before, after)).toEqual(['                "weight": 1']);
        expect(minus(after, before)).toEqual(['                "px": 279']);
    });

    it('emptying a column hides it, and filling it shows it again', () => {
        const deck = moved(sidebar, ...toDeck);
        expect(find(JSON.parse(deck), 'sidebar')?.hidden).toBe(true);
        const back = moved(deck, toSidebar[0]);
        expect(find(JSON.parse(back), 'sidebar')).not.toHaveProperty('hidden');
    });

    it('a hidden column that already holds parts stays hidden when one joins', () => {
        const tree = JSON.parse(
            moved(sidebar, { part: 'glide', target: 'panel' }),
        );
        expect(find(tree, 'panel')?.hidden).toBe(true);
    });

    it('emptying a column already hidden keeps one hidden line, and the part goes back', () => {
        const out = moved(sidebar, { part: 'panel-body', target: 'deck' });
        expect(out.match(/"hidden": true/g)?.length).toBe(
            sidebar.match(/"hidden": true/g)?.length,
        );
        expect(
            'text' in
                planPartMove(out, { part: 'panel-body', target: 'panel' }),
        ).toBe(true);
    });

    it('a part the layout does not hold is refused, naming it', () => {
        expect(planPartMove(sidebar, { part: 'nope', target: 'deck' })).toEqual(
            { error: 'no part «nope» in this layout' },
        );
    });

    it('a target that does not exist, or is no column or row, is refused', () => {
        expect(
            planPartMove(sidebar, { part: 'antenna', target: 'nowhere' }),
        ).toEqual({ error: 'no column or row «nowhere» in this layout' });
        expect(
            planPartMove(sidebar, { part: 'antenna', target: 'glide' }),
        ).toEqual({ error: 'no column or row «glide» in this layout' });
        expect(
            planPartMove(sidebar, { part: 'antenna', target: 'views' }),
        ).toEqual({ error: 'no column or row «views» in this layout' });
    });

    it('a --before that is not a child of the target is refused', () => {
        expect(
            planPartMove(sidebar, {
                before: 'chat',
                part: 'antenna',
                target: 'deck',
            }),
        ).toEqual({ error: '«chat» is not a part of «deck»' });
    });

    it('a part already in its target, or a column moved into itself, is refused', () => {
        expect(
            planPartMove(sidebar, { part: 'antenna', target: 'sidebar' }),
        ).toEqual({ error: '«antenna» already sits in «sidebar»' });
        expect(
            planPartMove(sidebar, { part: 'body', target: 'sidebar' }),
        ).toEqual({ error: '«sidebar» sits inside «body»' });
    });

    it('a valid file the line move cannot follow is refused as that, never as broken json', () => {
        const oneLine = sidebar.replace(
            '"children": [\n            {\n              "id": "orbit"',
            '"children": [],\n          "kids": [\n            {\n              "id": "orbit"',
        );
        expect(
            planPartMove(oneLine, { part: 'glide', target: 'deck' }),
        ).toEqual({
            error: 'the move would not read back as the layout it means, so nothing is written',
        });
    });

    it('the root never moves', () => {
        expect(planPartMove(sidebar, { part: 'root', target: 'deck' })).toEqual(
            { error: '«root» is the whole layout' },
        );
    });

    it('a size on a part with none is refused', () => {
        expect(
            planPartMove(sidebar, {
                part: 'views',
                size: { px: 9 },
                target: 'deck',
            }),
        ).toEqual({ error: '«views» has no size to change' });
    });
});

describe('the cli, on a fixture HOME', () => {
    let home = '';
    afterEach(() => {
        if (home) rmSync(home, { force: true, recursive: true });
    });

    function layoutHome() {
        home = mkdtempSync(join(process.env.TMPDIR ?? '/tmp', 'part-move-'));
        const dir = join(home, '.config/herdr-app/layouts');
        mkdirSync(dir, { recursive: true });
        const file = join(dir, 'itrout.json');
        writeFileSync(file, sidebar);
        return file;
    }
    const run = (...args: string[]) =>
        spawnSync('node', [script, ...args, '--layout', 'itrout'], {
            encoding: 'utf8',
            env: { ...process.env, HOME: home },
            timeout: 10_000,
        });

    it('moves a part in the named layout file and says what moved', () => {
        const file = layoutHome();
        const out = run('glide', 'deck', '--before', 'orbit');
        expect(out.stderr).toBe('');
        expect(out.status).toBe(0);
        expect(out.stdout).toBe('moved «glide» into «deck» in itrout\n');
        const tree = JSON.parse(readFileSync(file, 'utf8'));
        expect(find(tree, 'deck')?.children?.map((c) => c.id)).toEqual([
            'glide',
            'orbit',
        ]);
    });

    it('exits 1 on an unknown part and writes nothing', () => {
        const file = layoutHome();
        const out = run('nope', 'deck');
        expect(out.status).toBe(1);
        expect(out.stderr).toContain('no part «nope» in this layout');
        expect(readFileSync(file, 'utf8')).toBe(sidebar);
    });

    it('exits 1 on a bad size and writes nothing', () => {
        const file = layoutHome();
        const out = run('antenna', 'deck', '--size', 'wide');
        expect(out.status).toBe(1);
        expect(out.stderr).toContain('--size takes px:<n> or weight:<n>');
        expect(readFileSync(file, 'utf8')).toBe(sidebar);
    });
});

/* Types */

type PartMove = Parameters<typeof planPartMove>[1];
