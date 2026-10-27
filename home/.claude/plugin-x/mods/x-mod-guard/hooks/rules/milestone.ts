import { parse } from '../shell.ts';
import {
    type Command,
    type Context,
    type Refusal,
    commands,
} from './command.ts';

// a ticket put into a project with milestones names one, or it drops off every milestone view (FRM-417); only new
// creates and moves are read, so the tickets already sitting outside a milestone stay as they are
export type ProjectMove = { project: string; hasMilestone: boolean };

const MUTATION = /\bissue(Create|Update)\b/;
const PROJECT_ID = /\bprojectId["']?\s*:\s*["']([^"']+)["']/;

export const MILESTONE_DOOR =
    'pick a milestone, or propose one: add --milestone "<name>" (projectMilestoneId in an api mutation)';

// a flag's value, spaced or joined; an empty value is no value
function flag(words: string[], name: string) {
    const at = words.findIndex((w) => w === name || w.startsWith(`${name}=`));
    if (at < 0) return undefined;
    const word = words[at] ?? '';
    return word === name ? (words[at + 1] ?? '') : word.slice(name.length + 1);
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
    const verbs = words.filter(
        (w, i) => !w.startsWith('-') && words[i - 1] !== '--as',
    );
    if (verbs[0] === 'api') {
        const text = words.join(' ');
        const project = text.match(PROJECT_ID)?.[1];
        if (!MUTATION.test(text) || !project) return undefined;
        return {
            hasMilestone: /\bprojectMilestoneId\b/.test(text),
            project,
        };
    }
    const isMove = isX
        ? verbs[0] === 'set'
        : verbs[0] === 'issue' &&
          ['create', 'update', 'edit'].includes(verbs[1] ?? '');
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
