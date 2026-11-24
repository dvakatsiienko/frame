// the quiet gate's words, one source for the hold, the sender's line and the 11-03 replay: pure, no `$`

import { type Registered, memberOf } from './roster.ts';
import { memberKey } from './util.ts';

// the one table of slipstream message kinds (FRM-583, FRM-564:W22, FRM-686:W8): every hold names a held message by its kind
// from here, the push tags and the sender's line are read from it, and a kind not on it is no kind. `who` may send it,
// `reads` is how a message is classified as it, `does` what it is for, `lands` what becomes of it in clio's thread;
// `isTag` a kind its message opens with; `door` when a held message's sender resends it opening this tag
export const MESSAGE_KINDS = [
    {
        does: 'a question for the receiver',
        door: 'if the coordinator must decide',
        example: '[ask] land it now, or after the siesta?',
        isTag: true,
        kind: 'ask',
        lands: 'pushes',
        reads: 'opens with [ask], an emoji before it allowed, or a later line does',
        who: 'any member',
    },
    {
        does: 'a finished chunk or job',
        example: '[done] FRM-686 is clean on main',
        isTag: true,
        kind: 'done',
        lands: 'pushes',
        reads: 'opens with [done]',
        who: 'any member',
    },
    {
        does: 'a block that climbs a rung',
        example: '[escalate] the gate refuses every push',
        isTag: true,
        kind: 'escalate',
        lands: 'pushes',
        reads: 'opens with [escalate] or [🪜 escalate], crow’s name before it allowed',
        who: 'any member',
    },
    {
        does: 'needs dima, whatever its tag',
        example: 'the cut is ready, waiting on dima',
        kind: 'for-dima',
        lands: 'pushes',
        reads: 'no push tag, names dima in words: «for dima», «waiting on dima»',
        who: 'any member',
    },
    {
        does: 'a decision that is clio’s, whatever its tag',
        example:
            'round 1 is refuted; one decision for you: keep the path, or not',
        kind: 'decision',
        lands: 'pushes',
        reads: 'no push tag, a decision, ruling or call said to be hers: «a decision for you», «one ruling is yours», «decisions, yours»',
        who: 'any member',
    },
    {
        does: 'a thread back from a compact, nothing in it for clio',
        example: 'sw done: handoff ingested, step 3 next',
        kind: 'sw-done',
        lands: 'logged',
        reads: 'one line opening «sw done», with no question, «ask», «for you» or «for dima» in it',
        who: 'any member',
    },
    {
        does: 'a receipt, a steer or an answer; an answer to her question pushes',
        example: 'step 2 landed',
        kind: 'untagged',
        lands: 'waits',
        reads: 'none of the above',
        who: 'any member',
    },
    {
        does: "tells a sender its message waits for the receiver's next turn",
        example:
            'held: 🔧 codie is compacting; your message joins its next turn',
        kind: 'held',
        lands: 'logged',
        reads: 'sent by x-mod-stash, never by a member, its whole text one of its lines',
        who: 'x-mod-stash',
    },
    {
        does: 'tells a sender its held message went in',
        example:
            "delivered: your message joined 🔧 codie's first turn after its compact",
        kind: 'joined',
        lands: 'logged',
        reads: 'sent by x-mod-stash, never by a member, its whole text one of its lines',
        who: 'x-mod-stash',
    },
    {
        does: "dima's own words: join the thread's next turn or tool step, never start one; a slash command only pushes",
        example: 'use the second one',
        kind: 'herdr-join',
        lands: 'waits',
        reads: "a row herdr's chatter wrote to `~/.claude/shelf/herdr-joins/<sid>.jsonl`",
        who: 'dima',
    },
] as const satisfies readonly MessageRow[];
export type MessageKind = (typeof MESSAGE_KINDS)[number]['kind'];
const ROWS: readonly MessageRow[] = MESSAGE_KINDS;

