import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const FLOW_TAGS = ['#dima-caught', '#brief'] as const;

/** a flawlog file belongs to the day its name starts with: `2026-10-05-<slug>.md` */
export const flawlogCounts = (dir: string, since: string) => {
    const lines = readdirSync(dir)
        .filter(
            (f) =>
                /^\d{4}-\d{2}-\d{2}-.*\.md$/.test(f) && f.slice(0, 10) >= since,
        )
        .flatMap((f) => readFileSync(join(dir, f), 'utf8').split('\n'))
        .filter((l) => l.trimStart().startsWith('- '));
    return FLOW_TAGS.map((tag) => {
        const re = new RegExp(`(?<![\\w#-])${tag}(?![\\w-])`);
        return { count: lines.filter((l) => re.test(l)).length, tag };
    });
};

export const medianMinutes = (prs: MergedPr[]) => {
    const mins = prs
        .map((p) => (Date.parse(p.mergedAt) - Date.parse(p.createdAt)) / 60_000)
        .sort((a, b) => a - b);
    if (!mins.length) return undefined;
    const mid = mins.length >> 1;
    return mins.length % 2
        ? mins[mid]
        : ((mins[mid - 1] ?? 0) + (mins[mid] ?? 0)) / 2;
};

/* Types */
export type MergedPr = { createdAt: string; mergedAt: string };
