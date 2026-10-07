/* Core */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';

const root = path.resolve(import.meta.dirname, '../..');
const recipesDir = path.join(root, 'recipes');
const scripts = Object.keys(
    JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).scripts,
);
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
    const resolved = artifact.startsWith('~/')
        ? path.join(homedir(), artifact.slice(2))
        : path.join(root, artifact);
    return existsSync(resolved);
}

test.each(recipes)('%s has the recipe shape', (name) => {
    const dir = path.join(recipesDir, name);
    const text = readFileSync(path.join(dir, 'recipe.md'), 'utf8');
    const fields = frontmatter(text);
    expect(fields, `${name}: recipe.md opens with frontmatter`).not.toBeNull();
    expect(['refresh', 'nurture', 'run']).toContain(fields?.kind);
    expect(
        name.startsWith(`${fields?.kind}-`),
        `${name}: kind-first name`,
    ).toBe(true);
    expect(fields?.cadence, `${name}: cadence`).toBeTruthy();
    expect(Array.isArray(fields?.artifacts), `${name}: artifacts list`).toBe(
        true,
    );

    const script = fields?.script;
    expect(
        script === 'none' || scripts.includes(String(script)),
        `${name}: script «${script}» is none or a package.json key`,
    ).toBe(true);

    const artifacts = Array.isArray(fields?.artifacts) ? fields.artifacts : [];
    const missing = artifacts.filter((artifact) => !artifactExists(artifact));
    expect(missing, `${name}: artifacts that do not exist`).toEqual([]);

    if (fields?.draft === 'true') return;
    const want = text.indexOf('\n## the want');
    const run = text.indexOf('\n## the run');
    const vectors = text.indexOf('\n## vectors');
    expect(want, `${name}: ## the want`).toBeGreaterThan(-1);
    expect(run, `${name}: ## the run after the want`).toBeGreaterThan(want);
    if (vectors > -1) {
        expect(vectors, `${name}: ## vectors after the run`).toBeGreaterThan(
            run,
        );
    }
    const wantBody = text.slice(want, text.indexOf('\n## ', want + 1));
    expect(
        wantBody,
        `${name}: the want quotes dima in «» or a > block`,
    ).toMatch(/«[^»]+»|^> \S/m);

    expect(existsSync(path.join(dir, 'log.md')), `${name}: log.md`).toBe(true);
});
