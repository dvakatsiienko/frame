// clio's siesta gate (FRM-491): the cadence lives in a hook, not in her memory, since under load she skips a nudge
// stop: one ordered list of checks, at most one line a turn · prompt: whose turn it is, and the close · compact: the W1651 marker
// the door clio:siesta writes through: open · card [high…] · high <n> fixed|parked [why]
import { spawnSync } from 'node:child_process';
import {
    appendFileSync,
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    writeFileSync,
} from 'node:fs';
import path from 'node:path';

// flipped to true in one commit, after clio's wishkeeper siesta on FRM-491
const IS_BLOCKING = false;
const FILES_DUE = 15;
// a turn whose prompt opens with one of these is the fleet's, never his; the app prepends reminders to his own prompts
const NOT_DIMA = [
    '<cross-session-message',
    '<side-sessions-event>',
    '<task-notification>',
    '[Cross-session idle notice]',
    '[SYSTEM NOTIFICATION',
    'x-mod-stash waker:',
];
const REMINDER = /<system-reminder>[\s\S]*?<\/system-reminder>/g;
const MEMBER_DONE = /(^|\n)\s*(\[done\]|final\b)/;

export function stop(home: string, input: StopInput, isBlocking = IS_BLOCKING) {
    const state = readSiesta(home);
    if (state.open && isAfk(home) && isSettled(state)) close(state);
    const reasons = state.open ? [] : dueReasons(home, state);
    const isDue = reasons.length > 0;
    if (isDue && !state.due) state.epoch++;
    state.due = isDue;
    const checks: string[] = [];
    const isSiestaNudged = isDue && !loadedSiesta(input.transcript_path);
    if (isSiestaNudged)
        checks.push(`🌤️ siesta due: ${reasons.join(', ')} — load clio:siesta`);
    const ticks = deliveredTicks(home, input.session_id);
    if (ticks.length)
        checks.push(
            `🛎️ delivered tick(s) unresolved: ${ticks.join(' ')} — orbit resolve`,
        );
    // FRM-495: his `?` lines left unanswered · FRM-494: a member-woken turn that printed
    const isBlock =
        isBlocking &&
        isSiestaNudged &&
        !input.stop_hook_active &&
        state.blocked_epoch !== state.epoch;
    if (isBlock) state.blocked_epoch = state.epoch;
    writeSiesta(home, state);
    if (!checks.length) return undefined;
    const line = checks.join('; ');
    return isBlock
        ? ({ decision: 'block', reason: line } as const)
        : {
              hookSpecificOutput: {
                  additionalContext: line,
                  hookEventName: 'Stop' as const,
              },
          };
}

export function prompt(home: string, input: { prompt?: string }) {
    const text = (input.prompt ?? '').replace(REMINDER, '').trim();
    const isDima = text !== '' && !NOT_DIMA.some((m) => text.startsWith(m));
    const state = readSiesta(home);
    state.last_turn = isDima ? 'dima' : 'other';
    if (
        text.startsWith('<cross-session-message') &&
        MEMBER_DONE.test(text.slice(text.indexOf('>') + 1))
    )
        state.pings.push(new Date().toISOString());
    if (
        isDima &&
        state.open &&
        state.card_printed &&
        (!isAfk(home) || isSettled(state))
    )
        close(state);
    writeSiesta(home, state);
}

export function compact(
    home: string,
    input: { session_id?: string; trigger?: string },
) {
    mkdirSync(stateDir(home), { recursive: true });
    appendFileSync(
        path.join(stateDir(home), 'compactions.log'),
        `${new Date().toISOString()} ${input.trigger ?? '-'} ${input.session_id ?? '-'}\n`,
    );
}

function dueReasons(home: string, state: Siesta) {
    const since = siestaLast(home);
    const after = (at: string | number) =>
        new Date(at).getTime() > since.getTime();
    const files = clioFiles(home, since);
    const rows = readLines(path.join(stateDir(home), 'phases-done.jsonl'))
        .map((l) => JSON.parse(l) as { at: string | number })
        .filter((r) => after(r.at));
    const pings = state.pings.filter(after);
    return [
        files >= FILES_DUE ? `${files} files of clio's` : '',
        rows.length ? `${rows.length} phases line(s) done` : '',
        pings.length ? `${pings.length} member done ping(s)` : '',
    ].filter(Boolean);
}

// a path counts once across her commits since the stamp; another agent's and the pocket's auto commits stay out
function clioFiles(home: string, since: Date) {
    const env = Object.fromEntries(
        Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')),
    );
    const log = spawnSync(
        'git',
        [
            '-C',
            path.join(home, 'frame'),
            'log',
            `--since=${since.toISOString()}`,
            '--name-only',
            '--format=%x00%s%x01%(trailers:key=Agent,valueonly,separator=%x2C)',
        ],
        { encoding: 'utf8', env },
    ).stdout;
    const files = new Set(
        (log ?? '')
            .split('\0')
            .map((c) => c.trim().split('\n'))
            .filter(([head = '']) => {
                const [subject = '', agent = ''] = head.split('\x01');
                return (
                    agent.split(' · ')[0]?.trim() === 'clio' &&
                    !subject.endsWith('(auto)')
                );
            })
            .flatMap(([, ...paths]) => paths.filter(Boolean)),
    );
    return files.size;
}

