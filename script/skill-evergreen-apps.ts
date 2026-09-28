/**
 * skill:evergreen-apps — the changelog delta of the self-updating apps renovate and brew never
 * see. `cclio/evergreen/sources.json` holds one entry per app: where its changelog lives, how to
 * read it, and the newest entry the last run saw (`marker`). a run prints everything newer than
 * the marker, per app, for the evergreen skill to judge; `--mark` then advances every marker to
 * the newest entry seen and stamps `markedAt`, which the boot digest reads to say the lane is due.
 * by hand: `pnpm skill:evergreen-apps [--mark] [name…]`.
 */

/* Core */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SOURCES = join(homedir(), 'frame/cclio/evergreen/sources.json');
const BODY_CAP = 1_500;
const PAGE = 30;

const args = process.argv.slice(2);
const isMarking = args.includes('--mark');
const only = args.filter((a) => !a.startsWith('--'));

const sources = JSON.parse(readFileSync(SOURCES, 'utf8')) as Source[];
const picked = only.length
    ? sources.filter((s) => only.includes(s.name))
    : sources;

const text = async (url: string) => {
    const res = await fetch(url, {
        headers: { 'user-agent': 'x-evergreen/1 (+frame)' },
    });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res.text();
};

const strip = (html: string) =>
    html
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<br\s*\/?>|<\/(p|li|h\d|div|tr)>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;|&#x27;|&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/[ \t\u2002\u2003\u00a0]+/g, ' ')
        .replace(/\n\s*\n+/g, '\n')
        .trim();

const clip = (body: string, cap = BODY_CAP) =>
    body.length > cap ? `${body.slice(0, cap)}\n…` : body;

const untilMarker = (entries: Entry[], marker: string) => {
    const at = entries.findIndex((e) => `${e.id} ${e.date}`.includes(marker));
    return {
        entries: at === -1 ? entries : entries.slice(0, at),
        found: at !== -1,
    };
};

const readers: Record<Shape, (s: Source) => Promise<Delta>> = {
    'github-changelog': async (s) => {
        const md = await text(s.url);
        const entries = md
            .split(/^## +/m)
            .slice(1)
            .map((block) => {
                const [head = '', ...rest] = block.split('\n');
                return {
                    body: rest.join('\n').trim(),
                    date: '',
                    id: head.trim(),
                };
            });
        return untilMarker(entries, s.marker);
    },
    'github-releases': async (s) => {
        const raw = execFileSync(
            'gh',
            ['api', `repos/${s.repo}/releases?per_page=${PAGE}`],
            { encoding: 'utf8' },
        );
        const releases = JSON.parse(raw) as {
            tag_name: string;
            published_at: string;
            body: string | null;
        }[];
        const entries = releases.map((r) => ({
            body: r.body ?? '',
            date: r.published_at.slice(0, 10),
            id: r.tag_name,
        }));
        return untilMarker(entries, s.marker);
    },
    html: async (s) => {
        if (!s.entry)
            throw new Error('an html source needs an `entry` heading pattern');
        const heading = new RegExp(s.entry);
        const lines = strip(await text(s.url)).split('\n');
        const entries: Entry[] = [];
        for (const raw of lines) {
            const line = raw.trim();
            if (heading.test(line))
                entries.push({ body: '', date: '', id: line });
            else if (entries.at(-1))
                (entries.at(-1) as Entry).body += `${line}\n`;
        }
        return untilMarker(entries, s.marker);
    },
    rss: async (s) => {
        const xml = await text(s.url);
        const items = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/g)].map(
            (m) => m[0],
        );
        const field = (item: string, tag: string) =>
            strip(
                new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(
                    item,
                )?.[1] ?? '',
            );
        const entries = items.map((item) => ({
            body:
                field(item, 'description') ||
                field(item, 'content') ||
                field(item, 'summary'),
            date: (
                field(item, 'pubDate') ||
                field(item, 'updated') ||
                field(item, 'published')
            ).slice(0, 16),
            id: field(item, 'title'),
        }));
        const kept = (
            s.filter
                ? entries.filter((e) =>
                      new RegExp(s.filter as string).test(e.id),
                  )
                : entries
        ).sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
        return untilMarker(kept, s.marker);
    },
};

let newest: Record<string, string> = {};
for (const s of picked) {
    try {
        const { entries, found } = await readers[s.shape](s);
        const head = entries[0];
        if (head && found)
            newest = { ...newest, [s.name]: head.date || head.id };
        console.log(
            `\n## ${s.name} — ${entries.length} new since \`${s.marker}\`${found ? '' : ' ⚠️ marker not found, showing everything'}`,
        );
        console.log(`<${s.url}> · ${s.note}`);
        for (const e of entries) {
            console.log(
                `\n### ${e.id}${e.date ? ` · ${e.date}` : ''}\n${clip(e.body)}`,
            );
        }
    } catch (err) {
        console.log(`\n## ${s.name} — ⚠️ unreadable: ${(err as Error).message}`);
    }
}

if (isMarking) {
    const markedAt = new Date().toISOString().slice(0, 10);
    const next = sources.map((s) => ({
        ...s,
        markedAt,
        marker: newest[s.name] ?? s.marker,
    }));
    writeFileSync(SOURCES, `${JSON.stringify(next, null, 2)}\n`);
    // biome owns this file's shape; an unformatted write failed the next commit's hook
    execFileSync('npx', ['biome', 'format', '--write', SOURCES], {
        stdio: 'ignore',
    });
    console.log(
        `\nmarkers advanced: ${Object.keys(newest).join(', ') || 'none'}`,
    );
}

/* Types */
type Shape = 'github-releases' | 'github-changelog' | 'rss' | 'html';
type Source = {
    name: string;
    url: string;
    shape: Shape;
    repo?: string;
    marker: string;
    /** the day the marker was last advanced — the boot digest reads the lane's age from it */
    markedAt: string;
    note: string;
    /** html only — a regex matching a heading line; the page splits into entries on it */
    entry?: string;
    /** rss only — a regex an entry title must match, or the entry is dropped */
    filter?: string;
};
type Entry = { id: string; date: string; body: string };
type Delta = { entries: Entry[]; found: boolean };