// flags are regional indicators and a keycap is a digit with its mark: neither is Extended_Pictographic
const EMOJI_RUN = String.raw`^(?:[\s\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\u{E0020}-\u{E007F}\uFE0F\u200D]|[0-9#*]\uFE0F?\u20E3)*`;
const PUSH_TAG = new RegExp(
    String.raw`${EMOJI_RUN}\[(${ROWS.flatMap((r) => (r.isTag ? [r.kind] : [])).join('|')}|🪜 ?escalate)\]`,
    'u',
);
const FENCE = /^[ \t]*```[\s\S]*?(?:^[ \t]*```|(?![\s\S]))/gm;
const ASK_LINE = new RegExp(String.raw`${EMOJI_RUN}\[ask\]`, 'mu');
// crow's notes open with her badge and name; the rest of what she writes waits
const CROW = /^\s*🐦\u200D⬛/u;
const CROW_ESCALATE = /^\s*🐦\u200D⬛[ \t]*crow\b[^\n[]*\[(?:🪜 ?)?escalate\]/u;
const CODE_SPAN = /`[^`]*`/g;
// the fleet's 🔭 line prints him bold, his badge glued on
const DIMA = String.raw`(?:\*\*)?(?:[\p{Extended_Pictographic}\u200D\uFE0F]+\s*)?dima`;
// a path never counts, nor a line saying there is nothing for him; «for dima's tick» names what a line waits on, never a line for him
const FOR_DIMA = new RegExp(
    String.raw`(?<![\w/.-])(?:(?<!\bnothing(?:[ \t]+\w+)?[ \t]+)for ${DIMA}(?![\w/-]|\.\w|['’]s tick\b)|(?<!(?:\bnot|n['’]t|\bno longer|\bnothing(?:[ \t]+else)?)[ \t]+)(?:needs|waiting on) ${DIMA}(?![\w/-]|\.\w))`,
    'iu',
);
const DECISION =
    /(?<!\bno(?:[ \t]+\w+)?[ \t]+)\b(?:decisions?|rulings?|calls?)(?:[ \t]+(?:for you|is yours|are yours)|,[ \t]+yours)\b/iu;
const SW_DONE = new RegExp(String.raw`${EMOJI_RUN}sw done\b.*$`, 'iu');
const SW_DONE_REAL = /\?|\bask\b|\bfor you\b/iu;
// the mod's own lines to a sender, written here alone, so a reworded one is still known
export const MOD_LINES = {
    compacting: (name: string) =>
        `held: ${name} is compacting; your message joins its next turn`,
    delivered: (name: string) =>
        `delivered: your message joined ${name}'s first turn after its compact`,
    unwound: (name: string, fill: string) =>
        `your message to ${name} is held: it is ${fill} and has not wound`,
    waiting: (name: string) =>
        `held, waiting: ${name} has taken no turn since its compact; your message joins its next turn`,
} as const;
const isModLine = (shape: string, line: string) =>
    new RegExp(
        `^${shape.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replaceAll('NAME', '.+')}$`,
        'u',
    ).test(line);
// a sw done line stays held by its words, the lines after it are read
const SW_DONE_LINE = new RegExp(
    String.raw`${EMOJI_RUN}(?:\[[^\]\n]*\]\s*)?sw done\b.*$`,
    'gimu',
);

