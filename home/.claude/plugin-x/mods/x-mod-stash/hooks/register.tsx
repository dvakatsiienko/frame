/* @jsx h */
import type { EngineInterface, Register, RenderElement } from 'claude-code';

import type {
    OrbitAsk,
    OrbitAssumption,
    StashCap,
    StashDigest,
    StashEnhancer,
    StashEntry,
    StashMember,
    StashMeter,
    StashOrbit,
    StashView,
} from '../types/stash.d.ts';
import {
    backgroundWait,
    backgroundWaits,
    boldFleetWords,
    bulletDots,
    isFleetName,
    parseWait,
    ticketOf,
} from './parse.ts';

// x-mod-stash: dima's command center above the prompt, one row; FTR.md lists every feature.
// orbit: the session's asks to dima and its plan, written through its own tool, ticked in the board; its open asks are
// mirrored into $.store (one key per session), so the board counts every session's.
// afk: one switch every session polls; while it is on, every prompt carries an away note, and a flip reaches a running turn.
// keep-hot: while on and idle, one ping 50 min after the last turn ended keeps the prompt cache warm; the switch lives in $.store, so a reload keeps it

// label: the repo; name: the session's registry name, when it has one
type Entry = StashEntry;
// a session's last reply: when it ended, its 🔭 wait; `ended` once the session itself exited
// waits: every background task's own name when the reply set no 🔭, so the board can list them all
type Reply = {
    at: number;
    name?: string;
    wait?: string;
    waits?: string[];
    ended?: number;
};

const PREFIX = 'asks:';
const AFK_KEY = 'afk';
const AWAY_NOTE =
    'dima is afk: nothing waits on him. take reversible steps and log them, park every ask in orbit for his return, send no ping.';
const BACK_NOTE = 'dima is back from afk: orbit and pings reach him again.';
const POLL_MS = 4000;
// the fleet board: cc's registry gives each session's state; each session's stash adds its 🔭 wait and context fill
const BOARD = 'fleet-board';
// 🎛️ is a pane of its own, which the surface tabs beside 🚦: the band is capped by cc, the list outgrew it (dima's pick a of
// four homes, 16:20); a tab row inside a pane was proven too, kept as an idea in api-map.md
const SETTINGS_PANE = 'stash-settings';
const REPLY = 'reply:';
const CONTEXT = 'context:';
// the model and effort of a session's main loop, as its last model request named them
const MODEL = 'model:';
// the board's colour MVP: one fleet-wide switch, `/board colour`, off by default (FRM-329)
const COLOUR = 'board-colour';
// `/board breathe`: the bars breathe idle too, while dima refines the look (2026-10-11 12:20); off by default, a try
const BREATH_PREVIEW = 'breath-preview';
// the 🎛️ knobs (FRM-391 slice 06), fleet-wide in stash's store like the switches: a missing key is the default
const BREATHE = 'breathe';
const BREATH_SPEED = 'breath-speed';
const PHASE_LINES = 'phase-lines';
const SPEAK_ASSUMED = 'speak-assumed';
// x-mod-guard reads this key from stash's store file: true drops its rewrite, hint and delegate notes, never a refusal
const GUARD_SILENT = 'guard-silent';
const SPEED = { max: 5, min: 0.1, of: 0.5 } as const;
const LINES = { max: 7, min: 5 } as const;
// the 🎛️ settings (FRM-391 slice 05): one show/hide switch per part, in the store every session reads and the poll
// re-reads, so a flip reaches every band within one poll; a missing key is shown
const SHOWN = 'shown';
// the parts dima approved (o2, 2026-10-11 13:15), grouped by where they draw; a mod's own parts, so a new one joins here
const PARTS = [
    {
        group: 'stash · band',
        key: 'stash.chips',
        label: '🪐 🌔 asks and phases chips',
    },
    { group: 'stash · band', key: 'stash.pace', label: '🔋 🪫 pace gap' },
    {
        group: 'stash · band',
        key: 'stash.reset',
        label: '⏳ time to the 5h reset',
    },
    { group: 'stash · band', key: 'stash.wait', label: '🔭 wait line' },
    {
        group: 'stash · band',
        key: 'stash.enhancer',
        label: '🪄 ⏪ ⏩ enhancer',
    },
    { group: 'stash · band', key: 'stash.hot', label: '🔥 keep-hot' },
    { group: 'stash · band', key: 'stash.waker', label: '⏰ waker' },
    { group: 'stash · band', key: 'stash.afk', label: '💨 afk' },
    { group: 'stash · band', key: 'stash.board', label: '🚦 board button' },
    { group: 'stash · band', key: 'stash.5h', label: '🔥 5h bar (desktop)' },
    { group: 'stash · band', key: 'stash.ctx', label: '🧠 ctx bar (desktop)' },
    {
        group: 'stash · band',
        key: 'stash.digest',
        label: 'while you were away',
    },
    { group: 'stash · board', key: 'stash.orbit', label: '🪐 orbit asks' },
    { group: 'stash · board', key: 'stash.assumed', label: 'assumed section' },
    { group: 'stash · board', key: 'stash.phases', label: '🌔 phases' },
    {
        group: 'stash · board',
        key: 'stash.speak',
        label: '🔊 ⏯️ ⏹️ speak buttons',
    },
    {
        group: 'stash · board',
        key: 'stash.rowmeta',
        label: "session rows' second line",
    },
    {
        group: 'stash · replies',
        key: 'stash.bullets',
        label: '·-lists drawn as bullets',
    },
    {
        group: 'stash · replies',
        key: 'stash.boldwords',
        label: 'fleet words bold with their badge',
    },
] as const;
// the registry names a short-lived headless run `t-` + hex (`t-70`); the board leaves those out (dima, 2026-10-05)
const HEADLESS = /^t-[0-9a-f]+$/;
// a session younger than this, counted from the registry's `startedAt`, is a probe: it gets no row until it outlives it
const SHORT_MS = 60_000;
const STALE_MS = 24 * 60 * 60 * 1000;
// dima at the prompt, typing into a background job, on his phone or the web
const DIMA_ORIGINS = ['composer', 'sdk', 'bridge'] as const;
const HOT_MS = 50 * 60 * 1000;
const HOT = 'hot:';
// a reload keeps `$.state` and resets the module: what must outlive a mod save lives there (FRM-320)
// what the band and the board draw: renders read it, and a write redraws them, no invalidate
const VIEW = { key: 'view', plugin: 'x-mod-stash' } as const;
// what only the board pane draws, its clock included: the band never reads it, so a tick never redraws the band
const BOARD_VIEW = { key: 'board', plugin: 'x-mod-stash' } as const;
// the running turn, so a mid-turn reload still knows it is busy
const TURN = { key: 'turn', plugin: 'x-mod-stash' } as const;
// when the last main turn ended: 🔥 switched on while idle counts its 50 min from here, so the ping lands inside the cache's hour
const ENDED = { key: 'ended', plugin: 'x-mod-stash' } as const;
// a 📄 line's HH:MM — the same shape reply-check.py reads
const STAMP = /(📄[^\n]*?\b)(\d{1,2}:\d{2})\b/g;
const PING =
    'x-mod-stash keep-hot ping: answer with one character, nothing else.';
// the waker: one global switch, off by default; when on, a session stopped on the 5h cap gets one resume at the reset
const WAKER_KEY = 'waker';
const CAP = { key: 'cap', plugin: 'x-mod-stash' } as const;
// the band's meters, written on every session.measure
const METER = { key: 'meter', plugin: 'x-mod-stash' } as const;
// the 5h cap ends the turn as an API error with this text; the weekly cap and spent credits read otherwise
// (8 rows in the transcripts, 2026-10-08)
const CAPPED = /hit your session limit/i;
const RESUME =
    'x-mod-stash waker: the 5h window reset. pick up where you stopped.';
// a few seconds past the reset, so the window has turned before the resume goes out
const WAKE_SLACK_MS = 5000;
const ACCENT = '#d97757';
// 🪐 orbit: the session's asks to dima, ticked in the board instead of pasted back; the session writes them through
// its own tool, never a reply block
const ORBIT = { key: 'orbit', plugin: 'x-mod-stash' } as const;
const ORBIT_TOOL = 'mcp__x-mod-stash__orbit';
// the phases guard, no extra turn and no Stop block: one line at the first prompt, one nudge in a turn's tool results (dima's o14)
const PHASES_START = `phases are your live plan: set them with ${ORBIT_TOOL}'s plan op and keep them current as the work moves.`;
const NUDGE_AT = 3;
// mobile mode: mods draw nothing on the phone, so the session prints the open asks as the asks fence instead
const MOBILE = { key: 'mobile', plugin: 'x-mod-stash' } as const;
// a board card folded to its head row, per session (dima's o5, 17:16)
const FOLDS = { key: 'folds', plugin: 'x-mod-stash' } as const;
const MOBILE_SKILL = /(^|:)mobile-mode$/;
const MOBILE_OFF = /ARGUMENTS:\s*off\b/i;
const BACK_AT_MAC = /\bback at the mac\b/i;
// the prompt enhancer: Haiku rewrites the box on a press; prev and new swap the two texts back with no call
const ENHANCER = { key: 'enhancer', plugin: 'x-mod-stash' } as const;
const ENHANCE_MODEL = 'claude-haiku-5-5';
const ENHANCE_MS = 30_000;
const WISPR_DB = 'Library/Application Support/Wispr Flow/flow.sqlite';
let isEnhancing = false;
const TICKET_ID_ALL = /(?<!\[)\b(?:FRM|BYT)-\d+\b(?!\])/g;
const PLAN_MAX = 7;
const STALE_TURNS = 3;
// a plan line's lead word, one short word before its colon
const PLAN_LEAD = /^[a-z]{2,10}:/i;
const PHASE_MOONS = ['🌕', '🌔', '🌓', '🌒', '🌑'];
// a followed-up ask's mark, before its id so the text keeps the full width — a try, dima may swap the glyph (o6)
const CHANGED_MARK = '🆕';
// a quarter row between a block's lines: the desktop draws the fraction, the terminal rounds it away (dima, 21:22)
const LINE_GAP = 0.25;
// the board's sections sit in cards, no colour (dima, 16:48 «colors are ugly»): the desktop a 30 % grey that reads the same on
// light and dark, a touch softer than `subtle` (16:54 too faint, 17:00 «too hard», 17:08 «slightly less»); the terminal `subtle`
const cardBorder = (surface: string) =>
    surface === 'desktop' ? '#8080804d' : 'subtle';
// an ask, a follow-up or a phase reads at a glance in the narrow board (dima's o60, 22:13)
const ORBIT_TEXT_MAX = 90;
// at most this many assumptions a turn, and on the board at once (FRM-382 exit 2: under one a turn on average)
const ASSUMED_MAX = 3;
const ASSUMED_TURNS = 3;
// a ticket id inside an ask or a phase; split keeps the id as every odd part
const TICKET_IDS = /\b((?:FRM|BYT)-\d+)\b/;
const ORBIT_ABOUT = [
    "orbit is dima's list of your asks to him, in the fleet board: he rings 🛎️ take when your pick is good to go, 🔁 redo for another round, adds a note; the marked ones reach you as model-only context. it is the one door for asks: an ask goes here, never into a reply. a background (--bg) session draws no board, so it sends its asks to its coordinator instead.",
    `op add, asks [{ text, pick, hiddenNote }]: text is one line that reads alone after 20 more pile up (what is asked, never «above» or «this»), ≤${ORBIT_TEXT_MAX} chars, subject first, detail in hiddenNote; pick is your recommendation; hiddenNote is yours alone, where it came from and what a tick means. an ask for something irreversible (trash, push, close, merge) leads with ⚠️ and names the exact target. new asks append.`,
    'op resolve, ids: the asks you answered this turn; they leave orbit when the turn ends.',
    `op follow, id, text, pick: an answered ask that needs another round keeps its id and place with the new text (≤${ORBIT_TEXT_MAX} chars) and a ${CHANGED_MARK} mark before its id.`,
    `op assume, texts: choices you made without asking that would cost a redo if wrong, at most ${ASSUMED_MAX} a turn and ≤${ORBIT_TEXT_MAX} chars each; never routine ones. dima's 🛎️ clears one, ↩️ sends it back with his note.`,
    `op plan, lines: your next ${PLAN_MAX} moves, now, next, then, each readable alone and ≤${ORBIT_TEXT_MAX} chars; set it at each turn end; a plan untouched for ${STALE_TURNS} turns reads stale.`,
].join('\n');

let selfId: string | undefined;
let label = 'session';
let isUserTurn = false;
// what this session's last reply waits on, its 🔭 line
let wait: string | undefined;
let pinged = false;
let isPolling = false;
let afk = false;
let isWaker = false;
let shown: Record<string, boolean> = {};
let isSettingsOpen = false;
// the main thread's tool calls this turn, and whether its one phases nudge went out
let turnTools = 0;
let isNudged = false;
let isPrimed = false;
// the 5h reset as the last session.measure reported it, and this session's cap state
let fiveHourResetsAt: number | undefined;
// the dir the session started in: its project, whose .claude settings the threshold input writes
let projectDir: string | undefined;
let cap: StashCap | undefined;
let capGen = 0;
let turnAfk: boolean | undefined;
let proc: Proc | undefined;
// since: the turn end the next ping counts from; only dima's click turns it off, a 5h reset never does
let hot: { since: number } | undefined;
let endedAt: number | undefined;
let isBusy = false;
// the model label last written for this session, so a step writes the store only when it changes
let modelSeen: string | undefined;
// a turn start or a flip bumps it, so a ping armed before either never fires
let hotGen = 0;

// what the fleet did while dima was afk, shown in the band where he turned 💨 off until his next prompt
type Digest = StashDigest;
let digest: Digest | undefined;

const EMPTY_ORBIT: StashOrbit = { asks: [], next: 1, turns: 0 };
// mirrors `$.state`'s orbit, which survives a reload: a get inside one dispatch reads the moment it began
let orbit: StashOrbit = EMPTY_ORBIT;

// one json line to x-speak's control socket; the text rides argv, never the shell's words
async function speak($: EngineInterface, request: Record<string, string>) {
    const socket = `${await $.env.get('HOME')}/.local/share/x-speak/control.sock`;
    const r = await $.process
        .run([
            'sh',
            '-c',
            'printf "%s\\n" "$1" | nc -U -w 2 "$2"',
            'sh',
            JSON.stringify(request),
            socket,
        ])
        .catch(() => undefined);
    if (!r || r.exitCode !== 0 || r.stdout.includes('"error"'))
        $.ui.log(
            `x-mod-stash orbit: speak did not take ${request.op}: ${r?.stdout.trim() || r?.stderr.trim() || 'no answer'}`,
        );
}

// kept in $.state for this session, and its open asks mirrored into the store, where the board's `🪐 n` and the away
// digest count every session's
async function saveOrbit($: EngineInterface, next: StashOrbit) {
    orbit = next;
    await $.state
        .set(ORBIT, orbit)
        .catch((err) =>
            $.ui.log(`x-mod-stash: orbit was not kept: ${errorText(err)}`),
        );
    const sid = await currentId($);
    if (!sid) return;
    const asks = orbit.asks.filter((a) => !a.isResolved).map((a) => a.text);
    if (asks.length)
        await $.store
            .set(PREFIX + sid, {
                asks,
                at: await $.clock.now(),
                label,
                name: await sessionName($),
            } satisfies Entry)
            .catch(() => undefined);
    else await $.store.delete(PREFIX + sid).catch(() => undefined);
}

