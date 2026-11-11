import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, test } from 'vitest';

import { loadableSkills, menuMatches, skillHead } from './skills.js';

const fs = {
    list: (dir: string) => readdir(dir).catch((): string[] => []),
    read: (path: string) =>
        readFile(path, 'utf8').catch((): string | null => null),
};

async function put(path: string, text: string) {
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, text);
}

const skill = (name: string, description: string) =>
    `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`;

let home = '';
let cwd = '';

beforeAll(async () => {
    const root = await mkdtemp(join(process.env.TMPDIR ?? tmpdir(), 'skills-'));
    home = join(root, 'home');
    cwd = join(root, 'repo');
    const cache = join(home, '.claude/plugins/cache');
    await put(
        join(home, '.claude/settings.json'),
        JSON.stringify({ enabledPlugins: { 'alpha@m': false, 'foo@m': true } }),
    );
    await put(
        join(cwd, '.claude/settings.json'),
        JSON.stringify({ enabledPlugins: { 'alpha@m': true } }),
    );
    await put(
        join(cwd, '.claude/settings.local.json'),
        JSON.stringify({ enabledPlugins: { 'foo@m': false } }),
    );
    await put(
        join(home, '.claude/plugins/installed_plugins.json'),
        JSON.stringify({
            plugins: {
                'alpha@m': [
                    {
                        installPath: join(cache, 'alpha'),
                        projectPath: cwd,
                        scope: 'project',
                    },
                ],
                'foo@m': [{ installPath: join(cache, 'foo'), scope: 'user' }],
            },
        }),
    );
    await put(
        join(cache, 'alpha/skills/boot/SKILL.md'),
        skill('boot', 'start a coordinator'),
    );
    await put(
        join(cache, 'foo/skills/bar/SKILL.md'),
        skill('bar', 'a foo skill'),
    );
});

describe('every skill the seat can load autocompletes', () => {
    test('a plugin enabled by the project layer lists its skills', async () => {
        const skills = await loadableSkills(fs, { cwd, home });
        expect(skills.get('alpha:boot')).toBe('start a coordinator');
    });

    test('a plugin the local layer disables lists none', async () => {
        const skills = await loadableSkills(fs, { cwd, home });
        expect([...skills.keys()].some((k) => k.startsWith('foo:'))).toBe(
            false,
        );
    });

    test('a project plugin installed for another folder lists none', async () => {
        const skills = await loadableSkills(fs, { cwd: join(cwd, 'x'), home });
        expect(skills.has('alpha:boot')).toBe(false);
    });
});

describe('a SKILL.md head', () => {
    test('a folded description joins its lines', () => {
        expect(
            skillHead(
                '---\nname: dna\ndescription: >-\n  Load as step 0\n  of a member.\n---\n',
            ),
        ).toEqual({ description: 'Load as step 0 of a member.', name: 'dna' });
    });
});

describe('the / menu matches either half of a skill name', () => {
    const all: [string, string][] = [
        ['bootstrap-x', ''],
        ['reboot', ''],
        ['clio:boot', 'start a coordinator'],
        ['x:crew-codie', ''],
    ];

    test('«boot» lists clio:boot right after a name that starts with it', () => {
        expect(menuMatches(all, 'boot').map(([n]) => n)).toEqual([
            'bootstrap-x',
            'clio:boot',
            'reboot',
        ]);
    });

    test('a prefix of the skill half finds it', () => {
        expect(menuMatches(all, 'crew').map(([n]) => n)).toEqual([
            'x:crew-codie',
        ]);
    });
});
