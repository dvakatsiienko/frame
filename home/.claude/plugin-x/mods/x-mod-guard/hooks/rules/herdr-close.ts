import type { Command, Context, Refusal } from './command.ts';

// what a herdr close ends: a terminal, a pane, a tab or space and every terminal in it, an overlay, or everything at once
// (the window, the app, the hc server); a bare `herdr-app do overlay.close` with no overlay open killed main and wing 1
// at 19:41 (2026-11-10), so a close names its target, and a target that ends a live seat is refused (dima's o53)
export type HerdrClose = {
    scope: 'overlay' | 'pane' | 'space' | 'tab' | 'terminal' | 'whole';
    target?: string;
    verb: string;
};

// `herdr-app commands` lists these as closing, ending or quitting, each with the argument naming its target
const HERDR_CLOSES: Record<string, [HerdrClose['scope'], string?]> = {
    'app.quit': ['whole'],
    'overlay.close': ['overlay', 'id'],
    'pane.close': ['pane', 'pane'],
    'space.close': ['space', 'id'],
    'tab.close': ['tab', 'id'],
    'terminal.kill': ['terminal', 'terminal'],
    'window.close': ['whole'],
};

export function herdrCloseOf(c: Command): HerdrClose | undefined {
    const words = c.args.map((w) => w.text);
    const bare = words.filter((w) => !w.startsWith('-'));
    // `hc kill --help` prints usage and ends nothing (replay: 4 of the 2 days' fires)
    if (words.includes('--help') || words.includes('-h')) return undefined;
    if (c.name === 'hc') {
        const [verb, next] = bare;
        if (verb === 'server' && (next === 'stop' || next === 'restart'))
            return { scope: 'whole', verb: `hc server ${next}` };
        if (verb === 'kill' || verb === 'rm')
            return { scope: 'terminal', target: next, verb: `hc ${verb}` };
        return undefined;
    }
    if (c.name !== 'herdr-app' || bare[0] !== 'do') return undefined;
    const at = words.indexOf('do');
    const rest = words.slice(at + 1);
    const json = jsonOf(rest.find((w) => w.startsWith('{')));
    const verb =
        rest.find((w) => !w.startsWith('-') && !w.startsWith('{')) ??
        (typeof json?.name === 'string' ? json.name : '');
    const close = HERDR_CLOSES[verb];
    if (!close) return undefined;
    const [scope, arg] = close;
    if (!arg) return { scope, verb: `herdr-app do ${verb}` };
    const flagAt = rest.indexOf(`--${arg}`);
    const target =
        (flagAt >= 0 ? rest[flagAt + 1] : undefined) ??
        rest.find((w) => w.startsWith(`--${arg}=`))?.slice(arg.length + 3) ??
        (typeof json?.[arg] === 'string' ? json[arg] : undefined);
    return { scope, target, verb: `herdr-app do ${verb}` };
}

const jsonOf = (word: string | undefined) => {
    if (!word) return undefined;
    try {
        const v: unknown = JSON.parse(word);
        return v && typeof v === 'object'
            ? (v as Record<string, unknown>)
            : undefined;
    } catch {
        return undefined;
    }
};

export const herdrCloseKey = (close: HerdrClose) =>
    `${close.scope}:${close.target ?? ''}`;

// an overlay ends no terminal, so it needs only its name; every other close passes only on a lookup that found the
// terminals it ends and none of them a live seat (`herdrSafe`, filled by the caller)
export function herdrClose(c: Command, ctx: Context): Refusal | undefined {
    const close = herdrCloseOf(c);
    if (!close) return undefined;
    const door =
        'name the target, a terminal you started yourself that holds no seat; to end a seat, put the whole command in an orbit ask for dima’s tick';
    if (close.scope === 'whole')
        return {
            door: 'put the whole command in an orbit ask for dima’s tick',
            rule: 'herdr-close',
            targets: [close.verb],
            why: `\`${close.verb}\` ends every herdr seat at once, the window's or the server's`,
        };
    if (!close.target || close.target.includes('$'))
        return {
            door,
            rule: 'herdr-close',
            targets: [close.verb],
            why: `\`${close.verb}\` names no target the guard can read, so herdr picks one, and a bare \`herdr-app do overlay.close\` killed main and wing 1 at 19:41`,
        };
    if (close.scope === 'overlay' || ctx.herdrSafe?.has(herdrCloseKey(close)))
        return undefined;
    return {
        door,
        rule: 'herdr-close',
        targets: [close.target],
        why: `\`${close.verb} ${close.target}\` ends a live seat, or one herdr could not name: a \`seat=\` label, or a claude agent this seat did not start`,
    };
}
