import { type Command, type Refusal, commandsDeep } from './command.ts';

const isStore = (text: string) => /(^|[/'"])pr-verified\.json/i.test(text);
const isWatchPr = (text: string) => /(^|\/)watch-pr\.sh$/.test(text);
const RUNNERS = new Set(['bash', 'dash', 'ksh', 'sh', 'zsh', 'source', '.']);
const READERS = new Set([
    '[',
    'basename',
    'bat',
    'cat',
    'cd',
    'diff',
    'dirname',
    'du',
    'echo',
    'file',
    'grep',
    'head',
    'jq',
    'less',
    'ls',
    'md5',
    'more',
    'printf',
    'pushd',
    'readlink',
    'realpath',
    'rg',
    'shasum',
    'stat',
    'tail',
    'test',
    'wc',
]);
// these run text the parser cannot read, so a line that names the store beside one counts as touching it
const OPAQUE =
    /^(python[\d.]*|node|bun|deno|ruby|perl|php|lua|osascript|xargs|parallel|eval)$/;

function onlyReads(c: Command, named: (text: string) => boolean) {
    const words = c.args.map((w) => w.text);
    const operands = words.filter((w) => !w.startsWith('-'));
    if (c.name === 'sed')
        return !words.some((w) => /^(-\w*i|--in-place)/.test(w));
    if (c.name === 'cp') return !named(operands.at(-1) ?? '');
    // sd's first two operands are its find and its replace, text that may name a store in a doc
    if (c.name === 'sd') return !operands.slice(2).some(named);
    return READERS.has(c.name);
}

// writers are too many to list, and each one missed is a hole: past the few commands that only read, naming a store is touching it
export function touchesStore(
    command: string,
    cwd: string,
    named: (text: string) => boolean,
) {
    const parsed = commandsDeep(command, cwd);
    if (parsed.some((c) => OPAQUE.test(c.name)) && named(command)) return true;
    return parsed.some(
        (c) =>
            [...c.writes, ...c.appends].some(named) ||
            (named(`${c.dir}/`) &&
                (c.writes.length + c.appends.length > 0 ||
                    !READERS.has(c.name))) ||
            (c.args.some((w) => named(w.text)) && !onlyReads(c, named)),
    );
}

// `merge-auto` reads this store as sixth sense's clean, so only sixth sense and the coordinator write it; the caller checks
// who runs the line. a script run by path writes unseen: a Bash rule reads the line, never what the line goes on to run
export function cleanStampWrite(
    command: string,
    cwd: string,
): Refusal | undefined {
    const parsed = commandsDeep(command, cwd);
    const isStamp = parsed.some((c) => {
        const words = c.args.map((w) => w.text);
        const runsIt =
            isWatchPr(c.name) || (RUNNERS.has(c.name) && words.some(isWatchPr));
        return (
            runsIt &&
            words.some((w) => w === '--verified' || w.startsWith('--verified='))
        );
    });
    const isWrite = touchesStore(command, cwd, isStore);
    if (!isStamp && !isWrite) return undefined;
    return {
        door: "sixth sense's clean, or the coordinator's stamp, through watch-pr.sh --verified in that session; ask the lane's sixth sense or clio; a read goes through cat or jq",
        rule: 'clean-stamp',
        targets: ['pr-verified.json'],
        why: 'x lane merge-auto reads ~/.claude/shelf/pr-verified.json as the clean on a pr, so only sixth sense and the coordinator write it',
    };
}
