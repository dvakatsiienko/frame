import { globSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { STATE_DIR, type Usage, pad, tokensIn } from './lib.ts';

const DELTA_MAX_CHARS = 60_000;

export function newestTranscript() {
    const dir = join(
        homedir(),
        '.claude/projects',
        STATE_DIR.replaceAll(/[/.]/g, '-'),
    );
    try {
        return globSync('*.jsonl', { cwd: dir })
            .map((f) => join(dir, f))
            .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
    } catch {}
}

// a terminal turn ends on turn_duration, a desktop tab's on stop_hook_summary (no turn_duration there)
export function readTurn(path: string, marker: string): Run | undefined {
    const entries = readLines(path).flatMap((line) => parseEntry(line) ?? []);
    const start = entries.findIndex(
        (entry) =>
            entry.type === 'user' &&
            JSON.stringify(entry.message?.content ?? '').includes(marker),
    );
    if (start === -1) return;
    const end = entries.findIndex(
        (entry, index) =>
            index > start &&
            entry.type === 'system' &&
            (entry.subtype === 'turn_duration' ||
                entry.subtype === 'stop_hook_summary'),
    );
    if (end === -1) return;
    const usageById = new Map<string, Usage>();
    let model: string | null = null;
    let note = '';
    for (const entry of entries.slice(start + 1, end)) {
        if (entry.type !== 'assistant' || !entry.message) continue;
        model = entry.message.model ?? model;
        usageById.set(entry.message.id ?? '', entry.message.usage ?? {});
        const content = entry.message.content;
        for (const block of typeof content === 'string'
            ? []
            : (content ?? [])) {
            if (block.type === 'text' && block.text?.trim())
                note = block.text.trim();
        }
    }
    const usages = [...usageById.values()];
    return {
        model,
        note: note || 'none',
        seconds: Math.round(
            (entries[end]?.durationMs ??
                Date.parse(entries[end]?.timestamp ?? '') -
                    Date.parse(entries[start]?.timestamp ?? '')) / 1000,
        ),
        tokensIn: usages.reduce((sum, usage) => sum + tokensIn(usage), 0),
        tokensOut: usages.reduce(
            (sum, usage) => sum + (usage.output_tokens ?? 0),
            0,
        ),
    };
}

export function transcriptPathOf(cwd: string, sessionId: string) {
    return join(
        homedir(),
        '.claude/projects',
        cwd.replaceAll(/[/.]/g, '-'),
        `${sessionId}.jsonl`,
    );
}

// a line still being written has no trailing newline yet; leave it for the next read
export function readLines(path: string) {
    const lines = readFileSync(path, 'utf8').split('\n');
    lines.pop();
    return lines.filter((line) => line.trim() !== '');
}

export function parseEntry(line: string): TranscriptEntry | undefined {
    try {
        return JSON.parse(line);
    } catch {}
}

export function textOf(content: TranscriptContent | undefined) {
    if (typeof content === 'string') return content;
    return (content ?? [])
        .filter((block) => block.type === 'text')
        .map((block) => block.text ?? '')
        .join('\n');
}

function queuedText(prompt: TranscriptContent | undefined) {
    if (typeof prompt === 'string') return prompt;
    return (prompt ?? [])
        .map((block) =>
            block.type === 'image' ? '[image]' : (block.text ?? ''),
        )
        .filter(Boolean)
        .join('\n');
}

const NOTIFICATION_MAX_CHARS = 2_000;

// a task-notification carries a subagent's whole report; crow needs its gist and where the rest lives
function capNotifications(text: string) {
    let capped = 0;
    const kept = text.replace(
        /<task-notification>[\s\S]*?<\/task-notification>/g,
        (block) => {
            if (block.length <= NOTIFICATION_MAX_CHARS) return block;
            capped++;
            const file = /<output-file>([^<]*)<\/output-file>/.exec(block)?.[1];
            return `${block.slice(0, NOTIFICATION_MAX_CHARS)} …[cut${file ? `; full: ${file}` : ''}]`;
        },
    );
    return { capped, text: kept };
}

// the cut drops whole blocks from the head, so a packet never opens on an orphan fragment
function lastBlocks(parts: string[]) {
    const kept: string[] = [];
    let size = 0;
    for (const part of parts.toReversed()) {
        if (size + part.length + 2 > DELTA_MAX_CHARS && kept.length > 0) break;
        kept.unshift(part);
        size += part.length + 2;
    }
    const text = kept.join('\n\n');
    const dropped =
        parts.length - kept.length + (text.length > DELTA_MAX_CHARS ? 1 : 0);
    return { dropped, text: text.slice(-DELTA_MAX_CHARS) };
}

// crow times its sends off each block; a block whose entry has no timestamp prints none
function headOf(who: string, timestamp?: string) {
    const at = timestamp ? new Date(timestamp) : undefined;
    return at && !Number.isNaN(at.getTime())
        ? `## ${who} · ${pad(at.getHours())}:${pad(at.getMinutes())}`
        : `## ${who}`;
}

// a compaction can re-append the old chain under its own uuids and stamps, so a line offset alone lets it back in
export function transcriptDelta(lines: string[], fromLine: number) {
    const stepIds = new Set<string>();
    const parts: string[] = [];
    const dimaParts: string[] = [];
    let outputs = 0;
    const seen = new Set(
        lines.slice(0, fromLine).map((line) => parseEntry(line)?.uuid),
    );
    for (const entry of lines.slice(fromLine).map(parseEntry)) {
        if (entry?.uuid) {
            if (seen.has(entry.uuid)) continue;
            seen.add(entry.uuid);
        }
        if (entry && isDimaEntry(entry))
            dimaParts.push(
                `${headOf('dima', entry.timestamp)}\n${dimaTextOf(entry)}`,
            );
        if (entry?.type === 'assistant') {
            if (entry.message?.id) stepIds.add(entry.message.id);
            const text = textOf(entry.message?.content).trim();
            if (text) parts.push(`${headOf('clio', entry.timestamp)}\n${text}`);
        }
        // a message dima types while clio is mid-turn lands as a queued_command attachment, never a user entry
        if (
            entry?.type === 'attachment' &&
            entry.attachment?.type === 'queued_command'
        ) {
            const text = queuedText(entry.attachment.prompt).trim();
            if (text && !text.includes('<cross-session-message'))
                parts.push(`${headOf('dima', entry.timestamp)}\n${text}`);
        }
        // dima's orbit ticks and notes reach clio only as hook context, never as a user entry
        if (
            entry?.type === 'attachment' &&
            entry.attachment?.type === 'hook_additional_context'
        ) {
            const content = entry.attachment.content;
            for (const line of typeof content === 'string'
                ? [content]
                : (content ?? [])) {
                if (line.startsWith('orbit: dima marked'))
                    parts.push(
                        `${headOf('dima', entry.timestamp)}\n${line.trim()}`,
                    );
            }
        }
        if (entry?.type === 'user') {
            const text = textOf(entry.message?.content).trim();
            if (!text) continue;
            const who = entry.origin?.kind === 'peer' ? 'peer' : 'dima';
            if (who === 'dima' && (entry.isMeta || entry.isCompactSummary))
                continue;
            const notified = capNotifications(text);
            outputs += notified.capped;
            parts.push(`${headOf(who, entry.timestamp)}\n${notified.text}`);
        }
    }
    const { dropped, text } = lastBlocks(parts);
    return {
        cut: { blocks: dropped, outputs },
        dimaText: lastBlocks(dimaParts).text,
        steps: stepIds.size,
        text,
    };
}

// what dima himself said in this entry: a typed or queued line, or an orbit tick; a peer, a subagent's notice, a hook's reminder is not him
function dimaTextOf(entry: TranscriptEntry) {
    if (entry.type === 'attachment') {
        if (entry.attachment?.type === 'queued_command') {
            const text = withoutHarness(queuedText(entry.attachment.prompt));
            return text.includes('<cross-session-message') ? '' : text;
        }
        if (entry.attachment?.type !== 'hook_additional_context') return '';
        const content = entry.attachment.content;
        return (typeof content === 'string' ? [content] : (content ?? []))
            .filter((line) => line.startsWith('orbit: dima marked'))
            .join('\n')
            .trim();
    }
    if (entry.type !== 'user' || entry.isMeta || entry.isCompactSummary)
        return '';
    const kind = entry.origin?.kind;
    if (kind && kind !== 'human') return '';
    return withoutHarness(textOf(entry.message?.content));
}

// the harness writes its reminders and notices as user entries, and dima's own words may sit beside them
export function withoutHarness(text: string) {
    return text.replace(HARNESS_TEXT, '').trim();
}

function isDimaEntry(entry: TranscriptEntry) {
    return dimaTextOf(entry) !== '';
}

export function toolCallsOf(entries: (TranscriptEntry | undefined)[]) {
    const calls = new Map<string, ToolCall>();
    for (const entry of entries) {
        const content = entry?.message?.content;
        // cc 2.1.31x also writes `api-request-blob` copies of these blocks
        if (entry?.type !== 'assistant' && entry?.type !== 'user') continue;
        if (!Array.isArray(content)) continue;
        for (const block of content) {
            if (block.type === 'tool_use' && block.id)
                calls.set(block.id, {
                    input: block.input ?? {},
                    name: block.name ?? '?',
                });
            const call = calls.get(block.tool_use_id ?? '');
            if (block.type === 'tool_result' && call) call.result = block;
        }
    }
    return [...calls.values()];
}

export const oneLine = (text: string, max: number) =>
    text.replace(/\s+/g, ' ').trim().slice(0, max);

function resultText(result: ContentBlock | undefined) {
    const content = result?.content;
    return typeof content === 'string' ? content : textOf(content);
}

// a long gate ends `> file 2>&1; echo "exit $?"` (method-silent-failures), so a red one comes back with no error flag
function exitOf({ result }: ToolCall) {
    const text = resultText(result);
    if (result?.is_error) return /^Exit code (\d+)/.exec(text)?.[1] ?? '?';
    return [...text.matchAll(/^exit (\d+)\s*$/gm)].at(-1)?.[1] ?? '0';
}

// a command opens on its `cd … && S=<long path>` and a heredoc ends on the act, so both ends stay
function headAndTail(text: string) {
    return text.length <= COMMAND_MAX_CHARS
        ? text
        : `${text.slice(0, COMMAND_MAX_CHARS / 2)} … ${text.slice(-COMMAND_MAX_CHARS / 2)}`;
}

function receiptLine(call: ToolCall) {
    const { input, name, result } = call;
    const content = result?.content;
    const text = resultText(result);
    const hasImage =
        Array.isArray(content) && content.some((b) => b.type === 'image');
    const exit = result && name === 'Bash' ? exitOf(call) : undefined;
    const status = !result
        ? 'pending'
        : exit
          ? `exit ${exit}`
          : result.is_error
            ? 'error'
            : 'ok';
    const firstError =
        result?.is_error || (exit && exit !== '0')
            ? text
                  .split('\n')
                  .find((l) => l.trim() && !/^(Exit code|exit \d)/.test(l))
            : undefined;
    return [
        `- ${name} ${status}`,
        input.command
            ? headAndTail(oneLine(input.command, input.command.length))
            : oneLine(
                  input.file_path ??
                      input.url ??
                      input.description ??
                      JSON.stringify(input),
                  RECEIPT_MAX_CHARS,
              ),
        hasImage
            ? input.file_path
                ? `[image: ${input.file_path}]`
                : '[image]'
            : '',
        firstError ? oneLine(firstError, RECEIPT_MAX_CHARS) : '',
    ]
        .filter(Boolean)
        .join(' · ');
}

// the receipts beside clio's claims: one line per tool call since dima last spoke; crow reads them and never re-runs one
export function receiptsOf(lines: string[]) {
    const entries = lines.map(parseEntry);
    const start = entries.findLastIndex(
        (entry) => entry !== undefined && isDimaEntry(entry),
    );
    const digest = toolCallsOf(entries.slice(start + 1)).map(receiptLine);
    const dropped = digest.length - RECEIPTS_MAX;
    return [
        ...(dropped > 0 ? [`(${dropped} older calls dropped)`] : []),
        ...digest.slice(-RECEIPTS_MAX),
    ].join('\n');
}

const HARNESS_TEXT =
    /<(system-reminder|task-notification|local-command-\w+)>[\s\S]*?<\/\1>|<task-notification>[\s\S]*$/g;

const RECEIPTS_MAX = 100;

export const RECEIPT_MAX_CHARS = 160;

const COMMAND_MAX_CHARS = 300;

type TranscriptContent = string | ContentBlock[];

interface ContentBlock {
    type: string;
    text?: string;
    id?: string;
    name?: string;
    input?: ToolInput;
    tool_use_id?: string;
    is_error?: boolean;
    content?: TranscriptContent;
}

interface ToolInput {
    command?: string;
    description?: string;
    file_path?: string;
    url?: string;
}

interface ToolCall {
    input: ToolInput;
    name: string;
    result?: ContentBlock;
}

export interface Run {
    model: string | null;
    note: string;
    seconds: number;
    tokensIn: number;
    tokensOut: number;
}

export interface TranscriptEntry {
    type?: string;
    subtype?: string;
    durationMs?: number;
    timestamp?: string;
    uuid?: string;
    isMeta?: boolean;
    isCompactSummary?: boolean;
    origin?: { kind?: string };
    attachment?: {
        type?: string;
        prompt?: TranscriptContent;
        content?: string | string[];
    };
    message?: {
        id?: string;
        model?: string;
        usage?: Usage;
        content?: TranscriptContent;
    };
}
