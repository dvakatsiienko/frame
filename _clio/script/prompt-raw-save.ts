// clio's UserPromptSubmit hook: every prompt dima types lands raw in a day file outside every repo (frame is public),
// so a wish folded from it is groomed from his exact words (pm revamp grill 8, dima's W59, o88, o93)
import {
    appendFileSync,
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
} from 'node:fs';
import path from 'node:path';

import { ungroomedPrompts, ungroomedSteersToday } from './prompt-groom.ts';
import { seatOf } from './session-registry.ts';

const rawRoot =
    process.env.PROMPT_RAW_DIR ??
    path.join(process.env.HOME ?? '', '.local/state/clio/prompts');
// the fleet's own traffic arrives as a prompt too: a peer, a wake, a background task, a slash command's echo
const FLEET = [
    '<cross-session-message',
    '[Cross-session idle notice]',
    '<task-notification>',
    '<local-command',
    '<command-name>',
    '<command-message>',
];
// the app prepends notices (a fork's turn end) to his own prompt, so a reminder block never decides whose it is
const REMINDER = /<system-reminder>[\s\S]*?<\/system-reminder>/g;

export function dimasText(prompt: string) {
    const text = prompt.replace(REMINDER, '').trim();
    return text && !FLEET.some((mark) => text.startsWith(mark))
        ? text
        : undefined;
}

// the groom gate every prompt, not only at a siesta: the day's prompts older than 10 minutes and its orbit steers with no groom
export function groomNudge(
    dayText: string,
    day: string,
    now: string,
    noWishText: string,
    steerIds: string[] = [],
) {
    const late = [
        ...ungroomedPrompts(dayText, day, now, noWishText).map((p) => p.hhmm),
        ...steerIds,
    ];
    return late.length > 0
        ? `🔴 ${late.length} prompt(s) or steer(s) ungroomed: ${late.join(' ')} — node script/prompt-groom.ts <HH:MM|oN>, or a no-wish line`
        : undefined;
}

// measured over his raw prompts 10-30 → 11-03: these hit only personal chores; «order», «card», «subscription»,
// «anthropic», «plan» and «billing» hit fleet prompts too, so they stay out
const PERSONAL_CHORE =
    /\b(email|buy|auto-renew|refund|invoice|recruiter|tax|bank)\b/i;

// a personal chore mixed into a running lane's thread is offered a wing, one line
export function wingNudge(text: string, home: string) {
    return PERSONAL_CHORE.test(text) && isLaneLive(home)
        ? '🪽 a wing? a personal chore while a lane runs — `clio:wing` keeps it out of the lane'
        : undefined;
}

// a live lane is a live session whose registry name carries codie
function isLaneLive(home: string) {
    const dir = path.join(home, '.claude/sessions');
    if (!existsSync(dir)) return false;
    return readdirSync(dir)
        .filter((f) => /^\d+\.json$/.test(f))
        .some((f) => {
            const name = registryName(path.join(dir, f));
            return (
                Boolean(name?.includes('codie')) &&
                isAlive(Number.parseInt(f, 10))
            );
        });
}

// a registry file cc is mid-writing reads as no name, never a crash of the prompt hook
function registryName(file: string) {
    try {
        return (JSON.parse(readFileSync(file, 'utf8')) as { name?: string })
            .name;
    } catch {
        return undefined;
    }
}

function isAlive(pid: number) {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

export function entryFor(prompt: string, at: Date) {
    const hh = String(at.getHours()).padStart(2, '0');
    const mm = String(at.getMinutes()).padStart(2, '0');
    return `## ${hh}:${mm}\n\n${prompt.trim()}\n\n`;
}

// a seat's turn cannot end while 5 or more prompts or steers wait past 30 minutes for a groom (dima's o76, 2026-11-09)
export const GROOM_BLOCK_AT = 5;
export function groomBlock(
    dayText: string,
    day: string,
    now: string,
    noWishText: string,
    steerIds: string[] = [],
) {
    const [hh = 0, mm = 0] = now.split(':').map(Number);
    const minutes = Math.max(0, hh * 60 + mm - 20);
    const cutoff = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    const late = [
        ...ungroomedPrompts(dayText, day, cutoff, noWishText).map(
            (p) => p.hhmm,
        ),
        ...steerIds,
    ];
    return late.length >= GROOM_BLOCK_AT
        ? `🔴 ${late.length} prompt(s) or steer(s) wait past 30 min for a groom: ${late.join(' ')}. groom them before the turn ends: node script/prompt-groom.ts <HH:MM|oN>, or prompt-groom.ts --no-wish <HH:MM|oN> '<why>'`
        : undefined;
}

function seatDay(seat: string, now: Date, transcriptPath?: string) {
    const day = now.toLocaleDateString('sv');
    const file = path.join(rawRoot, seat, `${day}.md`);
    const noWish = path.join(
        process.env.PROMPT_GROOM_DIR ??
            path.join(process.env.HOME ?? '', '.local/state/clio/grooms'),
        seat,
        `${day}.no-wish.md`,
    );
    const noWishText = existsSync(noWish) ? readFileSync(noWish, 'utf8') : '';
    return {
        day,
        dayText: existsSync(file) ? readFileSync(file, 'utf8') : '',
        file,
        noWishText,
        now: now.toLocaleTimeString('sv').slice(0, 5),
        steerIds: ungroomedSteersToday(day, noWishText, transcriptPath).map(
            (s) => s.id,
        ),
    };
}

if (import.meta.main && process.argv[2] === '--stop') {
    const input = JSON.parse(readFileSync(0, 'utf8') || '{}') as {
        stop_hook_active?: boolean;
        transcript_path?: string;
    };
    const seat = seatOf();
    if (!input.stop_hook_active && seat !== undefined) {
        const d = seatDay(seat, new Date(), input.transcript_path);
        const reason = groomBlock(
            d.dayText,
            d.day,
            d.now,
            d.noWishText,
            d.steerIds,
        );
        if (reason) console.log(JSON.stringify({ decision: 'block', reason }));
    }
} else if (import.meta.main) {
    const { prompt = '', transcript_path } = JSON.parse(
        readFileSync(0, 'utf8') || '{}',
    ) as { prompt?: string; transcript_path?: string };
    const text = dimasText(prompt);
    // a session that is no clio seat (a plain fork, a sidecar) keeps no log
    const seat = seatOf();
    if (text && seat !== undefined) {
        const now = new Date();
        const { file } = seatDay(seat, now);
        mkdirSync(path.dirname(file), { recursive: true });
        const line = existsSync(file)
            ? readFileSync(file, 'utf8').split('\n').length
            : 1;
        appendFileSync(file, entryFor(text, now));
        console.log(`raw saved · ${file}:${line}`);
        const d = seatDay(seat, now, transcript_path);
        const nudge = groomNudge(
            d.dayText,
            d.day,
            d.now,
            d.noWishText,
            d.steerIds,
        );
        if (nudge) console.log(nudge);
        const wing = wingNudge(text, process.env.HOME ?? '');
        if (wing) console.log(wing);
    }
}
