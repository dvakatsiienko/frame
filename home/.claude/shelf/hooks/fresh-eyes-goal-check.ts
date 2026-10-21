// usage: node fresh-eyes-goal-check.ts <app src dir> <goal…> — refuses a goal that names a UI label, so fresh-eyes is never told which button to press
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export function uiLabels(source: string) {
    const labels = new Set<string>();
    for (const [, text] of source.matchAll(/>\s*([^<>{}\n]*[A-Za-z][^<>{}\n]*?)\s*</g))
        if (text && text.trim().length >= 3) labels.add(text.trim().toLowerCase());
    for (const [, text] of source.matchAll(
        /(?:aria-label|title|placeholder|label)=["']([^"']{3,})["']/g,
    ))
        if (text) labels.add(text.trim().toLowerCase());
    return labels;
}

export function labelInGoal(goal: string, labels: Set<string>) {
    const lower = goal.toLowerCase();
    return [...labels].find((label) =>
        new RegExp(`(^|\\W)${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\W|$)`).test(lower),
    );
}

function sources(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory())
            return entry.name === 'node_modules' ? [] : sources(full);
        return /\.(tsx|jsx|html|vue|svelte)$/.test(entry.name) ? [full] : [];
    });
}

if (import.meta.main) {
    const [dir, ...goals] = process.argv.slice(2);
    if (!dir || goals.length === 0) {
        console.error('usage: node fresh-eyes-goal-check.ts <app src dir> <goal…>');
        process.exit(2);
    }
    const labels = new Set(
        sources(dir).flatMap((file) => [...uiLabels(readFileSync(file, 'utf8'))]),
    );
    const refused = goals.flatMap((goal) => {
        const label = labelInGoal(goal, labels);
        return label ? [`✗ «${goal}» names the label «${label}» — say the outcome, not the button`] : [];
    });
    for (const line of refused) console.log(line);
    console.log(refused.length ? `${refused.length} goal(s) refused` : `${goals.length} goal(s) clean`);
    process.exit(refused.length ? 1 : 0);
}
