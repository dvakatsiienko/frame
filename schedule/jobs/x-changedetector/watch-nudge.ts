// clio's UserPromptSubmit hook: an upstream page in the prompt with no watch → one nudge line
import { readFileSync } from 'node:fs';

import { apiKey, watchApi, watchFor } from './watch-add.ts';

const ownOwners = ['dvakatsiienko'];
// every preview and prod deploy of ours ends in the vercel team's name
const ownVercelSuffix = '-dima-vakatsiienkos-projects.vercel.app';
// our own surfaces and pages that are read, never followed
const skipHosts = [
    'claude.ai',
    'linear.app',
    'figma.com',
    'www.figma.com',
    'localhost',
    '127.0.0.1',
    'youtube.com',
    'www.youtube.com',
    'youtu.be',
    'discord.gg',
    'docs.google.com',
    'notion.so',
    'www.notion.so',
];

export function upstreamLinks(text: string) {
    const links = new Set<string>();
    for (const [raw] of text.matchAll(/https?:\/\/[^\s<>«»"'`)\]]+/g)) {
        const link = raw.replace(/[.,;:!?]+$/, '');
        const url = URL.parse(link);
        if (
            !url ||
            skipHosts.includes(url.hostname) ||
            url.hostname.endsWith(ownVercelSuffix)
        )
            continue;
        if (url.hostname === 'github.com') {
            const [owner, , kind] = url.pathname.split('/').slice(1);
            const isIssue = kind === 'issues' || kind === 'pull';
            if (!isIssue || !owner || ownOwners.includes(owner)) continue;
        }
        links.add(link);
    }
    return [...links];
}

export function unwatched(links: string[], watchedUrls: string[]) {
    return links.filter((link) => !watchedUrls.includes(watchFor(link).url));
}

if (import.meta.main) {
    const { prompt = '' } = JSON.parse(readFileSync(0, 'utf8')) as {
        prompt?: string;
    };
    const links = upstreamLinks(prompt);
    if (links.length === 0) process.exit(0);
    const list = await fetch(watchApi, {
        headers: { 'x-api-key': apiKey() },
        signal: AbortSignal.timeout(3000),
    })
        .then((r) => r.json() as Promise<Record<string, { url: string }>>)
        .catch(() => undefined);
    if (list === undefined) process.exit(0);
    const missing = unwatched(
        links,
        Object.values(list).map((w) => w.url),
    );
    if (missing.length === 0) process.exit(0);
    const lines = missing.map(
        (link) => `pnpm -C ~/frame x-changedetector:watch-add ${link}`,
    );
    console.log(
        JSON.stringify({
            hookSpecificOutput: {
                additionalContext: `👁️ upstream link with no watch — add it this turn (habit-shared-files § watches):\n${lines.join('\n')}`,
                hookEventName: 'UserPromptSubmit',
            },
        }),
    );
}
