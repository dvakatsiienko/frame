// agent ops from transcripts, zero model tokens: tokens and wall time per ticket (coder + verifier), cclio's own code edits per session, boot cost.
// usage: pnpm agent-ops:report [--days 7] [--min-kb 200]
import { createReadStream, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';

const CODE_EXTENSIONS = ['.ts', '.tsx', '.go', '.sh', '.py', '.swift'];
const EDIT_TOOLS = ['Edit', 'Write', 'MultiEdit'];

export function median(values: number[]) {
    if (!values.length) {
        return 0;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    const upper = sorted[mid] ?? 0;
    return sorted.length % 2 ? upper : ((sorted[mid - 1] ?? 0) + upper) / 2;
}

/* parse */

export function parseSession(lines: Iterable<string>, path: string): Session {
    let title = '';
    let firstCmd = '';
    let firstArgs = '';
    let firstPrompt = '';
    let firstPromptTs = 0;
    let cwd = '';
    let firstTs = 0;
    let lastTs = 0;
    const steps = new Map<string, Step>();
    const order: Order = [];
    let codeEdits = 0;

    for (const line of lines) {
        if (!line) {
            continue;
        }
        let entry: Entry;
        try {
            entry = JSON.parse(line) as Entry;
        } catch {
            continue;
        }
        const ts = entry.timestamp ? Date.parse(entry.timestamp) : Number.NaN;
        if (!Number.isNaN(ts)) {
            firstTs ||= ts;
            lastTs = ts;
        }
        if (entry.type === 'custom-title' || entry.type === 'agent-name') {
            title = entry.customTitle ?? entry.agentName ?? title;
        } else if (entry.type === 'user' && !entry.isSidechain) {
            cwd ||= entry.cwd ?? '';
            const content = entry.message?.content;
            const isToolResult =
                Array.isArray(content) &&
                content.some((block) => block.type === 'tool_result');
            const isTask =
                entry.origin?.kind === 'task-notification' ||
                entry.origin?.kind === 'peer' ||
                entry.isMeta;
            if (!isToolResult && !isTask) {
                order.push({ kind: 'user' });
                if (!firstPrompt) {
                    const text =
                        typeof content === 'string'
                            ? content
                            : (content?.find((block) => block.type === 'text')
                                  ?.text ?? '');
                    firstPrompt = text.slice(0, 400);
                    firstPromptTs = Number.isNaN(ts) ? 0 : ts;
                    firstCmd =
                        text.match(/<command-name>\/?([^<]+)</)?.[1] ??
                        text.match(/^\/(\S+)/)?.[1] ??
                        '';
                    firstArgs =
                        text.match(/<command-args>([^<]*)</)?.[1] ??
                        text.match(/^\/\S+\s+(.*)/)?.[1] ??
                        '';
                }
            }
        } else if (entry.type === 'assistant' && !entry.isSidechain) {
            const message = entry.message ?? {};
            const id = message.id ?? entry.uuid ?? '';
            let step = steps.get(id);
            if (!step) {
                step = {
                    end: false,
                    tokens: 0,
                    ts: Number.isNaN(ts) ? 0 : ts,
                };
                steps.set(id, step);
                order.push({ id, kind: 'step' });
            }
            if (message.usage) {
                step.tokens = usageTokens(message.usage);
            }
            for (const block of Array.isArray(message.content)
                ? message.content
                : []) {
                if (block.type === 'tool_use' && block.name) {
                    const filePath = block.input?.file_path;
                    if (
                        EDIT_TOOLS.includes(block.name) &&
                        typeof filePath === 'string' &&
                        CODE_EXTENSIONS.some((ext) => filePath.endsWith(ext))
                    ) {
                        codeEdits++;
                    }
                }
            }
            if (message.stop_reason === 'end_turn') {
                step.end = true;
            }
        }
    }

    const ticket = (title.match(/\b(?:FRM|BYT|DOT)-\d+/) ??
        firstPrompt.match(/\b(?:FRM|BYT|DOT)-\d+/) ?? [''])[0];
    const role = classifyRole({ cwd, firstCmd, path, title });
    const tokens = [...steps.values()].reduce((sum, s) => sum + s.tokens, 0);

    return {
        boot:
            role === 'cclio'
                ? bootCost(order, steps, firstPromptTs, firstCmd, firstArgs)
                : null,
        codeEdits,
        id: path.split('/').pop()?.slice(0, 8) ?? '',
        role,
        steps: steps.size,
        ticket,
        title,
        tokens,
        wallMs: Math.max(0, lastTs - firstTs),
    };
}

function usageTokens(usage: Usage) {
    return (
        (usage.input_tokens ?? 0) +
        (usage.cache_creation_input_tokens ?? 0) +
        (usage.cache_read_input_tokens ?? 0) +
        (usage.output_tokens ?? 0)
    );
}

function classifyRole(args: {
    cwd: string;
    firstCmd: string;
    path: string;
    title: string;
}) {
    const { cwd, firstCmd, path, title } = args;
    if (/🔧/.test(title) || firstCmd === 'x:crew-coder') {
        return 'coder';
    }
    if (/🔎/.test(title) || firstCmd === 'x:crew-verifier') {
        return 'verifier';
    }
    if (/ccrow/i.test(title)) {
        return 'ccrow';
    }
    if (
        (/cclio/i.test(title) && !/ccrow/i.test(title)) ||
        (!title && /\/frame\/cclio$/.test(cwd)) ||
        /\/frame\/cclio(\/|$)/.test(cwd)
    ) {
        return 'cclio';
    }
    if (/🧪|probe/i.test(title) || /probe/.test(path)) {
        return 'probe';
    }
    if (/🔬|adviser|research/i.test(title)) {
        return 'research';
    }
    return 'other';
}

// tokens and seconds from the first prompt to the first assistant end_turn
function bootCost(
    order: Order,
    steps: Map<string, Step>,
    promptTs: number,
    cmd: string,
    args: string,
): Boot | null {
    if (cmd !== 'cclio:boot') {
        return null;
    }
    let tokens = 0;
    for (const entry of order) {
        if (entry.kind === 'user') {
            continue;
        }
        const step = steps.get(entry.id);
        if (!step) {
            continue;
        }
        tokens += step.tokens;
        if (step.end) {
            return {
                kind: args.trim().startsWith('mini') ? 'mini' : 'full',
                seconds: Math.max(0, (step.ts - promptTs) / 1000),
                tokens,
            };
        }
    }
    return null;
}

export function costPerTicket(sessions: Session[]) {
    const byTicket = new Map<string, { tokens: number; wallMs: number }>();
    for (const s of sessions) {
        if (!s.ticket || (s.role !== 'coder' && s.role !== 'verifier')) {
            continue;
        }
        const sum = byTicket.get(s.ticket) ?? { tokens: 0, wallMs: 0 };
        sum.tokens += s.tokens;
        sum.wallMs += s.wallMs;
        byTicket.set(s.ticket, sum);
    }
    return byTicket;
}

/* io */

function findTranscripts(days: number, minKb: number) {
    const root = join(homedir(), '.claude/projects');
    const cutoff = Date.now() - days * 864e5;
    const found: string[] = [];
    for (const dirName of readdirSync(root)) {
        const dir = join(root, dirName);
        let entries: string[];
        try {
            entries = readdirSync(dir);
        } catch {
            continue;
        }
        for (const name of entries) {
            if (!name.endsWith('.jsonl')) {
                continue;
            }
            const stat = statSync(join(dir, name));
            if (stat.mtimeMs >= cutoff && stat.size >= minKb * 1024) {
                found.push(join(dir, name));
            }
        }
    }
    return found;
}

async function scan(path: string) {
    const rl = createInterface({
        crlfDelay: Number.POSITIVE_INFINITY,
        input: createReadStream(path),
    });
    const lines: string[] = [];
    for await (const line of rl) {
        lines.push(line);
    }
    return parseSession(lines, path);
}

const fmtM = (n: number) => `${(n / 1e6).toFixed(1)}M`;
const fmtMin = (ms: number) => `${(ms / 60000).toFixed(1)}min`;

function printReport(sessions: Session[]) {
    console.log(
        '\n== cost per ticket: coder + verifier sessions, tokens = input + cache_creation + cache_read + output per step (deduped by message.id), wall = first to last timestamp ==',
    );
    const costs = [...costPerTicket(sessions)].sort(
        (a, b) => b[1].tokens - a[1].tokens,
    );
    for (const [ticket, c] of costs) {
        console.log(`${ticket}\t${fmtM(c.tokens)} tokens\t${fmtMin(c.wallMs)}`);
    }
    console.log(
        `median over ${costs.length} tickets: ${fmtM(median(costs.map(([, c]) => c.tokens)))} tokens, ${fmtMin(median(costs.map(([, c]) => c.wallMs)))}`,
    );

    console.log(
        `\n== cclio code edits: Edit/Write/MultiEdit on ${CODE_EXTENSIONS.join(' ')}, per cclio session ==`,
    );
    const cclio = sessions.filter((s) => s.role === 'cclio');
    for (const s of cclio.sort((a, b) => b.codeEdits - a.codeEdits)) {
        console.log(`${s.id}\t${s.codeEdits}\t${s.title || '-'}`);
    }
    console.log(
        `median over ${cclio.length} sessions: ${median(cclio.map((s) => s.codeEdits))}`,
    );

    console.log(
        '\n== boot cost: cclio sessions opening with /cclio:boot, first prompt to first end_turn ==',
    );
    for (const kind of ['full', 'mini'] as const) {
        const boots = cclio.flatMap((s) =>
            s.boot?.kind === kind ? [{ id: s.id, ...s.boot }] : [],
        );
        for (const b of boots) {
            console.log(
                `${kind}\t${b.id}\t${fmtM(b.tokens)} tokens\t${Math.round(b.seconds)}s`,
            );
        }
        console.log(
            `${kind} median over ${boots.length}: ${fmtM(median(boots.map((b) => b.tokens)))} tokens, ${Math.round(median(boots.map((b) => b.seconds)))}s`,
        );
    }
}

async function main() {
    const { values } = parseArgs({
        options: {
            days: { default: '7', type: 'string' },
            'min-kb': { default: '200', type: 'string' },
        },
    });
    const days = Number(values.days);
    const minKb = Number(values['min-kb']);
    const sessions: Session[] = [];
    for (const path of findTranscripts(days, minKb)) {
        sessions.push(await scan(path));
    }
    printReport(sessions);
}

if (import.meta.main) {
    await main();
}

/* Types */

type Order = Array<{ kind: 'step'; id: string } | { kind: 'user' }>;

type Usage = {
    input_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    output_tokens?: number;
};

type Block = {
    type?: string;
    text?: string;
    name?: string;
    input?: { file_path?: unknown };
};

type Entry = {
    type?: string;
    timestamp?: string;
    customTitle?: string;
    agentName?: string;
    isSidechain?: boolean;
    isMeta?: boolean;
    cwd?: string;
    uuid?: string;
    origin?: { kind?: string };
    message?: {
        id?: string;
        model?: string;
        stop_reason?: string;
        usage?: Usage;
        content?: string | Block[];
    };
};

type Step = {
    end: boolean;
    tokens: number;
    ts: number;
};

type Boot = { kind: 'full' | 'mini'; seconds: number; tokens: number };

export type Session = {
    boot: Boot | null;
    codeEdits: number;
    id: string;
    role: string;
    steps: number;
    ticket: string;
    title: string;
    tokens: number;
    wallMs: number;
};
