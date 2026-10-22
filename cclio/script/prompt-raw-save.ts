// cclio's UserPromptSubmit hook: every prompt dima types lands raw in a day file outside every repo (frame is public),
// so a wish folded from it is groomed from his exact words (pm revamp grill 8, dima's W59, o88, o93)
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const dir =
    process.env.PROMPT_RAW_DIR ??
    path.join(process.env.HOME ?? '', '.local/state/cclio/prompts');
// the fleet's own traffic arrives as a prompt too: a peer, a wake, a background task, a slash command's echo
const FLEET = [
    '<cross-session-message',
    '[Cross-session idle notice]',
    '<task-notification>',
    '<system-reminder>',
    '<local-command',
    '<command-name>',
    '<command-message>',
];

export function isDimas(prompt: string) {
    const head = prompt.trimStart();
    return head.length > 0 && !FLEET.some((mark) => head.startsWith(mark));
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
    if (isDimas(prompt)) {
        const now = new Date();
        const file = path.join(dir, `${now.toLocaleDateString('sv')}.md`);
        mkdirSync(dir, { recursive: true });
        const line = existsSync(file)
            ? readFileSync(file, 'utf8').split('\n').length
            : 1;
        appendFileSync(file, entryFor(prompt, now));
        console.log(`raw saved · ${file}:${line}`);
    }
}
