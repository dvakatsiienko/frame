import { touchesStore } from './clean-stamp.ts';
import { type Refusal, basename, commandsDeep } from './command.ts';

// wispr types «Operator override PRs.», so case and a closing period pass; anything else around the words reads as talk about them
const WORD = /^operator[- ]override (prs|off)\.?$/i;
const SHIFT = /^\/clio:shift\s+\S+$/;
const TYPED_DOWN = /operator[- ]override\s+(prs|off)\b|\/clio:shift\b/i;
const OPAQUE =
    /^(python[\d.]*|node|bun|deno|ruby|perl|php|lua|osascript|xargs|parallel|eval)$/;

// what a whole prompt asks of the switch, undefined for anything else
export function overrideAsked(text: string): OverrideAsk | undefined {
    const prompt = text.trim();
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

export const isOverrideStore = (text: string) =>
    /\.local\/state\/x\/(operator-override|[^/]*[*?[])|\$\{?\w+\}?\/operator-override|^operator-override\.(json|log)\b/i.test(
        text,
    );
const isStoreDir = (text: string) => /\.local\/state\/x\/?$/i.test(text);

const STORE_DOOR =
    "dima's whole typed prompt `operator-override prs` or `operator-override off`, or x lane merge-auto --override-off --apply; a read goes through cat or jq";
export const STORE_WHY =
    "operator-override opens merge-auto's every check, and only dima flips it";

// x and this mod are its two writers: a session's hand on it would grant itself every merge
export function overrideStoreWrite(
    command: string,
    cwd: string,
): Refusal | undefined {
    if (!touchesStore(command, cwd, isOverrideStore, isStoreDir))
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
    const parsed = commandsDeep(command, cwd);
    const isRexLine = parsed.some(
        (c) =>
            basename(c.name) === 'rex' &&
            TYPED_DOWN.test(c.args.map((w) => w.text).join(' ')),
    );
    const isHidden =
        TYPED_DOWN.test(command) &&
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
