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

// the child reads no user settings, so the user's own yes to the bypass dialog rides in as flag settings; off or absent,
// the dialog still stands
export function skipPromptArgs(userSettings: string): string[] {
    try {
        const { skipDangerousModePermissionPrompt: isSkipped } = (JSON.parse(
            userSettings,
        ) ?? {}) as { skipDangerousModePermissionPrompt?: unknown };
        return isSkipped === true
            ? ['--settings', '{"skipDangerousModePermissionPrompt":true}']
            : [];
    } catch {
        return [];
    }
}

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

// a client verb's request as the server reads it: a file read mid-write, or one of no known shape, is no request, never a
// throw in the watch callback, which would take the server down with its pty
export function requestOf(
    text: string,
): { label: string; what: LiveVerb } | undefined {
    try {
        const r = JSON.parse(text) as { label?: unknown; what?: unknown };
        return typeof r.label === 'string' &&
            typeof r.what === 'string' &&
            isVerb(r.what)
            ? { label: r.label, what: r.what }
            : undefined;
    } catch {
        return undefined;
    }
}
