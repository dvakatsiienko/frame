// the quiet gate's words, one source for the hold, the sender's line and the 11-03 replay: pure, no `$`
// flags are regional indicators and a keycap is a digit with its mark: neither is Extended_Pictographic
const EMOJI_RUN = String.raw`^(?:[\s\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\u{E0020}-\u{E007F}\uFE0F\u200D]|[0-9#*]\uFE0F?\u20E3)*`;
const PUSH_TAG = new RegExp(
    String.raw`${EMOJI_RUN}\[(ask|done|escalate|🪜 ?escalate)\]`,
    'u',
);
const PROGRESS_TAG = new RegExp(String.raw`${EMOJI_RUN}\[progress\]`, 'u');
const CODE_SPAN = /`[^`]*`/g;
// a path never counts, nor a line saying there is nothing for him
const FOR_DIMA =
    /(?<![\w/.-])(?<!\bnothing(?:[ \t]+\w+)?[ \t]+)for dima(?![\w/-]|\.\w)/i;
const RULE =
    'send only a question, a finished chunk or a block, led by [ask], [done] or [escalate]; progress stays in your own plan; sw done is the one progress line you still send, held';

const SLIPSTREAMED = "slipstreamed: joins clio's next turn.";
export const QUIET_SLIPSTREAMED = `${SLIPSTREAMED} ${RULE}`;
export const QUIET_PUSHED = `pushed: starts clio's turn. ${RULE}`;
export const QUIET_HELD_LINE = "held, delivered at clio's next turn";
// advising the tag that just held would send them round again
export const quietKindHeld = (kind: string) =>
    `${SLIPSTREAMED} [${kind}] is switched off, so resending changes nothing`;
const REPLY_MS = 30 * 60_000;

export function quietTag(body: string) {
    if (PROGRESS_TAG.test(body)) return 'progress';
    const tag = body.match(PUSH_TAG)?.[1];
    if (!tag) return 'none';
    return tag.endsWith('escalate') ? 'escalate' : tag;
}

// why a message starts a turn by its own words; undefined holds it, unless it answers clio. a kind switched off holds like
// an untagged line, «for dima» still pushes
export function quietPush(body: string, kindsOff: readonly string[] = []) {
    const tag = quietTag(body);
    if (tag !== 'none' && tag !== 'progress' && !kindsOff.includes(tag))
        return 'tag';
    return FOR_DIMA.test(body.replace(CODE_SPAN, '')) ? 'for-dima' : undefined;
}

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

export const QUIET_EVENT_FROM = 'the app';

// one block off the prompt's head; a message may quote a tag mid-line, never at a line's start
const APP_HEAD =
    /^\s*(?:<system-reminder>\n([\s\S]*?)\n<\/system-reminder>|<side-sessions-event>([^<]*)<\/side-sessions-event>|(<cross-session-message[^>]*>(?:(?!\n<\/?cross-session-message)[\s\S])*\n<\/cross-session-message>))/;
const NOTE =
    /^The session "([^"]*)" you started \((local_[^)]*)\) finished a turn(?: \([^)]*\))?\. It reported[^:]*: "([\s\S]*)"( \(first \d+ of \d+ characters\))? Read it with [^"]*$/;

const OPEN = '<cross-session-message';
const CLOSE = '</cross-session-message>';
const UNREAD_SPLIT =
    /(?<=\n<\/cross-session-message>)\s*(?=<cross-session-message)/;

// what the parser left is messages it could not read only with no text outside them, each with one close, its last;
// any doubt reads as his words
const isUnreadBlock = (block: string) =>
    block.startsWith(OPEN) &&
    block.indexOf(CLOSE) === block.length - CLOSE.length;

// the desktop's one `sdk` prompt, block by block: its notes as sender, report and the held text (the report, whether it is
// cut, the session holding the rest), its member messages, each with its place among the blocks, whether another reminder
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
            notes.push({
                body: note[3] ?? '',
                from: note[1] ?? '',
                head,
                held: `${note[3]}${note[4] ?? ''} (session ${note[2]})`,
            });
        else if (event !== undefined) lone = head;
        else if (block) messages.push({ block, head });
        else if (reminder && !reminder.startsWith('Linked sessions now'))
            hasOther = true;
    }
    // the app's notice holds like a note, beside a message too, so a silent end is seen; beside a note it only says what the note says. its own text is written
    // to the turn it arrives in, so what it says never rides a later one
    if (lone !== undefined && !notes.length && !hasOther)
        notes.push({
            body: '',
            from: QUIET_EVENT_FROM,
            head: lone,
            held: 'a side-sessions notice',
        });
    const tail = rest.trim();
    const unread = tail ? tail.split(UNREAD_SPLIT) : undefined;
    if (unread && !unread.every(isUnreadBlock)) return undefined;
    return { hasOther, heads, messages, notes, unread };
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
        const [taken, from, status, report] = m;
        rest = rest.slice(taken.length);
        notes.push({
            body: report ?? '',
            from: from ?? '',
            head: heads.push(taken) - 1,
            held: report || status || '',
        });
    }
    if (rest.trim() || !notes.length) return undefined;
    return { hasOther: false, heads, messages: [], notes, unread: undefined };
}

// the app's own prompt, no word of his in it, so it never counts as his turn whatever becomes of its hold
export const isAppPrompt = (text: string) => {
    const glued = quietGlued(text);
    return !!glued && (glued.heads.length > 0 || !!glued.unread);
};

export const quietHeldText = (body: string) =>
    body.replace(PROGRESS_TAG, '').trim();

/* Types */

type QuietNote = { from: string; body: string; head: number; held: string };
