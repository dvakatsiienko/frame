// FRM-418: a prompt of dima's is groomed before it is folded, and a fold with no groom reds
// usage: node prompt-groom.ts <HH:MM|oN> [--date YYYY-MM-DD] [--transcript <jsonl>]   cut the raw prompt (or orbit steer oN, FRM-451), start helga if down, print the chore brief
//        node prompt-groom.ts --check <file…>               red each W-line stamped from the rules start through today with no groom (the halt: linear bodies updated in the last 2 days)
import { execFileSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import path from 'node:path';

import { steersOf } from './chat-lines.ts';

const home = process.env.HOME ?? '';
const promptDir =
    process.env.PROMPT_RAW_DIR ?? path.join(home, '.local/state/clio/prompts');
const groomDir =
    process.env.PROMPT_GROOM_DIR ?? path.join(home, '.local/state/clio/grooms');
// the check binds every fold from the day the rules landed (dima's o61–o63) through today
// FRM-418's rule landed 2026-10-25 14:50; an earlier prompt was never groomed by design
const RULES_FROM = '2026-10-25 14:50';
// both shapes: helga's stamp-first `W<n> (<date> <HH:MM>, dima): text` and its drift `W<n> · text (<date> <HH:MM>, dima)`
const STAMP =
    /^\s*(?:[*-]\s+)?W\d+(?: \(| · [^\n]*\()(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}|inbox), dima(?:, (o\d+) steer)?/gm;

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
export const groomedOnDisk: Groomed = (day, hhmm, item) => {
    const file = groomFile(day, hhmm, 'groomed');
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
};

// the step that turns an ungroomed stamp green: a prompt is groomed by the chore, an inbox day by the boot's copy of helga's prep
export const groomStep = (hhmm: string) =>
    hhmm.startsWith('inbox')
        ? "copy that day's checked inbox-helga.md to grooms/<day>-inbox.groomed.md (boot step 3) with each item's `raw drop (<day> inbox, dima): …` note in it, or re-prep with helga"
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

const W_LINE = /^\s*(?:[*-]\s+)?W\d+\b.*$/gm;

// a W-line added since HEAD must carry its prompt's stamp, or it slips past the groom check
export function newUnstamped(text: string, head: string) {
    const before = new Set(head.match(W_LINE) ?? []);
    return (text.match(W_LINE) ?? []).filter(
        (line) =>
            !before.has(line) && !new RegExp(STAMP.source, 'm').test(line),
    );
}

// the newest steer of that id in clio's transcript (the given one, else the newest under her project dir)
function steerText(id: string, transcript?: string) {
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
    if (!file || !existsSync(file)) return undefined;
    return readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .flatMap((row) => steersOf(JSON.parse(row)))
        .findLast((steer) => steer.id === id)?.text;
}

function helgaUp() {
    const agents = JSON.parse(
        execFileSync('claude', ['agents', '--json'], { encoding: 'utf8' }),
    ) as {
        name?: string;
        status?: string;
    }[];
    return agents.some(
        (a) => a.name?.includes('helga') && a.status !== 'exited',
    );
}

function startHelga() {
    const skill = readFileSync(
        path.join(
            home,
            'frame/home/.claude/plugin-x/skills/crew-helga/SKILL.md',
        ),
        'utf8',
    ).replace(/^---\n[\s\S]*?\n---\n/, '');
    const cwd = path.join(home, '.local/state/helga');
    mkdirSync(cwd, { recursive: true });
    const settings = JSON.stringify({
        autoCompactWindow: 130000,
        env: { CLAUDE_CODE_DISABLE_CLAUDE_MDS: '1' },
        worktree: { bgIsolation: 'none' },
    });
    execFileSync(
        'claude',
        [
            '--bg',
            '-n',
            '🎀 helga',
            '--model',
            'haiku',
            '--effort',
            'medium',
            '--settings',
            settings,
            skill,
            '--remote-control',
        ],
        { cwd, stdio: 'inherit' },
    );
}

if (import.meta.main) {
    const args = process.argv.slice(2);
    if (args[0] === '--check' || args[0] === '--linear') {
        const day = new Date().toLocaleDateString('sv');
        // --linear: every ticket updated yesterday or today, a newly born one included (the halt's door; a halt after midnight still sees the day before)
        const sources: [string, string][] =
            args[0] === '--linear'
                ? (
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
                  ).map((n) => [n.identifier, n.description ?? ''])
                : args.slice(1).map((f) => [f, readFileSync(f, 'utf8')]);
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
                ? `prompt-groom: dima's ${day} ${hhmm} steer, raw text in ${rawFile}; groom it into numbered W-lines stamped «(${day} <HH:MM>, dima, ${hhmm} steer)», first number <N>, written to ${groomFile(day, hhmm, 'groomed')}`
                : `prompt-groom: dima's ${day} ${hhmm} prompt, raw text in ${rawFile}; groom it into numbered W-lines stamped «(${day} ${hhmm}, dima)», first number <N>, written to ${groomFile(day, hhmm, 'groomed')}`,
        );
    }
}