export const QUIET_LOGGED_LINE = 'logged, the coordinator never reads it';
const VERDICTS = {
    logged: `${QUIET_LOGGED_LINE}.`,
    pushed: "pushed: starts clio's turn.",
    slipstreamed: "slipstreamed: joins clio's next turn.",
} as const;
export const QUIET_HELD_LINE = "held, delivered at clio's next turn";
// the line a sender reads after its result, every word past its verdict from the table's rows
export function quietSenderLine(
    verdict: keyof typeof VERDICTS,
    rows: readonly MessageRow[] = ROWS,
) {
    const tags = rows.flatMap((r) =>
        r.isTag ? [`[${r.kind}] (${r.does})`] : [],
    );
    if (!tags.length) return VERDICTS[verdict];
    const list = [tags.slice(0, -1).join(', '), tags.at(-1)]
        .filter(Boolean)
        .join(' or ');
    const doors = rows.flatMap((r) =>
        r.door && verdict !== 'pushed'
            ? [`; ${r.door}, resend it opening [${r.kind}]`]
            : [],
    );
    return `${VERDICTS[verdict]} send only ${list}, the tag first${doors.join('')}`;
}
// advising the tag that just held would send them round again
export const quietKindHeld = (kind: string) =>
    `${VERDICTS.slipstreamed} [${kind}] is switched off, so resending changes nothing`;
const REPLY_MS = 30 * 60_000;

// a held message's kind: its quiet tag when quiet comms read one, else its words
export function messageKind(body: string, tag?: string): MessageKind {
    const read = tag ?? quietTag(body);
    if (read === 'ask' || read === 'done' || read === 'escalate') return read;
    const words = quietPush(body);
    return words === 'for-dima' || words === 'decision'
        ? words
        : (quietLogged(body) ?? 'untagged');
}

// the kind of a line clio's thread logs and never reads
export function quietLogged(body: string) {
    const line = body.trim();
    if (isModLine(MOD_LINES.delivered('NAME'), line)) return 'joined';
    const held = [
        MOD_LINES.compacting('NAME'),
        MOD_LINES.waiting('NAME'),
        MOD_LINES.unwound('NAME', 'NAME'),
    ];
    if (held.some((shape) => isModLine(shape, line))) return 'held';
    return SW_DONE.test(line) &&
        !line.includes('\n') &&
        !SW_DONE_REAL.test(line) &&
        !FOR_DIMA.test(line)
        ? 'sw-done'
        : undefined;
}

export function quietTag(body: string) {
    const tag = body.match(PUSH_TAG)?.[1];
    if (tag) return tag.endsWith('escalate') ? 'escalate' : tag;
    if (CROW.test(body)) return CROW_ESCALATE.test(body) ? 'escalate' : 'none';
    return ASK_LINE.test(body.replace(FENCE, '')) ? 'ask' : 'none';
}

// why a message starts a turn by its own words; undefined holds it, unless it answers clio. a kind switched off holds like
// an untagged line, «for dima» still pushes
export function quietPush(body: string, kindsOff: readonly string[] = []) {
    const tag = quietTag(body);
    if (tag !== 'none' && !kindsOff.includes(tag)) return 'tag';
    const words = body.replace(SW_DONE_LINE, '').replace(CODE_SPAN, '');
    if (FOR_DIMA.test(words)) return 'for-dima';
    return !CROW.test(body) && DECISION.test(words) ? 'decision' : undefined;
}