// the orbit as $.state holds it now: a reload can run a hook before session.start reads it back, and a module copy
// that never loaded would write an empty orbit over the kept one (FRM-381: «coder wiped the orbit»)
async function currentOrbit($: EngineInterface) {
    const kept = (await $.state.get(ORBIT).catch(() => undefined))?.value;
    if (kept) orbit = kept;
    return orbit;
}

const markWord = (mark: OrbitAsk['mark']) =>
    mark === 'accepted' ? '🛎️ accepted' : '↩️ rejected';

// what the session reads for each assumption dima sent back: the assumption and his note
const wrongText = (wrong: OrbitAssumption[]) =>
    [
        `orbit: dima marked ${wrong.length === 1 ? 'an assumption' : `${wrong.length} assumptions`} wrong; take it into account in this reply.`,
        ...wrong.map(
            (x) =>
                `- ${x.id} wrong assumption: ${x.text}` +
                (x.note ? ` · his note: «${x.note}»` : ''),
        ),
    ].join('\n');

// what the session reads for each marked ask: the mark, the ask, its pick, both notes
function joinText(asks: OrbitAsk[]) {
    const lines = asks.map(
        (a) =>
            `- ${a.id} ${markWord(a.mark)}: ${a.text} (your pick: ${a.pick})` +
            (a.note ? ` · his note: «${a.note}»` : '') +
            (a.hiddenNote ? ` · your note: «${a.hiddenNote}»` : ''),
    );
    return [
        `orbit: dima marked ${asks.length === 1 ? 'an ask' : `${asks.length} asks`}. answer each in this reply, then call ${ORBIT_TOOL}: resolve the answered ids, or follow one that needs another round.`,
        ...lines,
    ].join('\n');
}

// a plan set this turn counts from the turn's end, so a prompt landing mid-turn would read it as -1
const planAge = (o: StashOrbit) =>
    o.plan === undefined ? undefined : Math.max(0, o.turns - o.plan.at);

// the per-prompt note that keeps the habit through a compaction; none while orbit is empty
function orbitReminder(o: StashOrbit) {
    const open = o.asks.filter((a) => !a.isResolved);
    const age = planAge(o);
    if (!open.length && age === undefined) return undefined;
    const asks = open.length
        ? `orbit holds ${open.length} open ask${open.length === 1 ? '' : 's'} (${open.map((a) => a.id).join(', ')})`
        : 'orbit holds no open ask';
    const plan =
        age === undefined
            ? 'no plan set'
            : `plan set ${age} turn${age === 1 ? '' : 's'} ago${age >= STALE_TURNS ? ', stale: set it again' : ''}`;
    return `${asks}; ${plan}. asks and the plan go through ${ORBIT_TOOL}, never into a reply.`;
}

// on mobile the asks reach dima only through the reply: the asks fence, its header line kept as the skill prints it
function mobileReminder(o: StashOrbit) {
    const open = o.asks.filter((a) => !a.isResolved);
    const ids = open.length ? ` (${open.map((a) => a.id).join(', ')})` : '';
    // the phases are gone on mobile too: the plan's next 3 moves print under the fence (dima's o112, 2026-10-11)
    const age = planAge(o);
    const stale =
        age !== undefined && age >= STALE_TURNS
            ? ` the plan is stale, untouched ${age} turns: set it again through ${ORBIT_TOOL}.`
            : '';
    return `dima is on mobile, where the board draws nothing: end the reply with the asks fence, «⏳ waiting on your word:» and every open orbit ask${ids} with its id and pick, then «🌔 next:» and the plan's next 3 moves as bullets, and write his answer by id back through ${ORBIT_TOOL} the same turn.${stale}`;
}

const enhancerOf = async ($: EngineInterface): Promise<StashEnhancer> =>
    (await $.state.get(ENHANCER)).value ?? { status: 'idle' };
const saveEnhancer = ($: EngineInterface, next: StashEnhancer) =>
    $.state.set(ENHANCER, next).catch(() => undefined);

// what Haiku reads beside the prompt: the rules, every slash command by name, and dima's wispr dictionary
async function enhancerSystem($: EngineInterface) {
    const rules = await $.fs.read(`${$.plugin.root}/enhancer.md`);
    const commands = (await $.command.list().catch(() => []))
        .map((c) => `/${c.name} — ${c.description}`)
        .join('\n');
    const dictionary = await $.process
        .run([
            'sqlite3',
            '-readonly',
            '-separator',
            ' → ',
            `${await $.env.get('HOME')}/${WISPR_DB}`,
            'select coalesce(isSnippet, 0), phrase, replacement from Dictionary where isDeleted = 0 and replacement is not null',
        ])
        .catch(() => undefined);
    // only the mishearing rows: wispr flags a snippet (a short cue for a long text), whose extra lines lead with no flag
    // (dima, 2026-10-11 11:11)
    const heard =
        dictionary?.exitCode === 0
            ? dictionary.stdout
                  .split('\n')
                  .filter((l) => l.startsWith('0 → '))
                  .map((l) => l.slice('0 → '.length))
                  .join('\n')
            : '(unreadable now)';
    return [
        { text: rules },
        { text: `the slash commands:\n${commands}` },
        {
            cache: true as const,
            text: `dima's dictionary, heard → meant:\n${heard}`,
        },
    ];
}

// what each ticket a prompt names is, read through `x linear`, so the session starts with it instead of looking it up;
// x down or an unknown id adds nothing (dima's o14, 23:07)
async function ticketNote($: EngineInterface, text: string) {
    const ids = [...new Set(text.match(TICKET_ID_ALL) ?? [])];
    if (!ids.length) return undefined;
    const r = await $.process
        .run([
            `${await $.env.get('HOME')}/.local/bin/x`,
            'linear',
            'read',
            ...ids,
        ])
        .catch(() => undefined);
    if (r?.exitCode !== 0) return undefined;
    try {
        const tickets =
            (
                JSON.parse(r.stdout) as {
                    data?: {
                        tickets?: {
                            id?: string;
                            title?: string;
                            state?: string;
                            url?: string;
                        }[];
                    };
                }
            ).data?.tickets ?? [];
        const lines = tickets.flatMap((x) =>
            x.id && x.url
                ? [`${x.id}: ${x.title ?? ''} · ${x.state ?? ''} · ${x.url}`]
                : [],
        );
        return lines.length
            ? `the tickets this prompt names, read from linear:\n${lines.join('\n')}`
            : undefined;
    } catch {
        return undefined;
    }
}

// one call per press; a keystroke while it runs keeps his text and drops the answer, an error leaves the box alone
async function enhance($: EngineInterface) {
    // set before any await, so a second press in the same moment finds it
    if (isEnhancing) return;
    isEnhancing = true;
    try {
        await enhanceOnce($);
    } finally {
        isEnhancing = false;
    }
}

async function enhanceOnce($: EngineInterface) {
    const before = await enhancerOf($);
    const pressed = (await $.prompt.read()).text;
    if (!pressed.trim()) return;
    await saveEnhancer($, { ...before, error: undefined, status: 'running' });
    const stop = new AbortController();
    const timer = $.clock.after(ENHANCE_MS, () => stop.abort());
    let answer: string | undefined;
    let failure: string | undefined;
    try {
        const r = await $.model.complete(
            {
                maxTokens: 2048,
                model: ENHANCE_MODEL,
                prompt: pressed,
                system: await enhancerSystem($),
            },
            { signal: stop.signal },
        );
        if (r.isAnswered && r.text.trim()) answer = r.text.trim();
        else
            failure = stop.signal.aborted
                ? `Haiku took over ${ENHANCE_MS / 1000} s`
                : `Haiku gave no prompt back (${r.isAnswered ? 'empty' : r.reason})`;
    } catch (err) {
        failure = errorText(err);
    }
    timer.cancel();
    // read again, not `before`: a send while Haiku answered cleared ⏪ ⏩, and that stays
    const now = await enhancerOf($);
    if ((await $.prompt.read()).text !== pressed)
        return saveEnhancer($, { ...now, status: 'idle' });
    if (answer === undefined)
        return saveEnhancer($, {
            ...now,
            error: `enhance: ${failure}; your text is untouched`,
            status: 'idle',
        });
    if (answer === pressed)
        return saveEnhancer($, {
            ...now,
            error: 'enhance: Haiku found nothing to change',
            status: 'idle',
        });
    const filled = await $.prompt.fill({ text: answer });
    // a refused fill keeps the answer, so new can try the box again
    await saveEnhancer($, {
        error: filled.isFilled
            ? undefined
            : `enhance: the box did not take the answer (${filled.refusal ?? 'a hook kept it out'}); press new to retry`,
        latest: answer,
        original: pressed,
        status: 'idle',
    });
}

// prev keeps whatever he changed in the enhanced text, so new brings his edits back with it
async function enhancePrev($: EngineInterface) {
    const s = await enhancerOf($);
    if (s.status === 'running' || s.original === undefined) return;
    const box = (await $.prompt.read()).text;
    // an empty box is a sent prompt, never an edit: it keeps the enhanced text for new
    const latest = box === s.original || !box.trim() ? s.latest : box;
    await saveEnhancer($, { ...s, error: undefined, latest });
    await $.prompt.fill({ text: s.original });
}

async function enhanceNew($: EngineInterface) {
    const s = await enhancerOf($);
    if (s.status === 'running' || s.latest === undefined) return;
    const filled = await $.prompt.fill({ text: s.latest });
    await saveEnhancer($, {
        ...s,
        error: filled.isFilled
            ? undefined
            : `enhance: the box did not take the text (${filled.refusal ?? 'a hook kept it out'})`,
    });
}

const oneLine = (v: unknown) =>
    typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
const idsOf = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

// dima marks or notes asks; a locked ask is the running turn's and stays as it is. a mark made while a turn runs
// rides that turn's next tool result (the tool.call hook); one the turn never reaches rides his next prompt — a
// hidden message appended instead started a turn of its own when it landed after the last read (dima, 20:31)
// 🛎️ clears an assumption, ↩️ and its note mark it wrong; a 🛎️ or ↩️ press means dima is at the mac (dima, 11:16)
async function changeAssumed(
    $: EngineInterface,
    change: (x: OrbitAssumption) => OrbitAssumption | undefined,
    isMark = false,
) {
    if (isMark) await $.state.set(MOBILE, false).catch(() => undefined);
    const o = await currentOrbit($);
    await saveOrbit($, {
        ...o,
        assumed: (o.assumed ?? []).flatMap((x) => {
            const changed = change(x);
            return changed ? [changed] : [];
        }),
    });
}

async function markAsks(
    $: EngineInterface,
    change: (a: OrbitAsk) => OrbitAsk,
    isMark = false,
) {
    // only a 🛎️ or ↩️ press means dima is at the mac: a note or a speak press never ends mobile mode (dima, 11:16)
    if (isMark) await $.state.set(MOBILE, false).catch(() => undefined);
    const o = await currentOrbit($);
    const asks = o.asks.map((a) =>
        a.isLocked || a.isResolved ? a : change(a),
    );
    await saveOrbit($, { ...o, asks });
}

// the tool's ops on orbit; `isTurn` decides whether a plan set now counts from this turn's end or the last one
// the first text over the cap, named with its length, so the session can shorten that one
function overCap(op: string, texts: string[]) {
    const long = texts.find((x) => [...x].length > ORBIT_TEXT_MAX);
    return long === undefined
        ? undefined
        : {
              deny: `orbit ${op}: «${[...long].slice(0, 40).join('')}…» is ${[...long].length} chars; keep it ≤${ORBIT_TEXT_MAX}, subject first, detail in hiddenNote`,
          };
}

function orbitOp(
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
                                  // his note answered the old question
                                  note: undefined,
                                  pick: oneLine(input.pick) || a.pick,
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
                deny: `orbit: op is add, resolve, follow or plan, got «${String(input.op)}»`,
            };
    }
}

// a thread's asks show while it has any and they are under a day old
const isLive = (v: Entry | undefined, now: number): v is Entry =>
    !!v && Array.isArray(v.asks) && v.asks.length > 0 && now - v.at < STALE_MS;

const errorText = (err: unknown) =>
    err instanceof Error ? err.message : String(err);

const basename = (path: string) =>
    path.split('/').filter(Boolean).pop() ?? path;

type Proc = { pid: number; start: string };

const short = (sid: string) => sid.slice(0, 8);

// the name ListAgents shows lives in the session registry, keyed by the claude process id
async function sessionName($: EngineInterface) {
    if (!proc) return undefined;
    const home = await $.env.get('HOME');
    const raw = await $.fs
        .read(`${home}/.claude/sessions/${proc.pid}.json`)
        .catch(() => undefined);
    if (!raw) return undefined;
    try {
        const { name } = JSON.parse(raw) as { name?: unknown };
        return typeof name === 'string' && name ? name : undefined;
    } catch {
        return undefined;
    }
}

async function procOf($: EngineInterface): Promise<Proc | undefined> {
    const r = await $.process.run([
        'sh',
        '-c',
        'echo $PPID; ps -o lstart= -p $PPID',
    ]);
    const [pid, start] = r.stdout.split('\n').map((s) => s.trim());
    return r.exitCode === 0 && pid && start
        ? { pid: Number(pid), start }
        : undefined;
}

// everything this mod keeps for one conversation
async function forget($: EngineInterface, sid: string) {
    await $.store.delete(PREFIX + sid);
    await $.store.delete(HOT + sid);
    await $.store.delete(REPLY + sid);
    await $.store.delete(CONTEXT + sid);
    await $.store.delete(MODEL + sid);
}

// a session that exited keeps only its last reply, marked ended, so an away digest still counts it as done
async function retire($: EngineInterface, sid: string) {
    const reply = (await $.store.get(REPLY + sid)) as Reply | undefined;
    await forget($, sid);
    if (reply)
        await $.store.set(REPLY + sid, {
            ...reply,
            ended: await $.clock.now(),
        } satisfies Reply);
}

// an ended session's reply is dropped a day after it ended
async function pruneEnded($: EngineInterface) {
    const now = await $.clock.now();
    for (const key of await $.store.keys()) {
        if (!key.startsWith(REPLY)) continue;
        const v = (await $.store.get(key)) as Reply | undefined;
        if (v?.ended !== undefined && now - v.ended >= STALE_MS)
            await $.store.delete(key);
    }
}

// one `words:<yyyy-mm-dd>:<session>` key a day, the fleet words a reply had bolded for it, so a halt reads the hits;
// a key past WORDS_DAYS is dropped
const WORDS = 'words:';
const WORDS_DAYS = 30;
async function countWords($: EngineInterface, hits: Record<string, number>) {
    const at = await $.clock.now();
    const day = (ms: number) => new Date(ms).toLocaleDateString('sv');
    const key = `${WORDS}${day(at)}:${await $.session.id()}`;
    const was = ((await $.store.get(key)) ?? {}) as Record<string, number>;
    const next = { ...was };
    for (const [word, n] of Object.entries(hits))
        next[word] = (next[word] ?? 0) + n;
    await $.store.set(key, next);
    const oldest = `${WORDS}${day(at - WORDS_DAYS * 86_400_000)}`;
    for (const old of await $.store.keys())
        if (old.startsWith(WORDS) && old < oldest) await $.store.delete(old);
}

