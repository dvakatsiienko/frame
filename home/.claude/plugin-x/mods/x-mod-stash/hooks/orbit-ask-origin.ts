// ask origin (FRM-670): what an ask says beside its text — the area it is about, why it exists, and who started it when
// that is not the thread posting it; pure rules, the reads of the list and the poster are orbit-tool.ts's

import type { AskFrom, OrbitAsk } from '../types/stash.d.ts';
import { MEMBERS } from './parse.ts';
import type { ThreadRecord } from './session-identity.ts';
import { ORBIT_TEXT_MAX, oneLine } from './util.ts';

// the areas an ask may name, «word emoji» a line, read at every add, so clio's edit is live with no reload (FRM-670:W23)
export const AREAS_FILE = '~/.claude/shelf/orbit-areas.txt';
export type AskArea = { emoji?: string; word: string };
export const areasOf = (text: string): AskArea[] =>
    text.split('\n').flatMap((line) => {
        const [word, emoji] = line.trim().split(/\s+/);
        return !word || word.startsWith('#')
            ? []
            : [{ word: word.toLowerCase(), ...(emoji ? { emoji } : {}) }];
    });
// with no list to read: one plain word
const ANY_AREA = /^[\p{L}\p{N}-]{1,20}$/u;
export const areaWords = (areas: AskArea[]) =>
    areas.map((a) => a.word).join(', ');

// what a check knows beside the call: the list as it stands, and the poster's thread record; none, it cannot be placed
export type OriginRead = { areas: AskArea[]; self?: ThreadRecord };

const STARTERS = {
    codie: MEMBERS.codie,
    crow: MEMBERS.crow,
    designer: MEMBERS.designer,
    "dima's rule": MEMBERS.dima,
    helga: MEMBERS.helga,
    'main clio': MEMBERS.clio,
    'plain cc': '💻',
    'sixth sense': MEMBERS['sixth sense'],
    wishkeeper: '🐬',
} as const;
type Starter = keyof typeof STARTERS;
const WING = /^wing (\d+)$/;
// the order the tool's text and a refusal print them in
export const STARTER_WORDS =
    "crow, wishkeeper, codie, sixth sense, wing N, main clio, designer, helga, dima's rule, plain cc";
const isStarter = (who: string): who is Starter => Object.hasOwn(STARTERS, who);
// the two a relay must say which one of
const isMember = (who: string) => who === 'codie' || who === 'sixth sense';
// a starter's role in the thread records; wishkeeper is a card with no session of its own, and a plain cc, as a member
// with a topic, always means another session
const ROLES: Readonly<Partial<Record<string, string>>> = {
    codie: 'codie',
    crow: 'adviser',
    designer: 'designer',
    helga: 'copyist',
    'main clio': 'coordinator',
    'sixth sense': 'sixth-sense',
};

function isPoster(from: AskFrom, self: ThreadRecord | undefined) {
    if (!self?.role) return false;
    const wing = from.who.match(WING);
    if (wing) return self.role === 'wing' && self.wing === Number(wing[1]);
    if (self.role !== ROLES[from.who]) return false;
    // a member's own is its lane and ticket, its lane alone while its record has no ticket; a topic always means another session of its role
    return (
        !isMember(from.who) ||
        (from.lane !== undefined &&
            (self.ticket
                ? self.ticket === from.ticket &&
                  [self.area, self.lane].includes(from.lane.toLowerCase())
                : self.lane === from.lane.toLowerCase()))
    );
}

// a session on the schema from before this field sends a bare `null` as the word
const isCleared = (v: unknown) => v === null || v === 'null';

