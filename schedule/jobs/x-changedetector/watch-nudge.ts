// cclio's UserPromptSubmit hook: an upstream github issue or pr in the prompt with no watch → one nudge line
import { readFileSync } from 'node:fs';

import { apiKey, watchApi, watchFor } from './watch-add.ts';

const ownOwners = ['dvakatsiienko'];

export function upstreamLinks(text: string) {
    const links = new Set<string>();
    for (const [link, owner] of text.matchAll(
        /https:\/\/github\.com\/([^/\s]+)\/[^/\s]+\/(?:issues|pull)\/\d+/g,
    )) {
        if (owner && !ownOwners.includes(owner)) links.add(link);
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
