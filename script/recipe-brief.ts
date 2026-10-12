// a recipe's research brief, built so the shared vectors cannot be skipped (dima o73: read in a skill, still missed):
// the recipe's own want and vectors plus recipes/AGENTS.md's shared vectors, each verbatim, under a marker naming the
// shared section's sha256 — research-lanes.sh refuses a recipe brief without it
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const recipesDir = path.resolve(import.meta.dirname, '../recipes');
const name = process.argv[2] ?? '';
const recipe = path.join(recipesDir, name, 'recipe.md');

if (!/^[\w-]+$/.test(name) || !existsSync(recipe))
    fail(
        `no recipe «${name}» — usage: pnpm recipe:brief <name>, one of recipes/*/`,
    );

const own = readFileSync(recipe, 'utf8');
const want = section(own, '## the want', recipe);
const vectors = section(own, '## vectors', recipe);
const agents = path.join(recipesDir, 'AGENTS.md');
const shared = section(
    readFileSync(agents, 'utf8'),
    '## the shared vectors',
    agents,
);
const sha = createHash('sha256').update(shared).digest('hex');
const out = path.join(recipesDir, name, 'last', 'brief.md');
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(
    out,
    `<!-- shared-vectors: ${sha} -->\n# ${name} — research brief\n\n${want}\n\n${vectors}\n\n${shared}\n`,
);
console.log(`recipe:brief: ${path.relative(process.cwd(), out)}`);

// the lines from a `## ` heading that starts with `heading` up to the next `## ` heading, trailing blank lines dropped
function section(text: string, heading: string, file: string) {
    const lines = text.split('\n');
    const start = lines.findIndex((line) => line.startsWith(heading));
    if (start === -1) fail(`${file} has no «${heading}» section`);
    const end = lines.findIndex(
        (line, i) => i > start && line.startsWith('## '),
    );
    return lines
        .slice(start, end === -1 ? undefined : end)
        .join('\n')
        .trimEnd();
}

function fail(line: string): never {
    console.error(`recipe:brief: ${line}`);
    process.exit(2);
}
