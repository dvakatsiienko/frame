// unbash beside x-mod-guard's walker: the command names each one reads, over the escape table and the last 7 days of Bash calls.
// run: npm pack unbash@<v> in a scratch dir, untar it, then
//   node docs/test-drive/unbash-bench.mts <scratch>/package/dist [days]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

import { bashCalls } from '../../home/.claude/plugin-x/mods/replay.ts';
import {
    commands,
    commandsDeep,
} from '../../home/.claude/plugin-x/mods/x-mod-guard/hooks/rules/command.ts';
import { parse } from '../../home/.claude/plugin-x/mods/x-mod-guard/hooks/shell.ts';
import { ESCAPES } from '../../home/.claude/plugin-x/mods/x-mod-guard/tests/escapes.ts';

const [dist, days = '7'] = process.argv.slice(2);
if (!dist) throw new Error('usage: unbash-bench.mts <unbash dist dir> [days]');
type Node = {
    type: string;
    name?: { value: string };
    args?: { value?: string; text: string }[];
    errors?: { message: string }[];
};
const ub: {
    parse: (s: string) => Node;
    forEachChild: (n: Node, f: (c: Node) => void) => void;
} = await import(path.join(path.resolve(dist), 'parser.js'));

const KEYWORDS =
    /^(for|while|until|if|elif|case|select|function|time|coproc|then|do|else|fi|done|esac|in|!|\{|\}|\[\[|\]\]|;;)$/;

function unbashRead(source: string) {
    const heads = new Set<string>();
    const words = new Set<string>();
    const errors: string[] = [];
    const visit = (node: Node) => {
        if (node.type === 'Script' && node.errors)
            errors.push(...node.errors.map((e) => e.message));
        if (node.type === 'Command') {
            if (node.name) heads.add(node.name.value);
            for (const a of node.args ?? []) words.add(a.value ?? a.text);
        }
        ub.forEachChild(node, visit);
    };
    const at = performance.now();
    const tree = ub.parse(source);
    const ms = performance.now() - at;
    visit(tree);
    return { errors, heads, ms, words };
}

// unbash-only: a head the walker never names (its expansions, paths and peeled wrappers resolve on purpose, so those are skipped);
// walker-only: a walker head unbash reads as no command at all (a case pattern, an arithmetic word, an array literal)
function bench(label: string, lines: string[]) {
    const ms: number[] = [];
    let unbashOnly = 0;
    let walkerOnly = 0;
    let failed = 0;
    for (const line of lines) {
        const u = unbashRead(line);
        ms.push(u.ms);
        if (u.errors.length) failed++;
        const deep = new Set(
            commandsDeep(line, '/repo').flatMap((c) => [...c.wrappers, c.name]),
        );
        if (
            [...u.heads].some(
                (h) =>
                    h &&
                    !/[$/`]/.test(h) &&
                    !deep.has(h) &&
                    h !== 'pnpm' &&
                    h !== 'env',
            )
        )
            unbashOnly++;
        const top = commands(parse(line), '/repo').map(
            (c) => c.head?.text ?? c.name,
        );
        if (
            top.some(
                (h) =>
                    h &&
                    !/[$/]/.test(h) &&
                    !KEYWORDS.test(h) &&
                    !u.heads.has(h) &&
                    !u.words.has(h),
            )
        )
            walkerOnly++;
    }
    const sorted = ms.slice(5).sort((a, b) => a - b);
    const q = (p: number) => sorted[Math.floor(sorted.length * p)]?.toFixed(4);
    console.log(
        JSON.stringify({
            label,
            lines: lines.length,
            maxMs: sorted.at(-1)?.toFixed(2),
            p50ms: q(0.5),
            p95ms: q(0.95),
            parseFailed: failed,
            unbashOnly,
            walkerOnly,
        }),
    );
}

bench(
    'escapes',
    ESCAPES.map((row) => row[3]),
);
const root = path.join(homedir(), '.claude/projects');
const since = Date.now() - Number(days) * 86_400_000;
const seen = new Set<string>();
const calls = readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.jsonl'))
    .map((e) => path.join(e.parentPath, e.name))
    .filter((f) => statSync(f).mtimeMs >= since)
    .flatMap((f) => bashCalls(readFileSync(f, 'utf8')))
    .map((c) => c.command)
    .filter((c) => !seen.has(c) && seen.add(c));
bench('replay', calls);