async function load($: EngineInterface) {
    const flag = (await $.store.get(AFK_KEY)) as { on?: boolean } | undefined;
    afk = flag?.on === true;
    const waker = (await $.store.get(WAKER_KEY)) as
        | { on?: boolean }
        | undefined;
    isWaker = waker?.on === true;
    shown = shownOf(await $.store.get(SHOWN).catch(() => undefined));
    // after a /clear the process goes on under a new id, and no session.start fires
    selfId = await $.session.id().catch(() => selfId);
    // the band's 🔭 line: what this session's last reply said it waits on
    const reply = selfId
        ? ((await $.store.get(REPLY + selfId).catch(() => undefined)) as
              | Partial<Reply>
              | undefined)
        : undefined;
    wait = reply?.wait;
    await publish($);
}

// the band's view the module's values make
function viewOf(isBoardOpen: boolean): StashView {
    return {
        afk,
        digest,
        isBoardOpen,
        isHot: Boolean(hot),
        isSettingsOpen,
        isWaker,
        selfId,
        shown,
        wait,
    };
}

// the store's switches, any non-boolean dropped: a broken value never hides a part
function shownOf(v: unknown): Record<string, boolean> {
    if (!v || typeof v !== 'object') return {};
    return Object.fromEntries(
        Object.entries(v).filter(([, on]) => typeof on === 'boolean'),
    );
}

// a capped session's resume, armed for the reset it waits on; a turn start or a new cap bumps capGen, so an old timer
// never fires
async function armWake($: EngineInterface) {
    const mine = ++capGen;
    const at = cap?.resetsAt;
    if (at === undefined || cap?.sentFor === at) return;
    const wait = at + WAKE_SLACK_MS - (await $.clock.now());
    $.clock.after(Math.max(0, wait), async () => {
        if (mine !== capGen || isBusy || !cap) return;
        // the reset is spent at its fire, switch on or off: ⏰ flipped on later never wakes a reset already past (o102)
        cap = { ...cap, sentFor: at };
        await $.state.set(CAP, cap).catch(() => undefined);
        const waker = (await $.store.get(WAKER_KEY)) as
            | { on?: boolean }
            | undefined;
        if (waker?.on !== true) return;
        $.ui.log('x-mod-stash waker: resumed the session after the 5h reset');
        await $.prompt.submit({ text: RESUME });
    });
}

// the rate-limit mirror every fleet reader takes (cclio's boot, the designer), in sline's old shape: seconds, and
// `null` for a window the response did not report; this mod is its one writer
async function saveUsage(
    $: EngineInterface,
    limits: { kind: string; percentUsed: number; resetsAt?: string }[],
) {
    const window = (kind: string) => {
        const w = limits.find((l) => l.kind === kind);
        return w
            ? {
                  resets_at: w.resetsAt
                      ? Math.round(Date.parse(w.resetsAt) / 1000)
                      : null,
                  used_percentage: w.percentUsed,
              }
            : null;
    };
    await $.fs.write(
        `${await $.env.get('HOME')}/.claude/shelf/cc-usage-window.json`,
        JSON.stringify({
            rate_limits: {
                five_hour: window('five_hour'),
                seven_day: window('seven_day'),
            },
            written_at: Math.round((await $.clock.now()) / 1000),
        }),
    );
}

// an idle band stays live: every session shares one 5h window, so the usage file any busy session writes carries its
// latest reading, and the minute moves the time left; written only when one of the two changed
async function freshMeter($: EngineInterface) {
    const was = (await $.state.get(METER)).value ?? {};
    const raw = await $.fs
        .read(`${await $.env.get('HOME')}/.claude/shelf/cc-usage-window.json`)
        .catch(() => undefined);
    const window = raw
        ? (
              JSON.parse(raw) as {
                  rate_limits?: {
                      five_hour?: {
                          used_percentage?: unknown;
                          resets_at?: unknown;
                      } | null;
                  };
              }
          ).rate_limits?.five_hour
        : undefined;
    const fiveHour =
        typeof window?.used_percentage === 'number'
            ? {
                  resetsAt:
                      typeof window.resets_at === 'number'
                          ? window.resets_at * 1000
                          : undefined,
                  used: window.used_percentage,
              }
            : was.fiveHour;
    const next = {
        ...was,
        fiveHour,
        minute: Math.floor((await $.clock.now()) / 60_000),
    };
    if (JSON.stringify(next) !== JSON.stringify(was))
        await $.state.set(METER, next);
}

// the engine's own compaction point as a % of the window, whatever set it: the project's override, or cc's default
async function compactAtOf($: EngineInterface, window: number) {
    // the override as cc resolves it for this session: the settings merged for its project (cclio's 70 sits in
    // ~/frame/cclio/.claude/settings.json), then the process env; the engine's breakdown reports its default either way
    const merged = await $.settings.read().catch(() => undefined);
    const set =
        (typeof merged?.env === 'object' && merged.env
            ? (merged.env as Record<string, unknown>)
                  .CLAUDE_AUTOCOMPACT_PCT_OVERRIDE
            : undefined) ??
        (await $.env.get('CLAUDE_AUTOCOMPACT_PCT_OVERRIDE'));
    const override = Number(set);
    if (set !== undefined && Number.isInteger(override) && override > 0)
        return override;
    const usage = await $.session
        .usage({ breakdown: 'summary' })
        .catch(() => undefined);
    const tokens = usage?.context.breakdown?.autoCompactThreshold;
    return tokens && window ? Math.round((tokens / window) * 100) : undefined;
}

// a typed compaction point: a whole 10–99 goes into the launch dir's .claude settings `env`, keeping every
// other key; anything else, or a file that is not json, leaves the file alone and says why in one line
// typing saves each valid value as it lands; a half-typed one («8» on the way to «85») is skipped quietly, and only
// Enter names a refusal (dima, 23:31)
async function setCompactAt(
    $: EngineInterface,
    text: string,
    isTyping = false,
) {
    const was = (await $.state.get(METER)).value ?? {};
    const keep = async (note?: string) =>
        $.state
            .set(METER, { ...((await $.state.get(METER)).value ?? {}), note })
            .catch(() => undefined);
    const typed = thresholdOf(text);
    if ('refusal' in typed) {
        // a refused text takes back the saves typing made on the way to it: «10» on the way to «100»
        const t = text.trim();
        while (
            compactTrail.length > 1 &&
            t.startsWith(String(compactTrail.at(-1)))
        )
            compactTrail.pop();
        const back = compactTrail.at(-1);
        if (back !== undefined && back !== was.compactAt)
            await setCompactAt($, String(back), true);
        if (isTyping) return;
        compactTrail = [];
        return keep(typed.refusal);
    }
    if (!compactTrail.length && was.compactAt !== undefined)
        compactTrail.push(was.compactAt);
    compactTrail = isTyping ? [...compactTrail, typed.value] : [];
    // the launch dir cc keeps in the registry is the project its settings resolve from; session.start's cwd can be a
    // later one (cclio's read ~/frame while it launched in ~/frame/cclio, 2026-10-09)
    const launched = proc
        ? await $.fs
              .read(
                  `${await $.env.get('HOME')}/.claude/sessions/${proc.pid}.json`,
              )
              .then((raw) => {
                  const { cwd } = JSON.parse(raw) as { cwd?: unknown };
                  return typeof cwd === 'string' && cwd ? cwd : undefined;
              })
              .catch(() => undefined)
        : undefined;
    const dir = launched ?? projectDir;
    if (!dir) return keep('no project dir for this session');
    // a repo top's own settings.local.json outranks every subdir's, its shared settings.json does not (probed
    // 2026-10-10): the top writes the shared file, so a subdir session (cclio in ~/frame/cclio) keeps its own value
    const root = (await $.session.repo().catch(() => undefined))?.root;
    const path = `${dir}/.claude/${dir === root ? 'settings.json' : 'settings.local.json'}`;
    let settings: Record<string, unknown> = {};
    if (await $.fs.exists(path)) {
        try {
            const parsed: unknown = JSON.parse(await $.fs.read(path));
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
                return keep(`${path} is not a json object, left as it is`);
            settings = parsed as Record<string, unknown>;
        } catch {
            return keep(`${path} is not json, left as it is`);
        }
    }
    const env =
        settings.env && typeof settings.env === 'object'
            ? (settings.env as Record<string, unknown>)
            : {};
    await $.fs.write(
        path,
        `${JSON.stringify({ ...settings, env: { ...env, CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: String(typed.value) } }, null, 2)}\n`,
    );
    await $.state
        .set(METER, { ...was, compactAt: typed.value, note: undefined })
        .catch(() => undefined);
}

let published = '';
let boardPublished = '';
// the compaction field's typing run: the value before it, then each value typing saved; Enter ends the run
let compactTrail: number[] = [];
// writes the view to $.state when it changed; every site that reads it while drawing redraws
async function publish($: EngineInterface) {
    const isBoardOpen = await isOpen($);
    if (isBoardOpen) {
        // each board write redraws the pane, and the desktop then rebuilds the bars' svg in the band (a blink and a
        // restarted breath, FRM-354): it writes only when what the board shows changes — a row's facts, or a span such as
        // `busy 3m` turning its minute — never for the clock alone
        const now = await $.clock.now();
        const board = {
            at: now,
            isColour: (await $.store.get(COLOUR).catch(() => false)) === true,
            members: await members($).catch(() => undefined),
        };
        const boardText = JSON.stringify({
            ...board,
            at: board.members?.map((m) =>
                m.statusSince === undefined ? null : span(now - m.statusSince),
            ),
        });
        if (boardText !== boardPublished) {
            boardPublished = boardText;
            await $.state.set(BOARD_VIEW, board).catch(() => undefined);
        }
    }
    const view = viewOf(isBoardOpen);
    const text = JSON.stringify(view);
    if (text === published) return;
    published = text;
    await $.state
        .set(VIEW, view)
        .catch((err) =>
            $.ui.log(`x-mod-stash: the view was not kept: ${errorText(err)}`),
        );
}

async function keepTurn($: EngineInterface) {
    await $.state
        .set(TURN, { afk: turnAfk, isBusy, isPinged: pinged, isUserTurn })
        .catch(() => undefined);
}

// this session's id as session.start read it, else asked now; undefined when the engine cannot say
async function currentId($: EngineInterface) {
    return selfId ?? (await $.session.id().catch(() => undefined));
}

async function saveHot($: EngineInterface) {
    const sid = await currentId($);
    if (!sid) return;
    if (hot) await $.store.set(HOT + sid, hot);
    else await $.store.delete(HOT + sid);
}

async function armHot($: EngineInterface) {
    const mine = ++hotGen;
    if (!hot || isBusy) return;
    const wait = hot.since + HOT_MS - (await $.clock.now());
    $.clock.after(Math.max(0, wait), async () => {
        if (!hot || isBusy || mine !== hotGen) return;
        $.ui.log('x-mod-stash keep-hot: pinged the idle session');
        await $.prompt.submit({ text: PING });
    });
}

type Member = StashMember;

// `claude-opus-5-5` + `medium` reads «opus 5.5 · medium»; a dated or `[1m]` id drops its tail, an id off the pattern shows as written
function modelLabel(model: string, effort?: string | number) {
    const m = model.match(
        /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?=$|-\d{8}|\[)/,
    );
    const name = m ? `${m[1]} ${m[2]}${m[3] ? `.${m[3]}` : ''}` : model;
    return effort === undefined ? name : `${name} · ${effort}`;
}

// the colour look, borrowed from the reference on FRM-329: calm by default, each member's dot its own hue, and a
// colour only where something is live — theme keys follow light and dark; orange stays the asks' alone
// six mid-tones at 3.6:1 or more on white and 4.2:1 on a dark pane; no coral, which would read as the asks' orange
const HUES = [
    '#4f83e0',
    '#2f8f8a',
    '#a87f12',
    '#47915a',
    '#9a74c9',
    '#c4689f',
] as const;
// each member's hue: the one its name hashes to, so it holds across reloads, or the next free one when an earlier
// row took it — up to six members never share a colour
export function huesOf(names: string[]) {
    const used = new Set<number>();
    return names.map((name) => {
        let h = 0;
        for (const c of name) h = (h * 31 + (c.codePointAt(0) ?? 0)) >>> 0;
        let at = h % HUES.length;
        for (let n = 0; n < HUES.length && used.has(at); n++)
            at = (at + 1) % HUES.length;
        used.add(at);
        return HUES[at];
    });
}
// cc's registry status: the word the board shows, and its tint with colour on. `shell` is a long command
// inside a turn, so it reads busy; a status cc adds later reads as itself, amber
const STATUS = {
    blocked: { tint: 'error', word: 'blocked' },
    busy: { tint: 'success', word: 'busy' },
    idle: { tint: undefined, word: 'idle' },
    needs_input: { tint: 'warning', word: 'needs_input' },
    shell: { tint: 'success', word: 'busy' },
    waiting: { tint: 'warning', word: 'waiting' },
} as const satisfies Record<string, { tint: string | undefined; word: string }>;
const isStatus = (status: string): status is keyof typeof STATUS =>
    Object.hasOwn(STATUS, status);
const statusOf = (status: string | undefined) =>
    status !== undefined && isStatus(status)
        ? STATUS[status]
        : { tint: 'warning', word: status ?? '?' };
// sline's bar ramp, yellow, orange, red, tuned to 3.2:1 or more on a light pane and 4.2:1 on a dark one
const RAMP = ['#b98500', '#d9661a', '#e5484d'] as const;
// a calm context is dim; a filling one climbs the ramp
const contextTint = (percent: number) =>
    percent >= 80
        ? RAMP[2]
        : percent >= 65
          ? RAMP[1]
          : percent >= 50
            ? RAMP[0]
            : undefined;
// the prompt cache lives an hour: an idle session stays gray, then climbs the ramp as it cools, red from half the
// cache's life; cold past all of it
const COOLING_MS = [15 * 60_000, 22 * 60_000, 30 * 60_000] as const;
const COLD_MS = 60 * 60_000;

