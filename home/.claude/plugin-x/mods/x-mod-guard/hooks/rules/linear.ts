import { type Command, type Refusal, SHELLS, commandsDeep } from './command.ts';

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
// a name a glob or a variable may stand for: `CLAUDE*`, `CLAUDE{CODE,X}`, `$V`
const mayBeAgent = (name: string) =>
    name === AGENT ||
    /[$`]/.test(name) ||
    (/[*?[{]/.test(name) &&
        new RegExp(
            `^${name
                .replace(/[.+^()|\\]/g, '\\$&')
                .replaceAll('*', '.*')
                .replaceAll('?', '.')
                .replace(
                    /\{([^}]*)\}/g,
                    (_m, alts: string) => `(?:${alts.split(',').join('|')})`,
                )}$`,
        ).test(AGENT));
// an assignment that empties CLAUDECODE, or fills it with what the shell decides
const isEmptied = (a: string) => /^CLAUDECODE=(?:''|""|.*[$`].*)?$/.test(a);
// 'local': the drop reaches this command only (an env flag, a prefix assignment); 'persist': every later command (an
// unset, an export, a bare assignment, or a local drop on a shell that runs a script)
function dropsAgentHere(c: Command): 'local' | 'persist' | undefined {
    const here = dropsOwn(c);
    if (here === 'local' && (SHELLS.has(c.name) || c.name === 'eval'))
        return 'persist';
    return here;
}
function dropsOwn(c: Command): 'local' | 'persist' | undefined {
    if (c.assigns.some(isEmptied)) return c.name ? 'local' : 'persist';
    const env = c.envArgs;
    for (let j = 0; j < env.length; j++) {
        const w = env[j] ?? '';
        if (['-', '-i', '-c', '--ignore-environment'].includes(w))
            return 'local';
        if (/^-[A-Za-z]*i[A-Za-z]*$/.test(w) && c.wrappers.includes('env'))
            return 'local';
        const unset =
            w === '-u' || w === '--unset'
                ? env[++j]
                : w.match(/^(?:-u|--unset=)(.+)$/)?.[1];
        if (unset !== undefined && mayBeAgent(unset)) return 'local';
    }
    const ops = c.args.map((w) => w.text).filter((w) => !/^[-+]/.test(w));
    if (c.name === 'unset') return ops.some(mayBeAgent) ? 'persist' : undefined;
    if (
        ['export', 'declare', 'typeset', 'readonly', 'local'].includes(c.name)
    ) {
        const isUnexport = c.args.some((w) => /^(?:-n|\+x)$/.test(w.text));
        return ops.some((o) => (isUnexport && mayBeAgent(o)) || isEmptied(o))
            ? 'persist'
            : undefined;
    }
    return undefined;
}
const isXCall = (c: Command) =>
    c.name === 'x' &&
    c.args.some((w) => w.text === 'linear' || w.text === 'as');
// an x call the line reaches with CLAUDECODE gone: a drop on the call itself, or one earlier that persists
function actsAsDima(all: Command[]) {
    let isGone = false;
    for (const c of all) {
        const drop = dropsAgentHere(c);
        if (isXCall(c) && (isGone || drop)) return true;
        if (drop === 'persist') isGone = true;
    }
    return false;
}

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
        // an actor of dima's, or one the guard cannot read: a variable, or xargs filling it in (`--as` last, or `{}`)
        const isFilled = (w: { text: string } | undefined) =>
            c.wrappers.includes('xargs') &&
            (w === undefined || /\{\}/.test(w.text));
        const hasActor = c.args.some(
            (w, i) =>
                (w.text === '--as' &&
                    (c.args[i + 1]?.text.toLowerCase() === 'dima' ||
                        isOpaque(c.args[i + 1]) ||
                        isFilled(c.args[i + 1]))) ||
                /^--as=dima$/i.test(w.text) ||
                (w.text.startsWith('--as=') && isOpaque(w)),
        );
        const isAsDima =
            isAsVerb &&
            (bare[1]?.toLowerCase() === 'dima' ||
                isOpaque(c.args.find((w) => w.text === bare[1])) ||
                isFilled(c.args.find((w) => w.text === bare[1])));
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
            if (inner[0]?.split('/').at(-1) === 'linear') {
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
