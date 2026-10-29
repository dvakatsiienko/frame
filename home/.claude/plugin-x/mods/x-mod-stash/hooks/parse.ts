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

// each prose line of a reply, fences and the 📄 stamp left whole, with its inline code masked at the same length so a
// match's offsets land on the real line
function proseLines(
    text: string,
    fix: (line: string, masked: string) => string,
) {
    let isFence = false;
    return text
        .split('\n')
        .map((line) => {
            if (/^\s*```/.test(line)) isFence = !isFence;
            if (isFence || line.includes('📄')) return line;
            return fix(
                line,
                line.replace(/`[^`\n]*`/g, (m) => '\0'.repeat(m.length)),
            );
        })
        .join('\n');
}

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';

// a run of ①②③ in one line becomes one numbered line each (rules/fleet-output-format.md: «glyph run-ons»); a lone
// circled digit stays, it is no list
export function numberCircled(text: string) {
    return proseLines(text, (line, masked) => {
        const at = [...masked.matchAll(/[①-⑳]/gu)];
        if (at.length < 2) return line;
        const head = line.slice(0, at[0]?.index).trimEnd();
        const indent = line.match(/^\s*/)?.[0] ?? '';
        const items = at.map((m, k) => {
            const end = at[k + 1]?.index ?? line.length;
            const n = CIRCLED.indexOf(m[0]) + 1;
            return `${indent}${n}. ${line.slice((m.index ?? 0) + m[0].length, end).trim()}`;
        });
        return [...(head.trim() ? [head] : []), ...items].join('\n');
    });
}

// a bare ticket id becomes its one-click link; one already in a link, a url or inline code stays
export function linkTickets(text: string) {
    return proseLines(text, (line, masked) => {
        const hidden = masked
            .replace(/\[[^\]\n]*\]\([^)\n]*\)/g, (m) => '\0'.repeat(m.length))
            .replace(/https?:\/\/\S+/g, (m) => '\0'.repeat(m.length));
        let out = '';
        let from = 0;
        for (const m of hidden.matchAll(
            /(?<![\w/[-])(?:FRM|BYT)-\d+(?![\w-])/g,
        )) {
            out += `${line.slice(from, m.index)}[${m[0]}](https://linear.app/x-com/issue/${m[0]})`;
            from = (m.index ?? 0) + m[0].length;
        }
        return out + line.slice(from);
    });
}

// a 🔭 line is «🔭 waiting on <who>», nothing more: its (aside) is dropped; a link's url keeps its parens
export function dropWaitAside(text: string) {
    return proseLines(text, (line, masked) => {
        if (!/^\s*(?:[-*]\s+)?🔭/u.test(masked)) return line;
        const hidden = masked.replace(/\]\((?:[^()\n]|\([^()\n]*\))*\)/g, (m) =>
            '\0'.repeat(m.length),
        );
        let out = '';
        let from = 0;
        for (const m of hidden.matchAll(/\s*\([^()\n]*\)/g)) {
            out += line.slice(from, m.index);
            from = (m.index ?? 0) + m[0].length;
        }
        return (out + line.slice(from)).trimEnd();
    });
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
    'helper-lite': '🪶',
    researcher: '🐝',
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

