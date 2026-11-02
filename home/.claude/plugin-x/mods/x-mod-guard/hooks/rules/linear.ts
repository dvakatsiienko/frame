import type { Word } from '../shell.ts';
import {
    type Command,
    type Refusal,
    basename,
    commandsDeep,
} from './command.ts';

// FRM-459: a ticket body is written through `x linear body --set` (it refuses a body changed since the pull), and nobody acts as
// dima. the caller checks the session is not the coordinator's. a nested shell's script and an eval count
const BODY_DOOR = 'x linear body <id> --set <file>';
// the raw cli's description flags; graphql's mutations that carry a body
const RAW_DESCRIPTION = /^(?:-d|--description(?:-file)?)(?:=|$)|^-d\S/;
const BODY_MUTATION = /issue(?:Batch)?Update|issueCreate/i;

// the raw cli, as typed or after `x as <member> --`
function rawBody(words: string[]): Refusal | undefined {
    const bare = words.filter((w) => !w.startsWith('-'));
    const isWrite =
        (bare[0] === 'issue' &&
            (bare[1] === 'update' || bare[1] === 'create') &&
            words.some((w) => RAW_DESCRIPTION.test(w))) ||
        (bare[0] === 'api' && BODY_MUTATION.test(words.join(' ')));
    return isWrite
        ? {
              door: BODY_DOOR,
              rule: 'linear-body',
              targets: [`linear issue ${bare[1]} --description`],
              why: 'a ticket body is written through x linear body --set, which refuses a body changed since the pull',
          }
        : undefined;
}

// x reads an agent from CLAUDECODE or AI_AGENT and, with both empty on a tty, acts as dima (x/go/linear.go); cc sets only
// CLAUDECODE, so a line where any command empties it, or the whole env, beside an x call is read as acting as dima. every
// command the walker finds counts (a nested shell, an eval, env -S, a brace or if block, a wrapper), each judged on its own
// words, so another tool's `-i` (grep, sed) never counts
const AGENT = 'CLAUDECODE';
// a name a glob, a brace or a variable may stand for: `CLAUDE*`, `CLAUDE{CODE,X}`, `$V`; a member's name holds none
const isUnreadable = (name: string) => /[$`*?[\]{}]/.test(name);
const mayBeAgent = (name: string) => name === AGENT || isUnreadable(name);
// an assignment that empties CLAUDECODE, or fills it with what the shell decides
const isEmptied = (a: string) => /^CLAUDECODE=(?:''|""|.*[$`].*)?$/.test(a);
// the builtins that bind a name from what they read: `read CLAUDECODE`, `for CLAUDECODE in`, `printf -v CLAUDECODE`
const READERS = new Set(['read', 'mapfile', 'readarray']);
const LOOPS = new Set(['for', 'select']);
const DECLARERS = new Set([
    'export',
    'declare',
    'typeset',
    'readonly',
    'local',
]);
// a command that empties CLAUDECODE, unsets it or rebinds it, for itself or the rest of the line
function dropsAgent(c: Command) {
    if (c.assigns.some(isEmptied)) return true;
    const env = c.envArgs;
    for (let j = 0; j < env.length; j++) {
        const w = env[j] ?? '';
        if (['-', '-i', '-c', '--ignore-environment'].includes(w)) return true;
        if (/^-[A-Za-z]*i[A-Za-z]*$/.test(w) && c.wrappers.includes('env'))
            return true;
        const unset =
            w === '-u' || w === '--unset'
                ? env[++j]
                : w.match(/^(?:-u|--unset=)(.+)$/)?.[1];
        if (unset !== undefined && mayBeAgent(unset)) return true;
    }
    const words = c.args.map((w) => w.text);
    const flags = words.filter((w) => /^[-+]/.test(w));
    // a name operand: the part before an `=`
    const names = words
        .filter((w) => !/^[-+]/.test(w))
        .map((w) => w.split('=')[0] ?? w);
    if (c.name === 'unset') return names.some(mayBeAgent);
    if (READERS.has(c.name)) return names.some(mayBeAgent);
    if (LOOPS.has(c.name)) return mayBeAgent(names[0] ?? '');
    if (c.name === 'printf') {
        const at = words.findIndex((w) => w.startsWith('-v'));
        const name = words[at] === '-v' ? words[at + 1] : words[at]?.slice(2);
        return at >= 0 && mayBeAgent(name ?? '');
    }
    if (DECLARERS.has(c.name)) {
        if (words.some(isEmptied)) return true;
        // `-n`/`+x` in any cluster unexports; a bare `local`, `declare` or `typeset` shadows the export in a function
        const isUnexport =
            flags.some((f) => /^-[A-Za-z]*n|^\+[A-Za-z]*x/.test(f)) ||
            !['export', 'readonly'].includes(c.name);
        return isUnexport && names.some(mayBeAgent);
    }
    return false;
}
const isXCall = (c: Command) =>
    c.name === 'x' &&
    c.args.some((w) => w.text === 'linear' || w.text === 'as');
