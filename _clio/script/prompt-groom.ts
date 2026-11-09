// FRM-418: a prompt of dima's is groomed before it is folded, and a fold with no groom reds
// usage: node prompt-groom.ts <HH:MM|oN> [--date YYYY-MM-DD] [--transcript <jsonl>]   cut the raw prompt (or orbit steer oN, FRM-451), start helga if down, print the chore brief
//        node prompt-groom.ts --next <PK-N|FRM-N|BYT-N>      print the home's next full wish id, <home>:W1 for an empty home (PK-312, PK-338)
//        node prompt-groom.ts --move <PK-N> <FRM-N|BYT-N> <W-id…>   print the wishes renumbered into the ticket's series and the pocket's «moved:» line (o98); writes nothing
//        node prompt-groom.ts --no-wish <HH:MM|oN> '<why>'     write today's no-wish line for a prompt minute or an orbit steer, one call (dima's o76)
//        node prompt-groom.ts --standing [YYYY-MM-DD]       print the day's open ` #standing` W-lines, one a line (FRM-482; a new day starts empty)
//        node prompt-groom.ts --tag <W-id>                 clio's hand: end today's W-line with ` #standing`
//        node prompt-groom.ts --lift <W-id|all>            turn today's ` #standing` W-line(s) ` #lifted`; exit 1 when none matched
//        node prompt-groom.ts --check <file…>              red each W-line stamped from the rules start through today with no groom (the halt: linear bodies updated in the last 2 days)
//        node prompt-groom.ts --day [YYYY-MM-DD] [--now HH:MM] [--transcript <jsonl>]   red each prompt of that day (default today; a past day's now is its 23:59) older than 10 minutes with no groom and no `HH:MM — <why>` line in grooms/<day>.no-wish.md (slash-command-only and harness-event-only prompts skipped), each orbit steer of that day with no groom and no `oN — <why>` line, and each W-line of that day's groomed files whose id and text share no line of a pocket task file, no .scratch spec.md and no linear ticket body updated yesterday or today (linear unreachable: a 🟡 line, the no-home check skipped)
import { execFileSync } from 'node:child_process';
import {
    appendFileSync,
    existsSync,
    globSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import path from 'node:path';

import { steersOf } from './chat-lines.ts';
import { seatOf } from './session-registry.ts';
import { normalize, prefixWish, repeatedIds, unwrapIds } from './wish-cover.ts';

const home = process.env.HOME ?? '';
// each clio seat keeps its own prompts and grooms: main at the root, a wing in `wing-<N>/` (FRM-542)
const seat = seatOf() ?? '';
const promptDir = path.join(
    process.env.PROMPT_RAW_DIR ?? path.join(home, '.local/state/clio/prompts'),
    seat,
);
const groomRoot =
    process.env.PROMPT_GROOM_DIR ?? path.join(home, '.local/state/clio/grooms');
const groomDir = path.join(groomRoot, seat);
// a groom is written to its own seat's folder and read from every seat's: one made in main counts in a wing
const groomDirs = () => [
    groomRoot,
    ...(existsSync(groomRoot) ? readdirSync(groomRoot) : [])
        .filter((name) => /^wing-\d+$/.test(name))
        .map((name) => path.join(groomRoot, name)),
];
const pocketDir =
    process.env.POCKET_DIR ?? path.join(import.meta.dirname, '../pocket');
// the check binds every fold from the day the rules landed (dima's o61–o63) through today
// FRM-418's rule landed 2026-10-25 14:50; an earlier prompt was never groomed by design
const RULES_FROM = '2026-10-25 14:50';
// both shapes, an old head bare or a head with its home: helga's stamp-first `<home>:W<n> (<date> <HH:MM>, dima): text` and its drift `<home>:W<n> · text (<date> <HH:MM>, dima)`
const STAMP =
    /^\s*(?:[*-]\s+)?(?:(?:PK|FRM|BYT)-\d+:)?W\d+(?: \(| · [^\n]*\()(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}|inbox), dima(?:, (o\d+) steer)?/gm;

export type Groomed = (day: string, hhmm: string, item: string) => boolean;

export function dayBefore(day: string) {
    const date = new Date(`${day}T12:00:00`);
    date.setDate(date.getDate() - 1);
    return date.toLocaleDateString('sv');
}

export const groomFile = (day: string, hhmm: string, kind: 'raw' | 'groomed') =>
    path.join(groomDir, `${day}-${hhmm.replace(':', '')}.${kind}.md`);

// a line without its quote marker and its list marker: the shape of helga's prep, which quotes the original drop
const bare = (line: string) =>
    line
        .trim()
        .replace(/^> ?/, '')
        .replace(/^(?:\d+\.|[-*])\s+/, '');

// a groom file holds at least one W-line stamped with this very minute; a placeholder file fails
// an inbox day's groomed file is helga's checked prep, copied in at boot: it must exist and carry every
// `raw drop (<day> inbox, dima): …` note of the item, or an inbox stamp would pass a raw fold
export const groomedOnDisk: Groomed = (day, hhmm, item) =>
    groomDirs().some((dir) => groomedIn(dir, day, hhmm, item));

function groomedIn(dir: string, day: string, hhmm: string, item: string) {
    const file = path.join(dir, path.basename(groomFile(day, hhmm, 'groomed')));
    if (!existsSync(file)) return false;
    const groomed = readFileSync(file, 'utf8');
    if (hhmm === 'inbox') {
        const drops = [
            ...item.matchAll(
                new RegExp(`^raw drop \\(${day} inbox, dima\\): (.+)$`, 'gm'),
            ),
        ].map(([, drop]) => bare(drop ?? ''));
        const prep = groomed.split('\n').map(bare).join('\n');
        return drops.length > 0 && drops.every((drop) => prep.includes(drop));
    }
    return groomed
        .matchAll(STAMP)
        .some(([, date, time, id]) => date === day && (id ?? time) === hhmm);
}

// a minute this seat's log lacks was typed in another seat or before the log existed, so it owes this seat no groom
export const groomedOrUnlogged: Groomed = (day, key, item) => {
    if (groomedOnDisk(day, key, item)) return true;
    if (!/^\d{2}:\d{2}$/.test(key)) return false;
    const log = path.join(promptDir, `${day}.md`);
    return (
        !existsSync(log) ||
        rawPromptAt(readFileSync(log, 'utf8'), key) === undefined
    );
};

// the step that turns an ungroomed stamp green: a prompt is groomed by the chore, an inbox day by the boot's copy of helga's prep
export const groomStep = (hhmm: string) =>
    hhmm.startsWith('inbox')
        ? "copy that day's checked inbox-helga.md byte for byte to grooms/<day>-inbox.groomed.md (boot step 3) and fix the pocket note to one quote line per note, never the groomed file, or re-prep with helga"
        : `run \`node script/prompt-groom.ts ${hhmm}\``;

export function ungroomedStamps(
    text: string,
    day: string,
    isGroomed: Groomed = groomedOnDisk,
) {
    // a prompt of an earlier day names its date, so the chore command can take --date
    const times = new Set<string>();
    for (const [, date, hhmm, id] of text.matchAll(STAMP)) {
        // an orbit steer is groomed by its id, not its minute
        const key = id ?? hhmm;
        if (
            date &&
            key &&
            `${date} ${hhmm}` >= RULES_FROM &&
            date <= day &&
            !isGroomed(date, key, text)
        )
            times.add(date === day ? key : `${key} --date ${date}`);
    }
    return [...times];
}

// a raw prompt file from the rules start on, older than 10 minutes, with no groomed twin: the groom was started and never finished
export function strayRaws(files: string[], now: Date) {
    return files.filter((file) => {
        const [, day, hh, mm] =
            file.match(/^(\d{4}-\d{2}-\d{2})-(\d{2})(\d{2})\.raw\.md$/) ?? [];
        if (!day || `${day} ${hh}:${mm}` < RULES_FROM) return false;
        const age = now.getTime() - new Date(`${day}T${hh}:${mm}:00`).getTime();
        return (
            age > 10 * 60_000 &&
            !files.includes(file.replace('.raw.md', '.groomed.md'))
        );
    });
}

// the groom unit is a minute: every prompt saved under that head, so a wish in the second one is groomed too
export function rawPromptAt(dayFile: string, hhmm: string) {
    const prompts = dayFile
        .split(/^## /m)
        .filter((b) => b.startsWith(`${hhmm}\n`))
        .map((b) => b.slice(hhmm.length).trim())
        .filter(Boolean);
    return prompts.length > 0 ? prompts.join('\n\n---\n\n') : undefined;
}

// a minute with 2+ typed prompts needs `HH:MM ×N — <why>`, so a line written for one can't hide the other
function noWishKey(hhmm: string, text: string) {
    const typed = text
        .split('\n\n---\n\n')
        .filter((part) =>
            part
                .replace(
                    /<(side-sessions-event|task-notification|system-reminder)>[\s\S]*?<\/\1>/g,
                    '',
                )
                .trim(),
        ).length;
    return typed > 1 ? `${hhmm} ×${typed}` : hhmm;
}

// the `HH:MM — <why>` and `oN — <why>` lines of a no-wish file: a prompt minute or an orbit steer that carries no wish
const noWishIds = (noWishText: string) =>
    new Set(
        [...noWishText.matchAll(/^(\d{2}:\d{2}(?: ×\d+)?|o\d+) — /gm)].map(
            ([, id]) => id,
        ),
    );

// the day's orbit steers (the newest of each id) with no groom and no no-wish line
function ungroomedSteers(
    steers: { day: string; id: string; text: string }[],
    day: string,
    noWishText: string,
) {
    const noWish = noWishIds(noWishText);
    const latest = new Map(
        steers.filter((s) => s.day === day).map((s) => [s.id, s.text]),
    );
    return [...latest]
        .filter(
            ([id, text]) => !noWish.has(id) && !groomedOnDisk(day, id, text),
        )
        .map(([id, text]) => ({ id, text }));
}

// a prompt of the day file older than 10 minutes at `now` with no groom and no no-wish line; a prompt of slash commands or local-command echoes alone carries no wish
export function ungroomedPrompts(
    dayText: string,
    day: string,
    now: string,
    noWishText = '',
    isGroomed: Groomed = groomedOnDisk,
) {
    const minutes = (hhmm: string) =>
        Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
    const noWish = noWishIds(noWishText);
    const times = new Set(
        dayText.match(/^## \d{2}:\d{2}$/gm)?.map((head) => head.slice(3)),
    );
    return [...times].flatMap((hhmm) => {
        const text = rawPromptAt(dayText, hhmm);
        if (
            !text ||
            minutes(now) - minutes(hhmm) <= 10 ||
            noWish.has(noWishKey(hhmm, text)) ||
            isGroomed(day, hhmm, text) ||
            text
                .replace(
                    /<(side-sessions-event|task-notification|system-reminder)>[\s\S]*?<\/\1>/g,
                    '',
                )
                .split('\n')
                .filter((line) => line.trim() && line.trim() !== '---')
                .every((line) => /^\s*(?:\/|<local-command)/.test(line))
        )
            return [];
        return [{ hhmm, text }];
    });
}

// every ticket updated yesterday or today, a newly born one included (the halt's door; a halt after midnight still sees the day before)
function linearBodies(): [string, string][] {
    const day = new Date().toLocaleDateString('sv');
    return (
        JSON.parse(
            execFileSync(
                'x',
                [
                    'linear',
                    'api',
                    `{ issues(first: 250, filter: { updatedAt: { gte: "${dayBefore(day)}" } }) { nodes { identifier description } } }`,
                ],
                { encoding: 'utf8' },
            ),
        ).data.issues.nodes as {
            identifier: string;
            description: string | null;
        }[]
    ).map((n) => [n.identifier, unwrapIds(n.description ?? '')]);
}

// W-ids of the day's groomed files that no pocket task file, no scratch spec and no recent linear body carries: [id, groom file]
export function homelessWishes(
    day: string,
    scratchDir: string,
    linear: [string, string][],
) {
    const homes = [
        ...readdirSync(pocketDir, { recursive: true })
            .filter((name) => String(name).endsWith('.md'))
            .map((name) => path.join(pocketDir, String(name))),
        ...globSync('**/spec.md', { cwd: scratchDir }).map((name) =>
            path.join(scratchDir, name),
        ),
    ]
        .map((file) => readFileSync(file, 'utf8'))
        .concat(linear.map(([, body]) => body))
        .join('\n')
        .split('\n');
    // a stamp is shared by one prompt's lines and a short text recurs anywhere, so the id and the text home it together, on one line
    const isHomed = (line: string) => {
        const id = line.match(/\bW\d+\b/)?.[0];
        const text = line
            .replace(/^\s*(?:[*-]\s+)?(?:(?:PK|FRM|BYT)-\d+:)?W\d+/, '')
            .replace(/\(\d{4}-\d{2}-\d{2} [^)]*\)/, '')
            .replace(/^[\s·:]+/, '')
            .replace(/ #(standing|lifted)$/, '')
            .trim();
        // linear rewrites a body it stores (\~ for ~, autolinks), so both sides read through wish-cover's normalize
        const wanted = normalize(text);
        return (
            id !== undefined &&
            text !== '' &&
            homes.some(
                (home) =>
                    new RegExp(`\\b${id}\\b`).test(home) &&
                    normalize(home).includes(wanted),
            )
        );
    };
    return readdirSync(groomDir)
        .filter(
            (name) =>
                name.startsWith(`${day}-`) && name.endsWith('.groomed.md'),
        )
        .flatMap((name) =>
            (
                readFileSync(path.join(groomDir, name), 'utf8').match(W_LINE) ??
                []
            )
                // an unstamped line is helga's prep note or section id («- W1 has no bold title»), never his W-line
                .filter((line) => new RegExp(STAMP.source, 'm').test(line))
                .filter((line) => !isHomed(line))
                .map(
                    (line) =>
                        [
                            line.match(
                                /\b(?:(?:PK|FRM|BYT)-\d+:)?W\d+\b/,
                            )?.[0] ?? line,
                            name,
                        ] as const,
                ),
        );
}

const W_LINE = /^[ \t]*(?:[*-]\s+)?(?:(?:PK|FRM|BYT)-\d+:)?W\d+\b.*$/gm;

function bareId(id: string) {
    return id.replace(/^(?:PK|FRM|BYT)-\d+:/i, '');
}

// a full id names one home's line: a line headed by another home is not it, a bare old head still is
function isOtherHome(line: string, id: string) {
    const asked = id.match(/^((?:PK|FRM|BYT)-\d+):/i)?.[1]?.toUpperCase();
    const head = line.match(/^\s*(?:[*-]\s+)?((?:PK|FRM|BYT)-\d+):W\d/)?.[1];
    return Boolean(asked && head && asked !== head.toUpperCase());
}

// a prompt groom's (never the inbox prep's) `❓ ask` line with no W-id: [file, line]
// a session-wide instruction of dima's: helga tags its W-line ` #standing`; a lift turns it ` #lifted` (FRM-482)
function dayGrooms(day: string, dir: string) {
    return readdirSync(dir)
        .filter(
            (name) =>
                name.startsWith(`${day}-`) && name.endsWith('.groomed.md'),
        )
        .map((name) => path.join(dir, name));
}

export function openStanding(day: string, dir: string) {
    return dayGrooms(day, dir).flatMap((file) =>
        readFileSync(file, 'utf8')
            .split('\n')
            .filter((line) => / #standing\s*$/.test(line))
            .map((line) => ({
                id: line.match(/\bW\d+\b/)?.[0] ?? '',
                text: line.trim(),
            })),
    );
}

// a bare id two homes answer to names neither: a standing order stays where it is until the id says whose
function refuseAmbiguous(day: string, dir: string, id: string) {
    if (id === 'all' || bareId(id) !== id) return;
    const homes = new Set(
        dayGrooms(day, dir).flatMap((file) =>
            [
                ...readFileSync(file, 'utf8').matchAll(
                    /^\s*(?:[*-]\s+)?((?:PK|FRM|BYT)-\d+):(W\d+)\b/gm,
                ),
            ]
                .filter((m) => m[2] === id)
                .map((m) => m[1]),
        ),
    );
    if (homes.size > 1)
        throw new Error(
            `${id} names ${[...homes].map((home) => `${home}:${id}`).join(', ')}: pass the full id`,
        );
}

export function tagStanding(day: string, dir: string, id: string) {
    refuseAmbiguous(day, dir, id);
    const tagged: string[] = [];
    for (const file of dayGrooms(day, dir)) {
        const text = readFileSync(file, 'utf8');
        const next = text.replace(
            /^(.*?\b(W\d+)\b.*?)(\s*)$/gm,
            (line, head: string, wid: string, tail: string) => {
                if (
                    wid !== bareId(id) ||
                    isOtherHome(line, id) ||
                    / #(standing|lifted)$/.test(head)
                )
                    return line;
                tagged.push(wid);
                return `${head} #standing${tail}`;
            },
        );
        if (next !== text) writeFileSync(file, next);
    }
    return tagged;
}

export function liftStanding(day: string, dir: string, id: string) {
    refuseAmbiguous(day, dir, id);
    const lifted: string[] = [];
    for (const file of dayGrooms(day, dir)) {
        const text = readFileSync(file, 'utf8');
        const next = text.replace(
            /^(.*?\b(W\d+)\b.*) #standing(\s*)$/gm,
            (line, head: string, wid: string, tail: string) => {
                if (
                    id !== 'all' &&
                    (wid !== bareId(id) || isOtherHome(line, id))
                )
                    return line;
                lifted.push(wid);
                return `${head} #lifted${tail}`;
            },
        );
        if (next !== text) writeFileSync(file, next);
    }
    return lifted;
}

export function unnumberedAsks(day: string, dir: string) {
    return readdirSync(dir)
        .filter(
            (name) =>
                name.startsWith(`${day}-`) &&
                name.endsWith('.groomed.md') &&
                !name.endsWith('-inbox.groomed.md'),
        )
        .flatMap((name) =>
            readFileSync(path.join(dir, name), 'utf8')
                .split('\n')
                .filter(
                    (line) => /❓\s*ask/i.test(line) && !/\bW\d+\b/.test(line),
                )
                .map((line) => [name, line.trim()] as const),
        );
}

// a W-line added since HEAD must carry its prompt's stamp, or it slips past the groom check
export function newUnstamped(text: string, head: string, home = '') {
    const headLines = head.match(W_LINE) ?? [];
    const before = new Set([
        ...headLines,
        ...(home ? headLines.map((line) => prefixWish(line, home)) : []),
    ]);
    return (text.match(W_LINE) ?? []).filter(
        (line) =>
            !before.has(line) && !new RegExp(STAMP.source, 'm').test(line),
    );
}

// a W-line added since HEAD must carry its home, so a full id needs no habit (PK-338:W1); an old bare line stays valid
export function newBare(text: string, head: string, home: string) {
    const headLines = head.match(W_LINE) ?? [];
    const before = new Set([
        ...headLines,
        ...headLines.map((line) => prefixWish(line, home)),
    ]);
    return (text.match(W_LINE) ?? []).filter(
        (line) => !before.has(line) && /^\s*(?:[*-]\s+)?W\d/.test(line),
    );
}

// every steer in clio's transcript (the given one, else the newest under her project dir), with the local day it landed
function transcriptSteers(transcript?: string) {
    // read-both: the live dir since the 10-29 move, and the old one for history
    const file =
        transcript ??
        ['-Users-dima-frame--clio', '-Users-dima-frame-cclio']
            .map((d) => path.join(home, '.claude/projects', d))
            .filter((dir) => existsSync(dir))
            .flatMap((dir) =>
                readdirSync(dir)
                    .filter((name) => name.endsWith('.jsonl'))
                    .map((name) => path.join(dir, name)),
            )
            .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
    if (!file || !existsSync(file)) return [];
    return readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .flatMap((row) => {
            const entry: Parameters<typeof steersOf>[0] = JSON.parse(row);
            const day = entry.timestamp
                ? new Date(entry.timestamp).toLocaleDateString('sv')
                : '';
            return steersOf(entry).map((steer) => ({ ...steer, day }));
        });
}

// the prompt hook names its own transcript; with none, the newest clio transcript may be another seat's, so no steer is owed
export const ungroomedSteersToday = (
    day: string,
    noWishText: string,
    transcript?: string,
) =>
    transcript === undefined
        ? []
        : ungroomedSteers(transcriptSteers(transcript), day, noWishText);

// every steer of that id on that day: one ask can take several, and an id can return on a later day
const steerText = (id: string, day: string, transcript?: string) =>
    [
        ...new Set(
            transcriptSteers(transcript)
                .filter((steer) => steer.id === id && steer.day === day)
                .map((steer) => steer.text),
        ),
    ].join('\n') || undefined;

function helgaUp() {
    const agents = JSON.parse(
        execFileSync('claude', ['agents', '--json'], { encoding: 'utf8' }),
    ) as {
        name?: string;
        status?: string;
    }[];
    return (
        agents.some(
            (a) => a.name?.includes('helga') && a.status !== 'exited',
        ) || helgaPaneUp()
    );
}

// a pane helga is no --bg agent: hc ls lists only live terminals, so a labelled one is up (no hc or no core: not up)
function helgaPaneUp() {
    try {
        const { terminals } = JSON.parse(
            execFileSync('hc', ['ls', '--json', '--label', 'seat=helga'], {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore'],
            }),
        ) as { terminals: unknown[] };
        return terminals.length > 0;
    } catch {
        return false;
    }
}

// helga's cwd sits outside frame with CLAUDE.md loading off, so her passport rides the boot prompt
export function helgaBootPrompt(frame: string) {
    const skill = readFileSync(
        path.join(frame, 'home/.claude/plugin-x/skills/crew-helga/SKILL.md'),
        'utf8',
    ).replace(/^---\n[\s\S]*?\n---\n+/, '');
    const passport = readFileSync(path.join(frame, '_helga/AGENTS.md'), 'utf8');
    return `${skill}\n\n---\n\n${passport}`;
}

function startHelga() {
    const skill = helgaBootPrompt(path.join(home, 'frame'));
    const cwd = path.join(home, '.local/state/helga');
    mkdirSync(cwd, { recursive: true });
    const settings = JSON.stringify({
        autoCompactWindow: 130000,
        env: { CLAUDE_CODE_DISABLE_CLAUDE_MDS: '1' },
        worktree: { bgIsolation: 'none' },
    });
    const claudeArgs = [
        '-n',
        '🎀 helga',
        '--model',
        'haiku',
        '--effort',
        'medium',
        '--settings',
        settings,
    ];
    // a herdr seat sets CLIO_SIDECAR_PANE=1: the prompt rides inside hc run, no job id
    if (process.env.CLIO_SIDECAR_PANE === '1') {
        execFileSync(
            'hc',
            [
                'run',
                '--bg',
                '--no-parent',
                '--no-notify',
                '--name',
                'helga',
                '--cwd',
                cwd,
                '--label',
                'seat=helga',
                '--',
                'claude',
                ...claudeArgs,
                '--remote-control',
                '🎀 helga',
                skill,
            ],
            { stdio: 'inherit' },
        );
        return;
    }
    execFileSync('claude', ['--bg', ...claudeArgs, skill, '--remote-control'], {
        cwd,
        stdio: 'inherit',
    });
}

// a wish id numbers on inside its home, never from a global counter (PK-312, dima o94, o96, o98)
const highestWish = (homeText: string) =>
    Math.max(
        0,
        ...[
            ...unwrapIds(homeText).matchAll(
                /^\s*(?:[*-]\s+)?(?:(?:PK|FRM|BYT)-\d+:)?W(\d+)\b/gm,
            ),
        ].map((m) => Number(m[1])),
    );

export const nextWishId = (homeText: string, home: string): string =>
    `${home.toUpperCase()}:W${highestWish(homeText) + 1}`;

// a pocket wish moving to a ticket takes the ticket's next ids, text and stamp whole; the pocket keeps a moved line (o98)
export function moveWishes(
    pocketText: string,
    ticketText: string,
    item: string,
    ticket: string,
    ids: string[],
) {
    const bare = ids.map(bareId);
    const home = item.toUpperCase();
    const to = ticket.toUpperCase();
    const foreign = ids.filter(
        (id) => id.includes(':') && !id.toUpperCase().startsWith(`${home}:`),
    );
    if (foreign.length)
        throw new Error(`not ${home}'s ids: ${foreign.join(', ')}`);
    const repeated = repeatedIds(pocketText, [home]);
    if (repeated.length)
        throw new Error(
            `${home} numbers ${repeated.join(', ')} twice: renumber before a move`,
        );
    const wish = new Map(
        [
            ...pocketText.matchAll(
                /^\s*(?:[*-]\s+)?(?:((?:PK|FRM|BYT)-\d+):)?(W\d+) (\(.*)$/gm,
            ),
        ]
            .filter((m) => !m[1] || m[1].toUpperCase() === home)
            .map((m) => [m[2], m[3]]),
    );
    const missing = bare.filter((id) => !wish.has(id));
    if (missing.length)
        throw new Error(`not in the pocket item: ${missing.join(', ')}`);
    let next = highestWish(ticketText) + 1;
    const moved = bare.map((id) => ({ from: id, n: next++ }));
    return {
        lines: moved.map(({ from, n }) => `* ${to}:W${n} ${wish.get(from)}`),
        note: `moved: ${moved.map(({ from, n }) => `${home}:${from} → ${to}:W${n}`).join(', ')}`,
    };
}

const homeText = (home: string): string => {
    if (/^PK-\d+$/i.test(home)) {
        const [file] = globSync(
            `{tasks,archive/tasks}/${home.toLowerCase()} - *.md`,
            { cwd: pocketDir },
        );
        if (!file) throw new Error(`no pocket item ${home}`);
        return readFileSync(path.join(pocketDir, file), 'utf8');
    }
    const out = JSON.parse(
        execFileSync('x', ['linear', 'body', home], { encoding: 'utf8' }),
    );
    return readFileSync(out.data.file, 'utf8');
};

if (import.meta.main) {
    const args = process.argv.slice(2);
    const today = new Date().toLocaleDateString('sv');
    if (args[0] === '--next') {
        console.log(nextWishId(homeText(args[1] ?? ''), args[1] ?? ''));
        process.exit(0);
    }
    if (args[0] === '--move') {
        const [, item = '', ticket = '', ...ids] = args;
        const { lines, note } = moveWishes(
            homeText(item),
            homeText(ticket),
            item,
            ticket,
            ids,
        );
        console.log([...lines, '', note].join('\n'));
        process.exit(0);
    }
    if (args[0] === '--no-wish') {
        const [, key = '', why = ''] = args;
        if (!/^(\d{2}:\d{2}|o\d+)$/.test(key) || !why.trim()) {
            console.error(
                "usage: node prompt-groom.ts --no-wish <HH:MM|oN> '<why>'",
            );
            process.exit(2);
        }
        mkdirSync(groomDir, { recursive: true });
        appendFileSync(
            path.join(groomDir, `${today}.no-wish.md`),
            `${key} — ${why.trim()}\n`,
        );
        console.log(`${key} — no wish, today`);
        process.exit(0);
    }
    if (args[0] === '--standing') {
        for (const line of openStanding(args[1] ?? today, groomDir))
            console.log(line.text);
        process.exit(0);
    }
    if (args[0] === '--tag') {
        const tagged = tagStanding(today, groomDir, args[1] ?? '');
        console.log(
            tagged.length
                ? `tagged: ${tagged.join(', ')}`
                : `no line to tag: ${args[1] ?? ''}`,
        );
        process.exit(tagged.length ? 0 : 1);
    }
    if (args[0] === '--lift') {
        const lifted = liftStanding(today, groomDir, args[1] ?? '');
        console.log(
            lifted.length
                ? `lifted: ${lifted.join(', ')}`
                : `nothing open matches ${args[1] ?? ''}`,
        );
        process.exit(lifted.length ? 0 : 1);
    }
    if (args[0] === '--day') {
        const today = new Date();
        const day = /^\d{4}-\d{2}-\d{2}$/.test(args[1] ?? '')
            ? (args[1] ?? '')
            : today.toLocaleDateString('sv');
        const nowAt = args.indexOf('--now');
        // a past day is over: every prompt of it is old
        const now =
            nowAt >= 0
                ? (args[nowAt + 1] ?? '')
                : day < today.toLocaleDateString('sv')
                  ? '23:59'
                  : today.toLocaleTimeString('sv').slice(0, 5);
        const read = (file: string) =>
            existsSync(file) ? readFileSync(file, 'utf8') : '';
        const noWishText = read(path.join(groomDir, `${day}.no-wish.md`));
        const transcriptAt = args.indexOf('--transcript');
        const missing = [
            ...ungroomedPrompts(
                read(path.join(promptDir, `${day}.md`)),
                day,
                now,
                noWishText,
            ).map(({ hhmm, text }) => ({ id: hhmm, text })),
            ...ungroomedSteers(
                transcriptSteers(
                    transcriptAt >= 0 ? args[transcriptAt + 1] : undefined,
                ),
                day,
                noWishText,
            ),
        ];
        let linear: [string, string][] | undefined;
        try {
            linear = linearBodies();
        } catch {
            console.error(
                '🟡 linear not read — the no-home check skipped, the prompt reds below still stand',
            );
        }
        const homeless =
            linear && existsSync(groomDir)
                ? homelessWishes(day, path.join(home, 'frame/.scratch'), linear)
                : [];
        for (const { id, text } of missing)
            console.log(
                `🔴 ${id} — no groom: ${text.replace(/\s+/g, ' ').slice(0, 60)} — ${groomStep(`${id} --date ${day}`)}, or add «${id} — <why>» to ${path.join(groomDir, `${day}.no-wish.md`)}`,
            );
        for (const [id, file] of homeless)
            console.log(
                `🔴 ${id} (${file}) — no home: a groomed W-line whose id and text share no line of a pocket task file, no spec.md and no recent linear body`,
            );
        // a prompt groom's question is a W-line; an unnumbered ask line is invisible to the home check
        const asks = existsSync(groomDir) ? unnumberedAsks(day, groomDir) : [];
        for (const [file, line] of asks)
            console.log(
                `🔴 ${file} — an unnumbered ask, no home check sees it: ${line.slice(0, 60)} — make it a \`<home>:W<n> … ❓\` line`,
            );
        const reds = missing.length + homeless.length + asks.length;
        if (reds === 0 && linear)
            console.log(
                `🟢 ${day} at ${now}: every prompt older than 10 minutes and every steer has a groom or a no-wish line, and every groomed W-line has a home (scanned: ${promptDir}/${day}.md, ${groomDir}, ${pocketDir}, ${home}/frame/.scratch/**/spec.md, linear tickets updated yesterday or today)`,
            );
        process.exitCode = reds ? 1 : 0;
    } else if (args[0] === '--check' || args[0] === '--linear') {
        const day = new Date().toLocaleDateString('sv');
        // --linear: every ticket updated yesterday or today, a newly born one included (the halt's door; a halt after midnight still sees the day before)
        const sources: [string, string][] =
            args[0] === '--linear'
                ? linearBodies()
                : args
                      .slice(1)
                      .map((f) => [f, unwrapIds(readFileSync(f, 'utf8'))]);
        let red = 0;
        for (const [name, text] of sources) {
            for (const hhmm of ungroomedStamps(text, day)) {
                red++;
                console.log(
                    `🔴 ${name}: W-lines of the ${hhmm} prompt folded with no groom — ${groomStep(hhmm)}, then refold from the groomed file`,
                );
            }
        }
        if (existsSync(groomDir))
            for (const file of strayRaws(readdirSync(groomDir), new Date())) {
                red++;
                console.log(
                    `🔴 ${file}: a raw prompt with no groomed twin after 10 minutes — finish the groom into ${file.replace('.raw.md', '.groomed.md')}`,
                );
            }
        if (red === 0)
            console.log(
                `🟢 ${sources.length} source(s): every W-line stamped since the rules start was groomed`,
            );
        process.exitCode = red ? 1 : 0;
    } else {
        const hhmm = args[0] ?? '';
        const dateAt = args.indexOf('--date');
        const day =
            dateAt >= 0
                ? (args[dateAt + 1] ?? '')
                : new Date().toLocaleDateString('sv');
        const dayFile = path.join(promptDir, `${day}.md`);
        // an orbit steer (o69) is cut from clio's transcript, not the prompts file
        const isSteer = /^o\d+$/.test(hhmm);
        const transcriptAt = args.indexOf('--transcript');
        const raw = isSteer
            ? steerText(
                  hhmm,
                  day,
                  transcriptAt >= 0 ? args[transcriptAt + 1] : undefined,
              )
            : existsSync(dayFile)
              ? rawPromptAt(readFileSync(dayFile, 'utf8'), hhmm)
              : undefined;
        if (hhmm === 'inbox') {
            console.error(
                `an inbox has no raw prompt to cut: ${groomStep(hhmm)}`,
            );
            process.exit(1);
        }
        if (!(isSteer || /^\d{2}:\d{2}$/.test(hhmm)) || !raw) {
            console.error(
                isSteer
                    ? `no steer ${hhmm} in the transcript`
                    : `no prompt of dima's at ${hhmm || '?'} in ${dayFile}`,
            );
            process.exit(1);
        }
        mkdirSync(groomDir, { recursive: true });
        const rawFile = groomFile(day, hhmm, 'raw');
        writeFileSync(rawFile, `${raw}\n`);
        if (!helgaUp()) startHelga();
        console.log(
            isSteer
                ? `prompt-groom: dima's ${day} ${hhmm} steer, raw text in ${rawFile}; groom it into numbered W-lines stamped «(${day} <HH:MM>, dima, ${hhmm} steer)», first number from «prompt-groom.ts --next <home>», written to ${groomFile(day, hhmm, 'groomed')}`
                : `prompt-groom: dima's ${day} ${hhmm} prompt, raw text in ${rawFile}; groom it into numbered W-lines stamped «(${day} ${hhmm}, dima)», first number from «prompt-groom.ts --next <home>», written to ${groomFile(day, hhmm, 'groomed')}`,
        );
    }
}
