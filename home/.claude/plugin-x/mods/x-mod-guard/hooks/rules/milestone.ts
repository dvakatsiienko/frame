import { parse } from '../shell.ts';
import {
    type Command,
    type Context,
    type Refusal,
    commands,
} from './command.ts';

// only new creates and moves are read: tickets already outside a milestone stay as they are (FRM-417)
type ProjectMove = { project: string; hasMilestone: boolean };

const MUTATION = /\bissue(Create|Update)\b/;
// `x schema linear`, 2026-10-27
const X_VERBS = new Set([
    'api',
    'archive',
    'body',
    'comment',
    'link',
    'list',
    'read',
    'set',
    'update',
]);
// the project inline (`projectId: "<id>"`) or through a variable (`projectId: $p`, its value in --vars)
const PROJECT_ID = /\bprojectId["']?\s*:\s*(?:["']([^"']+)["']|\$(\w+))/;
const MILESTONE_ID = /\bprojectMilestoneId["']?\s*:\s*(?!null\b)\S/;

export const MILESTONE_DOOR =
    'pick a milestone, or propose one: add --milestone "<name>" (projectMilestoneId in an api mutation)';

// a flag's value, spaced or joined; an empty value is no value
function flag(words: string[], name: string) {
    const at = words.findIndex((w) => w === name || w.startsWith(`${name}=`));
    if (at < 0) return undefined;
    const word = words[at] ?? '';
    return word === name ? (words[at + 1] ?? '') : word.slice(name.length + 1);
}

function varValue(vars: string | undefined, name: string | undefined) {
    if (!vars || !name) return undefined;
    try {
        const value = (JSON.parse(vars) as Record<string, unknown>)[name];
        return typeof value === 'string' ? value : undefined;
    } catch {
        return undefined;
    }
}

// the linear words a command runs: the raw cli, `x as <member> -- linear …`, or x's own `x linear …`
function linearWords(c: Command) {
    const words = c.args.map((w) => w.text);
    if (c.name === 'linear') return { isX: false, words };
    if (c.name !== 'x') return undefined;
    if (words[0] === 'linear') return { isX: true, words: words.slice(1) };
    const dash = words.indexOf('--');
    if (words[0] === 'as' && dash >= 0 && words[dash + 1] === 'linear')
        return { isX: false, words: words.slice(dash + 2) };
    return undefined;
}

function projectMove(c: Command): ProjectMove | undefined {
    const linear = linearWords(c);
    if (!linear) return undefined;
    const { isX, words } = linear;
    // the verb may follow root flags (`--json`, `--as coder`, `--team FRM`); a later word that names a verb is a value
    const head = isX
        ? words.findIndex((w, i) => X_VERBS.has(w) && words[i - 1] !== '--as')
        : words.findIndex((w) => w === 'api' || w === 'issue');
    if (words[head] === 'api') {
        const text = words.join(' ');
        const id = text.match(PROJECT_ID);
        const project = id?.[1] ?? varValue(flag(words, '--vars'), id?.[2]);
        if (!MUTATION.test(text) || !project) return undefined;
        return { hasMilestone: MILESTONE_ID.test(text), project };
    }
    const isMove = isX
        ? words[head] === 'set'
        : words[head] === 'issue' &&
          ['create', 'update', 'edit'].includes(words[head + 1] ?? '');
    const project = isMove ? flag(words, '--project') : undefined;
    if (!project) return undefined;
    return { hasMilestone: !!flag(words, '--milestone'), project };
}

// the projects a command moves tickets into, for the caller to ask linear about
export function projectMoves(command: string, cwd: string) {
    return commands(parse(command), cwd).flatMap((c) => {
        const m = projectMove(c);
        return m ? [m] : [];
    });
}

export function milestone(c: Command, ctx: Context): Refusal | undefined {
    const m = projectMove(c);
    if (
        !m ||
        m.hasMilestone ||
        !ctx.milestoneProjects?.has(m.project.toLowerCase())
    )
        return undefined;
    return {
        door: MILESTONE_DOOR,
        rule: 'milestone',
        targets: [m.project],
        why: `${m.project} has milestones, and a ticket outside them drops off every milestone view`,
    };
}
