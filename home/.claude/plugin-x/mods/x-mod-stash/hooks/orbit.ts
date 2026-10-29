// orbit's rules as pure steps over one session's orbit: the tool's ops, dima's marks joining a turn, the turn's end.
// register.tsx owns every $ call: it reads the orbit from $.state, applies a step here, and saves the result.
import type {
    OrbitAsk,
    OrbitAssumption,
    StashOrbit,
    StashPlan,
} from '../types/stash.d.ts';

export const ORBIT_TOOL = 'mcp__x-mod-stash__orbit';
export const PLAN_MAX = 7;
// a followed-up ask's mark, before its id so the text keeps the full width — a try, dima may swap the glyph (o6)
export const CHANGED_MARK = '🆕';
// an ask, a follow-up or a phase reads at a glance in the narrow board (dima's o60, 22:13)
export const ORBIT_TEXT_MAX = 90;
// at most this many assumptions a turn, and on the board at once (FRM-382 exit 2: under one a turn on average)
export const ASSUMED_MAX = 3;
// an ask's one link: an https url, an obsidian:// url, or an absolute or home path to a file, spaces allowed in the
// path (an iCloud vault lives under «Mobile Documents»; FRM-426 rider)
export const ASK_LINK = /^(?:https:\/\/\S+|obsidian:\/\/\S+|(?:\/|~\/).+)$/;
// the label a non-https link draws: a path's file name, an obsidian url's note
export function linkLabel(target: string) {
    if (target.startsWith('obsidian://')) {
        const file = target.match(/[?&]file=([^&]+)/)?.[1];
        // a stray % in the url must not throw into the board's draw
        let decoded = file;
        try {
            decoded = file ? decodeURIComponent(file) : undefined;
        } catch {}
        return decoded?.split('/').filter(Boolean).pop() ?? 'obsidian';
    }
    return target.split('/').filter(Boolean).pop() ?? target;
}
export const ASSUMED_TURNS = 3;

export const oneLine = (v: unknown) =>
    typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
const idsOf = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

// a marked ask no turn has taken yet
export const isFresh = (a: OrbitAsk) =>
    Boolean(a.mark) && !a.isLocked && !a.isResolved;

// PK-88: a tick or replay waits SEND_MS in a reversible «sending» state before a turn may take it
export const SEND_MS = 5000;
export const isSending = (
    a: { mark?: unknown; sendAt?: number },
    now: number,
) => Boolean(a.mark) && a.sendAt !== undefined && now < a.sendAt;
// a fresh mark whose sending window has passed
export const isDue = (now: number) => (a: OrbitAsk) =>
    isFresh(a) && !isSending(a, now);

// a text kept under the fields' old name, «note», before the steer rename (dima's o57, 17:39): read once as its steer
export function steered<T extends { steer?: string }>(x: T): T {
    if (!('note' in x)) return x;
    const { note, ...rest } = x as T & { note?: unknown };
    return (
        typeof note === 'string' && rest.steer === undefined
            ? { ...rest, steer: note }
            : rest
    ) as T;
}

// an orbit kept before the 🐠 catch shelf left (dima, 2026-10-28) drops its pieces at the load
export const steeredOrbit = (kept: StashOrbit): StashOrbit => {
    const { caught: _, ...o } = kept as StashOrbit & { caught?: unknown };
    return {
        ...o,
        asks: o.asks.map(steered),
        ...(o.assumed ? { assumed: o.assumed.map(steered) } : {}),
    };
};

// a steer the turn carried has gone out: its field clears for the next one, so a second tick never resends it
const unsteer = <T extends { steer?: string }>(x: T): T => {
    const { steer: _, ...rest } = x;
    return rest as T;
};

// the asks a turn takes are locked to it until it ends; a remote mark's wake time is spent
export function lockJoined(o: StashOrbit, asks: OrbitAsk[]): StashOrbit {
    const ids = new Set(asks.map((a) => a.id));
    return {
        ...o,
        asks: o.asks.map((a) =>
            ids.has(a.id)
                ? {
                      ...a,
                      isLocked: true,
                      markedAt: undefined,
                      sendAt: undefined,
                  }
                : a,
        ),
    };
}

// the turn's answers leave, one with a closing word drawn dim one turn more; a marked ask it never resolved unlocks
// with its mark spent, so the tick reached the model once and a re-tick arrives fresh (PK-262); an unmarked assumption leaves at its third turn end, the turn it was made in counted;
// one sent back waits for his prompt
export function turnEnded(o: StashOrbit): StashOrbit {
    return {
        ...o,
        asks: o.asks
            .filter((a) => !a.isClosed && (!a.isResolved || a.word))
            .map((a) => (a.isResolved ? { ...a, isClosed: true } : a))
            .map((a) =>
                a.isLocked
                    ? {
                          ...unsteer(a),
                          isLocked: false,
                          mark: undefined,
                      }
                    : a,
            ),
        assumed: (o.assumed ?? []).filter(
            (x) => x.isWrong || o.turns + 2 - x.at < ASSUMED_TURNS,
        ),
        turns: o.turns + 1,
    };
}

