import { execFileSync } from 'node:child_process';
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

// a layout json is the one home of where a part sits (HRD-0001); a re-serialize rewrites every line of a hand-kept
// file (fleet hazard), so a move cuts and pastes the part's own lines, and the result must parse to the tree the
// move means or nothing is written. the bend: a sibling's comma, and `"hidden": true` on a column the move empties

const usage =
    'usage: layout-part-move.ts <part> <column or row> [--before <id>] [--size px:<n>|weight:<n>] [--layout <name>]';

/** the layout's text with `part` moved into `target`, or why it can't be */
export function planPartMove(
    text: string,
    move: PartMove,
): { text: string } | { error: string } {
    const tree: Node = JSON.parse(text);
    const { part, target, before, size } = move;
    if (tree.id === part) return { error: `«${part}» is the whole layout` };
    const from = parentOf(tree, part);
    if (!from) return { error: `no part «${part}» in this layout` };
    const into = nodeOf(tree, target);
    if (!into?.children || (into.type !== 'column' && into.type !== 'row'))
        return { error: `no column or row «${target}» in this layout` };
    if (from === into)
        return { error: `«${part}» already sits in «${target}»` };
    const node = from.children.find((c) => c.id === part) as Node;
    if (nodeOf(node, target))
        return { error: `«${target}» sits inside «${part}»` };
    if (before && !into.children.some((c) => c.id === before))
        return { error: `«${before}» is not a part of «${target}»` };
    if (size && !node.size) return { error: `«${part}» has no size to change` };

    const lines = text.split('\n');
    const cut = cutBlock(lines, part, size);
    if (!cut) return unreadable;
    if (from.children.length === 1 && from.hidden !== true)
        hide(lines, from.id);
    if (!paste(lines, target, before, cut)) return unreadable;

    const next = lines.join('\n');
    expectMove(tree, from, into, node, move);
    return readsAs(next, tree) ? { text: next } : notReadBack;
}

function readsAs(text: string, tree: Node) {
    try {
        return isDeepStrictEqual(JSON.parse(text), tree);
    } catch {
        return false;
    }
}

const notReadBack = {
    error: 'the move would not read back as the layout it means, so nothing is written',
};

const unreadable = {
    error: 'the layout is not in 2-space json form, so a line move would break it',
};

const indentOf = (line = '') => line.length - line.trimStart().length;

/** whether `line` sits at `indent` and its text passes `test` */
const lineIs = (
    line: string | undefined,
    indent: number,
    test: (text: string) => boolean,
) => line !== undefined && indentOf(line) === indent && test(line.trim());

/** the line of node `id`'s own `"id"` key, and the `{` above it */
function blockAt(lines: string[], id: string) {
    const at = lines.findIndex(
        (l) => l.trim().replace(/,$/, '') === `"id": ${JSON.stringify(id)}`,
    );
    if (at < 1) return null;
    const indent = indentOf(lines[at]) - 2;
    let start = at - 1;
    while (start > 0 && !lineIs(lines[start], indent, (t) => t === '{'))
        start--;
    let end = at;
    while (
        end < lines.length &&
        !lineIs(lines[end], indent, (t) => t.startsWith('}'))
    )
        end++;
    return end < lines.length ? { end, indent, start } : null;
}

/** takes the part's lines out of `lines`, its size swapped, and fixes the comma it leaves */
function cutBlock(lines: string[], id: string, size?: Size) {
    const block = blockAt(lines, id);
    if (!block) return null;
    const { end, indent, start } = block;
    const cut = lines.splice(start, end - start + 1);
    const wasLast = !cut.at(-1)?.endsWith(',');
    const above = lines[start - 1];
    if (wasLast && above?.trim() === '},')
        lines[start - 1] = above.replace(/,$/, '');
    cut.push((cut.pop() ?? '').replace(/,$/, ''));
    if (size) {
        const at = cut.findIndex(
            (l) => indentOf(l) === indent + 2 && l.trim() === '"size": {',
        );
        if (at < 0 || cut[at + 2]?.trim().replace(/,$/, '') !== '}')
            return null;
        const [key, value] = Object.entries(size)[0] ?? [];
        cut[at + 1] = `${' '.repeat(indent + 4)}"${key}": ${value}`;
    }
    return { indent, lines: cut };
}

/** the `"children": [` line of node `id` and its closing `]` */
function childrenOf(lines: string[], id: string) {
    const block = blockAt(lines, id);
    if (!block) return null;
    const key = block.indent + 2;
    const open = lines.findIndex(
        (l, i) =>
            i > block.start &&
            i < block.end &&
            indentOf(l) === key &&
            l.trim().startsWith('"children": ['),
    );
    if (open < 0) return null;
    let close = open;
    while (!lineIs(lines[close], key, (t) => t.startsWith(']')))
        if (++close >= block.end) return null;
    return { close, key, open };
}

