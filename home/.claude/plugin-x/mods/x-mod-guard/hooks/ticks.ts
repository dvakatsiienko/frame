import type { EngineInterface } from 'claude-code';

import { pressTicks } from './rules.ts';

// dima's ticks: x-mod-stash writes them into its own $.state from his 🛎️ press alone, and any plugin reads another's
// value while only its owner writes it — so no Bash, Edit, Write or orbit op can forge one, and it is this session's
// own (FRM-427)
const TICKS = { key: 'ticks', plugin: 'x-mod-stash' } as const;
const SPENT = { key: 'spent', plugin: 'x-mod-guard' } as const;
// a tick counts for 2 h: a yes for this afternoon's push never unlocks tonight's (dima's o2)
const TICK_MS = 2 * 60 * 60 * 1000;
// a tick is spent per use: `scope` names what it authorized (a command, a pr, a sign), so one ask quoting a guarded
// command and a pr carries both once. a use counts only when its command runs: `spends` holds it until `go`, so a later
// rule's refusal leaves dima's word for the retry (three re-ticks on 2026-11-05)
// the ask quotes the whole guarded command in one backtick span, spacing aside, never only a target its refusal names
// (dima's tick on the sixth sense's ask, 2026-10-28: `git push origin main` never unlocks `git push --mirror origin`)
const spaced = (text: string) => text.trim().replace(/\s+/g, ' ');
export const guardedOf = (command: string) =>
    spaced(command.replace(/\s#\s*dima-ok:.*$/, ''));
export const quotesCommand = (command: string) => (t: Tick) =>
    t.targets.some((q) => spaced(q) === guardedOf(command));
// markAt: the time x-mod-stash marked the press's ask, so spending the press spends the mark that stands for it once
// x-herdr-deck prunes the press (12b's live click: his one press ran the brake twice)
export type Tick = {
    id: string;
    text: string;
    targets: string[];
    at: number;
    markAt?: number;
};
// his presses on x-herdr-deck for this session (FRM-544 slice 1, reversing FRM-552's decision 4 on his word): the ticks-write
// rule keeps every seat's tool call out of that folder, so only x-herdr-deck writes it; a file that cannot be read is no tick
async function herdrTicks($: EngineInterface): Promise<Tick[]> {
    const sid = await $.session.id().catch(() => undefined);
    const home = await $.env.get('HOME').catch(() => undefined);
    if (!sid || !home) return [];
    const text = await $.fs
        .read(`${home}/.claude/shelf/orbit-ticks/${sid}.jsonl`)
        .catch(() => '');
    // a press counts only while this session's own orbit, x-mod-stash's owner-written `$.state`, holds that ask with its
    // text and his accepted mark: his take-back on the seat board ends it, and a press a forged store aimed here
    // matches no ask of this seat's that he accepted (wisphunter on 15a31816)
    const { value: orbit } = await $.state
        .get(STASH_ORBIT)
        .catch(() => ({ value: undefined }));
    // a press carrying a pick holds only while the ask still has it: a follow that swaps the pick after his press
    // never moves his tick to the new command (FRM-661)
    const pressed = pressTicks(text).flatMap((t) => {
        const a = orbit?.asks.find(
            (a) =>
                `herdr:${a.id}` === t.id &&
                a.text === t.text &&
                (t.pick === undefined || a.pick === t.pick) &&
                a.mark === 'accepted',
        );
        if (!a) return [];
        return typeof a.markedAt === 'number'
            ? [{ ...t, markAt: a.markedAt }]
            : [t];
    });
    // x-herdr-deck prunes a press from the file once x-mod-stash has taken it, so his next press there drops it: the
    // accepted mark x-mod-stash kept from it stands for the press, at the time it was marked (wing 1's o13, 19:08)
    const marked = (orbit?.asks ?? []).flatMap((a) =>
        a.mark === 'accepted' &&
        a.isHerdrMark &&
        typeof a.markedAt === 'number' &&
        !pressed.some((t) => t.id === `herdr:${a.id}`) &&
        // a press there at or past the mark is read above, or a ↩️ that takes it back (FRM-661: a swapped pick)
        !pressedSince(text, a.id, a.markedAt)
            ? pressTicks(
                  JSON.stringify({
                      at: a.markedAt,
                      id: a.id,
                      pick: a.pick,
                      text: a.text,
                      verdict: 'tick',
                  }),
              )
            : [],
    );
    return [...pressed, ...marked];
}
const pressedSince = (text: string, id: string, at: number) =>
    text.split('\n').some((line) => {
        try {
            const p = JSON.parse(line) as { at?: unknown; id?: unknown };
            return p.id === id && typeof p.at === 'number' && p.at >= at;
        } catch {
            return false;
        }
    });
const STASH_ORBIT = { key: 'orbit', plugin: 'x-mod-stash' } as const;
export async function tickFor(
    $: EngineInterface,
    scopeOf: string | ((tick: Tick) => string),
    covers: (tick: Tick) => boolean,
    spends: string[],
) {
    const scope = (t: Tick) =>
        typeof scopeOf === 'string' ? scopeOf : scopeOf(t);
    const { value: seatTicks = [] } = await $.state
        .get(TICKS)
        .catch(() => ({ value: [] }));
    const ticks = [...seatTicks, ...(await herdrTicks($))];
    const { value: spent = [] } = await $.state.get(SPENT);
    const now = await $.clock.now();
    const keys = (t: Tick) =>
        [t.at, t.markAt]
            .filter((at) => at !== undefined)
            .map((at) => `${t.id}@${at}:${scope(t)}`);
    const tick = [...ticks]
        .reverse()
        .find(
            (t) =>
                now - t.at <= TICK_MS &&
                t.at <= now &&
                covers(t) &&
                !keys(t).some((k) => spent.includes(k) || spends.includes(k)),
        );
    if (tick) spends.push(...keys(tick));
    return tick;
}

const spentAt = (key: string) =>
    Number(key.split('@')[1]?.split(':')[0]) || Number.POSITIVE_INFINITY;
// a spend lives as long as its tick, never a count: the 51st spend once revived the 1st's word
export async function spend($: EngineInterface, spends: string[]) {
    if (!spends.length) return;
    const { value: spent = [] } = await $.state.get(SPENT);
    const now = await $.clock.now();
    await $.state.set(SPENT, [
        ...spent.filter((k) => now - spentAt(k) <= TICK_MS),
        ...spends,
    ]);
}
// a call that failed never spends his word: the retry passes on it
export async function unspend($: EngineInterface, spends: string[]) {
    if (!spends.length) return;
    const { value: held = [] } = await $.state.get(SPENT);
    await $.state.set(
        SPENT,
        held.filter((k) => !spends.includes(k)),
    );
}
