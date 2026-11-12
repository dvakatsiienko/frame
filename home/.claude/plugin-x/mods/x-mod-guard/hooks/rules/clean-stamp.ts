import {
    type Command,
    type Refusal,
    claudeSpawn,
    commandsDeep,
} from './command.ts';

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
    // g4: clio's `grep … | tail -2 | cut -c1-400` in the ticks folder, refused as a write
    'cut',
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
    'nl',
    'printf',
    'pushd',
    'readlink',
    'realpath',
    'rg',
    'shasum',
    'stat',
    'tail',
    'test',
    'tr',
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

function onlyReads(c: Command, isNamed: (text: string) => boolean) {
    // a relative operand lands where the line's `cd` left it (g4: `cd <dir> && cp f "$(…)"` through a link there)
    const named = (t: string) => isNamed(t) || isNamed(`${c.dir}/${t}`);
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
const LOOP_READS = new Set([
    'for',
    'select',
    'done',
    'cat',
    'echo',
    'head',
    'jq',
    'ls',
    'stat',
    'tail',
]);
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
    // a loop over the folder's names hands each name to its body, so it reads only when every command on the line is a
    // reader with no redirect (FRM-574 decided 8: an allow-list)
    const isReadLoop = parsed.every(
        (c) => LOOP_READS.has(c.name) && !c.writes.length && !c.appends.length,
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
                !(isWritesOnly && isReadLoop && LOOPS.has(c.name))),
    );
}

// x's thread store names who is a sixth sense, the role the clean-stamp door trusts: only x writes it (`x thread list`,
// `x brief summon`, `x lane dispatch --apply`), never a line of any session's, a sixth sense's included (FRM-570)
const shelfPath = (text: string) =>
    text.replaceAll(/\/+/g, '/').replaceAll('/./', '/');