// this turn: the rows after the last prompt that is neither a tool result nor a skill's own text
function loadedSiesta(transcriptPath?: string) {
    const rows = readLines(transcriptPath).map(
        (l) => JSON.parse(l) as TranscriptRow,
    );
    const start = rows.findLastIndex(
        (r) =>
            r.type === 'user' &&
            !r.isMeta &&
            !(
                Array.isArray(r.message?.content) &&
                r.message.content.some((c) => c.type === 'tool_result')
            ),
    );
    const turn = rows.slice(start);
    const opener = turn[0]?.message?.content;
    return (
        (typeof opener === 'string' &&
            opener.includes('<command-name>/clio:siesta')) ||
        turn.some(
            (r) =>
                Array.isArray(r.message?.content) &&
                r.message.content.some(
                    (c) =>
                        c.type === 'tool_use' &&
                        c.name === 'Skill' &&
                        /(^|:)siesta$/.test(c.input?.skill ?? ''),
                ),
        )
    );
}

// x-mod-stash mirrors each session's open asks into its store; `isLocked` is a tick that joined a prompt
function deliveredTicks(home: string, sessionId?: string) {
    const asks = stashStore(home)[`asks:${sessionId}`] as
        | { items?: { id: string; isLocked?: boolean }[] }
        | undefined;
    return (asks?.items ?? []).filter((a) => a.isLocked).map((a) => a.id);
}

function isAfk(home: string) {
    return (stashStore(home).afk as { on?: boolean } | undefined)?.on === true;
}

function stashStore(home: string): Record<string, unknown> {
    const dir = path.join(home, '.claude/plugins/store');
    const file = existsSync(dir)
        ? readdirSync(dir).find((f) => f.startsWith('x-mod-stash_'))
        : undefined;
    return file ? JSON.parse(readFileSync(path.join(dir, file), 'utf8')) : {};
}

function isSettled(state: Siesta) {
    return state.highs.every(
        (h) => h.state === 'fixed' || (h.state === 'parked' && Boolean(h.why)),
    );
}

function close(state: Siesta) {
    state.open = false;
    state.card_printed = false;
    state.highs = [];
}

function stateDir(home: string) {
    return path.join(home, '.local/state/clio');
}

function siestaLast(home: string) {
    const file = path.join(stateDir(home), 'siesta-last');
    if (existsSync(file)) return new Date(readFileSync(file, 'utf8').trim());
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}

function readLines(file?: string) {
    return file && existsSync(file)
        ? readFileSync(file, 'utf8').split('\n').filter(Boolean)
        : [];
}

function readSiesta(home: string): Siesta {
    const file = path.join(stateDir(home), 'siesta.json');
    const kept = existsSync(file)
        ? (JSON.parse(readFileSync(file, 'utf8')) as Partial<Siesta>)
        : {};
    return {
        blocked_epoch: 0,
        card_printed: false,
        due: false,
        epoch: 0,
        highs: [],
        last_turn: 'other',
        open: false,
        pings: [],
        ...kept,
    };
}

function writeSiesta(home: string, state: Siesta) {
    mkdirSync(stateDir(home), { recursive: true });
    writeFileSync(
        path.join(stateDir(home), 'siesta.json'),
        `${JSON.stringify(state, null, 2)}\n`,
    );
}

function door(home: string, [verb, ...args]: string[]) {
    const state = readSiesta(home);
    switch (verb) {
        case 'open': {
            const now = new Date().toLocaleString('sv').replace(' ', 'T');
            mkdirSync(stateDir(home), { recursive: true });
            writeFileSync(path.join(stateDir(home), 'siesta-last'), `${now}\n`);
            Object.assign(state, {
                card_printed: false,
                due: false,
                highs: [],
                open: true,
            });
            break;
        }
        case 'card':
            state.card_printed = true;
            state.highs = args.map((text) => ({ state: 'open', text }));
            break;
        case 'high': {
            const [n = '', mark = '', ...why] = args;
            const high = state.highs[Number(n) - 1];
            if (!high || (mark !== 'fixed' && mark !== 'parked'))
                throw new Error('usage: high <n> fixed|parked [why]');
            high.state = mark;
            if (why.length) high.why = why.join(' ');
            break;
        }
        default:
            throw new Error(
                'usage: siesta-gate.ts stop|prompt|compact (hook json on stdin) | open | card [high…] | high <n> fixed|parked [why]',
            );
    }
    writeSiesta(home, state);
}

if (import.meta.main) {
    const home = process.env.HOME ?? '';
    const [verb = '', ...args] = process.argv.slice(2);
    const hook = () => JSON.parse(readFileSync(0, 'utf8') || '{}');
    if (verb === 'stop') {
        const out = stop(home, hook());
        if (out) console.log(JSON.stringify(out));
    } else if (verb === 'prompt') prompt(home, hook());
    else if (verb === 'compact') compact(home, hook());
    else door(home, [verb, ...args]);
}

/* Types */

type StopInput = {
    session_id?: string;
    stop_hook_active?: boolean;
    transcript_path?: string;
};

type High = { state: 'fixed' | 'open' | 'parked'; text: string; why?: string };

type Siesta = {
    blocked_epoch: number;
    card_printed: boolean;
    due: boolean;
    epoch: number;
    highs: High[];
    last_turn: 'dima' | 'other';
    open: boolean;
    pings: string[];
};

type TranscriptRow = {
    isMeta?: boolean;
    message?: {
        content?:
            | string
            | { input?: { skill?: string }; name?: string; type: string }[];
    };
    type?: string;
};
