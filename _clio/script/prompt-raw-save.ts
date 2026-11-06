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

const dir =
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

// a personal chore mixed into a running lane's thread is offered clio's side channel, one line
export function sideChannelNudge(text: string, home: string) {
    return PERSONAL_CHORE.test(text) && isLaneLive(home)
        ? '🪽 a wing? a personal chore while a lane runs — `clio:side-channel` keeps it out of the lane'
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

if (import.meta.main) {
    const { prompt = '', transcript_path } = JSON.parse(
        readFileSync(0, 'utf8') || '{}',
    ) as { prompt?: string; transcript_path?: string };
    const text = dimasText(prompt);
    if (text) {
        const now = new Date();
        const file = path.join(dir, `${now.toLocaleDateString('sv')}.md`);
        mkdirSync(dir, { recursive: true });
        const line = existsSync(file)
            ? readFileSync(file, 'utf8').split('\n').length
            : 1;
        appendFileSync(file, entryFor(text, now));
        console.log(`raw saved · ${file}:${line}`);
        const day = now.toLocaleDateString('sv');
        const noWish = path.join(
            process.env.PROMPT_GROOM_DIR ??
                path.join(process.env.HOME ?? '', '.local/state/clio/grooms'),
            `${day}.no-wish.md`,
        );
        const noWishText = existsSync(noWish)
            ? readFileSync(noWish, 'utf8')
            : '';
        const nudge = groomNudge(
            readFileSync(file, 'utf8'),
            day,
            now.toLocaleTimeString('sv').slice(0, 5),
            noWishText,
            ungroomedSteersToday(day, noWishText, transcript_path).map(
                (s) => s.id,
            ),
        );
        if (nudge) console.log(nudge);
        const side = sideChannelNudge(text, process.env.HOME ?? '');
        if (side) console.log(side);
    }
}
