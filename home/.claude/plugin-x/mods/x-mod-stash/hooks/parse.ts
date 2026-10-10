import type { StashDoor } from '../types/stash.d.ts';

const HEADER = /⏳\s*waiting on your word/i;

// a ·-joined list in prose, rewritten as bullets the way the output rules want it (reply-check blocks the dot);
// fences, inline code and the 📄 stamp line keep theirs
export function bulletDots(text: string) {
    let isFence = false;
    return text
        .split('\n')
        .flatMap((line) => {
            if (/^\s*```/.test(line)) isFence = !isFence;
            if (isFence || line.includes('📄')) return [line];
            // inline code masked at the same length, so split offsets land on the real line
            const masked = line.replace(/`[^`\n]*`/g, (m) =>
                '\0'.repeat(m.length),
            );
            if (!/\S\s·\s\S/.test(masked)) return [line];
            const parts: string[] = [];
            let from = 0;
            for (const m of masked.matchAll(/\s·\s/g)) {
                parts.push(line.slice(from, m.index));
                from = (m.index ?? 0) + m[0].length;
            }
            parts.push(line.slice(from));
            const [indent, bullet, head] = (parts[0] ?? '')
                .match(/^(\s*)(-\s+)?(.*)$/)
                ?.slice(1) ?? ['', undefined, ''];
            const pad = bullet ? `${indent}  ` : (indent ?? '');
            // a label ends at the first item's last colon: `the crew: a · b` keeps `the crew:` as its line
            const colon = (head ?? '').lastIndexOf(': ');
            const label =
                colon >= 0 ? (head ?? '').slice(0, colon + 1) : undefined;
            const items = [
                colon >= 0 ? (head ?? '').slice(colon + 2) : (head ?? ''),
                ...parts.slice(1),
            ];
            const lines = items.map((i) => `${pad}- ${i.trim()}`);
            if (label !== undefined)
                return [`${indent}${bullet ?? ''}${label}`, ...lines];
            return bullet ? [`${indent}${bullet}`.trimEnd(), ...lines] : lines;
        })
        .join('\n');
}

// a fleet word or member prints bold with its badge glued on (rules/fleet-output-format.md); a bare one in prose is fixed,
// not policed. fences, quotes, inline code, bold text and links keep theirs; «wish» only as a noun, after a determiner.
// members are rules/fleet-identity.md's, minus the names that are plain english too (helper, retro, classifier,
// explore, cc) — those would badge a helper function or the retro file
const MEMBERS = {
    cclio: '🦉',
    ccrow: '🐦‍⬛',
    coder: '🔧',
    cw: '🤝',
    designer: '🎨',
    dima: '🙋‍♂️',
    researcher: '🐝',
    sifter: '🪶',
    verifier: '🔎',
} as const;
const BADGES = {
    ...MEMBERS,
    freebie: '🍀',
    siesta: '🌤️',
    wish: '🌠',
    wisp: '✨',
} as const;
type FleetWord = keyof typeof BADGES;
const WORD = new RegExp(
    `(?<![\\w\\-/.])(?:(${Object.values(BADGES).join('|')}) )?(${Object.keys(BADGES).join('|')})(s|es)?(?![\\w\\-/]|[.:]\\w)`,
    'giu',
);
const DETERMINER =
    /(?:^|\s)(?:a|an|the|his|her|this|that|each|every|one|new|your|my|our|their|dima's)\s+(?:🌠 )?$/i;

export function boldFleetWords(text: string) {
    const hits: Partial<Record<FleetWord, number>> = {};
    let isFence = false;
    const lines = text.split('\n').map((line) => {
        if (/^\s*```/.test(line)) isFence = !isFence;
        if (isFence || /^\s*>/.test(line)) return line;
        // masked at the same length, so match offsets land on the real line; a «quote» stays as typed, and a session
        // name (`☕️ 🔧 mods coder`) keeps its own role emoji
        const masked = line.replace(
            /`[^`\n]*`|\*\*[^*\n]+\*\*|\]\([^)\n]*\)|https?:\/\/\S+|«[^»\n]*»|(?:☕️?|🎯) \S+ [^\n,;)»]*/gu,
            (m) => '\0'.repeat(m.length),
        );
        let out = '';
        let from = 0;
        for (const m of masked.matchAll(WORD)) {
            const at = m.index ?? 0;
            const word = (m[2] ?? '').toLowerCase() as FleetWord;
            if (word === 'wish' && !DETERMINER.test(masked.slice(0, at)))
                continue;
            const badge = BADGES[word];
            // another word's badge before it is someone else's label: leave both
            if (m[1] && m[1] !== badge) continue;
            const shown = m[0].slice(m[1] ? m[1].length + 1 : 0);
            out += `${line.slice(from, at)}**${badge} ${shown}**`;
            from = at + m[0].length;
            hits[word] = (hits[word] ?? 0) + 1;
        }
        return out + line.slice(from);
    });
    return { hits, text: lines.join('\n') };
}

