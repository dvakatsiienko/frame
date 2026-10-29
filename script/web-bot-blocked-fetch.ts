// reads a web page as text for agents whose own fetch is blocked (cloud-chat through Desktop Commander):
// a MediaWiki page through its free api (infobox values first), a .md/.txt url as is, anything else through firecrawl (1 credit).
// usage: pnpm web-bot-blocked:fetch <url> [--out <file>] · pnpm web-bot-blocked:fetch --index <wiki host> [--out <file>]
import { writeFileSync } from 'node:fs';

const userAgent = 'Mozilla/5.0 (frame web-bot-blocked:fetch)';

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

// wikipedia and miraheze serve the api at /w/api.php, fandom at /api.php
async function wikiApi(origin: string): Promise<string | undefined> {
    for (const path of ['/w/api.php', '/api.php']) {
        try {
            const info = (await getJson(
                `${origin}${path}?action=query&meta=siteinfo&format=json`,
            )) as { query?: { general?: unknown } };
            if (info.query?.general) return `${origin}${path}`;
        } catch {}
    }
    return undefined;
}

function topLevelTemplates(wikitext: string): string[] {
    const found: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < wikitext.length - 1; i++) {
        const pair = wikitext.slice(i, i + 2);
        if (pair === '{{') {
            if (depth === 0) start = i;
            depth++;
            i++;
        } else if (pair === '}}' && depth > 0) {
            depth--;
            i++;
            if (depth === 0) found.push(wikitext.slice(start + 2, i - 1));
        }
    }
    return found;
}

function topLevelParts(template: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let last = 0;
    for (let i = 0; i < template.length; i++) {
        const pair = template.slice(i, i + 2);
        if (pair === '{{' || pair === '[[') {
            depth++;
            i++;
        } else if ((pair === '}}' || pair === ']]') && depth > 0) {
            depth--;
            i++;
        } else if (template[i] === '|' && depth === 0) {
            parts.push(template.slice(last, i));
            last = i + 1;
        }
    }
    parts.push(template.slice(last));
    return parts;
}

export function plainWiki(value: string): string {
    return value
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<ref[^>]*\/>|<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
        .replace(/<br\s*\/?>/gi, ', ')
        .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
        .replace(/'{2,3}/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// the infobox-named template wins; NMS names its own «Resource infobox»
export function infobox(wikitext: string): [string, string][] {
    const named = topLevelTemplates(wikitext).map((template) => {
        const [name = '', ...parts] = topLevelParts(template);
        const params = parts.flatMap((part): [string, string][] => {
            const eq = part.indexOf('=');
            if (eq < 0) return [];
            const value = plainWiki(part.slice(eq + 1));
            return value ? [[part.slice(0, eq).trim(), value]] : [];
        });
        return { name, params };
    });
    const box =
        named.find(({ name }) => /infobox/i.test(name)) ??
        named.find(({ params }) => params.length > 0);
    return box?.params ?? [];
}

async function wikiInfobox(
    api: string,
    title: string,
): Promise<[string, string][]> {
    try {
        const data = (await getJson(
            `${api}?action=parse&prop=wikitext&redirects=1&format=json&formatversion=2&page=${encodeURIComponent(title)}`,
        )) as { parse?: { wikitext?: string } };
        return infobox(data.parse?.wikitext ?? '');
    } catch {
        return [];
    }
}

async function wikiPage(api: string, title: string): Promise<string> {
    const data = (await getJson(
        `${api}?action=query&prop=extracts&explaintext=1&redirects=1&format=json&formatversion=2&titles=${encodeURIComponent(title)}`,
    )) as {
        query: {
            pages: { title: string; extract?: string; missing?: boolean }[];
        };
    };
    const page = data.query.pages[0];
    if (!page || page.missing || !page.extract)
        throw new Error(`no wiki page «${title}»`);
    const box = await wikiInfobox(api, page.title);
    const block = box.length
        ? `== Infobox ==\n${box.map(([key, value]) => `- ${key}: ${value}`).join('\n')}\n\n`
        : '';
    return `# ${page.title}\n\n${block}${page.extract}\n`;
}

async function wikiIndex(host: string): Promise<string> {
    const origin = `https://${host}`;
    const api = await wikiApi(origin);
    if (!api) throw new Error(`${host} answers no MediaWiki api`);
    const titles: string[] = [];
    let from = '';
    do {
        const data = (await getJson(
            `${api}?action=query&list=allpages&apnamespace=0&apfilterredir=nonredirects&aplimit=max&format=json${from ? `&apcontinue=${encodeURIComponent(from)}` : ''}`,
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
            'FIRECRAWL_API_KEY missing — run through pnpm web-bot-blocked:fetch (op-run)',
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
    const api = title ? await wikiApi(url.origin) : undefined;
    if (title && api) return wikiPage(api, title);
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
            'usage: pnpm web-bot-blocked:fetch <url> [--out <file>] · pnpm web-bot-blocked:fetch --index <wiki host> [--out <file>]',
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
