import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';

import {
    putBackRepoSettings,
    repoSettingsPaths,
    snapshotRepoSettings,
} from './live-settings.ts';

const made: string[] = [];
afterEach(() => {
    for (const dir of made.splice(0))
        rmSync(dir, { force: true, recursive: true });
});
// a repo whose `.claude/settings.local.json` holds his line, and a run dir beside it
const world = () => {
    const root = mkdtempSync(join(tmpdir(), 'live-settings-'));
    made.push(root);
    const repo = join(root, 'repo');
    mkdirSync(join(repo, '.claude'), { recursive: true });
    const local = join(repo, '.claude/settings.local.json');
    writeFileSync(local, '{"outputStyle":"crew"}\n');
    const starts = snapshotRepoSettings(repoSettingsPaths(repo));
    return { keep: join(root, 'run/repo-settings'), local, repo, starts };
};
// the line cc's debug file carries for a settings write, copied from a live child's log
const wrote = (path: string) =>
    `2026-11-18T15:03:56.595Z [DEBUG] Writing to temp file: ${path}.tmp.93883.00582f79d584\n`;

it("a settings file the child's own write changed is put back, its version kept", () => {
    const w = world();
    writeFileSync(w.local, '{"enabledPlugins":{"x-mod-guard@x":false}}\n');
    const lines = putBackRepoSettings(w.starts, wrote(w.local), w.keep);
    const kept = join(w.keep, `${w.local.replaceAll('/', '_')}.child`);
    expect([
        readFileSync(w.local, 'utf8'),
        readFileSync(kept, 'utf8'),
        lines,
    ]).toEqual([
        '{"outputStyle":"crew"}\n',
        '{"enabledPlugins":{"x-mod-guard@x":false}}\n',
        [
            `mods:live: the child wrote ${w.local}; put back as it was at start, its version kept at ${kept}`,
        ],
    ]);
});

it('a settings file the child created is taken out, its copy kept', () => {
    const w = world();
    const project = join(w.repo, '.claude/settings.json');
    writeFileSync(project, '{"enabledPlugins":{}}\n');
    putBackRepoSettings(w.starts, wrote(project), w.keep);
    expect([
        existsSync(project),
        readFileSync(
            join(w.keep, `${project.replaceAll('/', '_')}.child`),
            'utf8',
        ),
    ]).toEqual([false, '{"enabledPlugins":{}}\n']);
});

it("a change the child's log never names stays, with the start copy beside it", () => {
    const w = world();
    writeFileSync(w.local, '{"outputStyle":"his hand edit"}\n');
    const lines = putBackRepoSettings(
        w.starts,
        wrote(`${w.repo}/elsewhere/.claude/settings.local.json`),
        w.keep,
    );
    const start = join(w.keep, `${w.local.replaceAll('/', '_')}.start`);
    expect([
        readFileSync(w.local, 'utf8'),
        readFileSync(start, 'utf8'),
        lines,
    ]).toEqual([
        '{"outputStyle":"his hand edit"}\n',
        '{"outputStyle":"crew"}\n',
        [
            `mods:live: ${w.local} changed during the run, not by the child's write; left as it is, the start copy at ${start}`,
        ],
    ]);
});

it('an unchanged file says nothing and copies nothing', () => {
    const w = world();
    expect([
        putBackRepoSettings(w.starts, wrote(w.local), w.keep),
        existsSync(w.keep),
    ]).toEqual([[], false]);
});
