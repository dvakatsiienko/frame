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
    // a toggle: called on an open mod it closes that overlay
    'mod.open': ['overlay', 'name'],
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

// a close passes only on a lookup (`herdrSafe`, filled by the caller): an overlay herdr lists open, since a close of one
// that is not there falls to whatever herdr picks (FRM-574 decided 4); any other close, the terminals it ends, none a live seat
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
    if (ctx.herdrSafe?.has(herdrCloseKey(close))) return undefined;
    if (close.scope === 'overlay')
        return {
            door: 'run `herdr-app status` and close an overlay its `overlays` lists open',
            rule: 'herdr-close',
            targets: [close.target],
            why: `\`${close.verb} ${close.target}\` names an overlay herdr does not list open, and a close with nothing to close falls to what herdr picks: a bare \`herdr-app do overlay.close\` killed main and wing 1 at 19:41`,
        };
    return {
        door,
        rule: 'herdr-close',
        targets: [close.target],
        why: `\`${close.verb} ${close.target}\` ends a live seat, or one herdr could not name: a \`seat=\` label, or a claude agent this seat did not start`,
    };
}

// a clio seat is the one herdr labels `seat=clio` (main) or `seat=clio-wing-<n>`: the label its spawner set, never the
// cc name a session gives itself (FRM-574)
export const isClioSeat = (seat: unknown) =>
    typeof seat === 'string' && /^clio(-wing-\d+)?$/.test(seat);

// the label keys a close trusts: `seat` says who a terminal is, `lead` which terminal may end it (its herdr id)
const PROOF_KEYS = new Set(['seat', 'lead']);
const RUN_VALUED = new Set([
    '--cwd',
    '--label',
    '--name',
    '--on',
    '--parent',
    '--timeout',
]);
// the labels an `hc label` or an `hc run`'s own options set; an `hc run`'s words past its program are the program's
export function herdrLabelsOf(c: Command) {
    if (c.name !== 'hc') return undefined;
    const words = c.args.map((w) => w.text);
    const at = words.findIndex((w) => !w.startsWith('-'));
    const verb = words[at];
    const pairs = (texts: string[]) =>
        texts.flatMap((t) => {
            const eq = t.indexOf('=');
            return eq > 0 ? [[t.slice(0, eq), t.slice(eq + 1)] as const] : [];
        });
    // a key the line fills in later (xargs, a variable), or herdr's api fed on stdin, may be any label: read as `seat`
    const isUnread =
        c.wrappers.includes('xargs') ||
        c.args.some((w) => w.isExpanding) ||
        c.feeders.length > 0 ||
        c.reads.length > 0 ||
        c.bodies.length > 0;
    if (verb === 'connect')
        return isUnread || words.length > at + 1
            ? { pairs: [['seat', '?'] as const], verb: 'label' }
            : undefined;
    if (verb === 'label')
        return {
            pairs: isUnread
                ? [['seat', '?'] as const]
                : pairs(words.slice(at + 2)),
            verb,
        };
    if (verb !== 'run') return undefined;
    const labels: string[] = [];
    for (let i = at + 1; i < words.length; i++) {
        const w = words[i] ?? '';
        if (w === '--' || !w.startsWith('-')) break;
        if (w.startsWith('--label=')) labels.push(w.slice('--label='.length));
        else if (RUN_VALUED.has(w)) {
            if (w === '--label') labels.push(words[i + 1] ?? '');
            i++;
        }
    }
    return { pairs: pairs(labels), verb };
}

// a relabel of a seat's proof keys could make any terminal a clio, or a clio no seat; a spawn labelled a clio comes only
// from a clio seat (FRM-574 decided 1)
export function herdrLabel(c: Command, ctx: Context): Refusal | undefined {
    const set = herdrLabelsOf(c);
    if (!set) return undefined;
    const door =
        'a seat keeps the labels its spawner gave it; for this one change, put the whole command in an orbit ask for dima’s tick';
    if (set.verb === 'label') {
        const keys = set.pairs.filter(([k]) => PROOF_KEYS.has(k));
        if (!keys.length) return undefined;
        return {
            door,
            rule: 'herdr-label',
            targets: keys.map(([k, v]) => `${k}=${v}`),
            why: '`hc label` on a live seat rewrites the `seat=` or `lead=` label a herdr close trusts to know a clio seat and a lead',
        };
    }
    const clio = set.pairs.find(([k, v]) => k === 'seat' && isClioSeat(v));
    if (!clio || ctx.isClioSeat) return undefined;
    return {
        door: 'a clio seat is started from a clio seat; start yours with your own `seat=` label',
        rule: 'herdr-label',
        targets: [`seat=${clio[1]}`],
        why: `this seat's own terminal carries no \`seat=clio\` label, so a spawn it labels \`seat=${clio[1]}\` would pass every close a clio may make`,
    };
}
