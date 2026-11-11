import { type Command, type Refusal, commandsDeep } from './command.ts';

const isStore = (text: string) => /(^|[/'"]|of=)pr-verified\b/i.test(text);
// `cp a/pr-verified.json ~/.claude/shelf/` lands on the store with no word for it
const isStoreDir = (text: string) => /(\.claude|cc)\/shelf\/?$/i.test(text);
const isWatchPr = (text: string) => /(^|\/)watch-pr\.sh$/.test(text);
const RUNNERS = new Set(['bash', 'dash', 'ksh', 'sh', 'zsh', 'source', '.']);
// these move or remove what they name, so naming a store's parent dir is touching the store
const CARRIERS = new Set([
    'cp',
    'ditto',
    'install',
    'ln',
    'mv',
    'rm',
    'rmdir',
    'rsync',
    // `tar -xf forged.tar -C <shelf>` unpacks into the store (wisphunter 18:06)
    'tar',
    'trash',
]);
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

function operandsOf(words: string[]) {
    const end = words.indexOf('--');
    const flagged = end < 0 ? words : words.slice(0, end);
    return [
        ...flagged.filter((w) => !w.startsWith('-')),
        ...(end < 0 ? [] : words.slice(end + 1)),
    ];
}

function onlyReads(c: Command, named: (text: string) => boolean) {
    const words = c.args.map((w) => w.text);
    const operands = operandsOf(words);
    // sed writes from inside its script too (`w <file>`), so the store may stand only as the file it reads
    if (c.name === 'sed')
        return (
            !words.some((w) => /^(-\w*[iI]|--in-place)/.test(w)) &&
            words.filter(named).every((w) => w === operands.at(-1))
        );
    if (c.name === 'cp') return !named(operands.at(-1) ?? '');
    // sd's first two operands are its find and its replace, text that may name a store in a doc
    if (c.name === 'sd') return !operands.slice(2).some(named);
    if (c.name === 'find')
        return !words.some((w) =>
            /^-(delete|exec|execdir|ok|okdir|fprint)/.test(w),
        );
    // `git diff --output=<file>` and `git log -o` write
    if (c.name === 'git')
        return (
            GIT_READS.has(gitVerb(words) ?? '') &&
            !words.some((w) => /^(--output|-o$)/.test(w))
        );
    return READERS.has(c.name);
}
// git's verbs that only read the tree or the index (wisphunter: `git check-ignore -v <store>` was refused)
const GIT_READS = new Set([
    'blame',
    'cat-file',
    'check-ignore',
    'diff',
    'grep',
    'log',
    'ls-files',
    'show',
    'status',
]);
// the verb past git's own options, `-C <dir>` and `-c <key=value>` taking a value
function gitVerb(words: string[]) {
    for (let i = 0; i < words.length; i++) {
        const w = words[i] ?? '';
        if (w === '-C' || w === '-c') i++;
        else if (!w.startsWith('-')) return w;
    }
    return undefined;
}

// a copy out of the dir leaves the store alone, so cp counts only with the dir as its target
function carriesDir(c: Command, namedDir: (text: string) => boolean) {
    if (c.name === 'cp')
        return namedDir(operandsOf(c.args.map((w) => w.text)).at(-1) ?? '');
    return c.args.some(
        (w) => namedDir(w.text) || namedDir(`${c.dir}/${w.text}`),
    );
}

// a loop binds the names it lists and writes nothing itself; its body's commands are judged on their own
const LOOPS = new Set(['for', 'select']);
// a program's write call, in python, node, ruby or perl; a shell's writes are the parser's
const WRITE_CALL =
    /\bopen\s*\([^)]*,\s*['"][^'"]*[wax+]|\.(write|append)(File|FileSync|_text|_bytes)?\s*\(|\b(os|shutil|fs|File|FileUtils)\.\w*(rename|replace|remove|unlink|link|mkdir|makedirs|copy|move|write|append|touch|rm|cp|mv)\w*\s*\(|\.(unlink|rename|touch|mkdir|symlink_to)\s*\(|\bcreateWriteStream\b/;
// the folder named as a path a program opens: under `.claude`, `cc`, or a home the program reads, never a word in its data
const HOME_PATH = /\.claude|(^|[^\w-])cc\/|\bHOME\b|expanduser|homedir/;
function writesNamed(command: string, named: (text: string) => boolean) {
    return command
        .split(/\n|;/)
        .some(
            (line) =>
                named(line) && HOME_PATH.test(line) && WRITE_CALL.test(line),
        );
}

// writers are too many to list, and each one missed is a hole: past the few commands that only read, naming a store is touching it
export function touchesStore(
    command: string,
    cwd: string,
    named: (text: string) => boolean,
    namedDir: (text: string) => boolean,
    // the fences that refuse writes only (ticks, plugin stores): a program's text counts where one of its lines both
    // names the folder and writes, so a read through python passes (clio 18:34: «a read never forges»)
    isWritesOnly = false,
) {
    const parsed = commandsDeep(command, cwd);
    const runsOpaque = (c: Command) =>
        OPAQUE.test(c.name) || c.wrappers.some((w) => OPAQUE.test(w));
    if (
        parsed.some(runsOpaque) &&
        (isWritesOnly ? writesNamed(command, named) : named(command))
    )
        return true;
    // a loop over the folder's names hands each name to its body, so it reads only when nothing on the line writes
    const writesNothing = parsed.every(
        (c) =>
            !c.writes.length &&
            !c.appends.length &&
            !CARRIERS.has(c.name) &&
            !runsOpaque(c),
    );
    return parsed.some(
        (c) =>
            // a relative target after a `cd` is judged where it lands too (`cd <shelf> && … > orbit-t*/x`)
            [...c.writes, ...c.appends].some(
                (w) => named(w) || named(`${c.dir}/${w}`),
            ) ||
            // in a writes-only fence a command run inside the folder counts as a write, a carrier or a program,
            // never as `ls`, `grep` or `jq` reading there (clio 18:34)
            (named(`${c.dir}/`) &&
                (c.writes.length + c.appends.length > 0 ||
                    (isWritesOnly
                        ? CARRIERS.has(c.name) || runsOpaque(c)
                        : !READERS.has(c.name)))) ||
            (c.args.some((w) => named(w.text) || named(`${c.dir}/${w.text}`)) &&
                !onlyReads(c, named) &&
                // a program's words are judged by its write calls above, a loop's by its body
                !(isWritesOnly && (LOOPS.has(c.name) || runsOpaque(c)))) ||
            (CARRIERS.has(c.name) && carriesDir(c, namedDir)) ||
            // `trash "$(realpath <store>)"`: the name reaches the word through a substitution
            // a loop's list writes nothing: `for f in $(ls <folder>)` is judged by its body (FRM-574 decided 8)
            (c.args.some((w) => w.isExpanding) &&
                c.feeders.some((f) => f.args.some((w) => named(w.text))) &&
                !onlyReads(c, named) &&
                !(isWritesOnly && writesNothing && LOOPS.has(c.name))),
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
    const isWrite = touchesStore(command, cwd, isStore, isStoreDir);
    if (!isStamp && !isWrite) return undefined;
    return {
        door: "sixth sense's clean, or the coordinator's stamp, through watch-pr.sh --verified in that session; ask the lane's sixth sense or clio; a read goes through cat or jq",
        rule: 'clean-stamp',
        targets: ['pr-verified.json'],
        why: 'x lane merge-auto reads ~/.claude/shelf/pr-verified.json as the clean on a pr, so only sixth sense and the coordinator write it',
    };
}
