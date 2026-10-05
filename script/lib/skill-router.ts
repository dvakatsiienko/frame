/* Core */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/* Instruments */
import type { JevResponse, Question } from './jev.ts';
import { judge } from './jev.ts';
import type { RouterSkill } from './jev-questions.ts';
import { routerRerank, routerVetoes, routerWide } from './jev-questions.ts';
import { sessionRead } from './session-read.ts';

// the cookbook's shortlist and excerpt (3 / 700); FRM-268 set FITS 0.30 → 0.50 on the vet misses
const SHORTLIST = 3;
const EXCERPT = 700;
// an ack or a later-only prompt loads nothing; the one threshold no sweep moves
const VETO = 0.6;
// `margin` is how far `none` must lead the top skill to stop stage 1: 0 is FRM-268's rule
export const defaultThresholds: Thresholds = {
    fits: 0.5,
    gate: 0.5,
    margin: 0,
    need: 0.5,
};

// a pick of these never auto-trusts, green router or not (memory/sys-jev.md)
export const sideEffectSkills: ReadonlySet<string> = new Set([
    'cclio:evergreen',
    'cclio:halt',
    'x:cmt',
    'x:handoff',
]);

// the must-not-miss gate (FRM-305): skills whose miss costs a broken flow, not a slower turn
export const mustNotMiss: readonly string[] = [
    'x:browser-headless',
    'x:cmt',
    'x:ftr',
    'x:github-contrib',
    'x:guide-ui-ux',
    'x:handoff-ingest',
    'x:pm',
    'x:shape-idea',
    'x:writing-for-humans',
];

const skillDirs = {
    cclio: new URL('../../cclio/plugin-cclio/skills/', import.meta.url),
    x: new URL('../../home/.claude/plugin-x/skills/', import.meta.url),
};

