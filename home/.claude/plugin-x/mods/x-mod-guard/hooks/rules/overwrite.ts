import { type Word, parse } from '../shell.ts';
import {
    type Command,
    type Context,
    type Refusal,
    SD_VALUE,
    basename,
    commands,
    hasFlag,
    isFlag,
    isJobTmp,
    operands,
    or,
    resolve,
} from './command.ts';

// an mv or cp's dest, then the file each source lands on when that dest is a dir
export function landings(c: Command, ctx: Context) {
    const ops = operands(c.args);
    const dest = ops.at(-1);
    if (ops.length < 2 || dest === undefined) return [];
    const to = resolve(dest, resolve(c.dir, '/', ctx), ctx);
    return [
        { path: to, text: dest },
        ...ops
            .slice(0, -1)
            .map((src) => ({ path: `${to}/${basename(src)}`, text: dest })),
    ];
}
// the paths a command may write over, for the caller to look up on disk
export function overwrittenPaths(
    command: string,
    cwd: string,
    ctx: Context = {},
) {
    return commands(parse(command), cwd).flatMap((c) => {
        const dir = resolve(c.dir, '/', ctx);
        const moved =
            c.name === 'mv' || c.name === 'cp'
                ? landings(c, ctx).map((l) => l.path)
                : [];
        return [...c.writes.map((w) => resolve(w, dir, ctx)), ...moved];
    });
}
export function writtenPaths(command: string, cwd: string, ctx: Context = {}) {
    const out: string[] = [];
    for (const m of command.matchAll(
        /open\(\s*['"]([^'"]+)['"]\s*,\s*['"][wax]/g,
    ))
        if (m[1]) out.push(resolve(m[1], cwd, ctx));
    const parsed = parse(command);
    for (const c of commands(parsed, cwd)) {
        const dir = resolve(c.dir, '/', ctx);
        const named = [...c.writes, ...c.appends];
        const ops = operands(c.args);
        if (c.name === 'tee') named.push(...ops);
        if (c.name === 'sd') named.push(...sdFiles(c.args));
        if (c.name === 'sed') named.push(...sedFiles(c.args));
        for (const n of named)
            if (n && !n.startsWith('/dev/') && !n.includes('$'))
                out.push(resolve(n, dir, ctx));
    }
    return [...new Set(out)];
}
// sd's files follow its find and replace; a flag in SD_VALUE eats the word after it
function sdFiles(args: Word[]) {
    const out: string[] = [];
    let isRest = false;
    for (let i = 0; i < args.length; i++) {
        const t = args[i]?.text ?? '';
        if (isRest) out.push(t);
        else if (t === '--') isRest = true;
        else if (SD_VALUE.has(t)) i++;
        else if (!isFlag(t)) out.push(t);
    }
    return out.slice(2);
}
// sed edits in place only with -i; macOS spells it `-i ''`, and -e or -f carries the script
function sedFiles(args: Word[]) {
    if (!args.some((a) => /^(-i|--in-place)/.test(a.text))) return [];
    const kept = args.filter(
        (a, i) => !(a.text === '' && args[i - 1]?.text === '-i'),
    );
    const isScripted = kept.some((a) => /^-[ef]$/.test(a.text));
    const files: string[] = [];
    for (let i = 0; i < kept.length; i++) {
        const t = kept[i]?.text ?? '';
        if (/^-[ef]$/.test(t)) i++;
        else if (!isFlag(t)) files.push(t);
    }
    return isScripted ? files : files.slice(1);
}
// the file a `>`, an mv, a cp -f or a cp /dev/null would empty or replace; the job's own tmp is its scratch to write over
export function overwrite(c: Command, ctx: Context): Refusal | undefined {
    const dir = resolve(c.dir, '/', ctx);
    const isFile = (p: string) =>
        ctx.kinds?.get(p) === 'file' && !isJobTmp(p, ctx);
    const written = c.writes.filter((w) => isFile(resolve(w, dir, ctx)));
    if (written.length)
        return {
            door: '>> to append, a new path, or the Write tool after reading the file',
            rule: 'overwrite',
            targets: written,
            why: 'a > redirect empties the file before the command runs',
        };
    const isNull = c.name === 'cp' && operands(c.args)[0] === '/dev/null';
    const isForced =
        c.name === 'mv' ||
        (c.name === 'cp' && hasFlag(c.args, ['--force'], 'f'));
    const isKept = hasFlag(c.args, ['--no-clobber'], 'ni');
    if (!(isNull || isForced) || isKept) return undefined;
    const [to, ...into] = landings(c, ctx);
    if (!to) return undefined;
    if (
        !isFile(to.path) &&
        !(ctx.kinds?.get(to.path) === 'dir' && into.some((l) => isFile(l.path)))
    )
        return undefined;
    if (isNull)
        return {
            door: 'the Write tool after reading the file',
            rule: 'overwrite',
            targets: [to.text],
            why: 'cp /dev/null empties the file',
        };
    return {
        door: `${c.name} -n, or trash the old file first`,
        rule: 'overwrite',
        targets: [to.text],
        why: `${c.name} replaces the file already there, silently`,
    };
}
