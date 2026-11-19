import { createHash } from 'node:crypto';
import {
    globSync,
    mkdirSync,
    readFileSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

import {
    MAIN_THREAD,
    NOTES_PATH,
    STATE_DIR,
    type State,
    VERDICTS_PATH,
    charterHash,
    localDay,
    meterLine,
    readCharter,
    threadLabel,
} from './lib.ts';
import { HELD_HEAD, heldUnsent, isHeldDue, ledgerLine } from './notes.ts';
import {
    RECEIPT_MAX_CHARS,
    newestTranscript,
    oneLine,
    parseEntry,
    receiptsOf,
    textOf,
    toolCallsOf,
    type transcriptDelta,
    withoutHarness,
} from './transcript.ts';

// a packet that lost blocks or tool output names the transcript, so crow reads its tail only then
export function cutLine(cut: Cut, transcriptPath: string) {
    if (cut.blocks === 0 && cut.outputs === 0) return '';
    return `cut: ${cut.blocks} older blocks dropped, ${cut.outputs} tool outputs capped · transcript ${transcriptPath}`;
}

export function resolveLeaves(patterns: string[], today: string) {
    const found: string[] = [];
    const missing: string[] = [];
    for (const raw of patterns) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const isLatest = line.startsWith('latest ');
        const pattern = (isLatest ? line.slice('latest '.length) : line)
            .replaceAll('{today}', today)
            .replace(/^~(?=\/)/, homedir());
        const matches = globSync(pattern).filter((path) =>
            statSync(path).isFile(),
        );
        if (matches.length === 0) {
            missing.push(line);
            continue;
        }
        if (isLatest) {
            const newest = matches.toSorted(
                (a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs,
            )[0];
            if (newest) found.push(newest);
            continue;
        }
        found.push(...matches.toSorted());
    }
    return { found, missing };
}

// crow holds a leaf it read earlier in the same transcript; a /clear starts a new one and gets every leaf again
export function leavesToSend(
    paths: string[],
    state: State,
    crowTranscript: string | undefined,
) {
    const known =
        state.leavesFor === crowTranscript ? (state.leafHashes ?? {}) : {};
    const hashes: Record<string, string> = {};
    const changed: string[] = [];
    const unchanged: string[] = [];
    for (const path of paths) {
        hashes[path] = createHash('sha1')
            .update(readFileSync(path))
            .digest('hex');
        (known[path] === hashes[path] ? unchanged : changed).push(path);
    }
    return { changed, hashes, unchanged };
}

export function buildPacket({
    charter,
    cut = '',
    deltaText,
    dir,
    held = [],
    leaves,
    ledger,
    meter,
    missing,
    proposal,
    receipts,
    thread = MAIN_THREAD,
    unchanged = [],
}: PacketInput) {
    mkdirSync(dir, { recursive: true });
    const proposalBlock = proposal
        ? `## proposal · ${proposal}\n\n${readFileSync(proposal, 'utf8').trim()}`
        : '';
    const leafBlocks = leaves.map(
        (path) => `## leaf · ${path}\n\n${readFileSync(path, 'utf8').trim()}`,
    );
    const unchangedNote = unchanged.length
        ? `## leaves unchanged since your last read\n${unchanged.map((path) => `- ${path}`).join('\n')}`
        : '';
    const missingNote = missing.length
        ? `## leaves with no match\n${missing.map((line) => `- ${line}`).join('\n')}`
        : '';
    const body = [
        ...(ledger ? [ledger] : []),
        ...(meter ? [meter] : []),
        ...(charter ? [`## charter changed\n\n${charter}`] : []),
        ...(held.length
            ? [
                  `${HELD_HEAD} · a restart ended it; send each, or drop it with a reason\n\n${held.map((n) => `${n.id}, ${n.at}\n${n.note}`).join('\n\n')}`,
              ]
            : []),
        `# ${threadLabel(thread)} since the last wake\n\n${cut ? `${cut}\n\n` : ''}${deltaText || '(no text)'}`,
        ...(receipts === undefined
            ? []
            : [
                  `## receipts · clio's tool calls since dima's last line\n${receipts || '(none)'}`,
              ]),
        proposalBlock,
        ...leafBlocks,
        unchangedNote,
        missingNote,
    ].filter(Boolean);
    writeFileSync(join(dir, 'packet.md'), `${body.join('\n\n')}\n`);
    return ['packet.md'];
}

// the words of each command in a shell line, quotes honoured, so a merge quoted in a commit message is no merge
function shellCommands(line: string) {
    const commands: string[][] = [];
    let words: string[] = [];
    let word = '';
    let hasWord = false;
    let quote = '';
    const endWord = () => {
        if (hasWord) words.push(word);
        word = '';
        hasWord = false;
    };
    const endCommand = () => {
        endWord();
        if (words.length) commands.push(words);
        words = [];
    };
    for (let i = 0; i < line.length; i++) {
        const char = line[i] ?? '';
        if (quote) {
            if (char === quote) quote = '';
            else if (char === '\\' && quote === '"') word += line[++i] ?? '';
            else word += char;
        } else if (char === '"' || char === "'") {
            quote = char;
            hasWord = true;
        } else if (char === '\\') {
            word += line[++i] ?? '';
            hasWord = true;
        } else if (/[;|&\n()]/.test(char)) {
            endCommand();
        } else if (/\s/.test(char)) {
            endWord();
        } else {
            word += char;
            hasWord = true;
        }
    }
    endCommand();
    return commands;
}

// a script that sends to a paid api says so in its source, so no list of scripts drifts
function isPaidSource(path: string, cwd: string) {
    try {
        return PAID_SOURCE.test(
            readFileSync(
                resolve(cwd, path.replace(/^~(?=\/)/, homedir())),
                'utf8',
            ),
        );
    } catch {
        return false;
    }
}

function isPaidPnpmVerb(words: string[], cwd: string) {
    let dir = cwd;
    let verb: string | undefined;
    for (let i = 1; i < words.length && !verb; i++) {
        const word = words[i] ?? '';
        if (word === '-C' || word === '--dir')
            dir = resolve(
                cwd,
                (words[++i] ?? '').replace(/^~(?=\/)/, homedir()),
            );
        else if (!word.startsWith('-') && word !== 'run') verb = word;
    }
    try {
        const script: unknown = JSON.parse(
            readFileSync(join(dir, 'package.json'), 'utf8'),
        ).scripts?.[verb ?? ''];
        return typeof script === 'string'
            ? isPaidCall(script.split(/\s+/), dir, [])
            : false;
    } catch {
        return false;
    }
}

function isPaidCall(words: string[], cwd: string, bodies: string[]): boolean {
    const [head = ''] = words;
    if (NETWORK_TOOL.test(head)) return words.some((w) => PAID_URL.test(w));
    if (head === 'pnpm') return isPaidPnpmVerb(words, cwd);
    if (!SCRIPT_RUNNER.test(head)) return false;
    const args = words.slice(1);
    return (
        args.join(' ').match(PAID_VERB) !== null ||
        args.some((word) =>
            word.startsWith('<<')
                ? bodies.some((body) => PAID_SOURCE.test(body))
                : PAID_SOURCE.test(word) ||
                  (SCRIPT_FILE.test(word) && isPaidSource(word, cwd)),
        )
    );
}

// a heredoc's body is data unless its command reads it, so it never splits into commands of its own
function splitHeredocs(line: string) {
    const bodies: string[] = [];
    const kept: string[] = [];
    const lines = line.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const row = lines[i] ?? '';
        kept.push(row);
        const delimiter = /<<-?\s*['"]?(\w+)['"]?/.exec(row)?.[1];
        const end = delimiter
            ? lines.findIndex((l, at) => at > i && l.trim() === delimiter)
            : -1;
        if (end === -1) continue;
        bodies.push(lines.slice(i + 1, end).join('\n'));
        i = end;
    }
    return { bodies, script: kept.join('\n') };
}

// `op-run.sh`, `env` and `sh -c '…'` run the real command, so the real command is the one judged
function realCommands(script: string): string[][] {
    return shellCommands(script).flatMap((command) => {
        let words = command.slice(command.findIndex((w) => !/^\w+=/.test(w)));
        while (WRAPPER.test(words[0] ?? '')) {
            words = words.slice(1);
            words = words.slice(words.findIndex((w) => !/^\w+=/.test(w)));
        }
        return SHELL.test(words[0] ?? '') && words[1] === '-c'
            ? realCommands(words[2] ?? '')
            : [words];
    });
}

// a merge, a paid call and a console write wait for crow's note; a spawn, a post and a close wake it and run on
export function decisionOf(
    line: string,
    cwd = process.cwd(),
): Decision | undefined {
    const what = oneLine(line, RECEIPT_MAX_CHARS);
    const { bodies, script } = splitHeredocs(line);
    let dir = cwd;
    for (const words of realCommands(script)) {
        if (words[0] === 'cd' && words[1])
            dir = resolve(dir, words[1].replace(/^~(?=\/)/, homedir()));
        const [head, verb, act] = words;
        if (head === 'gh' && verb === 'pr' && act === 'merge')
            return { args: words.slice(3), cwd: dir, kind: 'merge' };
        // a merge goes through x since FRM-427, often behind a `timeout N`; with no --apply it only plans
        const at = words[0] === 'timeout' ? 2 : 0;
        if (
            words[at] === 'x' &&
            words[at + 1] === 'lane' &&
            words[at + 2] === 'merge-auto' &&
            words.includes('--apply') &&
            // an --override-off/--override-on call names no pr, so it merges nothing
            mergeSelectors(words.slice(at + 3)).selector
        )
            return { args: words.slice(at + 3), cwd: dir, kind: 'merge' };
        if (head === 'claude' && words.includes('--bg'))
            return { kind: 'spawn' };
        if (isPaidCall(words, dir, bodies)) return { kind: 'paid', what };
        if (
            head === 'gh' &&
            (verb === 'pr' || verb === 'issue') &&
            (act === 'create' || act === 'comment')
        )
            return { kind: 'post', what: `gh ${verb} ${act}` };
        if (head === 'slk' && (verb === 'send' || verb === 's'))
            return { kind: 'post', what: 'slk send' };
        if (head === 'himalaya' && words.includes('send'))
            return { kind: 'post', what: 'himalaya send' };
        if (head === 'x' && verb === 'linear' && act === 'set') {
            const flag = words.findIndex((w) => /^--state(=|$)/.test(w));
            const state =
                words[flag]?.split('=')[1] ??
                (flag >= 0 ? words[flag + 1] : undefined);
            if (/^(done|canceled)$/i.test(state ?? ''))
                return { kind: 'close', what: words[3] ?? '?' };
        }
    }
}

// a click has no url of its own, so it counts on the page clio last navigated to
export function consoleOf(
    tool: string | undefined,
    input: { url?: string; action?: string } | undefined,
    lines: () => string[],
): Decision | undefined {
    if (!tool || !BROWSER_ACT.test(tool)) return;
    if (input?.action && BROWSER_READ.has(input.action)) return;
    const url =
        input?.url ??
        toolCallsOf(lines().map(parseEntry)).findLast(
            (call) => call.name.endsWith('__navigate') && call.input.url,
        )?.input.url;
    return url && CONSOLE_URL.test(url) ? { kind: 'console', url } : undefined;
}

const PAID_URL =
    /api\.(anthropic|openai)\.com|\/messages\/batches|\/v1\/batches/;

const PAID_SOURCE =
    /(?:from|import|require\()\s*['"]@anthropic-ai\/sdk|^\s*(?:import|from)\s+anthropic\b|['"`]https:\/\/api\.anthropic\.com\/v1\//m;

// the $54 batch of 2026-11-03: `script/op-run.sh python3 -I <scratch>/retro/batch.py submit`, its script gone with the scratch
const PAID_VERB = /\bbatch\.py\s+submit\b/;

const SCRIPT_RUNNER = /(^|\/)(node|python3?|bun|tsx|deno)$/;

const SCRIPT_FILE = /\.(c|m)?(js|ts)$|\.py$/;

const NETWORK_TOOL = /^(curl|wget|xh)$/;

const WRAPPER = /(^|\/)(op-run\.sh|env|time|exec|nohup)$/;

const SHELL = /(^|\/)(sh|bash|zsh)$/;

const BROWSER_ACT =
    /^mcp__(Claude_Browser|claude-in-chrome)__(navigate|computer|form_input)$/;

const BROWSER_READ = new Set(['screenshot', 'wait', 'scroll', 'zoom', 'hover']);

const CONSOLE_URL =
    /console\.anthropic\.com|platform\.claude\.com|\/billing(\/|\b)/i;

// a proposal clio writes for dima wakes crow before he ticks it; any other write is no decision
export function proposalOf(
    tool: string | undefined,
    path: string | undefined,
    command?: string,
    cwd?: string,
): Decision | undefined {
    // a relative file_path stands where the call's cwd stands; the packet reads the file from the hook's own cwd
    if ((tool === 'Write' || tool === 'Edit') && path && PROPOSAL.test(path))
        return { kind: 'proposal', path: cwd ? resolve(cwd, path) : path };
    // a heredoc or tee writes the proposal from Bash: its target follows the redirect
    if (tool === 'Bash' && command) {
        const target = [
            ...command.matchAll(
                /(?:>>?|\btee(?: -a)?)\s*["']?([^\s"';&|<>]+)/g,
            ),
        ]
            .map((match) => match[1] ?? '')
            .find((candidate) => PROPOSAL.test(candidate));
        // a relative target lands where the command's leading `cd` (else the hook's cwd) stands
        const cd = /^\s*cd\s+["']?([^\s"';&|]+)["']?\s*(?:&&|;)/.exec(
            command,
        )?.[1];
        const home = (p: string) => p.replace(/^~(?=\/|$)/, homedir());
        const base = cd ? resolve(cwd ?? '.', home(cd)) : cwd;
        if (target)
            return {
                kind: 'proposal',
                path: base ? resolve(base, home(target)) : home(target),
            };
    }
}

const PROPOSAL = /(^|\/)\.scratch\/(.+\/)?[^/]+-proposal\.md$/;

// a turn starts at a user entry with text (a prompt or a peer's message); a tool result carries none
export function turnStartOf(lines: string[]) {
    for (let i = lines.length - 1; i >= 0; i--) {
        const entry = parseEntry(lines[i] ?? '');
        if (
            entry?.type === 'user' &&
            !entry.isMeta &&
            withoutHarness(textOf(entry.message?.content))
        )
            return i;
    }
    return -1;
}

const MERGE_VALUE_FLAGS = new Set([
    '-A',
    '--author-email',
    '-b',
    '--body',
    '-F',
    '--body-file',
    '--match-head-commit',
    '-R',
    '--repo',
    '-t',
    '--subject',
]);

// `gh pr view` takes the same selector and repo the merge was given
export function prViewArgs(mergeArgs: string[]) {
    const { repo, selector } = mergeSelectors(mergeArgs);
    return [
        'pr',
        'view',
        ...(selector ? [selector] : []),
        ...(repo ? ['--repo', repo] : []),
        '--json',
        'number,headRefOid,url',
    ];
}

// a redirect (`2>`, `>>`, `&>`, `2>/dev/null`) is no pr; a bare one takes the next word as its file
const REDIRECT = /^(\d*|&)>>?/;

function mergeSelectors(mergeArgs: string[]) {
    let selector: string | undefined;
    let repo: string | undefined;
    for (let i = 0; i < mergeArgs.length; i++) {
        const arg = mergeArgs[i] ?? '';
        if (REDIRECT.test(arg)) {
            if (/^(\d*|&)>>?$/.test(arg)) i++;
            continue;
        }
        const [flag = '', inline] = arg.split(/=(.*)/s);
        const value = inline ?? mergeArgs[i + 1];
        if (flag === '-R' || flag === '--repo') repo = value;
        if (MERGE_VALUE_FLAGS.has(flag) && inline === undefined) i++;
        else if (!arg.startsWith('-')) selector ??= arg;
    }
    return { repo, selector };
}

const VERIFIED_PATH = join(homedir(), '.claude/shelf/pr-verified.json');

// written by sixth sense on clean (`watch-pr.sh --verified`), keyed `owner/repo#n`
export function verifiedHead(key: string) {
    try {
        const sha: unknown = JSON.parse(readFileSync(VERIFIED_PATH, 'utf8'))[
            key
        ];
        return typeof sha === 'string' && sha ? sha : undefined;
    } catch {}
}

// one packet for any wake: the delta since the last one, plus the leaves changed since crow last read them
export function packWake({
    delta,
    lines,
    now,
    proposal,
    state,
    thread = MAIN_THREAD,
    transcriptPath,
    wakeId,
}: PackInput) {
    let leafPatterns: string[] = [];
    try {
        leafPatterns = readFileSync(
            join(STATE_DIR, 'leaves.txt'),
            'utf8',
        ).split('\n');
    } catch {}
    const leaves = resolveLeaves(leafPatterns, localDay(now));
    const crowTranscript = newestTranscript();
    const toSend = leavesToSend(leaves.found, state, crowTranscript);
    const hash = charterHash();
    const charter =
        state.charterHash && state.charterHash !== hash
            ? readCharter()
            : undefined;
    const receipts = receiptsOf(lines);
    const files = buildPacket({
        charter,
        cut: cutLine(delta.cut, transcriptPath),
        deltaText: delta.text,
        dir: join(STATE_DIR, 'packets', wakeId),
        held: isHeldDue(state, crowTranscript, thread)
            ? heldUnsent(now, NOTES_PATH, thread)
            : [],
        leaves: toSend.changed,
        ledger: ledgerLine(now, NOTES_PATH, VERDICTS_PATH, thread),
        meter: meterLine(now),
        missing: leaves.missing,
        proposal,
        receipts,
        thread,
        unchanged: toSend.unchanged,
    });
    return {
        files,
        missing: leaves.missing,
        state: {
            ...state,
            charterHash: hash,
            leafHashes: toSend.hashes,
            leavesFor: crowTranscript,
            offsets: { ...state.offsets, [transcriptPath]: lines.length },
        } satisfies State,
    };
}

export type Decision =
    | { kind: 'merge'; args: string[]; cwd: string }
    | { kind: 'spawn' }
    | { kind: 'proposal'; path: string }
    | { kind: 'paid' | 'post' | 'close'; what: string }
    | { kind: 'console'; url: string };

interface PackInput {
    delta: ReturnType<typeof transcriptDelta>;
    lines: string[];
    now: Date;
    proposal?: string;
    state: State;
    thread?: string;
    transcriptPath: string;
    wakeId: string;
}

export interface Cut {
    blocks: number;
    outputs: number;
}

interface PacketInput {
    held?: { at: string; id: string; note: string }[];
    charter?: string;
    receipts?: string;
    cut?: string;
    dir: string;
    leaves: string[];
    unchanged?: string[];
    missing: string[];
    proposal?: string;
    ledger?: string;
    meter?: string;
    thread?: string;
    deltaText: string;
}
