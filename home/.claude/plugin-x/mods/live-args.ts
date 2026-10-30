// pnpm mods:live's arguments: a mod dir alone serves it; a verb with text acts in the running session; status names
// who holds the slot; --plant <file> <anchor> <replacement> serves a scratch copy with that one change
export const LIVE_VERBS = ['hover', 'click', 'type', 'fill'] as const;
export type LiveVerb = (typeof LIVE_VERBS)[number];

export type LiveArgs =
    | { kind: 'serve'; mod: string }
    | { kind: 'act'; mod: string; verb: LiveVerb; text: string }
    | { kind: 'status'; mod: string }
    | { kind: 'plant'; file: string; anchor: string; replacement: string }
    | { kind: 'usage' };

const isVerb = (v: string): v is LiveVerb =>
    (LIVE_VERBS as readonly string[]).includes(v);

export function parseLive(argv: readonly string[]): LiveArgs {
    const [mod, verb, ...rest] = argv;
    if (mod === '--plant') {
        const [anchor, replacement, ...extra] = rest;
        return verb &&
            anchor !== undefined &&
            replacement !== undefined &&
            !extra.length
            ? { anchor, file: verb, kind: 'plant', replacement }
            : { kind: 'usage' };
    }
    if (!mod) return { kind: 'usage' };
    if (verb === undefined) return { kind: 'serve', mod };
    if (verb === 'status')
        return rest.length ? { kind: 'usage' } : { kind: 'status', mod };
    if (!isVerb(verb) || !rest.length) return { kind: 'usage' };
    return { kind: 'act', mod, text: rest.join(' '), verb };
}