// the meters: a bar of whole cells, the reading filled and one cell marked — the pace on the 5h bar, the compaction
// point on the context one; runs of one kind come out joined, so each draws as one Text
// sline's bar ramp, cell by cell — green, yellow, orange, red — so a bar warms as it fills (sline/usage.go `barRamp`)
const BAR_RAMP = [
    '#a9b665',
    '#b5ba61',
    '#c1b25d',
    '#cdac5a',
    '#d8a657',
    '#e09852',
    '#e78a4e',
    '#e87f47',
    '#e97454',
    '#ea6962',
] as const;
export type BarRun = {
    kind: 'fill' | 'empty' | 'mark';
    text: string;
    color?: string;
    tone?: 'hi';
};
// the breathing (FRM-391), dima's pick C2 (2026-10-11 12:53, kept 13:01 over C): while a turn runs most lit cells spark
// white-hot now and then and cool back through a slow afterglow, each on its own seeded period, so a few embers are always
// cooling; the bars' length, labels and values never change, a flash may tint a cell (dima's o55), and an idle bar stands
// still (no ticks, no GPU)
// dima 12:58 «speed 0.5»: 16 s, so a cell sparks every 3.2–8.8 s
const BREATH_MS = 16000;
// the spark's shape over its period: dark, a flash, a slow cool-down
const EMBER_KEYS = [0, 0.5, 0.56, 0.66, 0.8, 1] as const;
const EMBER_GLOW = [0, 0, 1, 0.6, 0.25, 0] as const;
const EMBER_COLOR = '#ffe08a';
// a seeded hash, so a cell sparks the same way on every redraw and both surfaces agree
function seeded(n: number) {
    let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
    x ^= x >>> 13;
    x = Math.imul(x, 0xc2b2ae35);
    x ^= x >>> 16;
    return (x >>> 0) / 2 ** 32;
}
/** a cell's spark: whether it has one, its period and its offset into it, in ms */
export function emberOf(cell: number, row: number, breathMs = BREATH_MS) {
    const k = cell * 2 + row;
    return {
        isOn: seeded(k * 3 + 1) < 0.85,
        offsetMs: seeded(k * 3 + 3) * breathMs,
        periodMs: breathMs * (0.2 + seeded(k * 3 + 2) * 0.35),
    };
}
// one bar as cells: the reading filled, one cell marked — the pace on the 5h bar, the compaction point on the context
// one; each filled cell takes the ramp by its place, so the bar warms as it fills. `scale` is the % the ramp turns red
// at: 100 for the 5h window, the compaction point for the context
export function meterCells(
    percent: number,
    width: number,
    mark?: number,
    scale = 100,
) {
    const filled = Math.min(width, Math.round((percent / 100) * width));
    const at =
        mark === undefined
            ? -1
            : Math.min(
                  width - 1,
                  Math.max(0, Math.round((mark / 100) * width)),
              );
    return Array.from({ length: width }, (_, i) => {
        const kind: BarRun['kind'] =
            i === at ? 'mark' : i < filled ? 'fill' : 'empty';
        const step = Math.floor(
            (((i + 0.5) / width) * 100 * BAR_RAMP.length) / scale,
        );
        return {
            color:
                kind === 'fill'
                    ? BAR_RAMP[Math.min(BAR_RAMP.length - 1, step)]
                    : undefined,
            kind,
        };
    });
}
// the desktop's bar in the retired breather's design language: its 5px cells, 2px gaps and light and dark palettes, the
// ramp painted through the lit cells; two cell rows tall, so it still reads as a bar
const CELL = { gap: 2, rows: 2, size: 5 } as const;
const CELL_STEP = CELL.size + CELL.gap;
export const BAR_HEIGHT = CELL.rows * CELL_STEP - CELL.gap;
const BAR_STYLE =
    ':root{color-scheme:light dark}.off{fill:#cfcfcf;opacity:.5}.mark{fill:#7c7670}.r0{stop-color:#7fb83a}.r1{stop-color:#f2b400}.r2{stop-color:#ff7a1a}.r3{stop-color:#f2364d}.ember{fill:#ffe08a}' +
    '@media (prefers-color-scheme:dark){.off{fill:#504945;opacity:.45}.mark{fill:#a89984}.r0{stop-color:#a9b665}.r1{stop-color:#d8a657}.r2{stop-color:#e78a4e}.r3{stop-color:#ea6962}.ember{fill:#fff1c2}}';
export function meterSvg(
    percent: number,
    width: number,
    mark?: number,
    scale = 100,
    breathAt?: number,
    breathMs = BREATH_MS,
) {
    const w = width * CELL_STEP - CELL.gap;
    // the ramp reaches red where `scale` sits on the bar: the whole bar for the 5h window, the compaction point for ctx
    const redAt = Math.max(CELL_STEP, (Math.min(scale, 100) / 100) * w);
    // a redraw rebuilds the svg and restarts its clock: each spark's begin carries where its period stands at `breathAt`,
    // so a rebuild resumes every ember mid-flight instead of snapping back (the breather's fix, FRM-354)
    const sparkOf = (i: number, x: number, y: number, row: number) => {
        if (breathAt === undefined) return '';
        const e = emberOf(i, row, breathMs);
        if (!e.isOn) return '';
        const into = ((breathAt + e.offsetMs) % e.periodMs) / 1000;
        return `<rect class="ember" x="${x}" y="${y}" width="${CELL.size}" height="${CELL.size}" rx="1" opacity="0"><animate attributeName="opacity" values="${EMBER_GLOW.join(';')}" keyTimes="${EMBER_KEYS.join(';')}" dur="${(e.periodMs / 1000).toFixed(2)}s" begin="-${into.toFixed(2)}s" repeatCount="indefinite"/></rect>`;
    };
    const cells = meterCells(percent, width, mark, scale).flatMap((c, i) => {
        const x = i * CELL_STEP;
        if (c.kind === 'mark')
            return [
                `<rect class="mark" x="${x + 1.5}" y="0" width="2" height="${BAR_HEIGHT}" rx="1"/>`,
            ];
        return Array.from({ length: CELL.rows }, (_, r) => {
            const y = r * CELL_STEP;
            return c.kind === 'fill'
                ? `<rect x="${x}" y="${y}" width="${CELL.size}" height="${CELL.size}" rx="1" fill="url(#ramp)"/>${sparkOf(i, x, y, r)}`
                : `<rect class="off" x="${x}" y="${y}" width="${CELL.size}" height="${CELL.size}" rx="1"/>`;
        });
    });
    return (
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${BAR_HEIGHT}" viewBox="0 0 ${w} ${BAR_HEIGHT}">` +
        `<style>${BAR_STYLE}</style>` +
        `<defs><linearGradient id="ramp" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${redAt.toFixed(1)}" y2="0">` +
        '<stop class="r0" offset="0"/><stop class="r1" offset=".45"/><stop class="r2" offset=".75"/><stop class="r3" offset="1"/>' +
        '</linearGradient>' +
        `</defs>${cells.join('')}</svg>`
    );
}
// a calm meter's fill: the board's green and blue mid-tones, 3.6:1 or more on white and 4.2:1 on a dark pane
const METER_TINTS = { calm5h: '#47915a', calmCtx: '#4f83e0' } as const;
// the 5h window runs five hours; its pace is the share of it already gone, so a used % on pace keeps up exactly
const FIVE_HOUR_MS = 5 * 60 * 60_000;
export const paceOf = (resetsAt: number, now: number) =>
    Math.round(
        Math.min(100, Math.max(0, (1 - (resetsAt - now) / FIVE_HOUR_MS) * 100)),
    );
// used − pace: spare at 0 or under, a debt up to 10 is amber, past it red
export const gapTint = (gap: number) =>
    gap <= 0 ? METER_TINTS.calm5h : gap <= 10 ? RAMP[1] : RAMP[2];
// the context fill reads calm until 10 points short of its compaction point, then amber, red at and past it
export const contextFill = (percent: number, compactAt?: number) =>
    compactAt === undefined || percent < compactAt - 10
        ? METER_TINTS.calmCtx
        : percent < compactAt
          ? RAMP[1]
          : RAMP[2];
// a threshold dima types: a whole 10 to 99, else the one line that refuses it
export const thresholdOf = (text: string) => {
    const n = Number(text.trim());
    return Number.isInteger(n) && n >= 10 && n <= 99
        ? { value: n }
        : {
              refusal: `compaction point must be a whole 10–99, got «${text.trim()}»`,
          };
};
const idleTint = (ms: number) =>
    ms >= COOLING_MS[2]
        ? RAMP[2]
        : ms >= COOLING_MS[1]
          ? RAMP[1]
          : ms >= COOLING_MS[0]
            ? RAMP[0]
            : undefined;

const text = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

// every session whose reply ended since `since`: those that left asks first, then those that finished —
// a session the registry still shows busy has not finished; one that exited meanwhile has
async function awayDigest($: EngineInterface, since: number): Promise<Digest> {
    const needs: Digest['needs'] = [];
    const done: Digest['done'] = [];
    const keys = await $.store.keys();
    const running = new Set(
        (await registry($).catch(() => []))
            .filter((r) => r.isAlive && statusOf(r.base.status).word === 'busy')
            .map((r) => r.base.sid),
    );
    for (const key of keys) {
        if (!key.startsWith(PREFIX)) continue;
        const v = (await $.store.get(key)) as Entry | undefined;
        if (!v || v.at < since || !v.asks.length) continue;
        const sid = key.slice(PREFIX.length);
        needs.push({ asks: v.asks.length, name: v.name ?? short(sid), sid });
    }
    for (const key of keys) {
        if (!key.startsWith(REPLY)) continue;
        const sid = key.slice(REPLY.length);
        const v = (await $.store.get(key)) as Partial<Reply> | undefined;
        if (
            v?.at === undefined ||
            v.at < since ||
            running.has(sid) ||
            needs.some((n) => n.sid === sid)
        )
            continue;
        done.push({ name: v.name ?? short(sid), sid });
    }
    const byName = (a: { name: string }, b: { name: string }) =>
        a.name.localeCompare(b.name);
    return { done: done.sort(byName), needs: needs.sort(byName) };
}

type Registered = {
    pid: number;
    bg: boolean;
    isAlive: boolean;
    cwd?: string;
    startedAt?: number;
    base: Pick<Member, 'sid' | 'name' | 'status' | 'statusSince'>;
};

// cc's registry stores the black bird's zero-width joiner as a space: «🐦 ⬛ ccrow» for «🐦‍⬛ ccrow»
const SPLIT_CROW = '\u{1F426} \u{2B1B}';
const CROW = '\u{1F426}\u{200D}\u{2B1B}';

// every session in cc's registry and whether its process still runs; a registry file mid-write is skipped
async function registry($: EngineInterface): Promise<Registered[]> {
    const dir = `${await $.env.get('HOME')}/.claude/sessions`;
    const rows: Omit<Registered, 'isAlive'>[] = [];
    for (const f of await $.fs.list(dir)) {
        if (!f.name.endsWith('.json')) continue;
        try {
            const v = JSON.parse(await $.fs.read(`${dir}/${f.name}`)) as Record<
                string,
                unknown
            >;
            if (typeof v.pid !== 'number' || typeof v.sessionId !== 'string')
                continue;
            const bg = v.kind === 'bg';
            rows.push({
                base: {
                    name:
                        text(v.name)?.replaceAll(SPLIT_CROW, CROW) ??
                        short(v.sessionId),
                    sid: v.sessionId,
                    status: text(v.status),
                    statusSince:
                        typeof v.statusUpdatedAt === 'number'
                            ? v.statusUpdatedAt
                            : undefined,
                },
                bg,
                cwd: text(v.cwd),
                pid: v.pid,
                startedAt:
                    typeof v.startedAt === 'number' ? v.startedAt : undefined,
            });
        } catch {}
    }
    if (!rows.length) return [];
    // ps prints the pids still alive and skips the rest
    const ps = await $.process.run([
        'ps',
        '-o',
        'pid=',
        '-p',
        rows.map((r) => r.pid).join(','),
    ]);
    const alive = new Set(
        ps.stdout
            .split('\n')
            .map((s) => Number(s.trim()))
            .filter(Boolean),
    );
    return rows.map((r) => ({ ...r, isAlive: alive.has(r.pid) }));
}

// a session that never ran a turn has no transcript yet: the desktop's warm spares sit in the registry like this
// (cclio-9a, 2026-10-09); a missing project folder keeps the row, since cc hashes the folder name of a long path
async function isUnstarted(
    $: EngineInterface,
    home: string | undefined,
    cwd: string | undefined,
    sid: string,
) {
    if (!home || !cwd) return false;
    const dir = `${home}/.claude/projects/${cwd.replace(/[^a-zA-Z0-9]/g, '-')}`;
    return (
        (await $.fs.exists(dir).catch(() => false)) &&
        !(await $.fs.exists(`${dir}/${sid}.jsonl`).catch(() => true))
    );
}

// live sessions from the registry, each with what its own stash wrote
async function members($: EngineInterface): Promise<Member[]> {
    const out: Member[] = [];
    const now = await $.clock.now();
    const shown = (await registry($)).filter(
        (r) =>
            r.isAlive &&
            !HEADLESS.test(r.base.name) &&
            !(r.startedAt !== undefined && now - r.startedAt < SHORT_MS),
    );
    const home = await $.env.get('HOME');
    for (const { bg, cwd, base: r } of shown) {
        if (await isUnstarted($, home, cwd, r.sid)) continue;
        const reply = (await $.store.get(REPLY + r.sid)) as
            | Partial<Reply>
            | undefined;
        const asks = (await $.store.get(PREFIX + r.sid)) as Entry | undefined;
        out.push({
            ...r,
            asks: isLive(asks, now) ? asks.asks.length : 0,
            context: (await $.store.get(CONTEXT + r.sid)) as number | undefined,
            model: text(await $.store.get(MODEL + r.sid)),
            offPattern: bg && !isFleetName(r.name),
            // the band says «first +n»; the board has the room to name every wait (dima's o75)
            wait:
                reply?.waits && reply.waits.length > 1
                    ? `waiting on ${reply.waits.join('; ')}`
                    : reply?.wait,
        });
    }
    // the coordinator first, her adviser second, the rest by name
    return out.sort(
        (a, b) => pinOf(a.name) - pinOf(b.name) || a.name.localeCompare(b.name),
    );
}

const span = (ms: number) => {
    // a status stamped a moment ahead of this clock reads 0m, never -1m
    const m = Math.max(0, Math.floor(ms / 60000));
    return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
};

// each fact column's width in cells, sized to its usual reading — `🪐 12`, `FRM-306`, `ctx 54%`, `idle 12m` — so little slack shows between columns; a longer one is cut at its end
const COLUMNS = {
    asks: 4,
    context: 7,
    state: 9,
    ticket: 9,
} as const;

// the fleet's coordinator, pinned to the board's top in bold (dima, 2026-10-05)
// a member is the name's last word: a coder named «… + ccrow at decisions» is not ccrow (2026-10-10)
const isCoordinator = (name: string) => /(^|\s)cclio$/.test(name);
// cclio, then ccrow, then everyone else, the two pinned ones bold (dima, 2026-10-10)
const pinOf = (name: string) =>
    isCoordinator(name) ? 0 : /(^|\s)ccrow$/.test(name) ? 1 : 2;

async function isOpen($: EngineInterface) {
    const panes = await $.ui.panes().catch(() => []);
    return panes.some((p) => p.id === BOARD);
}

async function openBoard($: EngineInterface) {
    await $.ui.open({ closeOnEscape: true, id: BOARD, title: '🚦 board' });
}

// every control names itself on hover; the card stays on the control's row, since a one-row site clips the rest
// re-read before the write: another session may have flipped a part since this one's poll
async function flipPart($: EngineInterface, key: string) {
    const now = shownOf(await $.store.get(SHOWN).catch(() => undefined));
    shown = { ...now, [key]: now[key] === false };
    await $.store.set(SHOWN, shown);
    await publish($);
}

// a 🎛️ number knob's value: a whole or decimal number inside its range, else undefined — a half-typed «0.» or an out of
// range «8» on the way to nothing is never applied
function numberOf(v: unknown, range: { min: number; max: number }) {
    const text =
        typeof v === 'number'
            ? String(v)
            : typeof v === 'string'
              ? v.trim()
              : '';
    if (!/^\d+(\.\d+)?$/.test(text)) return undefined;
    const n = Number(text);
    return n >= range.min && n <= range.max ? n : undefined;
}

async function flipKnob(
    $: EngineInterface,
    key: string,
    isOnByDefault: boolean,
) {
    const was = await $.store.get(key).catch(() => undefined);
    await $.store.set(key, !(typeof was === 'boolean' ? was : isOnByDefault));
    $.ui.invalidate('ui.render');
}

// a keystroke saves at once when it makes a valid value, and is never applied when it does not (exit 6)
async function setKnobNumber(
    $: EngineInterface,
    key: string,
    text: string,
    range: { min: number; max: number },
) {
    const n = numberOf(text, range);
    if (n === undefined) return;
    await $.store.set(key, n);
    $.ui.invalidate('ui.render');
}

