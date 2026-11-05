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
    'push only for a lane fully ready, a dispute, an escalation or a roadblock: lead with [ask], [done] or [escalate]';

export const QUIET_SLIPSTREAMED = `slipstreamed: joins clio's next turn. ${RULE}`;
export const QUIET_PUSHED = `pushed: starts clio's turn. ${RULE}`;
export const QUIET_HELD_LINE = "held, delivered at clio's next turn";
const REPLY_MS = 30 * 60_000;

export function quietTag(body: string) {
    if (PROGRESS_TAG.test(body)) return 'progress';
    const tag = body.match(PUSH_TAG)?.[1];
    if (!tag) return 'none';
    return tag.endsWith('escalate') ? 'escalate' : tag;
}

// why a message starts a turn by its own words; undefined holds it, unless it answers clio
export function quietPush(body: string) {
    const tag = quietTag(body);
    if (tag !== 'none' && tag !== 'progress') return 'tag';
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

// one block off the prompt's head; a message ends only where the next block or the prompt does, so a body may quote a tag
const APP_HEAD =
    /^\s*(?:<system-reminder>\n([\s\S]*?)\n<\/system-reminder>|<side-sessions-event>[^<]*<\/side-sessions-event>|(<cross-session-message[^>]*>\n[\s\S]*?\n<\/cross-session-message>)(?=\s*(?:<(?:system-reminder|side-sessions-event|cross-session-message)\b|$)))/;
const NOTE =
    /^The session "([^"]*)" you started \((local_[^)]*)\) finished a turn(?: \([^)]*\))?\. It reported[^:]*: "([\s\S]*)"( \(first \d+ of \d+ characters\))? Read it with [^"]*$/;

// the desktop's one `sdk` prompt: its notes as sender, report and the held text (the report, whether it is cut, the session
// holding the rest), its member messages as their blocks, and whether it holds anything else, which starts a turn by itself
// (the origin is the same as dima's typing, so only the leading blocks' shape tells them apart)
export function quietGlued(text: string) {
    const notes: { block: string; from: string; body: string; held: string }[] =
        [];
    const messages: string[] = [];
    let rest = text;
    let hasOther = false;
    for (let head = rest.match(APP_HEAD); head; head = rest.match(APP_HEAD)) {
        const [taken, reminder, message] = head;
        rest = rest.slice(taken.length);
        const note = reminder?.match(NOTE);
        if (note)
            notes.push({
                block: taken.trimStart(),
                body: note[3] ?? '',
                from: note[1] ?? '',
                held: `${note[3]}${note[4] ?? ''} (session ${note[2]})`,
            });
        else if (message) messages.push(message);
        else if (reminder && !reminder.startsWith('Linked sessions now'))
            hasOther = true;
    }
    return { hasOther: hasOther || !!rest.trim(), messages, notes };
}

export const quietHeldText = (body: string) =>
    body.replace(PROGRESS_TAG, '').trim();
