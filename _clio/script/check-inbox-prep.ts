// helga's inbox prep, checked for data loss: every content line of dima's inbox.md sits verbatim in inbox-helga.md
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const HQ = path.join(
    homedir(),
    "Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian Dima's Vault/_hq",
);

export function contentLines(inbox: string) {
    const body = inbox.replace(/^---\n[\s\S]*?\n---\n/, '');
    return body
        .split('\n')
        .map((line) => squash(line))
        .filter((line) => line && !/^(#|>|-{3,}$)/.test(line));
}

export function findMisses(inbox: string, prep: string) {
    const haystack = squash(prep.replace(/^>\s?/gm, ''));
    return contentLines(inbox).filter((line) => !haystack.includes(line));
}

function squash(text: string) {
    return text.replace(/\s+/g, ' ').trim();
}

if (import.meta.main) {
    const inbox = readFileSync(path.join(HQ, 'inbox.md'), 'utf8');
    const prep = readFileSync(path.join(HQ, 'inbox-helga.md'), 'utf8');
    const misses = findMisses(inbox, prep);
    const total = contentLines(inbox).length;
    console.log(`coverage ${total - misses.length}/${total}`);
    for (const miss of misses) console.log(`miss: ${miss}`);
    process.exit(misses.length ? 1 : 0);
}
