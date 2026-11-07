// a wing's Bash line read by x-mod-guard's parser: prints the first path it can prove the line writes in a main checkout.
// a script run by path and a path behind an unknown variable stay unread, so a landing door like tree-sync.sh passes.
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import {
    type Command,
    commandsDeep,
    gitDir,
    gitParts,
    operands,
    resolve,
} from '../../home/.claude/plugin-x/mods/x-mod-guard/hooks/rules/command.ts';
import {
    commandWrites,
    pythonWrites,
} from '../../home/.claude/plugin-x/mods/x-mod-guard/hooks/rules/overwrite.ts';

const OPERAND_WRITERS = new Set([
    'chmod',
    'chown',
    'mkdir',
    'mv',
    'rm',
    'rmdir',
    'touch',
    'trash',
    'truncate',
    'unlink',
]);
const GIT_WRITERS = new Set([
    'add',
    'am',
    'apply',
    'checkout',
    'cherry-pick',
    'clean',
    'commit',
    'merge',
    'mv',
    'pull',
    'rebase',
    'reset',
    'restore',
    'revert',
    'rm',
    'stash',
    'switch',
]);
const GIT_TREE_FLAG = /^--(?:git-dir|work-tree)(?:=(.+))?$/;

// a linked worktree's `.git` is a file, a main checkout's a directory; no git spawn on a call every wing Bash pays
export function isMainCheckout(path: string) {
    let dir = path;
    while (!existsSync(dir)) dir = dirname(dir);
    dir = realpathSync(dir);
    for (;;) {
        const dot = join(dir, '.git');
        // `~/.git` here is an empty leftover, no repo: only a HEAD makes one
        if (existsSync(dot))
            return statSync(dot).isDirectory() && existsSync(join(dot, 'HEAD'));
        if (dir === dirname(dir)) return false;
        dir = dirname(dir);
    }
}

function gitTargets(c: Command, ctx: { home: string }) {
    const { sub } = gitParts(c.args);
    if (!GIT_WRITERS.has(sub)) return [];
    const dir = resolve(c.dir, '/', ctx);
    const flagged = c.args.flatMap((w, i) => {
        const m = w.text.match(GIT_TREE_FLAG);
        if (!m) return [];
        const value = m[1] ?? c.args[i + 1]?.text;
        return value ? [resolve(value, dir, ctx)] : [];
    });
    return flagged.length ? flagged : [gitDir(c, ctx)];
}

// a mode, an owner or a size comes first and names no file
function operandFiles(c: Command) {
    const ops = operands(c.args);
    const isValueFirst =
        c.name === 'chmod' ||
        c.name === 'chown' ||
        (c.name === 'truncate' && c.args.some((w) => w.text === '-s'));
    return isValueFirst ? ops.slice(1) : ops;
}

function fileTargets(c: Command, ctx: { home: string }) {
    const dir = resolve(c.dir, '/', ctx);
    const out = commandWrites(c, ctx);
    if (OPERAND_WRITERS.has(c.name))
        out.push(...operandFiles(c).map((p) => resolve(p, dir, ctx)));
    if (c.name === 'find' && c.args.some((w) => w.text === '-delete')) {
        const from = c.args[0]?.text ?? '';
        out.push(from && !from.startsWith('-') ? resolve(from, dir, ctx) : dir);
    }
    if (/^python\d*(?:\.\d+)?$/.test(c.name))
        out.push(
            ...pythonWrites(
                [...c.args.map((w) => w.text), ...c.bodies].join('\n'),
                dir,
                ctx,
            ),
        );
    return out;
}

function repoTargets(c: Command, ctx: { home: string }) {
    if (c.name === 'git') return gitTargets(c, ctx);
    return c.name === 'x' &&
        c.args[0]?.text === 'lane' &&
        c.args[1]?.text === 'commit'
        ? [resolve(c.dir, '/', ctx)]
        : [];
}

export function mainCheckoutWrite(command: string, cwd: string) {
    const ctx = { home: homedir() };
    const list = commandsDeep(command, cwd);
    const paths = [
        // main's gitignored .scratch holds a lane's spec, whichever clio runs the lane; a repo verb there still acts on main
        ...list
            .flatMap((c) => fileTargets(c, ctx))
            .filter((p) => !p.includes('/.scratch/')),
        ...list.flatMap((c) => repoTargets(c, ctx)),
    ];
    return paths.filter((p) => !p.includes('$')).find(isMainCheckout);
}

if (import.meta.main) {
    const input = JSON.parse(readFileSync(0, 'utf8'));
    const hit = mainCheckoutWrite(
        input.tool_input?.command ?? '',
        input.cwd ?? '/',
    );
    if (hit) console.log(hit);
}