const markWord = (mark: OrbitAsk['mark']) =>
    mark === 'accepted' ? '🛎️ accepted' : '↩️ rejected';

// what the session reads for each assumption dima sent back: the assumption and his steer
export const wrongText = (wrong: OrbitAssumption[]) =>
    [
        `orbit: dima marked ${wrong.length === 1 ? 'an assumption' : `${wrong.length} assumptions`} wrong; take it into account in this reply.`,
        ...wrong.map(
            (x) =>
                `- ${x.id} wrong assumption: ${x.text}` +
                (x.steer ? ` · his steer: «${x.steer.trim()}»` : ''),
        ),
    ].join('\n');

// what the session reads for each marked ask: the mark, the ask, its pick, both steers
export function joinText(asks: OrbitAsk[]) {
    const lines = asks.map(
        (a) =>
            `- ${a.id} ${markWord(a.mark)}: ${a.text} (your pick: ${a.pick})` +
            (a.steer ? ` · his steer: «${a.steer.trim()}»` : '') +
            (a.hiddenNote ? ` · your note: «${a.hiddenNote}»` : ''),
    );
    return [
        `orbit: dima marked ${asks.length === 1 ? 'an ask' : `${asks.length} asks`}. answer each in this reply, then call ${ORBIT_TOOL}: resolve the answered ids, or follow one that needs another round.`,
        ...lines,
    ].join('\n');
}

// the first text over the cap, named with its length, so the session can shorten that one
function overCap(op: string, texts: string[]) {
    const long = texts.find((x) => [...x].length > ORBIT_TEXT_MAX);
    return long === undefined
        ? undefined
        : {
              deny: `orbit ${op}: «${[...long].slice(0, 40).join('')}…» is ${[...long].length} chars; keep it ≤${ORBIT_TEXT_MAX}, subject first, detail in hiddenNote`,
          };
}

// a ticked ask shipped as picked, or changed with a new round beside it (PK-204: twice reported done narrower than ticked)
const AS_TICKED = /\bas ticked\b/i;
const CHANGED = /\bchanged:\s*\S/i;
function tickedWord(
    a: OrbitAsk,
    word: string,
    isAmended: boolean,
): string | undefined {
    if (a.mark !== 'accepted' || AS_TICKED.test(word)) return undefined;
    if (!CHANGED.test(word))
        return `orbit resolve: ${a.id} was ticked; its closing word says «as ticked» when it shipped as picked, or «changed: <what>» beside a follow or an add in the same call`;
    if (!isAmended)
        return `orbit resolve: ${a.id} «changed: …» needs a follow or an add in the same call (ops), so dima sees the new round`;
    return undefined;
}

