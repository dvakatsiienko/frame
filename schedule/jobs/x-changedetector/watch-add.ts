// usage: pnpm x-changedetector:watch-add <url> --why '<reason>'  |  pnpm x-changedetector:watch-add --why-set <url> '<reason>'   — a github issue or pr becomes an api watch with a jq filter, any other url a page watch; the title is «<what> — why: <reason>», --why-set rewrites the reason of a watched url
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

const whyTail = ' — why: ';
const usage = `usage: pnpm x-changedetector:watch-add <url> --why '<reason>' (e.g. watch-add https://example.com/pricing --why 'we wait for the new plan') · pnpm x-changedetector:watch-add --why-set <url> '<reason>'`;

export function parseCommand(argv: string[]): Command | undefined {
    if (argv.length !== 3) return undefined;
    const isSet = argv[0] === '--why-set';
    const [url, reason] = isSet
        ? [argv[1], argv[2]]
        : [argv[0], argv[1] === '--why' ? argv[2] : undefined];
    const trimmed = reason?.trim();
    if (!url || url.startsWith('--') || !trimmed) return undefined;
    return { mode: isSet ? 'set' : 'add', reason: trimmed, url };
}

export function whatFor(url: string, issueTitle?: string): string {
    const { title } = watchFor(url);
    if (title) return issueTitle ? `${title} ${issueTitle}` : title;
    const { host, pathname } = new URL(url);
    return host + pathname;
}

export const whatOf = (title: string): string => title.split(whyTail)[0] ?? '';

export const whyTitle = (what: string, reason: string): string =>
    `${what}${whyTail}${reason}`;

async function main(argv: string[]) {
    const command = parseCommand(argv);
    if (!command) {
        console.error(usage);
        process.exit(2);
    }
    const headers = {
        'content-type': 'application/json',
        'x-api-key': apiKey(),
    };
    const body = watchFor(command.url);

    const list = (await (await fetch(watchApi, { headers })).json()) as Record<
        string,
        { title?: string; url: string }
    >;
    const known = Object.entries(list).find(([, w]) => w.url === body.url);

    if (command.mode === 'set') {
        if (!known) {
            console.error(`not watched: ${command.url}`);
            process.exit(1);
        }
        const [uuid, watch] = known;
        const title = whyTitle(
            whatOf(watch.title ?? '') || whatFor(command.url),
            command.reason,
        );
        const put = await fetch(`${watchApi}/${uuid}`, {
            body: JSON.stringify({ title }),
            headers,
            method: 'PUT',
        });
        if (!put.ok) {
            console.error(
                `x-changedetector refused: ${put.status} ${await put.text()}`,
            );
            process.exit(1);
        }
        console.log(`retitled: ${uuid} · ${title}`);
        return;
    }

    if (known) {
        console.log(`already watched: ${known[0]} · ${body.url}`);
        return;
    }

    let issueTitle: string | undefined;
    if (body.title) {
        const issue = await fetch(body.url).catch(() => undefined);
        if (issue?.ok)
            issueTitle = ((await issue.json()) as { title: string }).title;
    }
    body.title = whyTitle(whatFor(command.url, issueTitle), command.reason);

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

if (import.meta.main) await main(process.argv.slice(2));

/* Types */

interface Command {
    mode: 'add' | 'set';
    reason: string;
    url: string;
}

interface WatchBody {
    include_filters?: string[];
    link_to_open?: string;
    title?: string;
    url: string;
}
