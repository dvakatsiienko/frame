// the lines Claude Code writes into a thread's transcript that dima never typed: a plugin's message (an orbit tick
// arrives as one), a background task's notice, a synthetic «No response requested.»; and the wrappers it puts around
// his own text. the chat folds, hides or shows them, his pick in settings (dima, 20:27: «can system messages be removed
// from my view?»)

/** @typedef {'fold' | 'hide' | 'show'} SystemMode */
/** @typedef {{ label: string, text: string }} SystemLine */

/** @type {[SystemMode, string][]} */
export const SYSTEM_MODES = [
    ['fold', 'Folded'],
    ['hide', 'Hidden'],
    ['show', 'Shown'],
];

const SURFACE_NOTE =
    /\n*This is how Claude Code surfaces a prompt a plugin submits[\s\S]*$/;

/**
 * his own text as he typed it: a paste reads as his plain text, a reminder Claude Code tucked in goes
 * @param {string} text
 */
export const cleanTyped = (text) =>
    text
        .replace(/<system-reminder\b[^>]*>[\s\S]*?<\/system-reminder>/g, '')
        .replace(
            /<pasted_content\b[^>]*>([\s\S]*?)<\/pasted_content\b[^>]*>/g,
            '$1',
        )
        .trim();

/** @param {unknown} content */
const textOf = (content) =>
    typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? content
                .filter((b) => b?.type === 'text')
                .map((b) => b.text)
                .join('\n')
          : '';

/** @param {string} text @param {string} name */
const tagged = (text, name) =>
    new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(text)?.[1]?.trim();

/** @param {string} text */
const firstLine = (text) => text.trim().split('\n')[0].trim().slice(0, 160);

/**
 * the system line a transcript entry is, or null when it is a person's or a model's own
 * @param {any} entry
 * @returns {SystemLine | null}
 */
export function systemLine(entry) {
    if (entry?.type === 'assistant' && entry.message?.model === '<synthetic>') {
        const text = textOf(entry.message.content).trim();
        return { label: text || 'an empty reply', text };
    }
    if (entry?.type !== 'user') return null;
    const kind = entry.origin?.kind;
    const raw = textOf(entry.message?.content);
    if (kind === 'task-notification') {
        const summary = tagged(raw, 'summary') ?? firstLine(raw);
        const status = tagged(raw, 'status');
        return {
            label: `⏱ ${status ? `${status}: ` : ''}${summary}`,
            text: raw.trim(),
        };
    }
    if (kind === 'plugin') {
        const name = entry.origin.name ?? 'a plugin';
        const body = raw
            .replace(/^The \S+ plugin sent a message:\n?/, '')
            .replace(SURFACE_NOTE, '')
            .trim();
        const command = tagged(body, 'command-name');
        return {
            label: `⚙︎ ${name}: ${command ?? firstLine(body)}`,
            text: body,
        };
    }
    return null;
}

/**
 * an entry's blocks with Claude Code's «[Image #n]» markers gone from its text, when the entry holds an image: the
 * image draws as its own chip, so the marker only repeats it; text with no image beside it is left as he typed it
 * @param {any[]} content
 * @returns {any[]}
 */
export function dropImageMarks(content) {
    if (!content.some((b) => b?.type === 'image')) return content;
    return content.map((b) =>
        b?.type === 'text'
            ? { ...b, text: b.text.replace(/\[Image #\d+\]\s*/g, '') }
            : b,
    );
}

/**
 * a prompt he typed while a turn ran, as the user entry it would have been: Claude Code writes it as a queued command
 * attachment, never a user entry (clio's 21:15 prompt drew nowhere); a peer's message or a task notice queued the same
 * way is not his, and stays out
 * @param {any} entry
 * @returns {any}
 */
export function midTurnPrompt(entry) {
    const queued = entry?.type === 'attachment' ? entry.attachment : null;
    if (queued?.type !== 'queued_command' || queued.origin?.kind !== 'human')
        return null;
    return {
        ...entry,
        message: { content: queued.prompt, role: 'user' },
        type: 'user',
    };
}
