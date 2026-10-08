import type { EngineInterface, Register } from 'claude-code';

import {
    type Brief,
    type Context,
    addedPaths,
    briefPaths,
    check,
    message,
    overwrittenPaths,
    rewrite,
} from './rules.ts';

// x-mod-guard: every Bash call is read before it runs; a floor command or a hazard shape is refused with its door.
// each refusal and each escape is kept in $.store as one `event:` key; x-mod-stash's band reads them as 🛡️ lines.

export type GuardEvent = {
    at: number;
    sid: string;
    name?: string;
    command: string;
    kind: 'refused' | 'escaped';
    door: string;
    target: string;
    // why it was refused, the line x-mod-stash shows unfolded; an escape names every rule it stepped past
    why: string;
    // the rule that fired; an escape names every rule it stepped past, comma-joined
    rule: string;
};

type Tally = { refused: number; escaped: number };
// rules: the same tally split by the rule that fired, so noise and real catches separate
export type DayCount = Tally & { rules?: Record<string, Tally> };

const EVENT = 'event:';
const KEEP = 50;
const DAY = 'day:';
const DAYS = 30;
const SHOWN = 160;
// a cclio session's own code edits: the 8th gets one note that a bigger job belongs to a helper
const CODE_FILE = /\.(ts|tsx|go|sh|py|swift)$/;
const EDITS = 'edits:';
const EDIT_LIMIT = 8;
const DELEGATE_NOTE =
    "x-mod-guard: 8 code edits in this cclio session — a bigger job goes to a helper (~137k base) instead of this thread's context";
const FAILED =
    'x-mod-guard: the check failed or ran out of time, so this call is refused (fail closed). retry it once; if it repeats, tell cclio';
// a fork carries the whole parent context; the line says what of it the fork needs
const WHY_FORK = /^\s*why-fork:\s*\S/m;
const FORK_DOOR =
    'a fresh agent with a self-contained brief, or chore-helper for a mechanical job';
const FORK_WHY = 'a fork carries the whole parent context (~220k tokens)';
const FORK_REFUSED = `x-mod-guard stopped this fork. instead: ${FORK_DOOR}. why: ${FORK_WHY}. a fork that truly needs that context says so in a prompt line: why-fork: <what parent context it needs>`;

// what x brief check stamps: sha256 over the file's raw bytes, under $X_STATE or ~/.local/state/x (x/go/brief.go)
async function readBrief(
    $: EngineInterface,
    path: string,
    home: string | undefined,
): Promise<Brief> {
    const { base64 } = await $.fs.read(path, { as: 'bytes' });
    const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
    const sum = [
        ...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    ]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    const state = (await $.env.get('X_STATE')) || `${home}/.local/state/x`;
    return {
        isCoder: new TextDecoder().decode(bytes).includes('/x:crew-coder'),
        isStamped: await $.fs.exists(`${state}/briefs/${sum}.json`),
    };
}

// the name ListAgents shows, from cc's session registry
async function sessionName($: EngineInterface, sid: string) {
    const dir = `${await $.env.get('HOME')}/.claude/sessions`;
    for (const f of await $.fs.list(dir).catch(() => [])) {
        if (!f.name.endsWith('.json')) continue;
        const raw = await $.fs.read(`${dir}/${f.name}`).catch(() => '');
        if (!raw.includes(sid)) continue;
        try {
            const v = JSON.parse(raw) as {
                sessionId?: unknown;
                name?: unknown;
            };
            if (v.sessionId === sid && typeof v.name === 'string')
                return v.name;
        } catch {}
    }
    return undefined;
}

// one key per event, so parallel sessions never overwrite each other; the oldest past KEEP are dropped
async function record(
    $: EngineInterface,
    event: Omit<GuardEvent, 'at' | 'sid' | 'name'>,
) {
    const sid = await $.session.id();
    const at = await $.clock.now();
    // one line on the band, whatever the command's shape
    const line = event.command.replace(/\s+/g, ' ').trim();
    const value: GuardEvent = {
        ...event,
        at,
        command: line.length > SHOWN ? `${line.slice(0, SHOWN)}…` : line,
        name: await sessionName($, sid),
        sid,
    };
    await $.store.set(`${EVENT}${at}:${sid}`, value);
    const keys = await $.store.keys();
    const events = keys.filter((k) => k.startsWith(EVENT));
    for (const old of events.slice(0, Math.max(0, events.length - KEEP)))
        await $.store.delete(old);
    await count($, keys, at, sid, event).catch(() => undefined);
}

const tally = (was: Tally | undefined, kind: GuardEvent['kind']): Tally => ({
    escaped: (was?.escaped ?? 0) + (kind === 'escaped' ? 1 : 0),
    refused: (was?.refused ?? 0) + (kind === 'refused' ? 1 : 0),
});

