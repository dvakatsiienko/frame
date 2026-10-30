// clio's UserPromptSubmit hook: every prompt dima types lands raw in a day file outside every repo (frame is public),
// so a wish folded from it is groomed from his exact words (pm revamp grill 8, dima's W59, o88, o93)
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { ungroomedPrompts } from './prompt-groom.ts';

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

// the groom gate every prompt, not only at a siesta: the day's prompts older than 10 minutes with no groom
export function groomNudge(
    dayText: string,
    day: string,
    now: string,
    noWishText: string,
) {
    const late = ungroomedPrompts(dayText, day, now, noWishText).map(
        (p) => p.hhmm,
    );
    return late.length > 0
        ? `🔴 ${late.length} prompt(s) ungroomed past 10 min: ${late.join(' ')} — node script/prompt-groom.ts <HH:MM>, or a no-wish line`
        : undefined;
}

export function entryFor(prompt: string, at: Date) {
    const hh = String(at.getHours()).padStart(2, '0');
    const mm = String(at.getMinutes()).padStart(2, '0');
    return `## ${hh}:${mm}\n\n${prompt.trim()}\n\n`;
}

if (import.meta.main) {
    const { prompt = '' } = JSON.parse(readFileSync(0, 'utf8') || '{}') as {
        prompt?: string;
    };
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
        const nudge = groomNudge(
            readFileSync(file, 'utf8'),
            day,
            now.toLocaleTimeString('sv').slice(0, 5),
            existsSync(noWish) ? readFileSync(noWish, 'utf8') : '',
        );
        if (nudge) console.log(nudge);
    }
}