// the 🎛️ pane's switch list: a column per group
function settingsListJSX(
    $: EngineInterface,
    ui: ReturnType<EngineInterface['ui']['resolve']>,
    shownNow: Record<string, boolean>,
    air: boolean,
) {
    const { Box, Text, Button } = ui;
    const groups = [...new Set(PARTS.map((p) => p.group))];
    return groups.map((group) => (
        <Box
            borderColor={cardBorder(air ? 'desktop' : 'terminal')}
            borderStyle='round'
            flexDirection='column'
            key={`settings:${group}`}
            paddingX={1}
            paddingY={air ? 0.5 : 0}
            rowGap={air ? 0.3 : 0}>
            <Text bold>{group}</Text>
            <Box flexDirection='column' rowGap={air ? 0.3 : 0}>
                {PARTS.filter((p) => p.group === group).map((p) => (
                    <Box flexDirection='row' key={`settings:row:${p.key}`}>
                        <Button
                            key={`part:${p.key}`}
                            onPress={() => void flipPart($, p.key)}
                            {...(shownNow[p.key] !== false
                                ? { variant: 'primary' as const }
                                : { dimColor: true })}>
                            {p.label}
                        </Button>
                    </Box>
                ))}
            </Box>
        </Box>
    ));
}

function hoverTip(
    ui: ReturnType<EngineInterface['ui']['resolve']>,
    key: string,
    words: string,
    control: RenderElement,
    place: { left: number } | { right: number },
    press?: { hotkey: string; onPress: () => void },
) {
    const { Box, Text, Button } = ui;
    return (
        <Box key={`tip:${key}`}>
            {control}
            <Box
                display='none'
                hover={{ display: 'flex' }}
                position='absolute'
                top={0}
                {...place}>
                {/* the key rides the card, not the icon: the surface draws its own key badge beside a Button with a hotkey */}
                {press ? (
                    <Button
                        dimColor
                        hotkey={press.hotkey}
                        key={`key:${key}`}
                        onPress={press.onPress}
                        plain>
                        {words}
                    </Button>
                ) : (
                    <Text dimColor>{words}</Text>
                )}
            </Box>
        </Box>
    );
}

// a reply's own 🔭 line wins; else its background tasks, the first named for the band and all of them for the board
function waitsOf(
    said: string | undefined,
    tasks: Parameters<typeof backgroundWait>[0],
): Pick<Reply, 'wait' | 'waits'> {
    if (said) return { wait: said };
    return { wait: backgroundWait(tasks), waits: backgroundWaits(tasks) };
}