// a name under the shelf whose literal start could still become `threads.json` once the shell expands the rest
const SHELF_EXPANDING = /(?:\.claude|cc)\/shelf\/([^/*?[{$(`'"\s]*)[*?[{$(`]/i;
export const isThreadStore = (text: string) => {
    if (/(^|[/'"]|of=)threads\.(json\b|\{)/i.test(text)) return true;
    const path = shelfPath(text);
    const found = path.match(SHELF_EXPANDING);
    const start = found?.[1]?.toLowerCase();
    if (start === undefined || !'threads.json'.startsWith(start)) return false;
    // a brace lists its words: it lands on the store only when one of them could still start it
    const after = path.slice((found?.index ?? 0) + (found?.[0].length ?? 0));
    const words =
        path[(found?.index ?? 0) + (found?.[0].length ?? 1) - 1] === '{'
            ? after.match(/^([^{}]*)\}/)?.[1]?.split(',')
            : undefined;
    return (
        words === undefined ||
        words.some(
            (w) =>
                /[*?[$(`]/.test(w) ||
                'threads.json'.startsWith(`${start}${w.toLowerCase()}`),
        )
    );
};
export function threadStoreWrite(
    command: string,
    cwd: string,
): Refusal | undefined {
    // a carrier into the shelf dir lands on the store when the line names it: `cp /tmp/threads.json ~/.claude/shelf/`
    const intoShelf = (text: string) =>
        isStoreDir(text) && isThreadStore(command);
    if (!touchesStore(command, cwd, isThreadStore, intoShelf)) return undefined;
    return {
        door: 'x thread list rewrites it from the registry, a role comes from x brief summon or x lane dispatch --apply; a read goes through cat or jq',
        rule: 'clean-stamp',
        targets: ['threads.json'],
        why: "~/.claude/shelf/threads.json holds every thread's role, a coordinator's and a sixth sense's whose clean opens x lane merge-auto, so only x writes it",
    };
}

// cc's registry names each session, and the guard reads a coordinator by that name: cc writes it, never a session's line
export const isRegistryFile = (text: string) =>
    /(\.claude|cc)\/sessions\/[^/]+$/i.test(shelfPath(text));
const isRegistryDir = (text: string) =>
    /(\.claude|cc)\/sessions\/?$/i.test(shelfPath(text));
export function registryWrite(
    command: string,
    cwd: string,
): Refusal | undefined {
    if (!touchesStore(command, cwd, isRegistryFile, isRegistryDir))
        return undefined;
    return {
        door: 'cc writes its own registry; a read goes through cat or jq',
        rule: 'clean-stamp',
        targets: ['~/.claude/sessions'],
        why: "x reads which session each process runs from cc's registry, the key to its role, so a session's write there would wear another's role",
    };
}

// the three files a Write or an Edit could forge a role or a clean through; undefined for any other path
export function roleStoreRefusal(path: string): Refusal | undefined {
    if (isThreadStore(path))
        return {
            door: 'x thread list rewrites it from the registry, a role comes from x brief summon',
            rule: 'clean-stamp',
            targets: ['threads.json'],
            why: "~/.claude/shelf/threads.json holds every thread's role, a coordinator's and a sixth sense's included, so only x writes it",
        };
    if (isStore(path))
        return {
            door: "sixth sense's clean through watch-pr.sh --verified in its own session",
            rule: 'clean-stamp',
            targets: ['pr-verified.json'],
            why: 'x lane merge-auto reads ~/.claude/shelf/pr-verified.json as the clean on a pr',
        };
    if (isRegistryFile(path))
        return {
            door: 'cc writes its own registry',
            rule: 'clean-stamp',
            targets: ['~/.claude/sessions'],
            why: "x finds each process's session, the key to its role, in cc's registry",
        };
    return undefined;
}

// items 1 and 5: a claude call wearing another thread's identity, run by a session that is no coordinator: a
// `--session-id` (x mints one with a role record at a summon, and only clio runs that argv). a name grants nothing since
// FRM-579: a role is the record x brief summon writes, so a start door is what hands one out
// FRM-579 exit 4: the doors that start clio, a wing, crow or helga; an allow-list over the doors, read in every token of
// every word of any command the line runs, so a door inside a wrapper's quoted script counts too (`pnpm`, `zsh`, `env`,
// `hc run -- …`, `rex`, `osascript -e '… do shell script "…clio-start.sh"'`, `launchctl submit … --`)
const START_FILES = new Set([
    'clio-start.sh',
    'clio-revive.sh',
    'keep-cache-hot.ts',
    'prompt-groom.ts',
]);
const START_WORDS = new Set([
    'clio-herdr',
    'clio-revive',
    'clio:start',
    'crow:keep-cache-hot',
    'crow:start',
]);
const isStartDoor = (c: Command) => {
    if (READERS.has(c.name.split('/').pop() ?? '')) return false;
    const tokens = [
        c.name,
        ...c.args.map((w) => w.text),
        ...c.assigns,
        ...c.envArgs,
    ].flatMap((w) => w.split(/[\s'"`;&|()=]+/));
    return tokens.some((w) => {
        const file = w.split('/').pop() ?? '';
        return (
            START_FILES.has(file) ||
            START_WORDS.has(w) ||
            (file === 'start.ts' && w.includes('crew-adviser'))
        );
    });
};
// x gates the same two verbs by its caller's registry entry, which an env prefix could aim elsewhere; here the session is
// read from the engine, whatever the line sets
const isRoleVerb = (c: Command) => {
    const words = c.args.map((w) => w.text);
    return (
        c.name === 'x' &&
        ((words[0] === 'brief' && words[1] === 'summon') ||
            (words[0] === 'lane' &&
                words[1] === 'dispatch' &&
                words.includes('--apply')))
    );
};
export function roleSpawn(command: string, cwd: string): Refusal | undefined {
    for (const c of commandsDeep(command, cwd)) {
        if (isRoleVerb(c))
            return {
                door: 'ask the coordinator: x brief summon and x lane dispatch --apply are hers',
                rule: 'clean-stamp',
                targets: ['x'],
                why: "both verbs give a thread its role, and a sixth sense's role opens the clean stamp",
            };
        if (isStartDoor(c))
            return {
                door: 'ask the coordinator: clio, a wing, crow and helga start from dima, his herdr layout or clio',
                rule: 'clean-stamp',
                targets: [c.name],
                why: 'a start door hands its thread the role of clio, a wing, crow or helga through x brief summon',
            };
        const call = c.name === 'claude' ? c : claudeSpawn(c);
        if (call?.name !== 'claude') continue;
        const isSessionId = call.args.some(
            (w) =>
                w.text === '--session-id' || w.text.startsWith('--session-id='),
        );
        if (isSessionId)
            return {
                door: 'ask the coordinator to summon it: x brief summon prints the argv, and clio runs it',
                rule: 'clean-stamp',
                targets: ['claude'],
                why: 'a --session-id carries the role x gave it at a summon, so only the coordinator runs one',
            };
    }
    return undefined;
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
