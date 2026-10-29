// clio's UserPromptSubmit hook: every prompt dima types lands raw in a day file outside every repo (frame is public),
// so a wish folded from it is groomed from his exact words (pm revamp grill 8, dima's W59, o88, o93)
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

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
    }
}
