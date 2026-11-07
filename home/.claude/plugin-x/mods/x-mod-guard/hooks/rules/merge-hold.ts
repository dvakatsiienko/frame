import { touchesStore } from './clean-stamp.ts';
import { type Command, type Refusal, commandsDeep } from './command.ts';

export type MergeHolds = { prs: Set<string>; isUnreadable: boolean };

// gh's own flags that take the next word, on `pr merge`, `stack merge`, `api` and the root
const VALUE_FLAGS = new Set([
    '--field',
    '--header',
    '--hostname',
    '--input',
    '--jq',
    '--method',
    '--raw-field',
    '--template',
    '-H',
    '-X',
    '-f',
    '-p',
    '-q',
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

// the words a wrapper hands gh: `x as <member> -- gh …`, `github-token-wrap pr …`, and the leading `gh` the wrap tolerates
function ghWords(c: Command) {
    const words = c.args.map((w) => w.text);
    if (c.name === 'gh') return words;
    if (c.name === 'github-token-wrap')
        return words[0] === 'gh' ? words.slice(1) : words;
    if (c.name === 'x' && words[0] === 'as') {
        const at = words.indexOf('--');
        if (at >= 0 && words[at + 1] === 'gh') return words.slice(at + 2);
    }
    return undefined;
}

const GRAPHQL_MERGE =
    /\b(mergePullRequest|enqueuePullRequest|enablePullRequestAutoMerge)\b/;
const GRAPHQL_PATH = /^(https?:\/\/[^/]+(\/api)?)?\/?graphql\/?(\?.*)?$/i;
const MERGE_PATH = /\/pulls\/[^/]+\/merge(-async)?\/?(\?.*)?$/;
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
    if (
        !words ||
        words.some(
            (w, i) =>
                (w === '--help' || w === '-h' || w === '--disable-auto') &&
                !VALUE_FLAGS.has(words[i - 1] ?? ''),
        )
    )
        return undefined;
    const [family, verb, target] = operands(words);
    // a stack merge lands every layer under the pr it names, and those layers are github's to list: it counts as no number
    if (family === 'stack' && verb === 'merge')
        return { isHoldOnly: true, pr: undefined };
    if (family === 'pr' && verb === 'merge') return { pr: prOf(target) };
    // the graphql door takes a node id, never a number, so it reads as a target it cannot name
    if (family === 'api' && words.some((w) => GRAPHQL_PATH.test(w))) {
        // a query read from a file or a variable holds text this rule cannot see; any other field's variable, a thread id
        // on a review-thread mutation, only counts against a hold
        const isMerge = c.args.some(
            (a) =>
                GRAPHQL_MERGE.test(a.text) ||
                (a.text.startsWith('query=') &&
                    (a.isExpanding || a.text.startsWith('query=@'))) ||
                a.text.startsWith('--input'),
        );
        if (isMerge) return { pr: undefined };
        return c.args.some((a) => a.isExpanding || /=@/.test(a.text))
            ? { isHoldOnly: true, pr: undefined }
            : undefined;
    }
    if (family !== 'api' || !isPut(words)) return undefined;
    const prs = new Set(
        words
            .filter((w) => MERGE_PATH.test(w))
            .map((w) =>
                w.includes('/merge-async')
                    ? undefined
                    : asPr(w.match(/\/pulls\/(\d+)\/merge/)?.[1]),
            ),
    );
    if (!prs.size) return undefined;
    // a field's value can read like a merge path too, so two different targets name none
    return { pr: prs.size === 1 ? [...prs][0] : undefined };
}

export const rawMerges = (command: string, cwd: string) =>
    commandsDeep(command, cwd).flatMap((c) => rawMerge(c) ?? []);

const DOOR = "x lane merge-auto <pr> --apply --dima-ok <pr>, on dima's word";

// after the required check went, nothing on github stops a raw merge reaching production (dima's o48, BYT-94): it refuses from
// its first head, the one named exception to warn-only; a stack merge stays open, its door has no merge-auto yet
export function rawMergeRefused(
    merges: { isHoldOnly?: boolean; pr: string | undefined }[],
): Refusal | undefined {
    const raw = merges.filter((m) => !m.isHoldOnly);
    return raw.length
        ? {
              door: 'x lane merge-auto <pr>',
              rule: 'raw-merge',
              targets: raw.map((m) => m.pr ?? 'gh merge'),
              why: 'a raw merge skips its gates, and nothing on github stops it reaching production',
          }
        : undefined;
}

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

const isHoldRecord = (text: string) =>
    /\.local\/state\/x\/merge-hold|\$\{?\w+\}?\/merge-hold\//i.test(text);
const isHoldRecordDir = (text: string) => /\.local\/state\/x\/?$/i.test(text);

// x is the record's one writer: a hand edit would drop a hold with no word
export function holdRecordWrite(
    command: string,
    cwd: string,
): Refusal | undefined {
    if (!touchesStore(command, cwd, isHoldRecord, isHoldRecordDir))
        return undefined;
    return {
        door: "x lane merge-auto <pr> --hold --apply, and x lane merge-auto <pr> --release-hold --dima-ok <pr> --apply on dima's word; a read goes through cat or jq",
        rule: 'merge-hold',
        targets: ['merge-hold'],
        why: "a hold in ~/.local/state/x/merge-hold is dima's, and a hand edit would drop it with no word",
    };
}
