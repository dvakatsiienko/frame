import { type Command, type Refusal, commandsDeep } from './command.ts';

export type MergeHolds = { prs: Set<string>; isUnreadable: boolean };

// gh's own flags that take the next word, on `pr merge`, `stack merge` and the root
const VALUE_FLAGS = new Set([
    '-A',
    '--author-email',
    '-b',
    '--body',
    '-F',
    '--body-file',
    '--match-head-commit',
    '-R',
    '--repo',
    '-t',
    '--subject',
]);
const operands = (words: string[]) =>
    words.filter((w, i) => {
        if (w.startsWith('-')) return false;
        const before = words[i - 1];
        return before === undefined || !VALUE_FLAGS.has(before);
    });

// the words a wrapper hands gh: `x as <member> -- gh …`, `github-token-wrap gh …`
function ghWords(c: Command) {
    const words = c.args.map((w) => w.text);
    if (c.name === 'gh') return words;
    if (c.name === 'github-token-wrap' && words[0] === 'gh')
        return words.slice(1);
    if (c.name === 'x' && words[0] === 'as') {
        const at = words.indexOf('--');
        if (at >= 0 && words[at + 1] === 'gh') return words.slice(at + 2);
    }
    return undefined;
}

const GRAPHQL_MERGE =
    /\b(mergePullRequest|enqueuePullRequest|enablePullRequestAutoMerge)\b/;
const asPr = (digits: string | undefined) =>
    digits === undefined ? undefined : String(Number(digits));
const prOf = (target: string | undefined) =>
    asPr(
        target?.match(/^#?(\d+)$/)?.[1] ?? target?.match(/\/pull\/(\d+)/)?.[1],
    );

function isPut(words: string[]) {
    return words.some(
        (w, i) =>
            /^(-X=?|--method=)put$/i.test(w) ||
            ((w === '-X' || w === '--method') &&
                words[i + 1]?.toUpperCase() === 'PUT'),
    );
}

// what one command merges on github outside x: undefined when it merges nothing, `pr` undefined when the target cannot be read
function rawMerge(c: Command) {
    const words = ghWords(c);
    if (!words || words.includes('--help')) return undefined;
    const [family, verb, target] = operands(words);
    // a stack merge lands every layer under the pr it names, and those layers are github's to list: it counts as no number
    if (family === 'stack' && verb === 'merge') return { pr: undefined };
    if (family === 'pr' && verb === 'merge') return { pr: prOf(target) };
    // the graphql door takes a node id, never a number, so it reads as a target it cannot name
    if (family === 'api' && words.includes('graphql'))
        return words.some((w) => GRAPHQL_MERGE.test(w))
            ? { pr: undefined }
            : undefined;
    if (family !== 'api' || !isPut(words)) return undefined;
    const path = words.find((w) =>
        /\/pulls\/[^/]+\/merge(-async)?\/?(\?.*)?$/.test(w),
    );
    if (!path) return undefined;
    if (path.includes('/merge-async')) return { pr: undefined };
    return { pr: asPr(path.match(/\/pulls\/(\d+)\/merge/)?.[1]) };
}

export const rawMerges = (command: string, cwd: string) =>
    commandsDeep(command, cwd).flatMap((c) => rawMerge(c) ?? []);

const DOOR = "x lane merge-auto <pr> --apply --dima-ok <pr>, on dima's word";

// a hold reads as held when its record does not read, and a target it cannot name counts as held while any hold stands
export function mergeHold(
    merges: { pr: string | undefined }[],
    holds: MergeHolds,
): Refusal | undefined {
    if (holds.isUnreadable)
        return {
            door: DOOR,
            rule: 'merge-hold',
            targets: merges.flatMap((m) => m.pr ?? []),
            why: 'a hold record under ~/.local/state/x/merge-hold is unreadable, so every merge reads as held',
        };
    const held = merges.flatMap((m) =>
        m.pr !== undefined && holds.prs.has(m.pr) ? [`#${m.pr}`] : [],
    );
    if (held.length)
        return {
            door: DOOR,
            rule: 'merge-hold',
            targets: held,
            why: `${held.join(', ')} is held by dima, and a raw merge skips the hold`,
        };
    if (holds.prs.size && merges.some((m) => m.pr === undefined))
        return {
            door: DOOR,
            rule: 'merge-hold',
            targets: [...holds.prs].map((pr) => `#${pr}`),
            why: `dima holds ${[...holds.prs].map((pr) => `#${pr}`).join(', ')}, and this merge names no pr number to tell it from a held one, or lands layers this guard cannot list; a hold on a dead pr comes off through x lane merge-auto <pr> --release-hold --dima-ok <pr> --apply`,
        };
    return undefined;
}
