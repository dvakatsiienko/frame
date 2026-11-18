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
        JSON.stringify({
            enabledPlugins: {
                'alpha@m': false,
                'foo@m': true,
                'matt@m': true,
                'shut@m': true,
            },
        }),
    );
    await put(
        join(cwd, '.claude/settings.json'),
        JSON.stringify({ enabledPlugins: { 'alpha@m': true } }),
    );
    await put(
        join(cwd, '.claude/settings.local.json'),
        JSON.stringify({ enabledPlugins: { 'foo@m': false, 'shut@m': false } }),
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
                'matt@m': [{ installPath: join(cache, 'matt'), scope: 'user' }],
                'shut@m': [{ installPath: join(cache, 'shut'), scope: 'user' }],
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
    // a plugin that nests its skills by bucket and lists the shipped ones in its manifest, as matt's 1.3.2 does
    await put(
        join(cache, 'matt/.claude-plugin/plugin.json'),
        JSON.stringify({
            name: 'matt',
            skills: [
                './skills/engineering/retro',
                'skills/engineering/tdd',
                './skills/engineering/ghost',
                './skills/engineering/review',
            ],
        }),
    );
    await put(
        join(cache, 'matt/skills/engineering/retro/SKILL.md'),
        skill('retro', 'a retro'),
    );
    await put(
        join(cache, 'matt/skills/engineering/tdd/SKILL.md'),
        skill('tdd', 'test first'),
    );
    await put(
        join(cache, 'matt/skills/engineering/review/SKILL.md'),
        skill('code-review', 'a review'),
    );
    await put(
        join(cache, 'matt/skills/deprecated/old/SKILL.md'),
        skill('old', 'gone'),
    );
    await put(
        join(cache, 'matt/skills/in-progress/beta/SKILL.md'),
        skill('beta', 'not shipped'),
    );
    await put(
        join(cache, 'matt/skills/flat/SKILL.md'),
        skill('flat', 'one level down, not listed'),
    );
    await put(
        join(cache, 'shut/.claude-plugin/plugin.json'),
        JSON.stringify({ skills: ['./skills/a/one'] }),
    );
    await put(join(cache, 'shut/skills/a/one/SKILL.md'), skill('one', 'off'));
});

describe('every skill the thread can load autocompletes', () => {
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

describe('a plugin manifest names its skills (FRM-593)', () => {
    test('the menu holds exactly the listed skills, with or without ./, a missing one skipped, its own name kept', async () => {
        const all = await loadableSkills(fs, { cwd, home });
        expect(
            [...all.keys()].filter((k) => k.startsWith('matt:')).sort(),
        ).toEqual(['matt:code-review', 'matt:retro', 'matt:tdd']);
    });

    test('a manifest plugin disabled in a later layer lists none', async () => {
        const all = await loadableSkills(fs, { cwd, home });
        expect([...all.keys()].some((k) => k.startsWith('shut:'))).toBe(false);
    });

    test('«ret» offers the manifest-listed retro', async () => {
        const all = await loadableSkills(fs, { cwd, home });
        expect(menuMatches([...all], 'ret').map(([n]) => n)).toContain(
            'matt:retro',
        );
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
