import type { EngineInterface, Register } from 'claude-code';

import { check, message } from './rules.ts';

// guard: every Bash call is read before it runs; a floor command or a hazard shape is refused with its door.
// each refusal and each escape is kept in $.store as one `event:` key; stash's band reads them as 🛡️ lines.

export type GuardEvent = {
    at: number;
    sid: string;
    name?: string;
    command: string;
    kind: 'refused' | 'escaped';
    door: string;
    target: string;
};

const EVENT = 'event:';
const KEEP = 50;
const SHOWN = 160;
const FAILED =
    'guard: the check failed or ran out of time, so this call is refused (fail closed). retry it once; if it repeats, tell cclio';
// a fork carries the whole parent context; the line says what of it the fork needs
const WHY_FORK = /^\s*why-fork:\s*\S/m;
const FORK_DOOR =
    'a fresh agent with a self-contained brief, or chore-helper for a mechanical job';
const FORK_REFUSED = `guard stopped this fork. instead: ${FORK_DOOR}. why: a fork carries the whole parent context (~220k tokens). a fork that truly needs that context says so in a prompt line: why-fork: <what parent context it needs>`;

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
    const value: GuardEvent = {
        ...event,
        at,
        command:
            event.command.length > SHOWN
                ? `${event.command.slice(0, SHOWN)}…`
                : event.command,
        name: await sessionName($, sid),
        sid,
    };
    await $.store.set(`${EVENT}${at}:${sid}`, value);
    const keys = (await $.store.keys()).filter((k) => k.startsWith(EVENT));
    for (const old of keys.slice(0, Math.max(0, keys.length - KEEP)))
        await $.store.delete(old);
}

export const register: Register = (on) => {
    on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
        // the input is the model's: a command that is not a string is the tool's to refuse
        const command = 'command' in e ? e.command : undefined;
        if (typeof command !== 'string') return next(e);
        const verdict = check(command, await $.session.cwd());
        if (verdict.kind === 'run') return next(e);
        if (verdict.kind === 'refused') {
            const { refusal } = verdict;
            await record($, {
                command,
                door: refusal.door,
                kind: 'refused',
                target: refusal.targets[0] ?? '',
            });
            return { deny: message(refusal) };
        }
        await record($, {
            command,
            door: verdict.refusals.map((r) => r.door).join('; '),
            kind: 'escaped',
            target: verdict.targets.join(', '),
        });
        $.ui.log(`guard: ran on dima-ok: ${verdict.targets.join(', ')}`);
        return next(e);
    }).catch(() => ({ deny: FAILED }));

    on('agent.spawn', async ($, e, next) => {
        if (!e.fork || WHY_FORK.test(e.prompt)) return next(e);
        await record($, {
            command: `fork: ${e.description}`,
            door: FORK_DOOR,
            kind: 'refused',
            target: 'why-fork',
        });
        return { deny: FORK_REFUSED };
    }).catch(() => ({ deny: FAILED }));
};
