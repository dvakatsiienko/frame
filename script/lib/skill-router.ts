/* Core */
import { readFileSync, readdirSync } from 'node:fs';

/* Instruments */
import type { JevResponse, Question } from './jev.ts';
import { judge } from './jev.ts';
import type { RouterSkill } from './jev-questions.ts';
import {
    routerNouls,
    routerRerank,
    routerVetoes,
    routerWide,
} from './jev-questions.ts';

// the cookbook's shortlist and excerpt (3 / 700); FITS 0.30 → 0.50: at 0.30 a 1p-vault prompt and a
// relay to a coder loaded (fits 0.35, 0.48), and no right pick sat between the two
const VETO = 0.6;
const FITS = 0.5;
const SHORTLIST = 3;
const EXCERPT = 700;
const NOUL_LOAD = 0.6;

// a pick of these never auto-trusts, green router or not (memory/sys-jev.md)
export const sideEffectSkills: ReadonlySet<string> = new Set([
    'cclio:evergreen',
    'cclio:halt',
    'x:cmt',
    'x:handoff',
]);

const skillDirs = {
    cclio: new URL('../../cclio/plugin-cclio/skills/', import.meta.url),
    x: new URL('../../home/.claude/plugin-x/skills/', import.meta.url),
};

export const roster: readonly RouterSkill[] = Object.entries(skillDirs).flatMap(
    ([prefix, dir]) =>
        readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
            if (!entry.isDirectory()) return [];
            const md = readFileSync(
                new URL(`${entry.name}/SKILL.md`, dir),
                'utf8',
            );
            // a user-only skill cannot be loaded by the model, so routing it is noise
            if (/^disable-model-invocation:\s*true\s*$/m.test(md)) return [];
            const description = readDescription(md);
            return description
                ? [
                      {
                          description,
                          excerpt: readBody(md).slice(0, EXCERPT),
                          name: `${prefix}:${entry.name}`,
                      },
                  ]
                : [];
        }),
);
const byName = new Map(roster.map((s) => [s.name, s]));

/** the new shape: at most one skill, or none */
export async function suggest(prompt: string): Promise<Suggestion> {
    const wide = await judge({ prompt }, routerWide(roster));
    const p = (id: string) => noulOf(wide, id);
    const ranked = Object.entries(choiceOf(wide, 'skill'))
        .filter(([name]) => name !== 'none')
        .sort((a, b) => b[1] - a[1]);
    const top = { name: ranked[0]?.[0] ?? '-', p: ranked[0]?.[1] ?? 0 };
    const stop = Object.keys(routerVetoes).some((id) => p(id) >= VETO)
        ? 'veto'
        : (choiceOf(wide, 'skill').none ?? 0) >= top.p
          ? 'none'
          : undefined;
    if (stop)
        return { loads: [], stage: stop, tokens: wide.usage.input_tokens, top };

    const shortlist = ranked
        .slice(0, SHORTLIST)
        .flatMap(([name]) => byName.get(name) ?? []);
    const narrow = await judge({ prompt }, routerRerank(shortlist));
    const winner = Object.entries(choiceOf(narrow, 'skill')).sort(
        (a, b) => b[1] - a[1],
    )[0]?.[0];
    const fits = winner ? noulOf(narrow, `fits:${winner}`) : 0;
    const tokens = wide.usage.input_tokens + narrow.usage.input_tokens;
    return winner && fits >= FITS
        ? {
              loads: [{ name: winner, p: fits }],
              stage: 'load',
              tokens,
              top: { name: winner, p: fits },
          }
        : {
              loads: [],
              stage: 'fits',
              tokens,
              top: { name: winner ?? top.name, p: fits },
          };
}

/** the old shape, one noul per skill — every skill over the line loads */
export async function suggestNouls(prompt: string): Promise<Suggestion> {
    const res = await judge({ prompt }, routerNouls(roster));
    const isVetoed = Object.keys(routerVetoes).some(
        (id) => noulOf(res, id) >= VETO,
    );
    const ranked = roster
        .map((s) => ({ name: s.name, p: isVetoed ? 0 : noulOf(res, s.name) }))
        .sort((a, b) => b.p - a.p);
    return {
        loads: ranked.filter((s) => s.p >= NOUL_LOAD),
        stage: isVetoed ? 'veto' : 'nouls',
        tokens: res.usage.input_tokens,
        top: ranked[0] ?? { name: '-', p: 0 },
    };
}

/** the hook's line: `skills (jev router): x:cmt 0.84 ⚠ read first` */
export const loadLine = (loads: readonly Pick[]) =>
    loads.length
        ? `skills (jev router): ${loads.map((s) => `${s.name} ${s.p.toFixed(2)}${sideEffectSkills.has(s.name) ? ' ⚠ read first' : ''}`).join(', ')}`
        : undefined;

function noulOf(res: JevResponse<Record<string, Question>>, id: string) {
    const a = res.answers[id];
    return a?.type === 'noul' ? a.noul : 0;
}

function choiceOf(
    res: JevResponse<Record<string, Question>>,
    id: string,
): Record<string, number> {
    const a = res.answers[id];
    return a?.type === 'choice' ? a.probabilities : {};
}

// frontmatter description is one line, or a `>-` folded block of indented lines
function readDescription(md: string) {
    const lines = md.split('\n');
    const at = lines.findIndex((l) => l.startsWith('description:'));
    if (at < 0) return undefined;
    const first = lines[at]?.slice('description:'.length).trim() ?? '';
    if (!first.startsWith('>')) return first;
    const folded: string[] = [];
    for (const l of lines.slice(at + 1)) {
        if (!l.startsWith(' ')) break;
        folded.push(l.trim());
    }
    return folded.join(' ');
}

function readBody(md: string) {
    const end = md.indexOf('\n---', 3);
    return (end < 0 ? md : md.slice(end + 4)).replace(/\s+/g, ' ').trim();
}

/* Types */
type Pick = { name: string; p: number };
/** `stage` names the check that decided: veto · none · fits · load (old: veto · nouls) */
export type Suggestion = {
    loads: Pick[];
    stage: string;
    tokens: number;
    top: Pick;
};