// dima's «yes, after X» verdicts, each with the open ask its number names; a plain yes is not one
export function parseAfter(prompt: string, asks: string[]) {
    return prompt.split('\n').flatMap((line) => {
        const m = line.match(/^\s*(\d+)\.\s.*?\byes,?\s+after\s+(.+?)\s*$/i);
        const ask = m && asks[Number(m[1]) - 1];
        return m?.[2] && ask ? [{ after: m[2], ask }] : [];
    });
}

// The asks of a reply's ⏳ block, in order; null when the reply carries no block.
export function parseAsks(reply: string): string[] | null {
    const start = reply.search(HEADER);
    if (start < 0) return null;
    const fence = reply.indexOf('```', start);
    if (fence < 0) return null;
    const end = reply.indexOf('```', fence + 3);
    const body = reply.slice(
        reply.indexOf('\n', fence) + 1,
        end < 0 ? undefined : end,
    );
    const asks: string[] = [];
    for (const line of body.split('\n')) {
        if (/^\s*wispr adds\s*$/i.test(line)) break;
        const m = line.match(/^\s*\d+\.\s+(.+?)\s*$/);
        if (m?.[1]) asks.push(m[1]);
    }
    return asks;
}

// The numbers of the ⏳ asks that carry lines under them; the rule is one line per item, so «c» copies it whole.
export function nestedAsks(reply: string): string[] {
    const start = reply.search(HEADER);
    if (start < 0) return [];
    const fence = reply.indexOf('```', start);
    if (fence < 0) return [];
    const end = reply.indexOf('```', fence + 3);
    const body = reply.slice(
        reply.indexOf('\n', fence) + 1,
        end < 0 ? undefined : end,
    );
    const nested = new Set<string>();
    let item: string | undefined;
    for (const line of body.split('\n')) {
        if (/^\s*wispr adds\s*$/i.test(line)) break;
        const m = line.match(/^\s*(\d+)\.\s+\S/);
        if (m?.[1]) item = m[1];
        else if (line.trim() && item) nested.add(item);
    }
    return [...nested];
}

// a reply line as a person reads it: links reduced to their labels, no bold or code marks, no list or heading marker
function plain(line: string) {
    return line
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\*\*|`/g, '')
        .replace(/^\s*(?:[-*]|#+)\s+/, '')
        .trim();
}

// What a reply says its session waits on: the 🔭 lines that end it, joined; a 🔭 quoted earlier, or in a fence, is not one.
export function parseWait(reply: string): string | undefined {
    const waits: string[] = [];
    for (const line of reply.trimEnd().split('\n').reverse()) {
        const l = line.trim();
        if (!l) continue;
        if (!l.startsWith('🔭')) break;
        waits.unshift(plain(l.slice('🔭'.length)));
    }
    return waits.length ? waits.join('; ') : undefined;
}

export const ticketOf = (name: string) => name.match(/\b[A-Z]{2,5}-\d+\b/)?.[0];

// the desktop's url handler accepts only these id shapes (Claude.app 2.1.289)
const LOCAL_ID = /^local_[A-Za-z0-9-]{1,64}$/;
const BRIDGE_ID = /^session_[A-Za-z0-9_-]+$/;
const JOB_ID = /^[A-Za-z0-9-]+$/;

export type Door = StashDoor;

// How a press reaches a session: its desktop deep link, else the terminal's attach command for a background job.
export function doorOf(entry: {
    hostSessionId?: string;
    bridgeSessionId?: string;
    jobId?: string;
    bg: boolean;
}): Door | undefined {
    if (entry.hostSessionId && LOCAL_ID.test(entry.hostSessionId))
        return {
            kind: 'open',
            url: `claude://code/continue?session=${entry.hostSessionId}`,
        };
    if (entry.bridgeSessionId && BRIDGE_ID.test(entry.bridgeSessionId))
        return { kind: 'open', url: `claude://code/${entry.bridgeSessionId}` };
    if (entry.bg && entry.jobId && JOB_ID.test(entry.jobId))
        return { kind: 'copy', text: `claude attach ${entry.jobId}` };
    return undefined;
}

// `<mode> <role emoji> <ticket> <role word>: <what>` — «☕️ 🔧 FRM-303 code: stash keep-hot»; a standing member keeps
// its own name, badge or not — «🐦‍⬛ ccrow», which the registry writes with a space for the joiner
const FLEET_NAME = /^(☕️?|🎯)\s+\S+\s+[A-Z]{2,5}-\d+\s+[\w-]+:\s+\S/u;
export function isFleetName(name: string) {
    return (
        FLEET_NAME.test(name) ||
        Object.hasOwn(MEMBERS, name.replace(/[^\w\s]/gu, '').trim())
    );
}