// the tool's ops on orbit; `isTurn` decides whether a plan set now counts from this turn's end or the last one;
// `isAmended`: the same call carries a follow or an add, which a «changed:» resolve needs
export function orbitOp(
    o: StashOrbit,
    input: Record<string, unknown>,
    isTurn: boolean,
    planMax: number = PLAN_MAX,
    isAmended = false,
): { orbit: StashOrbit; result: string } | { deny: string } {
    switch (input.op) {
        case 'add': {
            const raw = Array.isArray(input.asks) ? input.asks : [];
            const added: OrbitAsk[] = [];
            let next = o.next;
            for (const item of raw) {
                const v = (item ?? {}) as Record<string, unknown>;
                const text = oneLine(v.text);
                if (!text) continue;
                const hiddenNote = oneLine(v.hiddenNote);
                const link = oneLine(v.link);
                if (link && !ASK_LINK.test(link))
                    return {
                        deny: `orbit add: link «${link.slice(0, 40)}» is neither an https url, an obsidian:// url nor a file path (/… or ~/…)`,
                    };
                added.push({
                    hiddenNote: hiddenNote || undefined,
                    id: `o${next++}`,
                    ...(link ? { link } : {}),
                    pick: oneLine(v.pick) || 'no pick',
                    text,
                });
            }
            if (!added.length)
                return {
                    deny: 'orbit add: asks needs one { text, pick } or more',
                };
            const tooLong = overCap(
                'add',
                added.map((a) => a.text),
            );
            if (tooLong) return tooLong;
            return {
                orbit: { ...o, asks: [...o.asks, ...added], next },
                result: `added ${added.map((a) => a.id).join(', ')} to dima's orbit; never repeat them in the reply`,
            };
        }
        case 'assume': {
            const texts = (Array.isArray(input.texts) ? input.texts : [])
                .map(oneLine)
                .filter(Boolean);
            if (!texts.length)
                return { deny: 'orbit assume: texts needs one or more' };
            const tooLong = overCap('assume', texts);
            if (tooLong) return tooLong;
            const born = isTurn ? o.turns + 1 : o.turns;
            const kept = o.assumed ?? [];
            const already = kept.filter((x) => x.at === born).length;
            if (already + texts.length > ASSUMED_MAX)
                return {
                    deny: `orbit assume: at most ${ASSUMED_MAX} a turn, ${already} already; keep the ones that would cost a redo`,
                };
            let next = o.next;
            const added: OrbitAssumption[] = texts.map((text) => ({
                at: born,
                id: `a${next++}`,
                text,
            }));
            return {
                orbit: {
                    ...o,
                    assumed: [...kept, ...added].slice(-ASSUMED_MAX),
                    next,
                },
                result: `assumed ${added.map((x) => x.id).join(', ')}; dima sees them under orbit`,
            };
        }
        case 'resolve': {
            const ids = idsOf(input.ids);
            const unknown = ids.filter(
                (id) => !o.asks.some((a) => a.id === id),
            );
            const words =
                input.words && typeof input.words === 'object'
                    ? (input.words as Record<string, unknown>)
                    : {};
            for (const a of o.asks) {
                if (!ids.includes(a.id)) continue;
                const deny = tickedWord(a, oneLine(words[a.id]), isAmended);
                if (deny) return { deny };
            }
            const asks = o.asks.map((a) => {
                if (!ids.includes(a.id)) return a;
                const word = oneLine(words[a.id]);
                return word
                    ? { ...a, isResolved: true, word }
                    : { ...a, isResolved: true };
            });
            return {
                orbit: {
                    ...o,
                    // outside a turn the turn end already passed: a worded one lingers to the next, the rest leave
                    asks: isTurn
                        ? asks
                        : asks
                              .filter((a) => !a.isResolved || a.word)
                              .map((a) =>
                                  a.isResolved ? { ...a, isClosed: true } : a,
                              ),
                },
                result: `resolved ${ids.filter((id) => !unknown.includes(id)).join(', ') || 'nothing'}${unknown.length ? `; no ask ${unknown.join(', ')}` : ''}`,
            };
        }
        case 'follow': {
            const id = typeof input.id === 'string' ? input.id : '';
            const text = oneLine(input.text);
            if (!o.asks.some((a) => a.id === id) || !text)
                return {
                    deny: `orbit follow: needs a known id and a text, got «${id}»`,
                };
            const tooLong = overCap('follow', [text]);
            if (tooLong) return tooLong;
            return {
                orbit: {
                    ...o,
                    asks: o.asks.map((a) =>
                        a.id === id
                            ? {
                                  ...a,
                                  isChanged: true,
                                  isClosed: undefined,
                                  // a new question is no longer the running turn's: dima's next tick on it must land (o88)
                                  isLocked: undefined,
                                  isResolved: false,
                                  mark: undefined,
                                  pick: oneLine(input.pick) || a.pick,
                                  // his steer answered the old question
                                  steer: undefined,
                                  text,
                                  word: undefined,
                              }
                            : a,
                    ),
                },
                result: `${id} changed in place`,
            };
        }
        case 'plan': {
            const lines = (Array.isArray(input.lines) ? input.lines : [])
                .map(oneLine)
                .filter(Boolean)
                .slice(0, planMax);
            const tooLong = overCap('plan', lines);
            if (tooLong) return tooLong;
            return {
                orbit: {
                    ...o,
                    // dima's steer outlives the session's new lines: dropping it cleared the box he was typing in, so the
                    // field remounted and threw his text away (PK-149)
                    plan: lines.length
                        ? {
                              at: isTurn ? o.turns + 1 : o.turns,
                              lines,
                              ...(o.plan?.steer ? { steer: o.plan.steer } : {}),
                          }
                        : undefined,
                },
                // the board shows the 🎛️ phase lines (7 by default); a shorter plan leaves dima guessing past it (dima's o74)
                result: lines.length
                    ? `plan set, ${lines.length} line${lines.length === 1 ? '' : 's'}${lines.length < planMax ? ` — plan has ${lines.length} of ${planMax}, fill to ${planMax}` : ''}`
                    : 'plan cleared',
            };
        }
        default:
            return {
                deny: `orbit: op is add, assume, resolve, follow, plan or glide, got «${String(input.op)}»`,
            };
    }
}

// o84: a row moves one place up or down; the list stays the same set
export function moved<T>(list: readonly T[], i: number, by: -1 | 1): T[] {
    const j = i + by;
    if (i < 0 || j < 0 || i >= list.length || j >= list.length)
        return [...list];
    const out = [...list];
    [out[i], out[j]] = [out[j] as T, out[i] as T];
    return out;
}

// dima's hand on the phases card — a reorder or a tick, his steer riding with them — that a turn has not taken yet
export const hasPlanMark = (p: StashPlan | undefined): p is StashPlan =>
    Boolean(p && (p.isMoved || p.mark));

// what the session reads once dima's phases mark joins a turn
export function planText(p: StashPlan) {
    return [
        `🌔 phases: dima ${
            [
                p.isMoved ? 'reordered your phases' : '',
                p.mark ? '🛎️ ticked their order' : '',
            ]
                .filter(Boolean)
                .join(' and ') || 'left a steer on your phases'
        }; take it into account in this reply.`,
        ...(p.isMoved ? p.lines.map((l, i) => `${i + 1}. ${l}`) : []),
        ...(p.steer ? [`his steer: «${p.steer.trim()}»`] : []),
    ].join('\n');
}

// the mark is spent once a turn takes it: the lines stay as dima left them
export const planTaken = (p: StashPlan): StashPlan => ({
    at: p.at,
    lines: p.lines,
});
