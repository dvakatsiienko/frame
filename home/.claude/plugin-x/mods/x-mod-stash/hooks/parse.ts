// a ·-joined list in prose, rewritten as bullets the way the output rules want it (reply-check blocks the dot);
// fences, inline code, headings, tables, quotes and the 📄 stamp line keep theirs; a numbered item keeps its number
export function bulletDots(text: string) {
    let isFence = false;
    return text
        .split('\n')
        .flatMap((line) => {
            if (/^\s*```/.test(line)) isFence = !isFence;
            // a heading, a table row or a quote breaks as bullets, so it keeps its dots
            if (
                isFence ||
                line.includes('📄') ||
                /^\s*(?:#{1,6}\s|\||>)/.test(line)
            )
                return [line];
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
                .match(/^(\s*)((?:-|\d{1,3}[.)])\s+)?(.*)$/)
                ?.slice(1) ?? ['', undefined, ''];
            const pad = bullet
                ? `${indent}${' '.repeat(bullet.trimEnd().length + 1)}`
                : (indent ?? '');
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
    clio: '🦉',
    'cloud chat': '☁️',
    'cloud-chat': '☁️',
    codie: '🔧',
    crow: '🐦‍⬛',
    designer: '🎨',
    dima: '🙋‍♂️',
    helga: '🎀',
    'helper-lite': '🪶',
    researcher: '🐝',
    'sixth sense': '🔎',
} as const;
// a lane role key (`sixth-sense`) or a member's name, to the badge the fleet prints it with
export const memberBadge = (name: string) =>
    MEMBERS[name.replaceAll('-', ' ') as keyof typeof MEMBERS];
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
        // name (`☕️ 🔧 mods codie`) keeps its own role emoji
        const masked = line.replace(
            /`[^`\n]*`|\*\*[^*\n]+\*\*|\]\([^)\n]*\)|https?:\/\/\S+|«[^»\n]*»|(?:☕️?|🎯|⚡️?|🌗|🌘) \S+ [^\n,;)»]*/gu,
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
// «waiting on <who>», and +n for the rest (dima's o88: short, nothing more); clio's standing pr/ci watches
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
    // cc's task kind: `monitor` for a watch, `shell` for a background command
    type?: string;
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

// a team key's id, so `UTF-8` or `SHA-256` in a title is never a ticket
export const ticketOf = (name: string) =>
    name.match(/\b(?:FRM|BYT)-\d+\b/)?.[0];

const ROUND_LEAD = String.raw`(?:(?:\[\w+\]|[A-Z]{2,5}-\d+:?|#\d+|slice\s+\d+|coder:|sixth sense,|final(?:\s+[—–-])?)\s+)*`;
const ROUND_HEAD = new RegExp(
    String.raw`^${ROUND_LEAD}round\s+(\d+)\b[^\n]*?(?:\bon\s+\**([0-9a-f]{7,40})|\b((?=[0-9a-f]*\d)[0-9a-f]{7,40}))\b`,
);
// a sha holds a digit, so a word like «defaced» is none
const FINAL_HEAD = new RegExp(
    String.raw`^${ROUND_LEAD}final\s+on\s+\**((?=[0-9a-f]*\d)[0-9a-f]{7,40})\b`,
);

// codie's round, only at the message's head: a quoted round further in is a report of one. a leading «round N» counts with the first
// sha on its line, whatever sits between (a real «round 4, final, on <sha>» read 3); «final on <sha>» is round 1
export function roundOf(message: string) {
    const head = message.trimStart();
    const m = head.match(ROUND_HEAD);
    if (m) return { n: Number(m[1]), sha: m[2] ?? m[3] ?? '' };
    const sha = head.match(FINAL_HEAD)?.[1];
    return sha ? { n: 1, sha } : undefined;
}

export const ROUND_CAP = 3;
// the count only signals and refuses nothing (FRM-504:W49: a block stops everyone); past the cap the coordinator decides,
// `untold` the reason her line did not go
export function roundLine(count: number, untold?: string) {
    if (count < ROUND_CAP) return undefined;
    if (count === ROUND_CAP)
        return `round ${count} of this lane: a next round with a P0 or P1 is past the cap of ${ROUND_CAP}`;
    const heard =
        untold === undefined
            ? 'the coordinator has the count and says go on or stop'
            : `the line to the coordinator did not go (${untold}): send her this count yourself`;
    return `round ${count} of this lane, past the cap of ${ROUND_CAP}: ${heard}; nothing is refused, keep working`;
}
// the coordinator's line past the cap: [escalate] passes quiet comms and starts her turn
export const capLine = (lane: string, count: number, from: string) =>
    `[escalate] round ${count} of ${lane}, past the cap of ${ROUND_CAP}, from ${from}: ask dima «go on, or stop the lane»`;

// the quiet ledger's count of one member's sends to clio: `sh -c LEDGER_SENDS <home> <session id> <address regex>`
// prints the timestamp of each SendMessage call whose `to` names her; a call its result answered `success:false`
// (unreachable, refused by a plugin, a dead socket) never reached her, so it is left out
// the last lines of a session's transcript, found by its session id: the 5h cap ends a turn as an API error with an empty
// answer, and its text lives only in the transcript's last assistant entry (FRM-488, measured at two caps 2026-11-02)
// the newest file of that id, when two project dirs hold one
export const TRANSCRIPT_TAIL =
    'f=$(ls -t "$1"/.claude/projects/*/"$2".jsonl 2>/dev/null | head -n 1); [ -n "$f" ] && tail -n 40 "$f"';

const CAP_TEXT = /hit your session limit/i;

// the cap the transcript's last assistant entry names, with the reset it names; undefined when that entry is no 5h cap.
// the signals rank (dima, 2026-11-02, «what if Anthropic changes how this message is shaped?»): the entry's typed quota
// (`rateLimitType: five_hour`, an exact `resetsAt`), then its `error: rate_limit` unless the text names the weekly limit or
// credits, then the words «session limit» on an entry cc wrote itself (`<synthetic>`), never on a model's answer
export function capOf(
    tail: string,
): { resetsAt?: number; text: string } | undefined {
    for (const line of tail.trim().split('\n').reverse()) {
        let entry: {
            error?: unknown;
            message?: { content?: unknown; model?: unknown };
            quotaLimits?: { rateLimitType?: unknown; resetsAt?: unknown };
            timestamp?: unknown;
            type?: unknown;
        };
        try {
            entry = JSON.parse(line);
        } catch {
            continue;
        }
        if (entry?.type !== 'assistant') continue;
        const parts = Array.isArray(entry.message?.content)
            ? entry.message.content
            : [];
        const text = parts
            .flatMap((p: { text?: unknown; type?: unknown } | null) =>
                p?.type === 'text' && typeof p.text === 'string'
                    ? [p.text]
                    : [],
            )
            .join('\n');
        const quota = entry.quotaLimits;
        if (quota?.rateLimitType !== undefined) {
            if (quota.rateLimitType !== 'five_hour') return undefined;
            return typeof quota.resetsAt === 'number'
                ? { resetsAt: quota.resetsAt * 1000, text }
                : textCap(text, entry.timestamp);
        }
        if (entry.error === 'rate_limit')
            return OTHER_LIMIT.test(text)
                ? undefined
                : textCap(text, entry.timestamp);
        if (entry.message?.model === '<synthetic>' && CAP_TEXT.test(text))
            return textCap(text, entry.timestamp);
        return undefined;
    }
    return undefined;
}

const OTHER_LIMIT = /weekly|credit/i;

function textCap(text: string, timestamp: unknown) {
    const at =
        typeof timestamp === 'string' ? Date.parse(timestamp) : Number.NaN;
    return {
        resetsAt: Number.isNaN(at) ? undefined : capReset(text, at),
        text,
    };
}

// «resets 9:30pm (Europe/Kiev)» as the first instant at or after `at` whose wall clock in that zone reads 21:30
export function capReset(text: string, at: number): number | undefined {
    const m = /resets (\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*\(([^)]+)\)/i.exec(
        text,
    );
    if (!m?.[1] || !m[3] || !m[4]) return undefined;
    const target =
        ((Number(m[1]) % 12) + (m[3].toLowerCase() === 'pm' ? 12 : 0)) * 60 +
        Number(m[2] ?? 0);
    const zone = m[4];
    try {
        const wallOf = (t: number) => {
            const wall = new Intl.DateTimeFormat('en-GB', {
                hour: '2-digit',
                hourCycle: 'h23',
                minute: '2-digit',
                timeZone: zone,
            }).formatToParts(t);
            const read = (type: string) =>
                Number(wall.find((p) => p.type === type)?.value);
            return read('hour') * 60 + read('minute');
        };
        const minute = at - (at % 60_000);
        const guess =
            minute + ((((target - wallOf(at)) % 1440) + 1440) % 1440) * 60_000;
        // a DST change between now and the reset moves the wall clock an hour: read the guess back and shift once
        const drift = ((((target - wallOf(guess)) % 1440) + 2160) % 1440) - 720;
        return guess + drift * 60_000;
    } catch {
        return undefined;
    }
}

export const LEDGER_SENDS = [
    't=$(cat "$1"/.claude/projects/*/"$2".jsonl 2>/dev/null)',
    `bad=$(printf '%s\\n' "$t" | grep -F '\\"success\\":false' | sed -n 's/.*"tool_use_id":"\\([^"]*\\)".*/\\1/p')`,
    `printf '%s\\n' "$t" | grep -F '"name":"SendMessage"' | grep -E "$3" | { if [ -n "$bad" ]; then grep -v -F "$bad"; else cat; fi; } | sed -n 's/.*"timestamp":"\\([^"]*\\)".*/\\1/p'`,
].join('\n');