function fromOf(
    v: unknown,
    self: ThreadRecord | undefined,
): AskFrom | { deny: string } {
    if (typeof v !== 'object' || !v || Array.isArray(v))
        return {
            deny: `from is an object, { who, lane and ticket, or topic }; who is ${STARTER_WORDS}`,
        };
    const raw = v as Record<string, unknown>;
    const who = oneLine(raw.who).toLowerCase().replaceAll('’', "'");
    if (!isStarter(who) && !WING.test(who))
        return {
            deny: `from has who «${who.slice(0, 40)}»; use ${STARTER_WORDS}. a starter not on this list: drop from and lead the why with its name («retro: …»)`,
        };
    const lane = oneLine(raw.lane);
    const ticket = oneLine(raw.ticket).toUpperCase();
    const topic = oneLine(raw.topic);
    if (isMember(who)) {
        if (topic ? lane || ticket : !(lane && ticket))
            return {
                deny: `from ${who} names which one: lane and ticket, or a topic, never both`,
            };
    } else if (lane || ticket)
        return { deny: `from ${who} takes a topic, no lane or ticket` };
    const from = {
        who,
        ...(lane ? { lane, ticket } : {}),
        ...(topic ? { topic } : {}),
    } as AskFrom;
    const drawn = [...fromLine(from)].length;
    if (drawn > ORBIT_TEXT_MAX)
        return {
            deny: `from draws ${drawn} chars; keep it ≤${ORBIT_TEXT_MAX}`,
        };
    if (isPoster(from, self))
        return {
            deny: `from names you, the poster; leave it out, the ask is already yours`,
        };
    return from;
}

// the fields an add or a follow carries, checked together so one retry lands; a follow keeps what it leaves out
export function askOrigin(
    input: Record<string, unknown>,
    { areas, self }: OriginRead,
    isFollow: boolean,
): { origin: Partial<OrbitAsk> } | { deny: string } {
    const wrong: string[] = [];
    const origin: Partial<OrbitAsk> = {};
    if (!isFollow || input.area !== undefined) {
        const word = oneLine(input.area).toLowerCase();
        const area = areas.find((a) => a.word === word);
        if (area || (!areas.length && ANY_AREA.test(word))) {
            origin.area = word;
            origin.areaEmoji = area?.emoji;
        } else
            wrong.push(
                areas.length
                    ? `${word ? `area «${word.slice(0, 40)}» is off the list` : 'it has no area'}, one of ${areaWords(areas)} (${AREAS_FILE})`
                    : 'its area is one plain word, letters and digits',
            );
    }
    if (!isFollow || input.why !== undefined) {
        const why = oneLine(input.why);
        const words = why.split(' ').filter((x) => /[\p{L}\p{N}]/u.test(x));
        if ([...why].length > ORBIT_TEXT_MAX)
            wrong.push(
                `its why is ${[...why].length} chars; keep it ≤${ORBIT_TEXT_MAX}`,
            );
        else if (words.length > 1) origin.why = why;
        else
            wrong.push(
                `${why ? `why «${why.slice(0, 40)}» is one word` : 'it has no why'}; add why, a short clause of two words or more on why the ask exists`,
            );
    }
    if (isCleared(input.from)) origin.from = undefined;
    else if (input.from !== undefined) {
        const from = fromOf(input.from, self);
        if ('deny' in from) wrong.push(from.deny);
        else origin.from = from;
    }
    return wrong.length ? { deny: wrong.join('; ') } : { origin };
}

// who started it, as every surface draws it: «🔧 mods | FRM-662», «🔎 the pill», «🪽 wing 2», «🐦‍⬛ crow: the pill»
export function fromLine({ lane, ticket, topic, who }: AskFrom) {
    const badge = isStarter(who) ? STARTERS[who] : '🪽';
    if (isMember(who)) return `${badge} ${topic ?? `${lane} | ${ticket}`}`;
    const name = who.replace(/^(?:main|plain) /, '');
    return `${badge} ${name}${topic ? `: ${topic}` : ''}`;
}

// the muted line under the pick; an ask kept from before the field has none
export const originLine = ({ from, why }: Pick<OrbitAsk, 'from' | 'why'>) =>
    [from ? fromLine(from) : '', why].filter(Boolean).join(' · ');

export const areaLine = ({ area, areaEmoji }: OrbitAsk) =>
    [areaEmoji, area].filter(Boolean).join(' ');