function hide(lines: string[], id: string) {
    const children = childrenOf(lines, id);
    if (children)
        lines.splice(
            children.open,
            0,
            `${' '.repeat(children.key)}"hidden": true,`,
        );
}

function paste(
    lines: string[],
    target: string,
    before: string | undefined,
    cut: { indent: number; lines: string[] },
) {
    const children = childrenOf(lines, target);
    if (!children) return false;
    const indent = children.key + 2;
    const block = cut.lines.map((l) =>
        l.trim()
            ? ' '.repeat(indent + indentOf(l) - cut.indent) + l.trimStart()
            : l,
    );
    const column = blockAt(lines, target);
    const hidden = lines.findIndex(
        (l, i) =>
            i > (column?.start ?? 0) &&
            i < children.open &&
            indentOf(l) === children.key &&
            l.trim() === '"hidden": true,',
    );
    let at = children.close;
    if (before) {
        const sibling = blockAt(lines, before);
        if (!sibling) return false;
        block[block.length - 1] += ',';
        at = sibling.start;
    } else if (children.close - 1 !== children.open) {
        lines[children.close - 1] += ',';
    }
    const wasEmpty = children.close - 1 === children.open;
    lines.splice(at, 0, ...block);
    if (wasEmpty && hidden >= 0) lines.splice(hidden, 1);
    return true;
}

/** the same move on the parsed tree: what the cut-and-paste text must read back as */
function expectMove(
    tree: Node,
    from: Node & { children: Node[] },
    into: Node,
    node: Node,
    { before, size }: PartMove,
) {
    from.children = from.children.filter((c) => c !== node);
    if (from.children.length === 0) from.hidden = true;
    if (size) node.size = size;
    const children = into.children as Node[];
    if (children.length === 0) delete into.hidden;
    const at = before
        ? children.findIndex((c) => c.id === before)
        : children.length;
    children.splice(at, 0, node);
    return tree;
}

function nodeOf(node: Node, id: string): Node | undefined {
    if (node.id === id) return node;
    for (const child of node.children ?? []) {
        const found = nodeOf(child, id);
        if (found) return found;
    }
}

function parentOf(
    node: Node,
    id: string,
): (Node & { children: Node[] }) | undefined {
    for (const child of node.children ?? []) {
        if (child.id === id) return node as Node & { children: Node[] };
        const found = parentOf(child, id);
        if (found) return found;
    }
}

export function parsePartMoveArgs(argv: string[]): Args | string {
    const [part, target, ...rest] = argv;
    if (!part || !target || part.startsWith('-') || target.startsWith('-'))
        return usage;
    const args: Args = { part, target };
    for (let i = 0; i < rest.length; i += 2) {
        const [flag, value] = [rest[i], rest[i + 1]];
        if (!value) return usage;
        if (flag === '--before') args.before = value;
        else if (flag === '--layout') args.layout = value;
        else if (flag === '--size') {
            const match = /^(px|weight):(\d+)$/.exec(value);
            if (!match) return '--size takes px:<n> or weight:<n>';
            const n = Number(match[2]);
            args.size = match[1] === 'px' ? { px: n } : { weight: n };
        } else return usage;
    }
    return args;
}

/** the shown layout's name, from the window's status */
function activeLayout() {
    const status = JSON.parse(
        execFileSync('herdr-app', ['status'], {
            encoding: 'utf8',
            timeout: 10_000,
        }),
    );
    return status.layout as string;
}

function main(argv: string[]) {
    const args = parsePartMoveArgs(argv);
    if (typeof args === 'string') {
        console.error(args);
        return 1;
    }
    const layout = args.layout ?? activeLayout();
    const file = join(homedir(), '.config/herdr-app/layouts', `${layout}.json`);
    const plan = planPartMove(readFileSync(file, 'utf8'), args);
    if ('error' in plan) {
        console.error(plan.error);
        return 1;
    }
    writeFileSync(`${file}.part-move`, plan.text);
    renameSync(`${file}.part-move`, file);
    console.log(`moved «${args.part}» into «${args.target}» in ${layout}`);
    return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href)
    process.exitCode = main(process.argv.slice(2));

/* Types */

type Node = {
    id: string;
    children?: Node[];
    size?: unknown;
    hidden?: boolean;
    [key: string]: unknown;
};
type Size = { px: number } | { weight: number };
type PartMove = { part: string; target: string; before?: string; size?: Size };
type Args = PartMove & { layout?: string };
