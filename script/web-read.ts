// reads a web page as text for agents whose own fetch is blocked (cw through Desktop Commander):
// a MediaWiki page through its free api, a .md/.txt url as is, anything else through firecrawl (1 credit).
// usage: pnpm web:read <url> [--out <file>] · pnpm web:read --index <wiki host> [--out <file>]
import { writeFileSync } from 'node:fs';

const userAgent = 'Mozilla/5.0 (frame web:read)';

export function wikiTitle(url: URL): string | undefined {
    const slug = url.pathname.match(/^\/wiki\/(.+)$/)?.[1];
    return slug ? decodeURIComponent(slug).replaceAll('_', ' ') : undefined;
}

export function isPlainText(url: URL): boolean {
    return /\.(md|txt)$/.test(url.pathname);
}

async function getJson(url: string): Promise<unknown> {
    const res = await fetch(url, { headers: { 'user-agent': userAgent } });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res.json();
}

async function isMediaWiki(origin: string): Promise<boolean> {
    try {
        const info = (await getJson(
            `${origin}/w/api.php?action=query&meta=siteinfo&format=json`,
        )) as { query?: { general?: unknown } };
        return Boolean(info.query?.general);
    } catch {
        return false;
    }
}

async function wikiPage(origin: string, title: string): Promise<string> {
    const data = (await getJson(
        `${origin}/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&formatversion=2&titles=${encodeURIComponent(title)}`,
    )) as {
        query: {
            pages: { title: string; extract?: string; missing?: boolean }[];
        };
    };
    const page = data.query.pages[0];
    if (!page || page.missing || !page.extract)
        throw new Error(`no wiki page «${title}»`);
    return `# ${page.title}\n\n${page.extract}\n`;
}

async function wikiIndex(host: string): Promise<string> {
    const origin = `https://${host}`;
    const titles: string[] = [];
    let from = '';
    do {
        const data = (await getJson(
            `${origin}/w/api.php?action=query&list=allpages&apnamespace=0&apfilterredir=nonredirects&aplimit=max&format=json${from ? `&apcontinue=${encodeURIComponent(from)}` : ''}`,
        )) as {
            query: { allpages: { title: string }[] };
            continue?: { apcontinue: string };
        };
        titles.push(...data.query.allpages.map((page) => page.title));
        from = data.continue?.apcontinue ?? '';
    } while (from);
    const lines = titles.map(
        (title) =>
            `- ${title} — ${origin}/wiki/${encodeURIComponent(title.replaceAll(' ', '_'))}`,
    );
    return `# ${host} — ${titles.length} articles\n\n${lines.join('\n')}\n`;
}

async function firecrawl(url: string): Promise<string> {
    const key = process.env.FIRECRAWL_API_KEY;
    if (!key)
        throw new Error(
            'FIRECRAWL_API_KEY missing — run through pnpm web:read (op-run)',
        );
    const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
        body: JSON.stringify({
            formats: ['markdown'],
            onlyMainContent: true,
            url,
        }),
        headers: {
            authorization: `Bearer ${key}`,
            'content-type': 'application/json',
        },
        method: 'POST',
    });
    const data = (await res.json()) as {
        success: boolean;
        data?: { markdown?: string };
        error?: string;
    };
    if (!data.success || !data.data?.markdown)
        throw new Error(`firecrawl: ${data.error ?? res.status}`);
    return data.data.markdown;
}

async function read(input: string): Promise<string> {
    const url = new URL(input);
    const title = wikiTitle(url);
    if (title && (await isMediaWiki(url.origin)))
        return wikiPage(url.origin, title);
    if (isPlainText(url)) {
        const res = await fetch(url, { headers: { 'user-agent': userAgent } });
        if (res.ok) return res.text();
    }
    return firecrawl(input);
}

async function main(args: string[]) {
    const out = args.includes('--out')
        ? args[args.indexOf('--out') + 1]
        : undefined;
    const index = args.includes('--index')
        ? args[args.indexOf('--index') + 1]
        : undefined;
    const target = args.find((arg) => /^https?:\/\//.test(arg));
    if (!index && !target) {
        console.error(
            'usage: pnpm web:read <url> [--out <file>] · pnpm web:read --index <wiki host> [--out <file>]',
        );
        process.exit(2);
    }
    const text = index ? await wikiIndex(index) : await read(target as string);
    if (out) {
        writeFileSync(out, text);
        console.log(`wrote ${text.length} chars → ${out}`);
    } else {
        process.stdout.write(text);
    }
}

if (import.meta.main) await main(process.argv.slice(2));
