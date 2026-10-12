// orbit's rules as pure steps over one session's orbit: the tool's ops, dima's marks joining a turn, the turn's end.
// register.tsx owns every $ call: it reads the orbit from $.state, applies a step here, and saves the result.
import type {
    OrbitAsk,
    OrbitAssumption,
    OrbitCatch,
    StashOrbit,
} from '../types/stash.d.ts';

export const ORBIT_TOOL = 'mcp__x-mod-stash__orbit';
export const PLAN_MAX = 7;
// a followed-up ask's mark, before its id so the text keeps the full width — a try, dima may swap the glyph (o6)
export const CHANGED_MARK = '🆕';
// an ask, a follow-up or a phase reads at a glance in the narrow board (dima's o60, 22:13)
export const ORBIT_TEXT_MAX = 90;
// at most this many assumptions a turn, and on the board at once (FRM-382 exit 2: under one a turn on average)
export const ASSUMED_MAX = 3;
export const ASSUMED_TURNS = 3;
// 🐠 catch (FRM-386): at most this many new pieces a turn, and held at once until dima clears one
export const CATCH_TURN_MAX = 2;
export const CATCH_HELD_MAX = 5;

export const oneLine = (v: unknown) =>
    typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
const idsOf = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

// a marked ask no turn has taken yet
export const isFresh = (a: OrbitAsk) =>
    Boolean(a.mark) && !a.isLocked && !a.isResolved;

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

export const steeredOrbit = (o: StashOrbit): StashOrbit => ({
    ...o,
    asks: o.asks.map(steered),
    ...(o.assumed ? { assumed: o.assumed.map(steered) } : {}),
    ...(o.caught ? { caught: o.caught.map(steered) } : {}),
});

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
            ids.has(a.id) ? { ...a, isLocked: true, markedAt: undefined } : a,
        ),
    };
}

// the turn's answers leave; a marked ask it never resolved unlocks and rides dima's next prompt; an unmarked
// assumption leaves at its third turn end, the turn it was made in counted; one sent back waits for his prompt
export function turnEnded(o: StashOrbit): StashOrbit {
    return {
        ...o,
        asks: o.asks
            .filter((a) => !a.isResolved)
            .map((a) => (a.isLocked ? { ...unsteer(a), isLocked: false } : a)),
        assumed: (o.assumed ?? []).filter(
            (x) => x.isWrong || o.turns + 2 - x.at < ASSUMED_TURNS,
        ),
        caught: o.caught?.map((x) =>
            x.isLocked ? { ...unsteer(x), isLocked: false } : x,
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
                (x.steer ? ` · his steer: «${x.steer}»` : ''),
        ),
    ].join('\n');

// the 🤔 pieces no turn has taken yet
export const isThought = (x: OrbitCatch) => Boolean(x.isAsked) && !x.isLocked;

// a turn takes the 🤔 pieces once: they lock to it and stay held until dima clears them
export function lockThought(o: StashOrbit, pieces: OrbitCatch[]): StashOrbit {
    const ids = new Set(pieces.map((x) => x.id));
    return {
        ...o,
        caught: o.caught?.map((x) =>
            ids.has(x.id) ? { ...x, isAsked: false, isLocked: true } : x,
        ),
    };
}

// what the session reads for each 🤔: the piece, its hidden note, his steer
export const thinkText = (pieces: OrbitCatch[]) =>
    [
        `🐠 catch: dima pressed 🤔 on ${pieces.length === 1 ? 'a piece' : `${pieces.length} pieces`}: explain each in this reply, plainly, with the why. the piece stays until he clears it.`,
        ...pieces.map(
            (x) =>
                `- ${x.id}: ${x.text}` +
                (x.hiddenNote ? ` · your note: «${x.hiddenNote}»` : '') +
                (x.steer ? ` · his steer: «${x.steer}»` : ''),
        ),
    ].join('\n');

// what the session reads for each marked ask: the mark, the ask, its pick, both steers
export function joinText(asks: OrbitAsk[]) {
    const lines = asks.map(
        (a) =>
            `- ${a.id} ${markWord(a.mark)}: ${a.text} (your pick: ${a.pick})` +
            (a.steer ? ` · his steer: «${a.steer}»` : '') +
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

// the tool's ops on orbit; `isTurn` decides whether a plan set now counts from this turn's end or the last one
export function orbitOp(
    o: StashOrbit,
    input: Record<string, unknown>,
    isTurn: boolean,
    planMax: number = PLAN_MAX,
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
                added.push({
                    hiddenNote: hiddenNote || undefined,
                    id: `o${next++}`,
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
        case 'catch': {
            const raw = Array.isArray(input.pieces) ? input.pieces : [];
            const born = isTurn ? o.turns + 1 : o.turns;
            const held = o.caught ?? [];
            let next = o.next;
            const added: OrbitCatch[] = raw.flatMap((item) => {
                const v = (item ?? {}) as Record<string, unknown>;
                const text = oneLine(v.text);
                if (!text) return [];
                const hiddenNote = oneLine(v.hiddenNote);
                return [
                    {
                        at: born,
                        hiddenNote: hiddenNote || undefined,
                        id: `c${next++}`,
                        text,
                    },
                ];
            });
            if (!added.length)
                return {
                    deny: 'orbit catch: pieces needs one { text, hiddenNote } or two',
                };
            const tooLong = overCap(
                'catch',
                added.map((x) => x.text),
            );
            if (tooLong) return tooLong;
            const already = held.filter((x) => x.at === born).length;
            if (already + added.length > CATCH_TURN_MAX)
                return {
                    deny: `orbit catch: at most ${CATCH_TURN_MAX} a turn, ${already} already; 0 is normal, keep the one dima would most want`,
                };
            if (held.length + added.length > CATCH_HELD_MAX)
                return {
                    deny: `orbit catch: ${held.length} held, at most ${CATCH_HELD_MAX}; clear one first — dima clears them in the board`,
                };
            return {
                orbit: { ...o, caught: [...held, ...added], next },
                result: `caught ${added.map((x) => x.id).join(', ')}; dima sees them under 🐠 catch, never repeat them in the reply`,
            };
        }
        case 'resolve': {
            const ids = idsOf(input.ids);
            const unknown = ids.filter(
                (id) => !o.asks.some((a) => a.id === id),
            );
            const asks = o.asks.map((a) =>
                ids.includes(a.id) ? { ...a, isResolved: true } : a,
            );
            return {
                orbit: {
                    ...o,
                    asks: isTurn ? asks : asks.filter((a) => !a.isResolved),
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
                                  isResolved: false,
                                  mark: undefined,
                                  pick: oneLine(input.pick) || a.pick,
                                  // his steer answered the old question
                                  steer: undefined,
                                  text,
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
                    plan: lines.length
                        ? { at: isTurn ? o.turns + 1 : o.turns, lines }
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
                deny: `orbit: op is add, assume, catch, resolve, follow, plan or glide, got «${String(input.op)}»`,
            };
    }
}
