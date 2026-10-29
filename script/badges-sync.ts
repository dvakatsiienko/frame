// draws the readme's badges in the banner's style: gruvbox violet, scanlines, softly rounded.
// `pnpm badges:sync` redraws the stored facts into assets/badges/. `--ci <result> <dir>` draws only
// ci.svg — the ci workflow calls it after every main run and pushes it to the `badges` branch,
// which is how a badge in our own style still turns red live.
import { execFileSync } from 'node:child_process';
import {
    existsSync,
    globSync,
    mkdirSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';

const root = new URL('../', import.meta.url).pathname;
const out = `${root}assets/badges`;

const run = (cmd: string, args: string[]) =>
    execFileSync(cmd, args, { cwd: root, encoding: 'utf8' });

const fontSize = 13;
const charWidth = 7.9;
const padX = 8;
const height = 24;

function badge(label: string, value: string, color: string): string {
    const left = Math.round(label.length * charWidth + padX * 2);
    const right = Math.round(value.length * charWidth + padX * 2);
    const width = left + right;
    const y = 16.5;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}: ${value}">
<defs>
<clipPath id="r"><rect width="${width}" height="${height}" rx="4"/></clipPath>
<pattern id="scan" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="1" fill="#000" opacity=".06"/></pattern>
</defs>
<g clip-path="url(#r)">
<rect width="${left}" height="${height}" fill="#1d2021"/>
<rect x="${left}" width="${right}" height="${height}" fill="${color}"/>
<rect width="${width}" height="${height}" fill="url(#scan)"/>
</g>
<g font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="${fontSize}" text-anchor="middle">
<text x="${left / 2}" y="${y}" fill="#ebdbb2">${label}</text>
<text x="${left + right / 2}" y="${y}" fill="#1d2021" font-weight="700">${value}</text>
</g>
</svg>
`;
}

const ciAt = process.argv.indexOf('--ci');
if (ciAt >= 0) {
    const passing = process.argv[ciAt + 1] === 'success';
    const dir = process.argv[ciAt + 2] ?? '.';
    mkdirSync(dir, { recursive: true });
    writeFileSync(
        `${dir}/ci.svg`,
        badge(
            'ci',
            passing ? 'passing' : 'failing',
            passing ? '#b8bb26' : '#fb4934',
        ),
    );
    process.exit(0);
}

const skills = globSync(
    [
        'home/.claude/plugin-x/skills/*/SKILL.md',
        '_clio/plugin-clio/skills/*/SKILL.md',
    ],
    {
        cwd: root,
    },
).length;

const mirrored = Number(
    run('node', ['script/frame-link.ts']).match(/(\d+) entries mirrored/)?.[1],
);

const vitestOut = '/tmp/frame-badges-vitest.json';
run('npx', ['vitest', 'run', '--reporter=json', `--outputFile=${vitestOut}`]);
const tests: { numPassedTests: number } = JSON.parse(
    readFileSync(vitestOut, 'utf8'),
);

const pnpm: string = JSON.parse(
    readFileSync(`${root}package.json`, 'utf8'),
).packageManager.replace('pnpm@', '');

const node = readFileSync(`${root}.node-version`, 'utf8').trim();

const renovate = existsSync(`${root}renovate.json`) ? 'enabled' : 'off';

const badges = [
    { color: '#8ec07c', label: 'node', name: 'node', value: node },
    {
        color: '#fe8019',
        label: 'skills',
        name: 'skills',
        value: String(skills),
    },
    {
        color: '#83a598',
        label: 'mirrored',
        name: 'mirrored',
        value: String(mirrored),
    },
    {
        color: '#b8bb26',
        label: 'tests',
        name: 'tests',
        value: String(tests.numPassedTests),
    },
    { color: '#fabd2f', label: 'pnpm', name: 'pnpm', value: pnpm },
    { color: '#689d6a', label: 'renovate', name: 'renovate', value: renovate },
];

mkdirSync(out, { recursive: true });
for (const b of badges)
    writeFileSync(`${out}/${b.name}.svg`, badge(b.label, b.value, b.color));
console.log(badges.map((b) => `${b.label} ${b.value}`).join(' · '));