// a line with an x call where any command drops CLAUDECODE: the walker lists a function body, a trap or a loop body where
// it is written, never in the order it runs, so a drop anywhere on the line counts
const actsAsDima = (all: Command[]) =>
    all.some(isXCall) && all.some(dropsAgent);

export function linearWrite(command: string, cwd: string): Refusal | undefined {
    const all = commandsDeep(command, cwd);
    if (actsAsDima(all))
        return {
            door: 'run it without --as; an agent acts as its own member',
            rule: 'as-dima',
            targets: ['CLAUDECODE'],
            why: 'x acts as dima when CLAUDECODE is gone on a tty; an agent keeps its own member',
        };
    for (const c of all) {
        const words = c.args.map((w) => w.text);
        // a flag's value is no verb: `x linear --as codie api` is the api verb
        const bare = words.filter(
            (w, i) => !w.startsWith('-') && words[i - 1] !== '--as',
        );
        if (c.name === 'linear') {
            const found = rawBody(words);
            if (found) return found;
            continue;
        }
        if (c.name !== 'x') continue;
        const isLinear = bare.includes('linear');
        const isAsVerb = bare[0] === 'as';
        // a word the shell expands holds a value the guard cannot read: a variable, a substitution; a quoted `$id` in a query is text
        const isOpaque = (
            w: { text: string; isExpanding: boolean } | undefined,
        ) => w?.isExpanding && /[$`]/.test(w.text);
        // an actor of dima's, or one the guard cannot read: a variable, a glob or brace the shell widens, or any actor under
        // xargs, whose input can fill it through `{}` or any `-I`/`-J` mark
        const isDimaActor = (w: Word | undefined, text = w?.text ?? '') =>
            c.wrappers.includes('xargs') ||
            text.toLowerCase() === 'dima' ||
            (!!w?.isExpanding && /[$`]/.test(text)) ||
            (!w?.hasQuote && /[*?[\]{}]/.test(text));
        const hasActor = c.args.some((w, i) =>
            w.text === '--as'
                ? isDimaActor(c.args[i + 1])
                : w.text.startsWith('--as=') && isDimaActor(w, w.text.slice(5)),
        );
        const isAsDima =
            isAsVerb && isDimaActor(c.args.find((w) => w.text === bare[1]));
        if ((isLinear || isAsVerb) && (hasActor || isAsDima))
            return {
                door: 'run it without --as; an agent acts as its own member',
                rule: 'as-dima',
                targets: ['dima'],
                why: "nobody but dima acts as dima; an agent's writes carry its own member",
            };
        if (isAsVerb) {
            const dash = words.indexOf('--');
            const inner = dash >= 0 ? words.slice(dash + 1) : [];
            if (basename(inner[0] ?? '') === 'linear') {
                const found = rawBody(inner.slice(1));
                if (found) return found;
            }
        }
        const at = bare.indexOf('linear');
        if (isLinear && bare[at + 1] === 'api') {
            // the query is one word; a variable, a substitution or xargs hides it, and an unreadable query counts
            const query = words.join(' ');
            // xargs appends its input as the query, which the line never shows
            const isHidden =
                c.wrappers.includes('xargs') ||
                c.args.some(
                    (w, i) => isOpaque(w) && c.args[i - 1]?.text !== '--vars',
                );
            if (BODY_MUTATION.test(query) || isHidden)
                return {
                    door: `${BODY_DOOR}; a state or label move is x linear set`,
                    rule: 'linear-body',
                    targets: ['x linear api'],
                    why: 'a raw mutation sets a body past the door that checks the ticket did not change since the pull; a query the guard cannot read counts',
                };
        }
    }
    return undefined;
}