export const register: Register = (on) => {
    // session.start fires at startup and again on every hot reload; the classic event only at startup
    on('session.start', async ($, e, next) => {
        // the repo root, not the cwd: a cd in the shell must not rename the thread
        selfId = await $.session.id();
        projectDir = e.cwd;
        const top = (await $.session.repo())?.root ?? e.cwd;
        label = basename(top);
        proc = await procOf($).catch(() => {
            $.ui.log(
                'x-mod-stash: no pid for this session, so its row reads no registry name',
            );
            return undefined;
        });
        // what a reload finds in `$.state`, read once: every get of one dispatch reads the moment it began
        const kept = {
            cap: (await $.state.get(CAP)).value,
            ended: (await $.state.get(ENDED)).value,
            orbit: (await $.state.get(ORBIT)).value,
            turn: (await $.state.get(TURN)).value,
            view: (await $.state.get(VIEW)).value,
        };
        orbit = kept.orbit ?? EMPTY_ORBIT;
        await $.tool
            .register({
                description: ORBIT_ABOUT,
                inputSchema: {
                    properties: {
                        asks: {
                            items: {
                                properties: {
                                    hiddenNote: { type: 'string' },
                                    pick: { type: 'string' },
                                    text: { type: 'string' },
                                },
                                required: ['text', 'pick'],
                                type: 'object',
                            },
                            type: 'array',
                        },
                        id: { type: 'string' },
                        ids: { items: { type: 'string' }, type: 'array' },
                        lines: { items: { type: 'string' }, type: 'array' },
                        op: {
                            enum: [
                                'add',
                                'assume',
                                'resolve',
                                'follow',
                                'plan',
                            ],
                            type: 'string',
                        },
                        pick: { type: 'string' },
                        text: { type: 'string' },
                        texts: { items: { type: 'string' }, type: 'array' },
                    },
                    required: ['op'],
                    type: 'object',
                },
                name: 'orbit',
            })
            .catch(() =>
                $.ui.log('x-mod-stash: the orbit tool was not registered'),
            );
        cap = kept.cap ?? undefined;
        endedAt = kept.ended ?? undefined;
        await pruneEnded($).catch(() => undefined);
        hot = (await $.store.get(HOT + selfId)) as typeof hot;
        // a mid-turn reload: the turn goes on, busy, and the band keeps what only it held
        if (kept.turn) {
            isBusy = kept.turn.isBusy;
            isUserTurn = kept.turn.isUserTurn;
            pinged = kept.turn.isPinged;
            turnAfk = kept.turn.afk;
        }
        digest = kept.view?.digest;
        // a reload unloads the old module and aborts its Haiku call, so a stored «running» is stale
        const enhancer = await enhancerOf($);
        if (enhancer.status === 'running')
            await saveEnhancer($, { ...enhancer, status: 'idle' });
        await load($);
        await armHot($);
        await armWake($);
        await $.command
            .register({
                description:
                    'open the fleet board: every live session, busy or idle, its last message; `/board colour` flips its colour',
                name: 'board',
            })
            .catch(() => $.ui.log('x-mod-stash: /board was not registered'));
        if (!isPolling) {
            isPolling = true;
            const tick = () =>
                $.clock.after(POLL_MS, async () => {
                    // an open board's view carries the tick's clock, so its «ago» times move on their own
                    await load($);
                    await freshMeter($).catch(() => undefined);
                    tick();
                });
            tick();
        }
        return next(e);
    });

    // `/mobile-mode` turns the asks fence on, `/mobile-mode off` turns it off
    on('skill.prompt', async ($, e, next) => {
        if (MOBILE_SKILL.test(e.skill))
            await $.state
                .set(MOBILE, !MOBILE_OFF.test(e.text))
                .catch(() => undefined);
        return next(e);
    });

    // only dima's own hands make his turn; a reply to any other origin may drop the block
    on('prompt.submit', async ($, e, next) => {
        isUserTurn =
            e.text.trim().length > 0 &&
            (DIMA_ORIGINS as readonly string[]).includes(e.origin?.kind ?? '');
        pinged = e.text === PING;
        // dima read the away digest once he types again
        if (isUserTurn) digest = undefined;
        // a sent box ends the enhance: ⏪ ⏩ leave the band (dima's o11, 11:11)
        if (isUserTurn) {
            const { status } = await enhancerOf($);
            await saveEnhancer($, { status });
        }
        if (isUserTurn && BACK_AT_MAC.test(e.text))
            await $.state.set(MOBILE, false).catch(() => undefined);
        isBusy = true;
        turnTools = 0;
        isNudged = false;
        hotGen++;
        await load($);
        turnAfk = afk;
        await keepTurn($);
        // the clock rides every prompt, so a reply's 📄 stamp copies it instead of guessing
        const clock = `now ${new Date(await $.clock.now()).toTimeString().slice(0, 5)}`;
        // only dima's own prompt carries his marks; each joins once and locks until the turn ends
        await currentOrbit($);
        const marked = isUserTurn
            ? orbit.asks.filter((a) => a.mark && !a.isLocked && !a.isResolved)
            : [];
        // an assumption dima sent back joins his prompt once and leaves orbit
        const wrong = isUserTurn
            ? (orbit.assumed ?? []).filter((x) => x.isWrong)
            : [];
        if (marked.length || wrong.length) {
            const ids = new Set(marked.map((a) => a.id));
            await saveOrbit($, {
                ...orbit,
                asks: orbit.asks.map((a) =>
                    ids.has(a.id) ? { ...a, isLocked: true } : a,
                ),
                assumed: (orbit.assumed ?? []).filter((x) => !x.isWrong),
            });
        }
        const tickets = isUserTurn ? await ticketNote($, e.text) : undefined;
        const reminder = (await $.state.get(MOBILE)).value
            ? mobileReminder(orbit)
            : orbitReminder(orbit);
        const isFirst = orbit.turns === 0 && !orbit.plan && !isPrimed;
        isPrimed = true;
        return next({
            ...e,
            context: [
                ...(e.context ?? []),
                clock,
                ...(afk ? [AWAY_NOTE] : []),
                ...(marked.length ? [joinText(marked)] : []),
                ...(wrong.length ? [wrongText(wrong)] : []),
                ...(isFirst ? [PHASES_START] : []),
                ...(reminder ? [reminder] : []),
                ...(tickets ? [tickets] : []),
            ],
        });
    });

    // a long turn outruns the prompt's clock: the stored reply's 📄 stamp is the time it was written
    on('session.append', { door: 'response' }, async ($, e, next) => {
        const now = new Date(await $.clock.now()).toTimeString().slice(0, 5);
        // the 🎛️ switches gate the stored rewrite, not only its look (the part list's 📌)
        const switches = shownOf(
            await $.store.get(SHOWN).catch(() => undefined),
        );
        const isOn = {
            bold: switches['stash.boldwords'] !== false,
            bullets: switches['stash.bullets'] !== false,
        };
        let isChanged = false;
        const hits: Record<string, number> = {};
        const content = e.message.content.map((b) => {
            if (b.type !== 'text' || typeof b.text !== 'string') return b;
            // the stored row is what the Stop hooks read: a ·-list fixed here never trips reply-check
            const dotted = isOn.bullets ? bulletDots(b.text) : b.text;
            const fixed = isOn.bold
                ? boldFleetWords(dotted)
                : { hits: {}, text: dotted };
            for (const [word, n] of Object.entries(fixed.hits))
                hits[word] = (hits[word] ?? 0) + n;
            const bulleted = fixed.text;
            if (bulleted !== b.text) isChanged = true;
            const text = bulleted.replace(
                STAMP,
                (whole: string, head: string, at: string) => {
                    if (at === now) return whole;
                    isChanged = true;
                    return `${head}${now}`;
                },
            );
            return { ...b, text };
        });
        if (Object.keys(hits).length)
            await countWords($, hits).catch((err) =>
                $.ui.log(
                    `x-mod-stash: the fleet-word count was not kept: ${errorText(err)}`,
                ),
            );
        if (!isChanged) return next(e);
        return next({ ...e, message: { ...e.message, content } });
    });

    // the drawing: the reply's ·-list shows as bullets while it streams, before the stored row exists
    on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
        const switches = (await $.state.get(VIEW)).value?.shown ?? {};
        const dotted =
            switches['stash.bullets'] !== false
                ? bulletDots(e.props.text)
                : e.props.text;
        const { text } =
            switches['stash.boldwords'] !== false
                ? boldFleetWords(dotted)
                : { text: dotted };
        if (text === e.props.text) return next(e);
        return next({ ...e, props: { ...e.props, text } });
    });

    on('classic.Stop', async ($, e, next) => {
        const r = await next(e);
        // a keep-hot ping's one-character reply never clears what the session waits on
        if (!pinged)
            await $.store
                .set(REPLY + e.session_id, {
                    at: await $.clock.now(),
                    name: await sessionName($),
                    ...waitsOf(
                        parseWait(e.last_assistant_message ?? ''),
                        e.background_tasks,
                    ),
                } satisfies Reply)
                .catch(() => undefined);
        isUserTurn = false;
        await keepTurn($);
        await load($);
        return r;
    });

    on('turn.complete', async ($, e, next) => {
        const r = await next(e);
        // a subagent's turn ending is not the session going idle
        if (e.agentId) return r;
        isBusy = false;
        // the turn's answers leave; a marked ask it never resolved unlocks and rides dima's next prompt
        const done = await currentOrbit($);
        await saveOrbit($, {
            ...done,
            asks: done.asks
                .filter((a) => !a.isResolved)
                .map((a) => (a.isLocked ? { ...a, isLocked: false } : a)),
            // an unmarked assumption leaves at its third turn end, the turn it was made in counted; one sent back waits
            // for his prompt
            assumed: (done.assumed ?? []).filter(
                (x) => x.isWrong || done.turns + 2 - x.at < ASSUMED_TURNS,
            ),
            turns: done.turns + 1,
        });
        endedAt = await $.clock.now();
        await $.state.set(ENDED, endedAt).catch(() => undefined);
        await keepTurn($);
        // a stop on the 5h cap waits for the reset; any other end clears it
        cap =
            e.reason === 'error' && CAPPED.test(e.answer)
                ? { resetsAt: fiveHourResetsAt }
                : undefined;
        await $.state.set(CAP, cap ?? null).catch(() => undefined);
        await armWake($);
        // the store is 🔥's truth: ccrow writes its key after session.start, and a deleted key turns it off
        const sid = await currentId($);
        if (sid)
            hot = (await $.store.get(HOT + sid).catch(() => hot)) as typeof hot;
        if (hot) {
            hot = { ...hot, since: await $.clock.now() };
            await saveHot($);
        }
        await armHot($);
        await load($);
        return r;
    });

    // the context fill the board shows, and the 5h reset the waker waits on
    on('session.measure', async ($, e, next) => {
        const w = e.rateLimits.find((r) => r.kind === 'five_hour');
        const resetsAt = w?.resetsAt ? Date.parse(w.resetsAt) : undefined;
        if (resetsAt !== undefined) {
            fiveHourResetsAt = resetsAt;
            // capped before any measure named the reset: wait for this one
            if (cap && cap.resetsAt === undefined) {
                cap = { ...cap, resetsAt };
                await $.state.set(CAP, cap).catch(() => undefined);
                await armWake($);
            }
        }
        const sid = await currentId($);
        if (sid && e.context.percent !== undefined)
            await $.store
                .set(CONTEXT + sid, e.context.percent)
                .catch(() => undefined);
        if (e.changed.includes('rateLimits') && e.rateLimits.length)
            await saveUsage($, e.rateLimits).catch((err) =>
                $.ui.log(
                    `x-mod-stash: usage file not written: ${errorText(err)}`,
                ),
            );
        const was = (await $.state.get(METER)).value;
        const meter: StashMeter = {
            compactAt: e.changed.includes('context')
                ? ((await compactAtOf($, e.context.window)) ?? was?.compactAt)
                : was?.compactAt,
            context: e.context.percent,
            fiveHour: w ? { resetsAt, used: w.percentUsed } : was?.fiveHour,
            minute: was?.minute,
            note: was?.note,
        };
        // a write redraws the band, so only a reading that moved is written
        if (JSON.stringify(meter) !== JSON.stringify(was))
            await $.state.set(METER, meter).catch(() => undefined);
        return next(e);
    });

    // the board shows each session's model and effort as its main loop's last request named them; a subagent's step never counts
    on('turn.step', async function* ($, e, next) {
        if (!e.agentId) {
            const sid = await currentId($);
            const said = modelLabel(e.model, e.effort);
            if (sid && modelSeen !== `${sid}\u0000${said}`) {
                modelSeen = `${sid}\u0000${said}`;
                await $.store.set(MODEL + sid, said).catch(() => undefined);
            }
        }
        return yield* next(e);
    });

    // `/board colour` flips the colour MVP for every session's board, and opens it to look
    on('command.run', { command: 'board' }, async ($, e) => {
        if (e.args.trim() === 'breathe') {
            const isOn = !(await $.store.get(BREATH_PREVIEW));
            await $.store.set(BREATH_PREVIEW, isOn);
            $.ui.invalidate('ui.render');
            return {
                text: `bars breathe ${isOn ? 'all the time' : 'only while a turn runs'}`,
            };
        }
        const isColourFlip = /^colou?r$/.test(e.args.trim());
        if (isColourFlip)
            await $.store.set(COLOUR, !(await $.store.get(COLOUR)));
        await openBoard($);
        await publish($);
        if (!isColourFlip) return { text: 'fleet board opened' };
        return {
            text: `fleet board colour ${(await $.store.get(COLOUR)) ? 'on' : 'off'}`,
        };
    });

    // the row's 🚦 shows whether the board is open
    on('ui.close', async ($, e, next) => {
        const r = await next(e);
        if (e.id === BOARD) await publish($);
        if (e.id === SETTINGS_PANE) {
            isSettingsOpen = false;
            await publish($);
        }
        return r;
    });

    // 🎛️: the switch list, then the auto-compact point, in a pane of its own (dima's pick a, 16:20)
    on(
        'ui.render',
        { component: 'Pane', requestId: SETTINGS_PANE },
        async ($, e) => {
            const ui = $.ui.resolve(e);
            const { Box, Text, Button } = ui;
            const meter = (await $.state.get(METER)).value;
            // mobile draws no Input
            const Input = 'Input' in ui ? ui.Input : undefined;
            const read = (key: string) =>
                $.store.get(key).catch(() => undefined);
            // the knobs: a switch saves on its press, a number on each keystroke that makes a valid value
            const knobs = {
                always: (await read(BREATH_PREVIEW)) === true,
                breathe: (await read(BREATHE)) !== false,
                colour: (await read(COLOUR)) === true,
                guard: (await read(GUARD_SILENT)) !== true,
                lines: numberOf(await read(PHASE_LINES), LINES) ?? PLAN_MAX,
                speak: (await read(SPEAK_ASSUMED)) !== false,
                speed: numberOf(await read(BREATH_SPEED), SPEED) ?? SPEED.of,
            };
            const switchJSX = (
                key: string,
                label: string,
                isOn: boolean,
                isOnByDefault: boolean,
            ) => (
                <Box flexDirection='row' key={`knob:${key}`}>
                    <Button
                        key={`knob:${key}`}
                        onPress={() => void flipKnob($, key, isOnByDefault)}
                        {...(isOn
                            ? { variant: 'primary' as const }
                            : { dimColor: true })}>
                        {label}
                    </Button>
                </Box>
            );
            const numberJSX = (
                key: string,
                label: string,
                value: number,
                range: { min: number; max: number },
                unit: string,
            ) =>
                Input ? (
                    <Box
                        alignItems='center'
                        flexDirection='row'
                        gap={1}
                        key={`knob:${key}`}>
                        <Text>{label}</Text>
                        <Box flexShrink={0} width={8}>
                            <Input
                                key={`knob:${key}`}
                                onInput={(text) =>
                                    void setKnobNumber($, key, text, range)
                                }
                                onSubmit={(text) =>
                                    void setKnobNumber($, key, text, range)
                                }
                                value={String(value)}
                            />
                        </Box>
                        <Text
                            dimColor>{`${unit} (${range.min}–${range.max})`}</Text>
                    </Box>
                ) : null;
            const air = e.surface === 'desktop';
            const knobsJSX = (
                <Box
                    borderColor={cardBorder(e.surface)}
                    borderStyle='round'
                    flexDirection='column'
                    key='settings:knobs'
                    paddingX={1}
                    paddingY={air ? 0.5 : 0}
                    rowGap={air ? 0.3 : 0}>
                    <Text bold>stash · knobs</Text>
                    {switchJSX(COLOUR, '🎨 board colour', knobs.colour, false)}
                    {numberJSX(
                        PHASE_LINES,
                        '🌔 phase lines',
                        knobs.lines,
                        LINES,
                        'lines',
                    )}
                    {switchJSX(
                        SPEAK_ASSUMED,
                        '🔊 read-aloud on assumptions',
                        knobs.speak,
                        true,
                    )}
                    {/* the switch reads «shown» while lit, so it flips the stored «silent» the other way */}
                    <Box flexDirection='row' key='knob:guard-silent'>
                        <Button
                            key='knob:guard-silent'
                            onPress={() =>
                                void flipKnob($, GUARD_SILENT, false)
                            }
                            {...(knobs.guard
                                ? { variant: 'primary' as const }
                                : { dimColor: true })}>
                            🛡️ guard notes to the model
                        </Button>
                    </Box>
                </Box>
            );
            // the bars' animation, its own card at the pane's bottom beside the context (dima, 18:06)
            const barsJSX = (
                <Box
                    borderColor={cardBorder(e.surface)}
                    borderStyle='round'
                    flexDirection='column'
                    flexGrow={1}
                    key='settings:bars'
                    paddingX={1}
                    paddingY={air ? 0.5 : 0}
                    rowGap={air ? 0.3 : 0}
                    width={0}>
                    <Text bold>🔥 bars</Text>
                    {switchJSX(
                        BREATHE,
                        '🔥 bars breathe while a turn runs',
                        knobs.breathe,
                        true,
                    )}
                    {switchJSX(
                        BREATH_PREVIEW,
                        '🔥 bars breathe all the time',
                        knobs.always,
                        false,
                    )}
                    {numberJSX(
                        BREATH_SPEED,
                        '🔥 breath speed',
                        knobs.speed,
                        SPEED,
                        '×',
                    )}
                </Box>
            );
            // the auto-compact point lives only in 🎛️, its last section (dima, 15:35: «move full autocompact part to settings»)
            const compactJSX = Input ? (
                <Box
                    borderColor={cardBorder(e.surface)}
                    borderStyle='round'
                    flexDirection='column'
                    flexGrow={1}
                    key='settings:compact'
                    paddingX={1}
                    paddingY={e.surface === 'desktop' ? 0.5 : 0}
                    width={0}>
                    <Text bold>context</Text>
                    <Box alignItems='center' flexDirection='row' gap={1}>
                        <Text>📦 auto-compact at</Text>
                        <Box flexShrink={0} width={8}>
                            <Input
                                key='compact-at'
                                onInput={(value) =>
                                    void setCompactAt($, value, true)
                                }
                                onSubmit={(value) =>
                                    void setCompactAt($, value)
                                }
                                placeholder='70'
                                value={
                                    meter?.compactAt === undefined
                                        ? ''
                                        : String(meter.compactAt)
                                }
                            />
                        </Box>
                        <Text dimColor>% of the context window</Text>
                    </Box>
                </Box>
            ) : null;
            return (
                // two columns of cards, the switches left and the knobs right (dima, 17:42); the bars and the context sit at the
                // pane's bottom, side by side, a gap growing above them as the phases do on the board (dima, 18:06)
                <Box
                    flexDirection='column'
                    gap={1}
                    key='settings:view'
                    minHeight={
                        e.props.placement === 'dock'
                            ? e.props.scroll.bodyRows
                            : undefined
                    }>
                    <Box flexDirection='row' gap={1} key='settings:columns'>
                        <Box
                            flexDirection='column'
                            flexGrow={1}
                            gap={1}
                            width={0}>
                            {settingsListJSX(
                                $,
                                ui,
                                (await $.state.get(VIEW)).value?.shown ?? {},
                                e.surface === 'desktop',
                            )}
                        </Box>
                        <Box
                            flexDirection='column'
                            flexGrow={1}
                            gap={1}
                            width={0}>
                            {knobsJSX}
                        </Box>
                    </Box>
                    <Box flexGrow={1} key='settings:gap' />
                    <Box flexDirection='row' gap={1} key='settings:bottom'>
                        {barsJSX}
                        {compactJSX}
                    </Box>
                </Box>
            );
        },
    );

    on('ui.render', { component: 'Pane', requestId: BOARD }, async ($, e) => {
        const ui = $.ui.resolve(e);
        const { Box, Text, Button, Link } = ui;
        // the poll read the registry into the view; the pane only draws it, so a draw costs no file or process read
        const board = (await $.state.get(BOARD_VIEW)).value;
        const now = board?.at ?? 0;
        const me = (await $.state.get(VIEW)).value?.selfId;
        // the board's lower half: this session's orbit and its plan, read here so a mark or a tool call redraws it
        const o = (await $.state.get(ORBIT)).value ?? orbit;
        // mobile draws no Input: its notes wait for another surface
        const Input = 'Input' in ui ? ui.Input : undefined;
        const open = o.asks.filter((a) => !a.isResolved);
        const age = planAge(o);
        // 🛎️ and ↩️ are one toggle each, side by side at the row's left: lit while it holds, plain while it does not
        const markJSX = (a: OrbitAsk, mark: 'accepted' | 'rejected') => (
            <Button
                key={`orbit:${mark}:${a.id}`}
                onPress={() =>
                    void markAsks(
                        $,
                        (x) =>
                            x.id === a.id
                                ? {
                                      ...x,
                                      isChanged: false,
                                      mark: x.mark === mark ? undefined : mark,
                                  }
                                : x,
                        true,
                    )
                }
                // take is always the filled button (dima, 17:08); a held mark swaps its emoji for ✅, so the size never
                // changes (dima's o7, 17:16) — one mark per ask, so only one of the two ever shows ✅
                {...(mark === 'accepted'
                    ? { variant: 'primary' as const }
                    : {})}>
                {`${a.mark === mark ? (a.isLocked ? '🔓' : '✅') : mark === 'accepted' ? '🛎️' : '🔁'} ${mark === 'accepted' ? 'take' : 'redo'}`}
            </Button>
        );
        const handleAssumedNote = (id: string, value: string) =>
            void changeAssumed($, (y) =>
                y.id === id ? { ...y, note: value.trim() || undefined } : y,
            );
        // the note keeps every keystroke, no Enter needed
        const handleNote = (id: string, value: string) =>
            void markAsks($, (x) =>
                x.id === id ? { ...x, note: value.trim() || undefined } : x,
            );
        // a locked ask is the running turn's: no control at all, its mark and note as dim text (the api has no disabled)
        // speak reads, pauses or stops through its control socket: a mod's text can't be selected for F4 on the desktop
        // (claude-code#101090) — a workaround, see mods/workarounds.md
        const boardShown = (await $.state.get(VIEW)).value?.shown ?? {};
        const isPartOn = (key: string) => boardShown[key] !== false;
        const speakAssumed =
            (await $.store.get(SPEAK_ASSUMED).catch(() => undefined)) !== false;
        const folds = (await $.state.get(FOLDS)).value ?? {};
        // 📂 sits at the far right of each card's head line and folds the card to that line, then reads 📁 (dima's o5, 17:21)
        const foldJSX = (card: string) => (
            <Button
                key={`fold:${card}`}
                onPress={async () => {
                    const was = (await $.state.get(FOLDS)).value ?? {};
                    await $.state.set(FOLDS, { ...was, [card]: !was[card] });
                }}
                plain>
                {folds[card] ? '📁' : '📂'}
            </Button>
        );
        const speakJSX = (id: string, text: string) =>
            !isPartOn('stash.speak')
                ? []
                : (
                      [
                          ['read', '🔊', { op: 'read', text }],
                          ['pause', '⏯️', { op: 'pause' }],
                          ['stop', '⏹️', { op: 'stop' }],
                      ] as const
                  ).map(([what, glyph, request]) => (
                      <Button
                          key={`orbit:${what}:${id}`}
                          onPress={() => void speak($, request)}
                          plain>
                          {glyph}
                      </Button>
                  ));
        // a ticket id in an ask or a phase opens its linear page, as a session row's does (dima's o62, 22:13)
        const linkedJSX = (text: string, key: string) =>
            text.split(TICKET_IDS).map((part, i) => {
                if (i % 2 === 0) return part;
                return (
                    <Link
                        href={`https://linear.app/x-com/issue/${part}`}
                        key={`${key}:${i}`}>
                        {part}
                    </Link>
                );
            });
        // the ask on its own line, the bold id leading it; under it one row: the note, 🛎️ ↩️, then speak's 🔊 ⏯ ⏹
        // (dima, 20:08); a full row of air between asks (dima, 19:52)
        const askJSX = (a: OrbitAsk, i: number) => (
            <Box
                borderDimColor
                borderStyle='round'
                flexDirection='column'
                key={`orbit:ask:${a.id}`}
                marginTop={i > 0 ? 0.5 : 0}
                paddingX={1}
                rowGap={LINE_GAP}>
                <Box flexDirection='row' gap={1}>
                    <Box
                        flexDirection='column'
                        flexGrow={1}
                        flexShrink={1}
                        minWidth={0}
                        rowGap={LINE_GAP}>
                        {/* the id and the pick bold, so the proposal stands out (dima, 20:30) */}
                        {/* an ask answered this turn leads its line with 👀 until the turn ends — inline, so the row keeps its left
                            edge; a hover card would need a box of its own (dima, 20:34, 20:39) */}
                        <Text>
                            {a.isResolved ? '👀 ' : ''}
                            {/* a joined ask's mark leads its line, so the row below holds only 🔊 and the note (dima, 11:57) */}
                            {a.isChanged ? `${CHANGED_MARK} ` : ''}
                            <Text bold>{a.id}</Text>
                            {': '}
                            {linkedJSX(a.text, `ask:${a.id}`)}
                        </Text>
                        {/* the pick on a line of its own, the mock's card shape (dima, 17:00) */}
                        <Text>
                            {'➡️ '}
                            <Text bold>
                                {linkedJSX(a.pick, `pick:${a.id}`)}
                            </Text>
                        </Text>
                    </Box>
                </Box>
                {/* the buttons lead, the note follows them (dima, 20:19) */}
                <Box alignItems='center' flexDirection='row' gap={1}>
                    {/* a joined ask keeps both buttons; the held one reads 🔓 while the turn holds it (dima, 17:42) */}
                    {[markJSX(a, 'accepted'), markJSX(a, 'rejected')]}
                    {/* reading aloud edits nothing, so a locked row keeps 🔊 ⏯️ ⏹️ (dima, 20:25) */}
                    {/* 🔊 reads what the card shows, no «pick» word (dima, 17:14) */}
                    {speakJSX(a.id, `${a.text}. ${a.pick}`)}
                    {a.isLocked ? (
                        a.note ? (
                            <Box flexShrink={1} minWidth={0}>
                                <Text dimColor wrap='truncate-end'>
                                    {/* a sent note leads with 💬, drawn for dima only: the model gets «his note: …» (dima, 18:14) */}
                                    {`💬 «${a.note}»`}
                                </Text>
                            </Box>
                        ) : null
                    ) : Input ? (
                        <Box flexShrink={1} minWidth={0}>
                            <Input
                                key={`orbit:note:${a.id}`}
                                onInput={(value: string) =>
                                    handleNote(a.id, value)
                                }
                                onSubmit={(value: string) =>
                                    handleNote(a.id, value)
                                }
                                placeholder='note'
                                value={a.note ?? ''}
                            />
                        </Box>
                    ) : null}
                </Box>
            </Box>
        );
        const orbitJSX = (
            <Box
                borderColor={cardBorder(e.surface)}
                borderStyle='round'
                flexDirection='column'
                key='orbit'
                marginTop={1}
                paddingX={1}
                paddingY={0.5}
                rowGap={0.5}>
                <Box flexDirection='row' justifyContent='space-between'>
                    <Text bold>🪐 orbit</Text>
                    <Box alignItems='center' flexDirection='row' gap={1}>
                        {open.some((a) => !a.mark && !a.isLocked) ? (
                            <Button
                                key='orbit:all'
                                onPress={() =>
                                    void markAsks(
                                        $,
                                        (x) =>
                                            x.mark
                                                ? x
                                                : {
                                                      ...x,
                                                      isChanged: false,
                                                      mark: 'accepted',
                                                  },
                                        true,
                                    )
                                }
                                plain>
                                ✅
                            </Button>
                        ) : null}
                        {foldJSX('orbit')}
                    </Box>
                </Box>
                {/* an answered ask stays until its turn ends, so dima sees it go */}
                {folds.orbit ? null : o.asks.map(askJSX)}
                {!folds.orbit &&
                o.assumed?.length &&
                isPartOn('stash.assumed') ? (
                    <Box
                        flexDirection='column'
                        key='orbit:assumed'
                        marginTop={1}
                        rowGap={LINE_GAP}>
                        <Text bold>assumed</Text>
                        {o.assumed.map((x) => {
                            return (
                                <Box
                                    flexDirection='column'
                                    key={`orbit:assumption:${x.id}`}
                                    rowGap={LINE_GAP}>
                                    <Text>
                                        <Text bold>{x.id}</Text>
                                        {`: ${x.text}`}
                                    </Text>
                                    <Box
                                        alignItems='center'
                                        flexDirection='row'
                                        gap={1}>
                                        <Button
                                            key={`orbit:right:${x.id}`}
                                            onPress={() =>
                                                void changeAssumed(
                                                    $,
                                                    (y) =>
                                                        y.id === x.id
                                                            ? undefined
                                                            : y,
                                                    true,
                                                )
                                            }
                                            plain>
                                            🛎️
                                        </Button>
                                        <Button
                                            key={`orbit:wrong:${x.id}`}
                                            onPress={() =>
                                                void changeAssumed(
                                                    $,
                                                    (y) =>
                                                        y.id === x.id
                                                            ? {
                                                                  ...y,
                                                                  isWrong:
                                                                      !y.isWrong,
                                                              }
                                                            : y,
                                                    true,
                                                )
                                            }
                                            {...(x.isWrong
                                                ? {
                                                      variant:
                                                          'secondary' as const,
                                                  }
                                                : { plain: true as const })}>
                                            ↩️
                                        </Button>
                                        {speakAssumed
                                            ? speakJSX(x.id, x.text)
                                            : null}
                                        {Input ? (
                                            <Box flexShrink={1} minWidth={0}>
                                                <Input
                                                    key={`orbit:anote:${x.id}`}
                                                    onInput={(value: string) =>
                                                        handleAssumedNote(
                                                            x.id,
                                                            value,
                                                        )
                                                    }
                                                    onSubmit={(value: string) =>
                                                        handleAssumedNote(
                                                            x.id,
                                                            value,
                                                        )
                                                    }
                                                    placeholder='note'
                                                    value={x.note ?? ''}
                                                />
                                            </Box>
                                        ) : null}
                                    </Box>
                                </Box>
                            );
                        })}
                    </Box>
                ) : null}
            </Box>
        );
        // the phases stick to the board's bottom: a docked board fills its rows and a gap grows above them (dima, 11:07)
        const phasesJSX = o.plan
            ? [
                  <Box flexGrow={1} key='phases:gap' />,
                  <Box
                      borderColor={cardBorder(e.surface)}
                      borderStyle='round'
                      flexDirection='column'
                      key='phases'
                      marginTop={1}
                      paddingX={1}
                      paddingY={0.5}
                      rowGap={LINE_GAP}>
                      <Box flexDirection='row' justifyContent='space-between'>
                          <Text bold>
                              {`🌔 phases${age !== undefined && age >= STALE_TURNS ? ` · stale, untouched ${age} turns` : ''}`}
                          </Text>
                          {foldJSX('phases')}
                      </Box>
                      {(folds.phases ? [] : o.plan.lines).map((line, i) => {
                          // a line's lead word — `now:`, `next:`, `then:` — prints bold (dima, 20:40)
                          const lead = line.match(PLAN_LEAD);
                          return (
                              // the moon fills by nearness, the then lines dim (dima, 20:58); only the now lead is green (21:08)
                              <Text
                                  dimColor={i > 1}
                                  // biome-ignore lint/suspicious/noArrayIndexKey: a plan line's place is its identity
                                  key={`plan:${i}`}>
                                  {`${PHASE_MOONS[Math.min(i, PHASE_MOONS.length - 1)]} `}
                                  {lead ? (
                                      <Text
                                          bold
                                          color={
                                              i === 0
                                                  ? METER_TINTS.calm5h
                                                  : undefined
                                          }>
                                          {lead[0]}
                                      </Text>
                                  ) : null}
                                  {linkedJSX(
                                      lead ? line.slice(lead[0].length) : line,
                                      `plan:${i}`,
                                  )}
                              </Text>
                          );
                      })}
                  </Box>,
              ]
            : null;
        const fill =
            e.props.placement === 'dock' ? e.props.scroll.bodyRows : undefined;
        const list = board?.members;
        if (!list)
            return (
                <Box flexDirection='column' minHeight={fill}>
                    <Text dimColor>the session registry is unreadable</Text>
                    {isPartOn('stash.orbit') ? orbitJSX : null}
                    {isPartOn('stash.phases') ? phasesJSX : null}
                </Box>
            );
        if (!list.length)
            return (
                <Box flexDirection='column' minHeight={fill}>
                    <Text dimColor>no live sessions</Text>
                    {isPartOn('stash.orbit') ? orbitJSX : null}
                    {isPartOn('stash.phases') ? phasesJSX : null}
                </Box>
            );
        const isColour = board.isColour;
        const hues = huesOf(list.map((m) => m.name));
        const row = (m: Member, i: number) => {
            const { tint: stateTint, word: state } = statusOf(m.status);
            const isMemberBusy = state === 'busy';
            const sinceMs =
                m.statusSince === undefined ? undefined : now - m.statusSince;
            const idleMs =
                state === 'idle' && sinceMs !== undefined ? sinceMs : 0;
            const isCold = idleMs >= COLD_MS;
            const coolTint = idleTint(idleMs);
            const stateText =
                sinceMs === undefined
                    ? state
                    : `${isCold ? '❄️' : state} ${span(sinceMs)}`;
            const ticket = ticketOf(m.name);
            const name = m.sid === me ? `${m.name} (here)` : m.name;
            const line = m.wait && `🔭 ${m.wait}`;
            return (
                <Box
                    flexDirection='column'
                    key={`m:${m.sid}`}
                    // the desktop's rows sit closer, the cards mock's spacing (dima, 17:27); a terminal row cannot be split
                    marginTop={i > 0 ? (e.surface === 'desktop' ? 0.6 : 1) : 0}
                    rowGap={LINE_GAP}>
                    <Box
                        flexDirection='row'
                        gap={1}
                        justifyContent='space-between'>
                        {/* the name side gives way, clipped, so a long name never pushes the fact columns out of line */}
                        <Box
                            flexDirection='row'
                            flexGrow={1}
                            flexShrink={1}
                            gap={1}
                            minWidth={0}
                            overflow='hidden'>
                            {/* the dot leads the row, the reference's cue: with colour on, the member's own hue, dimmed while idle */}
                            <Box flexShrink={0}>
                                <Text
                                    color={isColour ? hues[i] : undefined}
                                    dimColor={!isColour || state === 'idle'}>
                                    ●
                                </Text>
                            </Box>
                            {/* every name bold text, no control: the board opens no session (dima, 17:42) */}
                            <Text bold wrap='truncate-end'>
                                {name}
                            </Text>
                            {m.offPattern ? (
                                <Text color={ACCENT}>⚠</Text>
                            ) : null}
                        </Box>
                        {/* one fixed-width, right-aligned cell per fact, drawn empty when it has no reading, so the columns line up across rows (dima, 2026-10-05) */}
                        <Box
                            flexDirection='row'
                            flexShrink={0}
                            gap={e.surface === 'desktop' ? 0.5 : 1}>
                            {/* no hover card in the pane: an absolute card in a narrow row wraps and clips (dima, 2026-10-05) */}
                            <Box
                                justifyContent='flex-end'
                                width={COLUMNS.ticket}>
                                {ticket ? (
                                    // never wraps: `FRM-306` broke at its hyphen in the desktop font
                                    <Text dimColor wrap='truncate-end'>
                                        <Link
                                            href={`https://linear.app/x-com/issue/${ticket}`}>
                                            {ticket}
                                        </Link>
                                    </Text>
                                ) : null}
                            </Box>
                            <Box
                                justifyContent='flex-end'
                                width={COLUMNS.context}>
                                {m.context === undefined ? null : (
                                    <Text
                                        color={
                                            isColour
                                                ? contextTint(m.context)
                                                : undefined
                                        }
                                        dimColor={
                                            !isColour || !contextTint(m.context)
                                        }>
                                        ctx {m.context}%
                                    </Text>
                                )}
                            </Box>
                            <Box
                                justifyContent='flex-end'
                                width={COLUMNS.state}>
                                <Text
                                    bold
                                    color={
                                        coolTint ??
                                        (isColour || isMemberBusy
                                            ? stateTint
                                            : undefined)
                                    }
                                    dimColor={state === 'idle' && !coolTint}
                                    wrap='truncate-end'>
                                    {stateText}
                                </Text>
                            </Box>
                            {/* the asks close the row, always drawn: `🪐 0` dimmed when none (dima, 2026-10-05) */}
                            <Box justifyContent='flex-end' width={COLUMNS.asks}>
                                <Text
                                    color={m.asks ? ACCENT : undefined}
                                    dimColor={!m.asks}>
                                    🪐 {m.asks}
                                </Text>
                            </Box>
                        </Box>
                    </Box>
                    {/* the second line sits under the name, past the dot, dim — the reference's: the model first, kept whole, then the wait, cut at its end */}
                    {(m.model || line) && isPartOn('stash.rowmeta') ? (
                        <Box flexDirection='row' gap={2} paddingLeft={2}>
                            {m.model ? (
                                <Box flexShrink={0}>
                                    <Text dimColor>{m.model}</Text>
                                </Box>
                            ) : null}
                            {line ? (
                                <Box flexShrink={1} minWidth={0}>
                                    <Text dimColor wrap='truncate-end'>
                                        {/* each «waiting on <who>» part prints <who> bold, as the band does (dima, 17:20) */}
                                        {'🔭 '}
                                        {(m.wait ?? '')
                                            .split('; ')
                                            .map((part, k) => {
                                                const w = part.match(
                                                    /^(waiting on )(.+?)( — .*)?$/u,
                                                );
                                                return (
                                                    // biome-ignore lint/suspicious/noArrayIndexKey: a wait's place in the line is its identity
                                                    <Text key={`w:${k}`}>
                                                        {k > 0 ? '; ' : ''}
                                                        {w ? w[1] : part}
                                                        {w ? (
                                                            <Text bold>
                                                                {w[2]}
                                                            </Text>
                                                        ) : null}
                                                        {w?.[3] ?? ''}
                                                    </Text>
                                                );
                                            })}
                                    </Text>
                                </Box>
                            ) : null}
                        </Box>
                    ) : null}
                </Box>
            );
        };
        const busyCount = list.filter(
            (m) => statusOf(m.status).word === 'busy',
        ).length;
        return (
            <Box flexDirection='column' minHeight={fill}>
                <Box
                    borderColor={cardBorder(e.surface)}
                    borderStyle='round'
                    flexDirection='column'
                    key='sessions'
                    paddingX={1}
                    paddingY={0.5}>
                    {/* the head: what the pane holds on the left, how many work right now on the right */}
                    <Box
                        flexDirection='row'
                        justifyContent='space-between'
                        marginBottom={folds.sessions ? 0 : 1}>
                        <Text bold>🌌 sessions</Text>
                        <Box alignItems='center' flexDirection='row' gap={1}>
                            {/* the mock's head: the count and the busy on the right, the busy bold (dima, 17:00) */}
                            <Text>
                                <Text
                                    dimColor>{`${list.length} on this mac · `}</Text>
                                <Text
                                    bold
                                    color={
                                        busyCount ? STATUS.busy.tint : undefined
                                    }>
                                    {`${busyCount} busy`}
                                </Text>
                            </Text>
                            {foldJSX('sessions')}
                        </Box>
                    </Box>
                    {folds.sessions ? null : list.map(row)}
                </Box>
                {isPartOn('stash.orbit') ? orbitJSX : null}
                {isPartOn('stash.phases') ? phasesJSX : null}
            </Box>
        );
    });

    // a /clear or a resume leaves the conversation behind; an exit leaves its last reply for the away digest
    on('session.end', async ($, e, next) => {
        if (e.reason === 'clear' || e.reason === 'resume') {
            // the process outlives a /clear, so the next conversation is primed again: no session.start fires for it
            isPrimed = false;
            await forget($, e.sessionId);
        } else await retire($, e.sessionId);
        return next(e);
    });

    // `/clear` and `/resume` leave the conversation: its asks and holds go now, not at the next poll
    on('command.run', async ($, e, next) => {
        if (e.command !== 'clear' && e.command !== 'resume') return next(e);
        const left = await currentId($);
        const r = await next(e);
        if (left) await forget($, left).catch(() => undefined);
        await saveOrbit($, EMPTY_ORBIT);
        await load($);
        return r;
    });

    // orbit's write door, where the session adds, resolves and follows up its asks and sets its plan; and afk flipped
    // mid-turn: the next tool result carries the new state once
    on('tool.call', async ($, e, next) => {
        if ((e.tool as string) === ORBIT_TOOL) {
            // the turn as $.state holds it: a call that lands before a mid-turn reload's start reads a default isBusy
            const isTurn = (await $.state.get(TURN)).value?.isBusy ?? isBusy;
            const op = orbitOp(
                await currentOrbit($),
                e as Record<string, unknown>,
                isTurn,
                numberOf(
                    await $.store.get(PHASE_LINES).catch(() => undefined),
                    LINES,
                ) ?? PLAN_MAX,
            );
            if ('deny' in op) return { deny: op.deny };
            await saveOrbit($, op.orbit);
            return { result: op.result } as never;
        }
        const r = await next(e);
        if (r.deny !== undefined || e.agentId) return r;
        const notes: string[] = [];
        if (turnAfk !== undefined && turnAfk !== afk) {
            turnAfk = afk;
            notes.push(afk ? AWAY_NOTE : BACK_NOTE);
        }
        // a mark dima made while any turn of this session runs joins it here, model-only, and locks — a peer's or a task's
        // turn too, only the keep-hot ping never takes one (dima's o10, 2026-10-11); the turn is read from $.state, which a
        // mid-turn reload keeps
        const o = await currentOrbit($);
        const isPing = (await $.state.get(TURN)).value?.isPinged ?? pinged;
        const fresh = isPing
            ? []
            : o.asks.filter((a) => a.mark && !a.isLocked && !a.isResolved);
        if (fresh.length) {
            const ids = new Set(fresh.map((a) => a.id));
            await saveOrbit($, {
                ...o,
                asks: o.asks.map((a) =>
                    ids.has(a.id) ? { ...a, isLocked: true } : a,
                ),
            });
            notes.push(joinText(fresh));
        }
        if (
            !isNudged &&
            ++turnTools >= NUDGE_AT &&
            !(o.plan && o.plan.at === o.turns + 1)
        ) {
            isNudged = true;
            notes.push(
                o.plan
                    ? `phases not set this turn — update them with ${ORBIT_TOOL} plan`
                    : `no phases yet — set them with ${ORBIT_TOOL} plan`,
            );
        }
        if (!notes.length) return r;
        return { ...r, context: [...(r.context ?? []), ...notes] };
    });

    // the band: one row — orbit's and the plan's counts, the meters' readings, the 🔭 mark, the switches — then the bars,
    // the away digest and a refused threshold's one line
    on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
        if (e.surface !== 'terminal' && e.surface !== 'desktop') return next(e);
        // the published view and orbit, never the module's values: reading them subscribes this band, and a write redraws it
        const view = (await $.state.get(VIEW)).value ?? viewOf(false);
        const enhancer = (await $.state.get(ENHANCER)).value ?? {
            status: 'idle' as const,
        };
        const o = (await $.state.get(ORBIT)).value ?? orbit;
        const ui = $.ui.resolve(e);
        const { Box, Text, Button } = ui;
        const handleAfkFlip = async () => {
            const was = (await $.store.get(AFK_KEY)) as
                | { at?: number; on?: boolean }
                | undefined;
            afk = !afk;
            digest =
                !afk && was?.on && was.at !== undefined
                    ? await awayDigest($, was.at)
                    : undefined;
            await $.store.set(AFK_KEY, { at: await $.clock.now(), on: afk });
            await publish($);
        };
        // one switch for every session, kept in the store so a restart keeps it
        const handleWakerFlip = async () => {
            isWaker = !view.isWaker;
            await $.store.set(WAKER_KEY, { on: isWaker });
            await publish($);
        };
        const handleHotFlip = async () => {
            const now = await $.clock.now();
            hot = hot ? undefined : { since: isBusy ? now : (endedAt ?? now) };
            await saveHot($);
            await armHot($);
            await publish($);
        };
        const tip = (
            key: string,
            words: string,
            control: RenderElement,
            place: { left: number } | { right: number },
            press?: { hotkey: string; onPress: () => void },
        ) => hoverTip(ui, key, words, control, place, press);
        const boardOpen = view.isBoardOpen;
        const isShown = (key: string) => view.shown?.[key] !== false;
        const handleSettingsFlip = async () => {
            isSettingsOpen = !view.isSettingsOpen;
            if (isSettingsOpen)
                await $.ui.open({ id: SETTINGS_PANE, title: '🎛️ settings' });
            else await $.ui.close({ id: SETTINGS_PANE });
            await publish($);
        };
        const handleBoardFlip = async () => {
            if (await isOpen($)) await $.ui.close({ id: BOARD });
            else await openBoard($);
            await publish($);
        };
        // a terminal draws a chromed Button as `[ label ]`
        const leftOf = (label: string, chrome: boolean) => ({
            right: [...label].length + (chrome ? 4 : 0) + 1,
        });

        // the chips: text, never a control — 🚦 already opens the board, where orbit and the plan live (dima, 2026-10-10)
        const openAsks = o.asks.filter((a) => !a.isResolved).length;
        // every chip names itself on hover in five words or fewer (dima, 20:13)
        const planned = o.plan?.lines.length ?? 0;
        const asksChip = `🪐 ${openAsks}`;
        const planChip = `🌔 ${planned}`;
        const chips = (
            <Box flexDirection='row' flexShrink={0} gap={1} key='chips'>
                {tip(
                    'chip:asks',
                    `${openAsks} open ask${openAsks === 1 ? '' : 's'} for you`,
                    <Text
                        bold={openAsks > 0}
                        color={openAsks ? ACCENT : undefined}
                        dimColor={!openAsks}>
                        {asksChip}
                    </Text>,
                    { left: [...asksChip].length + 1 },
                )}
                {tip(
                    'chip:plan',
                    `${planned} phase${planned === 1 ? '' : 's'}`,
                    <Text dimColor={!planned}>{planChip}</Text>,
                    { left: [...planChip].length + 1 },
                )}
            </Box>
        );

        // the meters: two short bars in the row, each ending in its %; the readings sit beside them
        const meter = (await $.state.get(METER)).value;
        const now = await $.clock.now();
        const Svg = e.surface === 'desktop' ? $.ui.resolve(e).Svg : undefined;
        const isBreathing =
            (Boolean(e.props.isWorking) &&
                (await $.store.get(BREATHE).catch(() => undefined)) !==
                    false) ||
            (await $.store.get(BREATH_PREVIEW).catch(() => false)) === true;
        // the 🎛️ speed: 1× sparks a cell every 1.6–4.4 s, 0.5× (the default, dima 12:58) twice as slow
        const breathMs =
            (BREATH_MS * SPEED.of) /
            (numberOf(
                await $.store.get(BREATH_SPEED).catch(() => undefined),
                SPEED,
            ) ?? SPEED.of);
        const five = meter?.fiveHour;
        const pace =
            five?.resetsAt === undefined
                ? undefined
                : paceOf(five.resetsAt, now);
        const gap =
            five && pace !== undefined
                ? Math.round(five.used - pace)
                : undefined;
        const fiveTint = gapTint(gap ?? 0);
        const ctx = meter?.context;
        const ctxTint = contextFill(ctx ?? 0, meter?.compactAt);
        // the meters run the band's full width, one bar a row under the row (dima, 20:45: «bring back old wide meters»);
        // the desktop band runs ~7.8px a column (measured off dima's 20:22 shot): the label, the % and gaps take ~90px
        const svgCells = Math.max(
            8,
            Math.floor((e.props.bodyColumns * 7.8 - 90) / CELL_STEP),
        );
        const barJSX = (
            key: string,
            label: string,
            words: string,
            tint: string,
            bar?: { percent: number; mark?: number; scale?: number },
            marginTop = 0,
        ) => (
            <Box
                alignItems='center'
                flexDirection='row'
                gap={Svg ? 0.5 : 1}
                key={key}
                marginTop={marginTop}>
                <Box flexShrink={0} width={Svg ? 5 : 6}>
                    {tip(key, words, <Text wrap='truncate-end'>{label}</Text>, {
                        left: [...label].length + 1,
                    })}
                </Box>
                {bar === undefined ? (
                    <Text dimColor>no reading yet</Text>
                ) : (
                    // the % ends on the band's right edge, under the row's last button
                    <Box
                        alignItems='center'
                        flexDirection='row'
                        flexGrow={1}
                        gap={1}
                        justifyContent='space-between'>
                        {Svg ? (
                            <Svg
                                alt={`${label} ${Math.round(bar.percent)}%`}
                                height={BAR_HEIGHT}
                                key={`${key}:svg`}
                                source={meterSvg(
                                    bar.percent,
                                    svgCells,
                                    bar.mark,
                                    bar.scale,
                                    isBreathing ? now : undefined,
                                    breathMs,
                                )}
                            />
                        ) : null}
                        <Box flexShrink={0} justifyContent='flex-end' width={4}>
                            <Text bold color={tint}>
                                {`${Math.round(bar.percent)}%`}
                            </Text>
                        </Box>
                    </Box>
                )}
            </Box>
        );
        const meterInfoJSX = (
            <Box
                flexDirection='row'
                flexShrink={1}
                gap={1}
                key='meter:info'
                minWidth={0}>
                {!isShown('stash.pace') || gap === undefined
                    ? null
                    : tip(
                          'pace',
                          gap > 0
                              ? 'behind the 5h pace'
                              : 'ahead of the 5h pace',
                          // room reads 🔋 green, over the pace 🪫 red at any size (dima's o46, 21:37)
                          <Text
                              bold
                              color={gap > 0 ? RAMP[2] : METER_TINTS.calm5h}>
                              {gap > 0 ? `🪫 -${gap}%` : `🔋 +${-gap}%`}
                          </Text>,
                          { left: 10 },
                      )}
                {!isShown('stash.reset') ||
                five?.resetsAt === undefined ||
                five.resetsAt <= now
                    ? null
                    : tip(
                          'reset',
                          'until the 5h window resets',
                          // rounded up like cc's own «resets in 1 min», so it never reads 0m (o103)
                          <Text>
                              ⏳{' '}
                              {span(
                                  Math.ceil((five.resetsAt - now) / 60_000) *
                                      60_000,
                              )}
                          </Text>,
                          { left: 9 },
                      )}
            </Box>
        );
        const switches = (
            <Box flexDirection='row' flexShrink={0} gap={1} key='switches'>
                {!isShown('stash.hot')
                    ? null
                    : tip(
                          'hot',
                          view.isHot
                              ? "stop keeping this session's cache hot"
                              : "keep this session's cache hot: ping every 50 min",
                          <Button
                              key='hot'
                              onPress={() => void handleHotFlip()}
                              {...(view.isHot
                                  ? { variant: 'secondary' as const }
                                  : { plain: true as const })}>
                              🔥
                          </Button>,
                          leftOf('🔥', !!view.isHot),
                      )}
                {!isShown('stash.waker')
                    ? null
                    : tip(
                          'waker',
                          view.isWaker
                              ? 'stop waking capped sessions at the 5h reset'
                              : 'wake every session stopped on the 5h cap',
                          <Button
                              key='waker'
                              onPress={() => void handleWakerFlip()}
                              {...(view.isWaker
                                  ? { variant: 'secondary' as const }
                                  : { plain: true as const })}>
                              ⏰
                          </Button>,
                          leftOf('⏰', view.isWaker),
                      )}
                {!isShown('stash.afk')
                    ? null
                    : tip(
                          'afk',
                          view.afk
                              ? 'back: tell fleet that dima is here'
                              : 'afk: tell fleet that dima is away',
                          <Button
                              key='afk'
                              onPress={() => void handleAfkFlip()}
                              {...(view.afk
                                  ? { variant: 'secondary' as const }
                                  : { plain: true as const })}>
                              💨
                          </Button>,
                          leftOf('💨', view.afk),
                      )}
                {tip(
                    'settings',
                    view.isSettingsOpen
                        ? 'fold the settings'
                        : 'settings: show or hide each part',
                    <Button
                        key='settings'
                        onPress={() => void handleSettingsFlip()}
                        {...(view.isSettingsOpen
                            ? { variant: 'secondary' as const }
                            : { plain: true as const })}>
                        🎛️
                    </Button>,
                    leftOf('🎛️', view.isSettingsOpen),
                )}
                {!isShown('stash.board')
                    ? null
                    : tip(
                          'board',
                          boardOpen ? 'fold fleet board' : 'unfold fleet board',
                          <Button
                              key='board'
                              onPress={() => void handleBoardFlip()}
                              {...(boardOpen
                                  ? { variant: 'secondary' as const }
                                  : { plain: true as const })}>
                              🚦
                          </Button>,
                          leftOf('🚦', boardOpen),
                          {
                              hotkey: 'b',
                              onPress: () => void handleBoardFlip(),
                          },
                      )}
            </Box>
        );
        // the readings pack left after the chips, then this session's 🔭 mark, always drawn; the switches hold the right
        // edge (dima's o6 and o7, 22:03)
        // 🪄 ⏪ ⏩, beside the switches, each named on hover in a few words (dima, 23:13); while the call runs 🪄 rests
        // dimmed as if disabled, the api has no `disabled` and a press then is a no-op (dima, 2026-10-11 11:56); each emoji
        // draws two cells, so its card sits two past it
        const isEnhancing = enhancer.status === 'running';
        const enhancerJSX = (
            <Box flexDirection='row' flexShrink={0} gap={1} key='enhancer'>
                {tip(
                    'enh:enhance',
                    isEnhancing
                        ? 'enhancing; type to cancel'
                        : 'enhance prompt',
                    <Button
                        dimColor={isEnhancing}
                        key='enh:enhance'
                        onPress={() => void enhance($)}
                        plain>
                        🪄
                    </Button>,
                    { right: 3 },
                )}
                {enhancer.original !== undefined
                    ? tip(
                          'enh:prev',
                          'your text',
                          <Button
                              key='enh:prev'
                              onPress={() => void enhancePrev($)}
                              plain>
                              ⏪
                          </Button>,
                          { right: 3 },
                      )
                    : null}
                {enhancer.latest !== undefined
                    ? tip(
                          'enh:new',
                          'enhanced text',
                          <Button
                              key='enh:new'
                              onPress={() => void enhanceNew($)}
                              plain>
                              ⏩
                          </Button>,
                          { right: 3 },
                      )
                    : null}
            </Box>
        );
        // each «waiting on <who>» part of a 🔭 wait prints <who> bold, its «— how» tail plain (dima, 2026-10-10 23:54)
        const waitJSX = (wait: string) =>
            wait.split('; ').map((part, i) => {
                const m = part.match(/^(waiting on )(.+?)( — .*)?$/u);
                return (
                    // biome-ignore lint/suspicious/noArrayIndexKey: a wait's place in the line is its identity
                    <Text key={`wait:${i}`}>
                        {i > 0 ? '; ' : ''}
                        {m ? m[1] : part}
                        {m ? <Text bold>{m[2]}</Text> : null}
                        {m?.[3] ?? ''}
                    </Text>
                );
            });
        const row = (
            <Box
                alignItems='center'
                flexDirection='row'
                gap={1}
                justifyContent='space-between'
                key='row'>
                <Box
                    alignItems='center'
                    flexDirection='row'
                    flexGrow={1}
                    flexShrink={1}
                    gap={1}
                    key='row:readings'
                    minWidth={0}>
                    {isShown('stash.chips') ? chips : null}
                    {meterInfoJSX}
                    {isShown('stash.wait') ? (
                        <Box flexShrink={1} key='wait' minWidth={0}>
                            <Text color='inactive' wrap='truncate-end'>
                                {'🔭 '}
                                {view.wait ? waitJSX(view.wait) : 'not waiting'}
                            </Text>
                        </Box>
                    ) : null}
                </Box>
                {isShown('stash.enhancer') ? enhancerJSX : null}
                {switches}
            </Box>
        );
        // desktop air above and between the bars; a terminal row cannot be split, so none there
        const air = e.surface === 'desktop';
        const meters = (
            <Box
                flexDirection='column'
                flexShrink={0}
                key='meters'
                marginTop={air ? 0.5 : 0}
                paddingRight={air ? 1 : 0}>
                {!isShown('stash.5h')
                    ? null
                    : barJSX(
                          'meter:5h',
                          '🔥 5h',
                          '5h window used',
                          fiveTint,
                          five ? { mark: pace, percent: five.used } : undefined,
                      )}
                {!isShown('stash.ctx')
                    ? null
                    : barJSX(
                          'meter:ctx',
                          '🧠 ctx',
                          'context window used',
                          ctxTint,
                          ctx === undefined
                              ? undefined
                              : {
                                    mark: meter?.compactAt,
                                    percent: ctx,
                                    scale: meter?.compactAt ?? 100,
                                },
                          air ? 0.4 : 0,
                      )}
            </Box>
        );
        const away =
            isShown('stash.digest') &&
            view.digest &&
            (view.digest.needs.length || view.digest.done.length)
                ? [
                      <Text dimColor key='away'>
                          while you were away
                      </Text>,
                      ...view.digest.needs.map((n) => (
                          <Text key={`away:n:${n.sid}`} wrap='truncate-end'>
                              {`needs you · ${n.name} · 🪐 ${n.asks}`}
                          </Text>
                      )),
                      ...view.digest.done.map((d) => (
                          <Text
                              dimColor
                              key={`away:d:${d.sid}`}
                              wrap='truncate-end'>
                              {`done · ${d.name}`}
                          </Text>
                      )),
                  ]
                : [];
        return (
            <Box flexDirection='column'>
                {row}
                {/* the terminal reads the 5h and ctx on sline's line; the desktop keeps the bars (dima, 15:06) */}
                {Svg ? meters : null}
                {enhancer.error ? (
                    <Text color='error' key='enh:error' wrap='truncate-end'>
                        {enhancer.error}
                    </Text>
                ) : null}
                {meter?.note ? (
                    <Text color='error' wrap='truncate-end'>
                        {meter.note}
                    </Text>
                ) : null}
                {away}
                {await next(e)}
            </Box>
        );
    });
};
