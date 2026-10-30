import { parse } from '../shell.ts';
import { type Refusal, commandsDeep } from './command.ts';

// FRM-459: a ticket body is written through `x linear body --set` (it refuses a body changed since the pull), and nobody acts as
// dima. the caller checks the session is not the coordinator's. a nested shell's script and an eval count
const BODY_DOOR = 'x linear body <id> --set <file>';
// the raw cli's description flags; graphql's mutations that carry a body
const RAW_DESCRIPTION = /^(?:-d|--description(?:-file)?)(?:=|$)/;
const BODY_MUTATION = /issue(?:Batch)?Update|issueCreate/i;

// the raw cli, as typed or after `x as <member> --`
function rawBody(words: string[]): Refusal | undefined {
    const bare = words.filter((w) => !w.startsWith('-'));
    const isWrite =
        bare[0] === 'issue' &&
        (bare[1] === 'update' || bare[1] === 'create') &&
        words.some((w) => RAW_DESCRIPTION.test(w));
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
// CLAUDECODE, so a line that empties it or the whole env before an x call is read as acting as dima. judged per segment, on its
// own words, so another tool's `-i` (grep, sed) never counts
const AGENT = /^CLAUDECODE$/;
const SHELLS = new Set(['sh', 'bash', 'zsh']);
const isEmptied = (a: string) => /^CLAUDECODE=(?:''|"")?$/.test(a);
function segmentDrops(words: string[]): boolean {
    let i = 0;
    while (/^[A-Za-z_]\w*=/.test(words[i] ?? '')) {
        if (isEmptied(words[i] ?? '')) return true;
        i++;
    }
    const [name, ...rest] = words.slice(i);
    if (name === undefined) return false;
    // by path too: `/usr/bin/env -u CLAUDECODE …`
    if (name.split('/').at(-1) === 'env') {
        for (let j = 0; j < rest.length; j++) {
            const w = rest[j] ?? '';
            // env's split-string: its words run as an env command line of their own
            const split =
                w === '-S' || w === '--split-string'
                    ? rest[++j]
                    : (w.match(/^(?:-S|--split-string=)(.+)$/)?.[1] ??
                      undefined);
            if (split !== undefined)
                return segmentDrops(['env', ...split.split(/\s+/)]);
            if (/^[A-Za-z_]\w*=/.test(w)) {
                if (isEmptied(w)) return true;
                continue;
            }
            if (!w.startsWith('-')) break;
            if (w === '-' || w === '--ignore-environment') return true;
            if (/^-[A-Za-z]*i[A-Za-z]*$/.test(w)) return true;
            const unset =
                w === '-u' || w === '--unset'
                    ? rest[++j]
                    : (w.match(/^(?:-u|--unset=)(.+)$/)?.[1] ?? undefined);
            if (
                unset !== undefined &&
                (AGENT.test(unset) || /[$`]/.test(unset))
            )
                return true;
        }
        return false;
    }
    const ops = rest.filter((w) => !/^[-+]/.test(w));
    if (name === 'unset')
        return ops.some((o) => AGENT.test(o) || /[$`]/.test(o));
    if (['export', 'declare', 'typeset', 'readonly', 'local'].includes(name)) {
        const isUnexport = rest.some((w) => /^(?:-n|\+x)$/.test(w));
        return ops.some((o) => (isUnexport && AGENT.test(o)) || isEmptied(o));
    }
    return false;
}
// the segments up to the first x call, a nested shell's script and an eval's words read the same way
function dropsAgent(command: string): boolean {
    for (const s of parse(command).segments) {
        const words = s.words.map((w) => w.text);
        if (segmentDrops(words)) return true;
        const head = words.find((w) => !/^[A-Za-z_]\w*=/.test(w));
        const dashC = SHELLS.has(head ?? '')
            ? words.findIndex((w) => /^-[A-Za-z]*c[A-Za-z]*$/.test(w))
            : -1;
        const nested =
            dashC >= 0
                ? words[dashC + 1]
                : head === 'eval'
                  ? words.slice(words.indexOf('eval') + 1).join(' ')
                  : undefined;
        if (nested && dropsAgent(nested)) return true;
        if (head === 'x') return false;
    }
    return false;
}

// an x linear or x as call anywhere in the line, `env - x linear …` included, where the parse sees no `x` command
const X_CALL = /(?:^|[\s;&|('"])x\s+(?:--?\w[\w-]*\s+)*(?:linear|as)\b/;

export function linearWrite(command: string, cwd: string): Refusal | undefined {
    if (X_CALL.test(command) && dropsAgent(command))
        return {
            door: 'run it without --as; an agent acts as its own member',
            rule: 'as-dima',
            targets: ['CLAUDECODE'],
            why: 'x acts as dima when CLAUDECODE is gone on a tty; an agent keeps its own member',
        };
    for (const c of commandsDeep(command, cwd)) {
        const words = c.args.map((w) => w.text);
        const bare = words.filter((w) => !w.startsWith('-'));
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
        ) => w !== undefined && w.isExpanding && /[$`]/.test(w.text);
        // an actor of dima's, or one the guard cannot read
        const hasActor = c.args.some(
            (w, i) =>
                (w.text === '--as' &&
                    (c.args[i + 1]?.text.toLowerCase() === 'dima' ||
                        isOpaque(c.args[i + 1]))) ||
                /^--as=dima$/i.test(w.text) ||
                (w.text.startsWith('--as=') && isOpaque(w)),
        );
        const isAsDima =
            isAsVerb &&
            (bare[1]?.toLowerCase() === 'dima' ||
                isOpaque(c.args.find((w) => w.text === bare[1])));
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
            if (inner[0] === 'linear') {
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
