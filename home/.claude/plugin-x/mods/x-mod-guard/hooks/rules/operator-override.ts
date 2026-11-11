import { touchesStore } from './clean-stamp.ts';
import { type Refusal, basename, commandsDeep } from './command.ts';

// wispr types «Operator override PRs.», so case and a closing period pass; anything else around the words reads as talk about them
const WORD = /^operator[- ]override (prs|off)\.?$/i;
const SHIFT = /^\/clio:shift\s+\S+$/;
const TYPED_DOWN = /operator[- ]override\b|\/clio:shift\b/i;
const REX_READS = new Set(['capture', 'list', 'ls']);
const OPAQUE =
    /^(python[\d.]*|node|bun|deno|ruby|perl|php|lua|osascript|xargs|parallel|eval)$/;

const NOTE_OPEN = '<system-reminder>';
const NOTE_CLOSE = '</system-reminder>';

// the app glues queued session notes before his composer text. a note quotes a child's words, so only what follows the
// last close counts: the app writes that close, so a quoted one can never end the last note early
export function typedPart(text: string) {
    const prompt = text.trim();
    const lastClose = prompt.lastIndexOf(NOTE_CLOSE);
    if (!prompt.startsWith(NOTE_OPEN) || lastClose < 0) return prompt;
    return prompt.slice(lastClose + NOTE_CLOSE.length).trim();
}

// what a whole prompt asks of the switch, undefined for anything else
export function overrideAsked(text: string): OverrideAsk | undefined {
    const prompt = typedPart(text);
    if (SHIFT.test(prompt)) return { by: 'shift', scope: 'prs' };
    const scope = prompt.match(WORD)?.[1]?.toLowerCase();
    if (scope === 'prs') return { by: 'word', scope };
    if (scope === 'off') return { by: 'word', scope };
    return undefined;
}

// the store after an ask. a shift's start leaves his own word standing, so its end can't take it
export function overrideAfter(
    grants: OverrideGrants,
    ask: OverrideAsk,
    at: string,
): OverrideGrants {
    if (ask.scope === 'off') return {};
    if (ask.by === 'shift' && grants.prs) return grants;
    return { ...grants, prs: { at, by: ask.by } };
}

const normalized = (path: string) => {
    let was = '';
    let now = path.replaceAll(/\/+/g, '/').replaceAll('/./', '/');
    while (was !== now) {
        was = now;
        now = now.replace(/[^/]+\/\.\.\//, '');
    }
    return now;
};

// its name anywhere, however the path reaches it; a last word with an expansion directly in x's state dir can land on it too
export const isOverrideStore = (text: string) =>
    /operator-override\.(json|log)\b|\$\{?\w+\}?\/operator-override/i.test(
        text,
    ) || /\.local\/state\/x\/[^/]*[*?[{$(`][^/]*$/i.test(normalized(text));
const isStoreDir = (text: string) =>
    /\.local\/state\/x\/?$/i.test(normalized(text));

const STORE_DOOR =
    "dima's whole typed prompt `operator-override prs` or `operator-override off`, or x lane merge-auto --override-off --apply; a read goes through cat or jq";
export const STORE_WHY =
    "operator-override opens merge-auto's every check, and only dima flips it";

// x and this mod are its two writers: a session's hand on it would grant itself every merge
// readers that print what they read, so a line of them in the store's folder writes nothing (FRM-574 rider: wing 1's awk loop
// in ~/.local/state/x read an awk program `{print $1}` as a path in that folder); awk only with no redirect, pipe, system or
// getline in its program
const STORE_READERS = new Set([
    '',
    'cat',
    'cd',
    'cut',
    'done',
    'echo',
    'for',
    'grep',
    'head',
    'jq',
    'rg',
    'sort',
    'tail',
    'uniq',
    'wc',
]);
// a reader writes through these: `sort -o`, `uniq <in> <out>`, `awk -f` and `-i` (a program the guard never reads), `rg --pre`
const isReaderWrite = (c: { name: string; args: { text: string }[] }) => {
    const words = c.args.map((w) => w.text);
    if (c.name === 'sort')
        return words.some((w) => /^(-\w*o|--output)/.test(w));
    if (c.name === 'uniq')
        return words.filter((w) => !w.startsWith('-')).length > 1;
    if (c.name === 'awk')
        return words.some((w) => /^(-\w*[fi]|--(file|include))/.test(w));
    if (c.name === 'rg') return words.some((w) => w.startsWith('--pre'));
    return false;
};
const isPlainAwk = (c: { name: string; args: { text: string }[] }) =>
    c.name === 'awk' &&
    c.args.every((w) => !/[>|]|\bsystem\b|\bgetline\b/.test(w.text));
const isStoreRead = (command: string, cwd: string) =>
    commandsDeep(command, cwd).every(
        (c) =>
            (STORE_READERS.has(c.name) || isPlainAwk(c)) &&
            !isReaderWrite(c) &&
            !c.writes.length &&
            !c.appends.length,
    );
export function overrideStoreWrite(
    command: string,
    cwd: string,
): Refusal | undefined {
    if (isStoreRead(command, cwd)) return undefined;
    // a bare `$F` after a `cd` names the store only with its dir joined on
    const isJoinedWrite = commandsDeep(command, cwd).some((c) =>
        [...c.writes, ...c.appends].some((w) =>
            isOverrideStore(`${c.dir}/${w}`),
        ),
    );
    if (
        !isJoinedWrite &&
        !touchesStore(command, cwd, isOverrideStore, isStoreDir)
    )
        return undefined;
    return {
        door: STORE_DOOR,
        rule: 'operator-override',
        targets: ['operator-override'],
        why: STORE_WHY,
    };
}

export const overrideStoreRefusal = (path: string): Refusal => ({
    door: STORE_DOOR,
    rule: 'operator-override',
    targets: [path],
    why: STORE_WHY,
});

// a claude in a rex pane takes rex's keys as its composer (probed 2026-11-07), so the phrase never rides a rex line; a script
// run by path still can, and the log is what catches that
export function overrideTypedDown(
    command: string,
    cwd: string,
): Refusal | undefined {
    // the whole line counts, its words as the shell hands them over: rex reads stdin, and quoting can split the phrase
    const parsed = commandsDeep(command, cwd);
    const words = parsed.flatMap((c) => c.args.map((w) => w.text)).join(' ');
    if (!TYPED_DOWN.test(command) && !TYPED_DOWN.test(words)) return undefined;
    const isRexLine = parsed.some(
        (c) =>
            basename(c.name) === 'rex' && !REX_READS.has(c.args[0]?.text ?? ''),
    );
    const isHidden =
        /\brex\b/.test(command) &&
        parsed.some(
            (c) =>
                OPAQUE.test(c.name) || c.wrappers.some((w) => OPAQUE.test(w)),
        );
    if (!isRexLine && !isHidden) return undefined;
    return {
        door: 'dima types it himself',
        rule: 'operator-override',
        targets: ['rex'],
        why: 'keys sent through rex read as his typing, and the override opens on his typing alone',
    };
}

/* Types */
export type OverrideAsk =
    | { by: 'shift' | 'word'; scope: 'prs' }
    | { by: 'word'; scope: 'off' };

export type OverrideGrants = Record<
    string,
    { at: string; by: string; until?: string }
>;