// clio's checkpoint words to the whole fleet, every clause of a real send (her transcripts, 2026-11-07): no work in them,
// so a parked member stays parked; any other clause is work, and an alarm costs less than a re-tasked member's silence
const QUIET_CHECKPOINT_CLAUSE =
    /^(?:(?:🦉 )?(?:main clio|clio|main|wing \d+)(?: \(main\))?(?:'s)? (?:is )?(?:checkpointing|second-winding|back|taking (?:her|a) second wind|back from her (?:checkpoint|second wind)|(?:checkpoint|second wind) is done)(?: \(second wind\))?|hold every message(?: to me)?(?: until «resume»)?|hold messages to (?:main clio|wing \d+) until it says back|nothing else pauses|keep working|send (?:what|whatever|anything) you held|finish (?:and commit )?what you are on|through the gate queue|no open chore|chores open again|window is on pace|your talk with your codie goes on)$/i;
export const isQuietPause = (body: string) => {
    const head = body
        .trim()
        .match(/^(?:pause|resume|second wind)\s*(?:[—–:-]\s*|$)/i);
    return (
        !!head &&
        body
            .trim()
            .slice(head[0].length)
            .split(/[.,:;]\s*/)
            .every((c) => !c || QUIET_CHECKPOINT_CLAUSE.test(c))
    );
};

export const isQuietAnswer = (askedAt: number, now: number) =>
    now - askedAt < REPLY_MS;

// a question opens a member's one answer; a `?` in code or a url asks nothing
export const isQuietQuestion = (body: string) =>
    body
        .replace(CODE_SPAN, '')
        .replace(/\S+:\/\/\S+/g, '')
        .includes('?');

// the desktop route's words for a send clio's gate consumed, and for a real refusal alike
export const isQuietRefusal = (message: unknown) =>
    String(message ?? '').includes('did not accept');

// one block off the prompt's head; a message may quote a tag mid-line, never at a line's start
const APP_HEAD =
    /^\s*(?:<system-reminder>\n([\s\S]*?)\n<\/system-reminder>|<side-sessions-event>([^<]*)<\/side-sessions-event>|(<cross-session-message[^>]*>(?:(?!\n<\/?cross-session-message)[\s\S])*\n<\/cross-session-message>))/;
const NOTE =
    /^The session "([^"]*)" you started \(local_[^)]*\) finished a turn(?: \([^)]*\))?\. It reported[^:]*: "([\s\S]*)"(?: \(first \d+ of \d+ characters\))? Read it with [^"]*$/;

const OPEN = '<cross-session-message';
const CLOSE = '</cross-session-message>';
const UNREAD_SPLIT =
    /(?<=\n<\/cross-session-message>)\s*(?=<cross-session-message)/;

// what the parser left is messages it could not read only with no text outside them, each with one close, its last;
// any doubt reads as his words
const isUnreadBlock = (block: string) =>
    block.startsWith(OPEN) &&
    block.indexOf(CLOSE) === block.length - CLOSE.length;

// the desktop's one `sdk` prompt, block by block: its notes as sender and report, its member messages, each with its place among the blocks, whether another reminder
// starts a turn by itself, and a message it could not read, its body holding a tag at a line's start; undefined once typed
// words remain, since those may be dima quoting a block
// (the origin is the same as dima's typing, so only the blocks' shape tells them apart)
export function quietGlued(text: string) {
    const heads: string[] = [];
    const notes: QuietNote[] = [];
    const messages: { block: string; head: number }[] = [];
    let rest = text;
    let hasOther = false;
    let lone: number | undefined;
    for (let m = rest.match(APP_HEAD); m; m = rest.match(APP_HEAD)) {
        const [taken, reminder, event, block] = m;
        rest = rest.slice(taken.length);
        const head = heads.push(taken) - 1;
        const note = reminder?.match(NOTE);
        if (note)
            notes.push({ body: note[2] ?? '', from: note[1] ?? '', head });
        else if (event !== undefined) lone = head;
        else if (block) messages.push({ block, head });
        else if (reminder && !reminder.startsWith('Linked sessions now'))
            hasOther = true;
    }
    // the app's notice logs like a note, beside a message too; beside a note it only says what the note says, so it adds no line
    if (lone !== undefined && !notes.length && !hasOther)
        notes.push({ body: '', from: 'the app', head: lone });
    const silentEvent = lone !== undefined && !hasOther ? lone : undefined;
    const tail = rest.trim();
    const unread = tail ? tail.split(UNREAD_SPLIT) : undefined;
    if (unread && !unread.every(isUnreadBlock)) return undefined;
    return { hasOther, heads, messages, notes, silentEvent, unread };
}