// a reply line as a person reads it: links reduced to their labels, code marks and the list or heading marker dropped; **bold**
// stays, so the names a reply marked reach the band bold (PK-164), unless a mark is left unpaired
function plain(line: string) {
    const out = line
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/`/g, '')
        .replace(/^\s*(?:[-*]|#+)\s+/, '')
        .trim();
    return (out.match(/\*\*/g)?.length ?? 0) % 2
        ? out.replaceAll('**', '')
        : out;
}

const WAITING_ON = /^waiting on /i;
// What a reply says its session waits on: the 🔭 lines that end it, joined; a 🔭 quoted earlier, or in a fence, is not one.
// every «waiting on <who>» line without a «— how» tail merges into one, the holders split by commas (PK-160)
export function parseWait(reply: string): string | undefined {
    const waits: string[] = [];
    for (const line of reply.trimEnd().split('\n').reverse()) {
        const l = line.trim();
        if (!l) continue;
        if (!l.startsWith('🔭')) break;
        waits.unshift(plain(l.slice('🔭'.length)));
    }
    const parts: string[] = [];
    let merged = -1;
    for (const w of waits) {
        if (!WAITING_ON.test(w) || w.includes(' — ')) parts.push(w);
        else if (merged < 0) merged = parts.push(w) - 1;
        else parts[merged] += `, ${w.replace(WAITING_ON, '')}`;
    }
    return parts.length ? parts.join('; ') : undefined;
}

// a wait part as its plain and bold spans: the names a reply marked **bold**, else the whole <who> of «waiting on <who>»
// (a background task's name carries no mark); the «waiting on » head and a «— how» tail stay plain
export function waitSpans(part: string): { text: string; isBold: boolean }[] {
    const m = part.match(/^(waiting on )(.+?)( — .*)?$/iu);
    const who = m ? (m[2] ?? '') : part;
    const spans = who.includes('**')
        ? who
              .split(/\*\*(.+?)\*\*/)
              .map((text, i) => ({ isBold: i % 2 === 1, text }))
        : [{ isBold: !!m, text: who }];
    return [
        { isBold: false, text: m?.[1] ?? '' },
        ...spans,
        { isBold: false, text: m?.[3] ?? '' },
    ].filter((span) => span.text);
}

export const unbold = (wait: string) => wait.replaceAll('**', '');

// with no 🔭 line, the session's own background work is what it waits on: the first task in three words at most,
// «waiting on <who>», and +n for the rest (dima's o88: short, nothing more); cclio's standing pr/ci watches
// (`watch-once.sh`) run all day and are no wait (dima's o52)
const STANDING_WATCH = /^Arm the one-shot (?:pr|ci) watch/i;
const isStandingWatch = (t: { description: string; command?: string }) =>
    t.command?.includes('watch-once.sh') || STANDING_WATCH.test(t.description);
// a background task as the Stop event lists it, kept per reply; `state` is set once its end notice arrived
export type BackgroundTask = {
    id?: string;
    name?: string;
    description: string;
    command?: string;
    agent_type?: string;
    state?: 'done' | 'failed';
};

// every background task the session still waits on, by its own name or description: the board's row lists them all (dima's o75)
export function backgroundWaits(
    all: readonly BackgroundTask[] | undefined,
): string[] {
    return (all ?? [])
        .filter((t) => !isStandingWatch(t) && !t.state)
        .map((t) => (t.name ?? t.description).trim());
}

// a fleet subagent is named by its badge and type, the way replies print a member (rules/fleet-identity.md)
const AGENT_BADGE: Record<string, string> = {
    helper: '🐜',
    'helper-lite': '🪶',
    researcher: '🐝',
    retro: '🦡',
    scout: '🦅',
    wishkeeper: '🐬',
};

const named = (t: BackgroundTask) => {
    const badge = t.agent_type && AGENT_BADGE[t.agent_type];
    return badge
        ? `${badge} ${t.agent_type}`
        : (t.name ?? t.description).trim().split(/\s+/).slice(0, 3).join(' ');
};

// the tasks still running read «waiting on <who>»; with none left, the ones that ended read «<who> done» or «<who> failed»,
// so a finished agent never shows as running (dima, 2026-10-15; PK-147)
export function backgroundWait(
    all: readonly BackgroundTask[] | undefined,
): string | undefined {
    const tasks = all?.filter((t) => !isStandingWatch(t)) ?? [];
    const live = tasks.filter((t) => !t.state);
    const first = live[0];
    // the ended ones beside it: «(2 done, 1 failed)», so a finished agent reads finished next to the one still running
    const count = (state: 'done' | 'failed') =>
        tasks.filter((t) => t.state === state).length;
    const tally = [
        count('done') && `${count('done')} done`,
        count('failed') && `${count('failed')} failed`,
    ].filter(Boolean);
    if (first)
        return `waiting on ${named(first)}${live.length > 1 ? ` +${live.length - 1}` : ''}${tally.length ? ` (${tally.join(', ')})` : ''}`;
    const ended = tasks[0];
    if (!ended) return undefined;
    return `${named(ended)} ${ended.state}${tasks.length > 1 ? ` +${tasks.length - 1}` : ''}`;
}

// a task-notification delivery names the task that ended and how: completed is done, failed, killed and stopped are failed
const ENDS = {
    completed: 'done',
    failed: 'failed',
    killed: 'failed',
    stopped: 'failed',
} as const;
export function noticeOf(
    text: string,
): { id: string; state: 'done' | 'failed' } | undefined {
    if (!text.includes('<task-notification>')) return undefined;
    const id = text.match(/<task-id>([^<]+)<\/task-id>/)?.[1];
    const status = text.match(/<status>(\w+)<\/status>/)?.[1];
    const state = status ? ENDS[status as keyof typeof ENDS] : undefined;
    return id && state ? { id, state } : undefined;
}

// a lane plan's steps: the numbered lines at column 0, `- [ ] NN · text` or `- [x] NN · text`; a nested, unnumbered or
// any other checklist line moves nothing (FRM-429 exit 1)
export function planSteps(text: string) {
    return text.split('\n').flatMap((line) => {
        const m = line.match(/^- \[( |x)\] \d+ · (.+?)\s*$/);
        return m ? [{ isDone: m[1] === 'x', text: m[2] ?? '' }] : [];
    });
}

export const ticketOf = (name: string) => name.match(/\b[A-Z]{2,5}-\d+\b/)?.[0];

// `<mode> <role emoji> <ticket> <role word>: <what>` — «☕️ 🔧 FRM-303 code: stash keep-hot»; a standing member keeps
// its own name, badge or not — «🐦‍⬛ ccrow», which the registry writes with a space for the joiner
const FLEET_NAME = /^(☕️?|🎯)\s+\S+\s+[A-Z]{2,5}-\d+\s+[\w-]+:\s+\S/u;
// standing sidecars named by a bare word, not by the lane pattern: composer is cclio's copyist (rules/fleet-identity.md)
const SIDECARS = new Set(['composer']);
export function isFleetName(name: string) {
    return (
        FLEET_NAME.test(name) ||
        Object.hasOwn(MEMBERS, name.replace(/[^\w\s-]/gu, '').trim()) ||
        SIDECARS.has(name.replace(/[^\w\s-]/gu, '').trim())
    );
}

// the quiet ledger's count of one member's sends to cclio: `sh -c LEDGER_SENDS <home> <session id> <address regex>`
// prints the timestamp of each SendMessage call whose `to` names her; a call its result answered `success:false`
// (unreachable, refused by a plugin, a dead socket) never reached her, so it is left out
export const LEDGER_SENDS = [
    't=$(cat "$1"/.claude/projects/*/"$2".jsonl 2>/dev/null)',
    `bad=$(printf '%s\\n' "$t" | grep -F '\\"success\\":false' | sed -n 's/.*"tool_use_id":"\\([^"]*\\)".*/\\1/p')`,
    `printf '%s\\n' "$t" | grep -F '"name":"SendMessage"' | grep -E "$3" | { if [ -n "$bad" ]; then grep -v -F "$bad"; else cat; fi; } | sed -n 's/.*"timestamp":"\\([^"]*\\)".*/\\1/p'`,
].join('\n');
