// reading Claude's question: the AskUserQuestion it waits on, from the transcript, and where its screen is (FRM-638
// slice 7, copied from x-herdr-chatter's question.js); question.js draws the card and presses its keys

/** @typedef {{ label: string, description?: string }} Option */
/** @typedef {{ question: string, header?: string, options: Option[], multiSelect?: boolean }} Question */
/** @typedef {{ id: string, input: { questions?: Question[] }, kind: string, name: string, result?: string }} AskItem */
/** @typedef {{ at: number, cursor: number, done: Set<string>, review: { a: string, q: string }[], ticked: Set<number> }} Where */
/**
 * what the card reads and writes of the chat
 * @typedef {{ address: string, items: AskItem[], screen: string | null, lastAsk: Where | null, askFolded: string | null,
 *   tick: (cx: any) => void, toTerminal: (address: string) => void,
 *   button: (t: any, id: string, label: string, onClick: ((e: any, cx: any) => void) | null, strong?: boolean) => any }} AskView
 */

/** @param {unknown} s */
export const flat = (s) =>
    String(s ?? '')
        .replace(/[│┃]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
export const RECOMMENDED = / \(Recommended\)$/;

// A question's text as context and the question itself: real ones lead with paragraphs of
// background (the user's hook asks for an "ELI5: …" one), and the question is the last paragraph.
/** @param {unknown} text */
export function parts(text) {
    const paras = String(text ?? '')
        .trim()
        .split(/\n\s*\n/);
    return {
        context: paras.slice(0, -1).join('\n\n'),
        question: paras[paras.length - 1] ?? '',
    };
}

// The AskUserQuestion still waiting for its answer, if any.
/** @param {readonly AskItem[]} items @returns {AskItem | null} */
export function pending(items) {
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        if (item?.kind === 'tool' && item.name === 'AskUserQuestion')
            return item.result === undefined ? item : null;
    }
    return null;
}

// Where Claude's question screen is: `at` = the shown question (questions.length = the review
// page), `cursor` = the list position the cursor is on, `ticked` = positions ticked, `done` =
// headers answered. Null when the screen isn't this question's.
/** @param {string | null} screen @param {Question[]} questions @returns {Where | null} */
export function where(screen, questions) {
    if (!screen) return null;
    const lines = screen.split('\n');
    const text = flat(screen);
    const at = /Review your answers/.test(screen)
        ? questions.length
        : questions.findIndex((q) =>
              text.includes(flat(q.question).slice(0, 60)),
          );
    if (at < 0) return null;
    const n = questions[at]?.options?.length ?? 0;
    let cursor = 1;
    const ticked = new Set();
    for (const line of lines) {
        const m = /^\s*❯\s*(\d+)\./.exec(line);
        if (m) cursor = Number(m[1]);
        else if (/^\s*❯\s*Submit\b/.test(line)) cursor = n + 2;
        const box = /^\s*(?:❯\s*)?(\d+)\.\s*\[(.)\]/.exec(line);
        if (box && box[2] !== ' ') ticked.add(Number(box[1]));
    }
    const done = new Set(
        questions
            .filter((q) => q.header && screen.includes(`☒ ${q.header}`))
            .map((q) => /** @type {string} */ (q.header)),
    );
    // The review page's answers: "● question" then "→ answer".
    /** @type {{ a: string, q: string }[]} */
    const review = [];
    if (at === questions.length)
        for (const line of lines) {
            if (/^\s*●/.test(line))
                review.push({ a: '', q: flat(line.replace(/^\s*●/, '')) });
            else if (/^\s*→/.test(line) && review.length) {
                const last = review[review.length - 1];
                if (last) last.a = flat(line.replace(/^\s*→/, ''));
            }
        }
    return { at, cursor, done, review, ticked };
}

// Up/down from the cursor to `to`, then Enter (unless `enter` is false).
/** @param {number} cursor @param {number} to */
export function moves(cursor, to, enter = true) {
    const d = to - cursor;
    return [
        ...Array(Math.abs(d)).fill(d > 0 ? 'down' : 'up'),
        ...(enter ? ['enter'] : []),
    ];
}

/**
 * the question Claude waits on, read off the transcript as it grows: an AskUserQuestion call opens it, any tool result
 * for that call (his answer, or a hook that sent it back) closes it
 */
export function createAskWatch() {
    /** @type {{ id: string, input: any } | null} */
    let open = null;
    return {
        /** @param {readonly string[]} lines whole transcript lines, oldest first */
        add(lines) {
            for (const line of lines) {
                if (!line.includes('AskUserQuestion') && !open) continue;
                let entry;
                try {
                    entry = JSON.parse(line);
                } catch {
                    continue;
                }
                const content = entry?.message?.content;
                for (const b of Array.isArray(content) ? content : []) {
                    if (b?.type === 'tool_use' && b.name === 'AskUserQuestion')
                        open = { id: String(b.id ?? ''), input: b.input ?? {} };
                    else if (
                        b?.type === 'tool_result' &&
                        open &&
                        b.tool_use_id === open.id
                    )
                        open = null;
                }
            }
        },
        /** the card's items: the open question as the copied card reads it, or none */
        items: () =>
            open
                ? [
                      {
                          id: open.id,
                          input: open.input,
                          kind: 'tool',
                          name: 'AskUserQuestion',
                      },
                  ]
                : [],
        reset() {
            open = null;
        },
    };
}

/**
 * the part of a blocked thread's screen that holds its ask: from the rule above the first option down, no blank rows
 * (80 rows: a long question with context and four described options is taller than 40)
 * @param {string} stdout
 */
export function screenTail(stdout) {
    const lines = stdout.replace(/\r/g, '').split('\n');
    let start = Math.max(0, lines.length - 80);
    let first = lines.length - 1;
    while (first > start && !/^\s*(❯\s*)?1\.\s/.test(lines[first] ?? ''))
        first--;
    if (first === start) first = lines.length - 3;
    // not the last rule: a question has another one lower down, above «Chat about this»
    for (let i = first; i > start; i--)
        if (/^\s*[─━]{20,}/.test(lines[i] ?? '')) {
            start = i + 1;
            break;
        }
    return lines
        .slice(start)
        .filter((l) => l.trim())
        .join('\n');
}
