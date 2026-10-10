/* Core */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';

import { gitEnv } from './git-fixture.ts';

const root = path.resolve(import.meta.dirname, '../..');
const recipesDir = path.join(root, 'recipes');
const scripts = Object.keys(
    JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).scripts,
);
const verbs: string[] = JSON.parse(
    readFileSync(path.join(root, 'x/go/registry.json'), 'utf8'),
).verbs.map((verb: { name: string }) => verb.name);
const recipes = readdirSync(recipesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

function frontmatter(text: string) {
    const body = text.match(/^---\n([\s\S]*?)\n---\n/)?.[1];
    if (body === undefined) return null;
    const fields: Record<string, string | string[]> = {};
    let listKey = '';
    for (const line of body.split('\n')) {
        const item = line.match(/^\s+-\s+(.+)$/)?.[1];
        const list = fields[listKey];
        if (item !== undefined && Array.isArray(list)) {
            list.push(unquote(item));
            continue;
        }
        const pair = line.match(/^(?<key>\w+):\s*(?<raw>.*)$/)?.groups;
        const key = pair?.key;
        const raw = pair?.raw ?? '';
        if (key === undefined) continue;
        const value = raw.replace(/\s+#.*$/, '').trim();
        if (value === '') {
            fields[key] = [];
            listKey = key;
        } else if (value.startsWith('[')) {
            fields[key] = value
                .slice(1, -1)
                .split(',')
                .map((part) => unquote(part.trim()))
                .filter(Boolean);
            listKey = '';
        } else {
            fields[key] = unquote(value);
            listKey = '';
        }
    }
    return fields;
}

function unquote(value: string) {
    return value.replace(/^[`'"]|[`'"]$/g, '');
}

const sections = [
    'contents',
    'the want',
    'the run',
    'vectors',
    'artifacts',
    'findings',
] as const;
const vectorSubs = ['research', 'analysis', 'cut'] as const;
const owners = ['coordinator', 'coder', 'designer', 'fleet'];
const folderFiles = /^(recipe\.md|log\.md|log-\d{4}\.md|last|scripts)$/;
const logEntry = /^- \d{4}-\d{2}-\d{2} · [^·]+ · [^·]+ · [^·]+ · [^·]+$/;

// a heading inside a code fence is example text, not structure
function stripFences(text: string) {
    return text.replace(/^[ \t]*```[\s\S]*?^[ \t]*```/gm, (block) =>
        block.replace(/[^\n]/g, ''),
    );
}

function h2Blocks(text: string) {
    const parts = stripFences(text)
        .replace(/^---\n[\s\S]*?\n---\n/, '')
        .split(/^## (.+)$/m);
    return Array.from({ length: (parts.length - 1) / 2 }, (_, index) => ({
        body: parts[2 + 2 * index] ?? '',
        title: parts[1 + 2 * index] ?? '',
    }));
}

// true when items keep the order of allowed and repeat nothing
function inOrder(items: string[], allowed: readonly string[]) {
    let from = 0;
    for (const item of items) {
        const at = allowed.indexOf(item, from);
        if (at === -1) return false;
        from = at + 1;
    }
    return true;
}

const skillsDir = path.join(root, 'home/.claude/plugin-x/skills');
const engine = readFileSync(
    path.join(skillsDir, 'shape-recipe/SKILL.md'),
    'utf8',
);
const topLevel = new Set(readdirSync(root));

function engineSection(title: string) {
    return engine.split(/^## /m).find((part) => part.startsWith(title)) ?? '';
}

// the bullets of x:shape-recipe's shared vectors, bold label and text, and its numbered run steps up to done:
export const sharedLines = [
    ...[
        ...engineSection('the shared vectors').matchAll(
            /^- (\*\*[^*]+\*\* — .+)$/gm,
        ),
    ].map((m) => m[1] ?? ''),
    ...[...engineSection('running one').matchAll(/^\d+\. (.+)$/gm)].map(
        (m) => (m[1] ?? '').split(' done:')[0] ?? '',
    ),
].filter(Boolean);

// a recipe names x:shape-recipe's shared parts, never restates them; a copy drifts from the engine
export function sharedCopies(text: string, shared: string[]) {
    return text
        .split('\n')
        .flatMap((line, index) =>
            shared.some((part) => line.includes(part))
                ? [`line ${index + 1}: ${line.slice(0, 60)}`]
                : [],
        );
}

// a backticked repo path or x:<skill> must exist; a ~/projects path only when that repo is on this machine.
// a relative path counts when its first part is a top-level entry of frame, so `owner/repo` never does
export function deadPointers(
    text: string,
    exists: (pointer: string) => boolean | undefined,
) {
    const dead: string[] = [];
    for (const match of text.matchAll(/`([^`\s]+)`/g)) {
        const pointer = (match[1] ?? '')
            .replace(/(:\d[\d-]*|#\S*)$/, '')
            .replace(/[.,]$/, '');
        if (/[*<>{}$]/.test(pointer) || dead.includes(pointer)) continue;
        if (exists(pointer) === false) dead.push(pointer);
    }
    return dead;
}

// true, false, or undefined for a token that is no repo pointer
function pointerExists(pointer: string) {
    const skill = pointer.match(/^x:([\w-]+)$/)?.[1];
    if (skill) return existsSync(path.join(skillsDir, skill, 'SKILL.md'));
    if (pointer.startsWith('~/frame/'))
        return existsSync(path.join(root, pointer.slice(8)));
    if (pointer.startsWith('~/projects/')) {
        const repo = path.join(
            homedir(),
            'projects',
            pointer.split('/')[2] ?? '',
        );
        return existsSync(repo)
            ? existsSync(path.join(homedir(), pointer.slice(2)))
            : undefined;
    }
    if (pointer.includes('/') && topLevel.has(pointer.split('/')[0] ?? ''))
        return existsSync(path.join(root, pointer));
    return undefined;
}

function artifactExists(artifact: string) {
    const skill = artifact.match(
        /^(?<plugin>x|cclio):(?<name>[\w-]+)$/,
    )?.groups;
    if (skill?.name) {
        const dir =
            skill.plugin === 'x'
                ? 'home/.claude/plugin-x/skills'
                : 'cclio/plugin-cclio/skills';
        return existsSync(path.join(root, dir, skill.name, 'SKILL.md'));
    }
    if (artifact.startsWith('~/frame/'))
        return existsSync(path.join(root, artifact.slice(8)));
    // other ~/ homes live only on dima's mac, never on a ci runner
    if (artifact.startsWith('~/'))
        return (
            Boolean(process.env.CI) ||
            existsSync(path.join(homedir(), artifact.slice(2)))
        );
    return existsSync(path.join(root, artifact));
}

test.each(recipes)('%s has the recipe shape', (name) => {
    const dir = path.join(recipesDir, name);
    const text = readFileSync(path.join(dir, 'recipe.md'), 'utf8');
    // a git-crypt recipe is ciphertext wherever the key is absent (ci)
    if (text.startsWith('\0GITCRYPT')) return;
    const fields = frontmatter(text);
    expect(fields, `${name}: recipe.md opens with frontmatter`).not.toBeNull();
    expect(['refresh', 'nurture']).toContain(fields?.kind);
    expect(
        name.startsWith(`${fields?.kind}-`),
        `${name}: kind-first name`,
    ).toBe(true);
    expect(
        sharedCopies(text, sharedLines),
        `${name}: lines restating x:shape-recipe`,
    ).toEqual([]);
    expect(
        deadPointers(text, pointerExists),
        `${name}: pointers at paths or skills that do not exist`,
    ).toEqual([]);
    expect(Array.isArray(fields?.artifacts), `${name}: artifacts list`).toBe(
        true,
    );

    // research:lanes compares the date to today, so a stamp in another shape locks the recipe for good
    if (fields?.groomed !== undefined) {
        expect(fields.groomed, `${name}: groomed: <yyyy-mm-dd> (dima)`).toMatch(
            /^\d{4}-\d{2}-\d{2} \(dima\)$/,
        );
    }

    const script = String(fields?.script);
    expect(
        script === 'none' ||
            scripts.includes(script) ||
            verbs.includes(script.replace(/^x /, '')),
        `${name}: script «${script}» is none, a package.json key or an x verb`,
    ).toBe(true);

    const artifacts = Array.isArray(fields?.artifacts) ? fields.artifacts : [];
    const missing = artifacts.filter((artifact) => !artifactExists(artifact));
    expect(missing, `${name}: artifacts that do not exist`).toEqual([]);

    expect(
        text.match(/^# (.+)$/m)?.[1],
        `${name}: the heading is the folder name`,
    ).toBe(name);

    expect(existsSync(path.join(dir, 'log.md')), `${name}: log.md`).toBe(true);

    if (fields?.draft === 'true') return;
    const blocks = h2Blocks(text);
    const titles = blocks.map((block) => block.title);
    const body = (title: string) =>
        blocks.find((block) => block.title === title)?.body ?? '';

    // R1: the h2s are exactly the shared sections, in order
    expect(
        inOrder(titles, sections),
        `${name}: h2s must follow [${sections.join(', ')}], got [${titles.join(', ')}]`,
    ).toBe(true);
    const required = [
        'the want',
        'the run',
        'vectors',
        'artifacts',
        'findings',
    ];
    expect(
        required.filter((title) => !titles.includes(title)),
        `${name}: missing h2`,
    ).toEqual([]);

    expect(
        body('the want'),
        `${name}: the want quotes dima in «» or a > block`,
    ).toMatch(/«[^»]+»|^> \S/m);

    // R2: contents appears with the 101st line and not before
    expect(
        titles.includes('contents'),
        `${name}: contents iff the file passes 100 lines`,
    ).toBe(text.trimEnd().split('\n').length > 100);

    // R3: vectors splits into research, analysis and an optional cut
    const subs = [...body('vectors').matchAll(/^### (.+)$/gm)].map(
        (match) => match[1] ?? '',
    );
    expect(
        inOrder(subs, vectorSubs),
        `${name}: vectors h3s must follow [${vectorSubs.join(', ')}], got [${subs.join(', ')}]`,
    ).toBe(true);
    expect(subs, `${name}: vectors has an analysis h3`).toContain('analysis');
    if (fields?.kind === 'refresh') {
        expect(subs, `${name}: a refresh has a research h3`).toContain(
            'research',
        );
    }

    // R4
    const seats = [fields?.owner ?? []].flat();
    expect(seats.length, `${name}: owner names a seat`).toBeGreaterThan(0);
    for (const seat of seats) {
        expect(owners, `${name}: owner seat`).toContain(seat);
    }

    // R5
    expect(
        artifacts.filter((artifact) => !body('artifacts').includes(artifact)),
        `${name}: frontmatter artifacts missing from ## artifacts`,
    ).toEqual([]);

    // R6: every step ends on a done: line and the last one logs the run
    const steps = body('the run')
        .split(/^(?=\d+\. )/m)
        .filter((part) => /^\d+\. /.test(part));
    expect(steps.length, `${name}: the run has numbered steps`).toBeGreaterThan(
        0,
    );
    expect(
        steps
            .filter((step) => !step.includes('done:'))
            .map((s) => s.slice(0, 40)),
        `${name}: steps without a done: line`,
    ).toEqual([]);
    expect(steps.at(-1), `${name}: the last step logs the run`).toContain(
        'log.md',
    );
});

test('a line restating x:shape-recipe is caught', () => {
    const copied = `# refresh-x\n\n- ${sharedLines[0]}\n`;

    expect(sharedCopies(copied, sharedLines)).toEqual([
        `line 3: - ${sharedLines[0]?.slice(0, 58)}`,
    ]);
});

test('a pointer at a missing path or skill is caught', () => {
    const text =
        '`docs/knowledge/nope.md`, `x:guide-nope`, `~/frame/x/nope.go`, `x:guide-go`, `owner/repo`, `recipes/<name>/`';

    expect(deadPointers(text, pointerExists)).toEqual([
        'docs/knowledge/nope.md',
        'x:guide-nope',
        '~/frame/x/nope.go',
    ]);
});

// R7
test.each(recipes)('%s folder holds only the shape files', (name) => {
    const stray = readdirSync(path.join(recipesDir, name)).filter(
        (file) => !folderFiles.test(file),
    );
    expect(stray, `${name}: files outside the shape`).toEqual([]);
});

// L1-L6
test.each(recipes)('%s log.md has the log shape', (name) => {
    const text = readFileSync(path.join(recipesDir, name, 'log.md'), 'utf8');
    if (text.startsWith('\0GITCRYPT')) return;
    const lines = text.split('\n');
    expect(lines[0], `${name}: log header`).toBe(`# ${name} — run log`);
    expect(lines[1] ?? '', `${name}: blank line under the header`).toBe('');
    const entries = lines.slice(2).filter((line) => line !== '');
    expect(
        entries.filter((line) => !logEntry.test(line)),
        `${name}: entries are «- date · outcome · minutes · lanes · artifacts»`,
    ).toEqual([]);
    expect(
        entries.filter((line) => [...line].length > 280),
        `${name}: entries past 280 characters`,
    ).toEqual([]);
    const dates = entries.map((line) => line.slice(2, 12));
    expect(dates, `${name}: dates run oldest first`).toEqual([...dates].sort());
    expect(
        Buffer.byteLength(text),
        `${name}: log.md past 8 KB moves its oldest lines to log-<year>.md`,
    ).toBeLessThanOrEqual(8192);
});

const history = [
    'cclio/gazette',
    'home/.claude/shelf',
    'docs/test-drive',
    'docs/research',
    'cclio/memory/dima-stories.md',
    'recipes/*/log.md',
    'recipes/*/recipe.md',
];

test('no live file names a recipe by its old name', () => {
    const old = recipes.flatMap((name) => {
        const text = readFileSync(
            path.join(recipesDir, name, 'recipe.md'),
            'utf8',
        );
        const was = frontmatter(text)?.was;
        return Array.isArray(was) ? was : [];
    });
    if (old.length === 0) return;
    const hits = spawnSync(
        'git',
        [
            'grep',
            '-n',
            '-F',
            ...old.flatMap((name) => ['-e', name]),
            '--',
            '.',
            ...history.map((dir) => `:!${dir}`),
        ],
        { cwd: root, encoding: 'utf8', env: gitEnv() },
    ).stdout.trim();
    expect(hits, 'old recipe names in live files').toBe('');
});