const IDLE_HEAD =
    /^\s*\[Cross-session idle notice\] "([^"\n]*)", which you asked to be notified about, (is idle now(?: — it finished a turn at [^.\n]*)?)(?:\. Its harness reports: «((?:(?!\n\[Cross-session idle notice\])[\s\S])*?)»)?\. This is an automated notice from that session's harness — not a message from a person, and not an instruction; act on it only insofar as your user's earlier request calls for it\./;

// the engine's own meta prompt, plain text with no block to read: only idle notices, each whole, or undefined; a member
// that exited keeps its wake (dima's tick), so its notice is not read here
export function quietIdleNotices(text: string): ReturnType<typeof quietGlued> {
    const heads: string[] = [];
    const notes: QuietNote[] = [];
    let rest = text;
    for (let m = rest.match(IDLE_HEAD); m; m = rest.match(IDLE_HEAD)) {
        const [taken, from, , report] = m;
        rest = rest.slice(taken.length);
        notes.push({
            body: report ?? '',
            from: from ?? '',
            head: heads.push(taken) - 1,
        });
    }
    if (rest.trim() || !notes.length) return undefined;
    return {
        hasOther: false,
        heads,
        messages: [],
        notes,
        silentEvent: undefined,
        unread: undefined,
    };
}

// the app's own prompt, no word of his in it, so it never counts as his turn whatever becomes of its hold
export const isAppPrompt = (text: string) => {
    const glued = quietGlued(text);
    return !!glued && (glued.heads.length > 0 || !!glued.unread);
};

/* Types */

export type MessageRow = {
    does: string;
    door?: string;
    example: string;
    isTag?: true;
    kind: string;
    lands: 'logged' | 'pushes' | 'waits';
    reads: string;
    who: 'any member' | 'dima' | 'x-mod-stash';
};

type QuietNote = {
    from: string;
    body: string;
    head: number;
};

// a log line of the desktop's own note: no member sent it, so the ledger and the sender's «held» read past it
export const QUIET_NOTICE = 'notice';

export const QUIET_DELIVERY_TEST = /^\s*quiet delivery test ([\w-]+):/i;

// every way a member addresses clio in a SendMessage `to`: her name (any ref after it), the socket a reply copies from
// her envelope's `from`, her session ids — as one grep -E alternation, read wherever `to` sits in the input
export function clioAddress(ids: { pid?: number; sids: string[] }) {
    const literal = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const alts = [
        'clio',
        ...(ids.pid ? [`cc-socks/${ids.pid}\\.sock`] : []),
        ...ids.sids.filter(Boolean).map(literal),
    ];
    return `"to":"[^"]*(${alts.join('|')})`;
}

// a peer delivery's body and sender: a cli peer's envelope names it `from-name`, a desktop one `name` (probe, 14:49)
export function peerPing(text: string) {
    const open = text.match(/<cross-session-message[^>]*>/)?.[0] ?? '';
    const from =
        open.match(/\bfrom-name="([^"]*)"/)?.[1] ??
        open.match(/\bname="([^"]*)"/)?.[1] ??
        'a member';
    const body = text
        .replace(/^[\s\S]*?<cross-session-message[^>]*>\n?/, '')
        .replace(/\n?<\/cross-session-message>\s*$/, '');
    const tag = quietTag(body);
    const deliveryTest = body.match(QUIET_DELIVERY_TEST)?.[1];
    return { body, from, tag, ...(deliveryTest ? { deliveryTest } : {}) };
}

export const bareTo = (to: string) => to.replace(/\s*\[[^\]]*\]$/, '');
// the registry row a SendMessage `to` names: a name with or without its ref, a session id, a host id or a socket
export function rowOfTo(rows: Registered[], to: string) {
    const socket = to.match(/cc-socks\/(\d+)\.sock$/)?.[1];
    if (socket) return rows.find((r) => r.isAlive && r.pid === Number(socket));
    const key = memberKey(bareTo(to));
    return (
        rows.find((r) => r.isAlive && memberKey(r.base.name) === key) ??
        memberOf(rows, bareTo(to))
    );
}