/** x + cclio from this tree, so a worktree measures its own descriptions — FRM-268's whole roster */
export const treeRoster: readonly RouterSkill[] = Object.entries(
    skillDirs,
).flatMap(([prefix, dir]) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        if (!entry.isDirectory()) return [];
        const md = readFileSync(new URL(`${entry.name}/SKILL.md`, dir), 'utf8');
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

/**
 * every skill the session was shown (its transcript's skill listing), x + cclio swapped for this
 * tree's copies; a listed skill with a SKILL.md on disk gets its excerpt, a built-in only its line
 */
export function rosterFrom(listing: ReadonlyMap<string, string>) {
    const own = new Set(treeRoster.map((s) => s.name));
    // `x-cw:<s>` is cowork's copy of `x:<s>`: two names for one procedure split the Choice
    const asTree = (name: string) => name.replace(/^x-cw:/, 'x:');
    const isTwin = (name: string) =>
        own.has(asTree(name)) || /^(x|cclio):/.test(name);
    const listed = new Set([...listing.keys()].map(asTree));
    const others = [...listing]
        .filter(([name]) => !isTwin(name))
        .map(([name, description]) => ({
            description,
            excerpt: excerptOf(name),
            name,
        }));
    // a tree skill the session was not shown (cclio's in a coder session) cannot be loaded there
    return [...treeRoster.filter((s) => listed.has(s.name)), ...others];
}

/** the replay's roster: the newest coordinator transcript that carries a listing */
export function rosterLatest() {
    const dir = join(
        process.env.HOME ?? '',
        '.claude/projects/-Users-dima-frame-cclio',
    );
    if (!existsSync(dir)) return { path: '-', roster: treeRoster };
    const newest = readdirSync(dir)
        .filter((f) => f.endsWith('.jsonl'))
        .map((f) => join(dir, f))
        .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
    for (const path of newest) {
        const { listing } = sessionRead(path);
        if (listing.size) return { path, roster: rosterFrom(listing) };
    }
    return { path: '-', roster: treeRoster };
}

/** the live hook: one transcript read gives the roster, the last reply and the skills in play */
export function routeInput(prompt: string, transcriptPath?: string) {
    const session = sessionRead(transcriptPath);
    return {
        input: {
            prompt,
            recentContext: session.recentContext,
            seen: session.seen,
        },
        roster: session.listing.size ? rosterFrom(session.listing) : treeRoster,
    };
}

/** the two jev calls; every number they return is kept, so a threshold sweep needs no new call */
export async function score(input: RouteInput, arm: RouterArm): Promise<Raw> {
    const started = performance.now();
    const state = {
        prompt: input.prompt,
        ...(arm.hasContext &&
            input.recentContext && { recent_context: input.recentContext }),
    };
    // a skill already in the session keeps competing in the Choice — dropped from it, a near
    // neighbour took its probability and loaded instead; `decide` drops it from the loads
    const roster = arm.roster;
    const gate = arm.hasGate
        ? roster.filter((s) => mustNotMiss.includes(s.name))
        : [];
    const wide = await judge(state, routerWide(roster, arm.hasContext, gate));
    const choice = choiceOf(wide, 'skill');
    const ranked = Object.entries(choice)
        .filter(([name]) => name !== 'none')
        .sort((a, b) => b[1] - a[1]);
    const raw: Raw = {
        blocked: arm.hasMemory
            ? roster.flatMap((s) => (input.seen.has(s.name) ? [s.name] : []))
            : [],
        gate: Object.fromEntries(
            gate.map((s) => [s.name, noulOf(wide, `must:${s.name}`)]),
        ),
        ms: 0,
        none: choice.none ?? 0,
        ranked: ranked.slice(0, SHORTLIST),
        tokens: wide.usage.input_tokens,
        vetoes: Object.fromEntries(
            Object.keys(routerVetoes).map((id) => [id, noulOf(wide, id)]),
        ),
    };
    // only a veto skips stage 2: `none` beating the top skill is a margin `decide` sweeps, since
    // a verdict («go», «2 yes») ranks the right skill first yet loses to `none` (FRM-305 replay)
    const isVetoed = Object.values(raw.vetoes).some((p) => p >= VETO);
    if (!isVetoed) {
        const byName = new Map(roster.map((s) => [s.name, s]));
        const shortlist = raw.ranked.flatMap(
            ([name]) => byName.get(name) ?? [],
        );
        const narrow = await judge(
            {
                ...state,
                ...(arm.hasNeed && {
                    skills: Object.fromEntries(
                        shortlist.map((s) => [s.name, s.description]),
                    ),
                }),
            },
            routerRerank(shortlist, arm.hasContext, arm.hasNeed),
        );
        const winner = Object.entries(choiceOf(narrow, 'skill')).sort(
            (a, b) => b[1] - a[1],
        )[0]?.[0];
        raw.rerank = {
            fits: winner ? noulOf(narrow, `fits:${winner}`) : 0,
            need: arm.hasNeed ? noulOf(narrow, 'needsSkill') : undefined,
            winner: winner ?? '-',
        };
        raw.tokens += narrow.usage.input_tokens;
    }
    raw.ms = Math.round(performance.now() - started);
    return raw;
}

/** pure: thresholds over one prompt's raw scores → the loads, and one reason per stage */
export function decide(
    raw: Raw,
    t: Thresholds = defaultThresholds,
): Suggestion {
    const top = { name: raw.ranked[0]?.[0] ?? '-', p: raw.ranked[0]?.[1] ?? 0 };
    const veto = Object.entries(raw.vetoes).find(([, p]) => p >= VETO);
    const blocked = new Set(raw.blocked);
    const trace: string[] = [];
    let pick: Pick | undefined;
    if (veto) trace.push(`veto ${veto[0]} ${veto[1].toFixed(2)}`);
    else if (raw.none >= top.p + t.margin)
        trace.push(
            `none ${raw.none.toFixed(2)} ≥ ${top.name} ${top.p.toFixed(2)} + ${t.margin}`,
        );
    else if (raw.rerank) {
        const { fits, need, winner } = raw.rerank;
        if (need !== undefined && need < t.need)
            trace.push(`need ${need.toFixed(2)} < ${t.need}`);
        else if (fits < t.fits)
            trace.push(`fits ${winner} ${fits.toFixed(2)} < ${t.fits}`);
        else if (blocked.has(winner))
            trace.push(`seen ${winner} — already in the session`);
        else {
            pick = { name: winner, p: fits };
            trace.push(`load ${winner} ${fits.toFixed(2)}`);
        }
    }
    // the gate overrides `none` and the stage-2 checks, never a veto; it fires only on a skill
    // stage 1 also shortlisted — a third of the false fires at the same recall (FRM-305 replay)
    const shortlisted = new Set(raw.ranked.map(([name]) => name));
    const gated = veto
        ? []
        : Object.entries(raw.gate)
              .filter(
                  ([name, p]) =>
                      p >= t.gate &&
                      shortlisted.has(name) &&
                      !blocked.has(name) &&
                      name !== pick?.name,
              )
              .map(([name, p]) => ({ name, p }));
    if (gated.length)
        trace.push(
            `gate ${gated.map((g) => `${g.name} ${g.p.toFixed(2)}`).join(', ')}`,
        );
    return {
        loads: [...(pick ? [pick] : []), ...gated],
        tokens: raw.tokens,
        top,
        trace,
    };
}

// the hook runs full roster + last reply + memory at fits 0.75: 94 % / 2 % precision / wrong on
// FRM-305's held split, but 67 % / 7 % on its 32 real prompts — the synthetic lines carry the
// headline, and no arm meets the bar to turn on (≥ 90 % / ≤ 5 %) on real prompts. the full
// roster stays because it is the only way a non-x skill loads; the gate stays in the replay
const live = {
    parts: {
        hasContext: true,
        hasGate: false,
        hasMemory: true,
        hasNeed: false,
    },
    thresholds: { ...defaultThresholds, fits: 0.75 },
};

export async function suggest(
    input: RouteInput,
    roster: readonly RouterSkill[],
) {
    const raw = await score(input, { ...live.parts, roster });
    return { ...decide(raw, live.thresholds), ms: raw.ms };
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

// a plugin skill's SKILL.md sits under the plugin's install path; a user skill under ~/.claude/skills
const home = process.env.HOME ?? '';
const installedPath = join(home, '.claude/plugins/installed_plugins.json');
// read once per process: every listed skill looks its plugin up here
const installed: Installed = existsSync(installedPath)
    ? (JSON.parse(readFileSync(installedPath, 'utf8')) as Installed)
    : { plugins: {} };

function excerptOf(name: string) {
    const [plugin, skill] = name.includes(':')
        ? name.split(':')
        : [undefined, name];
    const roots = plugin
        ? Object.entries(installed.plugins).flatMap(([id, installs]) =>
              id.startsWith(`${plugin}@`)
                  ? installs.map((i) => join(i.installPath, 'skills'))
                  : [],
          )
        : [join(home, '.claude/skills')];
    // a plugin may group its skills one level down (matt's `skills/engineering/tdd/`)
    const md = roots
        .flatMap((root) =>
            existsSync(root)
                ? [root, ...readdirSync(root).map((d) => join(root, d))]
                : [],
        )
        .map((dir) => join(dir, skill ?? '', 'SKILL.md'))
        .find((path) => existsSync(path));
    return md ? readBody(readFileSync(md, 'utf8')).slice(0, EXCERPT) : '';
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
type Installed = { plugins: Record<string, { installPath: string }[]> };
export type Thresholds = {
    fits: number;
    gate: number;
    margin: number;
    need: number;
};
/** which v2 parts one replay arm switches on — FRM-268's router is all four off */
export type RouterArm = {
    roster: readonly RouterSkill[];
    hasContext: boolean;
    hasMemory: boolean;
    hasGate: boolean;
    hasNeed: boolean;
};
export type RouteInput = {
    prompt: string;
    recentContext: string;
    seen: ReadonlySet<string>;
};
/** every number the two calls returned; `rerank` is absent when stage 1 stopped */
export type Raw = {
    /** skills already in the session (memory arms): ranked as usual, never emitted */
    blocked: string[];
    vetoes: Record<string, number>;
    none: number;
    ranked: [string, number][];
    gate: Record<string, number>;
    rerank?: { winner: string; fits: number; need: number | undefined };
    tokens: number;
    ms: number;
};
/**
 * `top` is the wide Choice's best skill, one scale for route.log's band; a load carries its
 * fits (or its gate noul). `trace` holds one reason per stage that spoke: veto · none · need ·
 * fits · load · gate
 */
export type Suggestion = {
    loads: Pick[];
    trace: string[];
    tokens: number;
    top: Pick;
};
