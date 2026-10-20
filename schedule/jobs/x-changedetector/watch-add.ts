// usage: pnpm x-changedetector:watch-add <url>   — a github issue or pr becomes an api watch with a jq filter, any other url a page watch
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const watchApi = 'http://127.0.0.1:7390/api/v1/watch';

export function apiKey(): string {
    const store = join(
        homedir(),
        '.local/share/x-changedetector/data/changedetection.json',
    );
    return JSON.parse(readFileSync(store, 'utf8')).settings.application
        .api_access_token as string;
}
const issueFilter =
    'jq:{state, state_reason, labels: [.labels[].name], comments, closed_at}';

export function watchFor(url: string): WatchBody {
    const issue = url.match(
        /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:issues|pull)\/(\d+)/,
    );
    if (!issue) return { url };
    const [, owner, repo, id] = issue;
    return {
        include_filters: [issueFilter],
        link_to_open: `https://github.com/${owner}/${repo}/issues/${id}`,
        title: `${owner}/${repo}#${id}`,
        url: `https://api.github.com/repos/${owner}/${repo}/issues/${id}`,
    };
}

async function main(input: string | undefined) {
    if (!input) {
        console.error('usage: pnpm x-changedetector:watch-add <url>');
        process.exit(2);
    }
    const headers = {
        'content-type': 'application/json',
        'x-api-key': apiKey(),
    };
    const body = watchFor(input);

    const list = (await (await fetch(watchApi, { headers })).json()) as Record<
        string,
        { url: string }
    >;
    const known = Object.entries(list).find(([, w]) => w.url === body.url);
    if (known) {
        console.log(`already watched: ${known[0]} · ${body.url}`);
        return;
    }

    if (body.title) {
        const issue = await fetch(body.url).catch(() => undefined);
        if (issue?.ok) {
            const { title } = (await issue.json()) as { title: string };
            body.title = `${body.title} ${title}`;
        }
    }

    const res = await fetch(watchApi, {
        body: JSON.stringify(body),
        headers,
        method: 'POST',
    });
    if (!res.ok) {
        console.error(
            `x-changedetector refused: ${res.status} ${await res.text()}`,
        );
        process.exit(1);
    }
    const { uuid } = (await res.json()) as { uuid: string };
    console.log(`watching: ${uuid} · ${body.title ?? body.url}`);
}

if (import.meta.main) await main(process.argv[2]);

/* Types */

interface WatchBody {
    include_filters?: string[];
    link_to_open?: string;
    title?: string;
    url: string;
}