// the local day, `yyyy-mm-dd`
function day(at: number) {
    const d = new Date(at);
    const two = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

// one `day:<yyyy-mm-dd>:<session>` key per session a day, so a halt counts the whole day past the KEEP kept events; a count past DAYS is dropped
async function count(
    $: EngineInterface,
    keys: string[],
    at: number,
    sid: string,
    { kind, rule }: Pick<GuardEvent, 'kind' | 'rule'>,
) {
    const key = `${DAY}${day(at)}:${sid}`;
    const was = (await $.store.get(key)) as DayCount | undefined;
    const rules = { ...was?.rules };
    for (const r of new Set(rule.split(', '))) rules[r] = tally(rules[r], kind);
    await $.store.set(key, {
        ...tally(was, kind),
        rules,
    } satisfies DayCount);
    const oldest = `${DAY}${day(at - DAYS * 86_400_000)}`;
    for (const old of keys)
        if (old.startsWith(DAY) && old < oldest) await $.store.delete(old);
}

export const register: Register = (on) => {
    // a Monitor's command is a shell command too
    on('tool.call', { tool: /^(Bash|Monitor)$/ }, async ($, e, next) => {
        // the input is the model's: a command that is not a string is the tool's to refuse
        if (e.tool !== 'Bash' && e.tool !== 'Monitor') return next(e);
        const typed = e.command;
        if (typeof typed !== 'string') return next(e);
        // a shape with one right spelling is fixed, then the fixed command is what every rule reads
        const { command, notes } = rewrite(typed);
        const cwd = await $.session.cwd();
        const ctx: Context = {
            home: await $.env.get('HOME'),
            jobDir: await $.env.get('CLAUDE_JOB_DIR'),
        };
        const missing = new Set<string>();
        for (const path of addedPaths(command, cwd, ctx))
            if (!(await $.fs.exists(path))) missing.add(path);
        const kinds: NonNullable<Context['kinds']> = new Map();
        for (const path of overwrittenPaths(command, cwd, ctx))
            if (await $.fs.exists(path))
                kinds.set(path, (await $.fs.stat(path)).kind);
        const briefs = new Map<string, Brief>();
        for (const path of briefPaths(command, cwd, ctx))
            if (await $.fs.exists(path))
                briefs.set(path, await readBrief($, path, ctx.home));
        const verdict = check(command, cwd, {
            ...ctx,
            briefs,
            kinds,
            missing,
        });
        // the model typed the old command: it is told what changed, or it reads a surprise
        const go = async () => {
            if (!notes.length) return next(e);
            const result = await next({ ...e, command });
            if (result.deny !== undefined) return result;
            const note = `x-mod-guard rewrote this call before it ran: ${notes.join('; ')}. it ran: ${command}`;
            return { ...result, context: [...(result.context ?? []), note] };
        };
        if (verdict.kind === 'run') return go();
        if (verdict.kind === 'refused') {
            const { refusal } = verdict;
            await record($, {
                command,
                door: refusal.door,
                kind: 'refused',
                rule: refusal.rule,
                target: refusal.targets[0] ?? '',
                why: refusal.why,
            });
            return { deny: message(refusal) };
        }
        await record($, {
            command,
            door: verdict.refusals.map((r) => r.door).join('; '),
            kind: 'escaped',
            rule: [...new Set(verdict.refusals.map((r) => r.rule))].join(', '),
            target: verdict.targets.join(', '),
            why: verdict.refusals.map((r) => r.why).join('; '),
        });
        $.ui.log(`x-mod-guard: ran on dima-ok: ${verdict.targets.join(', ')}`);
        return go();
    }).catch(() => ({ deny: FAILED }));

    on(
        'tool.call',
        { tool: /^(Edit|Write|MultiEdit)$/ },
        async ($, e, next) => {
            const result = await next(e);
            const path = 'file_path' in e ? e.file_path : undefined;
            if (
                result.deny !== undefined ||
                typeof path !== 'string' ||
                !CODE_FILE.test(path)
            )
                return result;
            try {
                const home = await $.env.get('HOME');
                const cwd = await $.session.cwd();
                const root = `${home}/frame/cclio`;
                if (cwd !== root && !cwd.startsWith(`${root}/`)) return result;
                const key = EDITS + (await $.session.id());
                const n =
                    (((await $.store.get(key)) as number | undefined) ?? 0) + 1;
                await $.store.set(key, n);
                if (n !== EDIT_LIMIT) return result;
                return {
                    ...result,
                    context: [...(result.context ?? []), DELEGATE_NOTE],
                };
            } catch {
                return result;
            }
        },
    );

    on('agent.spawn', async ($, e, next) => {
        if (!e.fork || WHY_FORK.test(e.prompt)) return next(e);
        await record($, {
            command: `fork: ${e.description}`,
            door: FORK_DOOR,
            kind: 'refused',
            rule: 'fork',
            target: 'why-fork',
            why: FORK_WHY,
        });
        return { deny: FORK_REFUSED };
    }).catch(() => ({ deny: FAILED }));
};
