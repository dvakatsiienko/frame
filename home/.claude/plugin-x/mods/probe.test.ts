import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    behindFalse,
    childEnv,
    holdsInGroup,
    loadedFrom,
    parseRows,
    probeArgv,
    rowVerdicts,
    swapDir,
} from './probe.ts';

const names: Record<string, string> = {
    '~/m/x-mod-guard': 'x-mod-guard',
    '~/m/x-mod-stash': 'x-mod-stash',
};
const nameOf = (dir: string) => names[dir];

describe('swapDir', () => {
    it('puts the dev copy in the live entry of the same plugin, order kept', () => {
        expect(
            swapDir(
                ['~/m/x-mod-stash', '~/m/x-mod-guard'],
                '/wt/x-mod-stash',
                'x-mod-stash',
                nameOf,
            ),
        ).toEqual(['/wt/x-mod-stash', '~/m/x-mod-guard']);
    });

    it('adds a mod that is not live yet at the end', () => {
        expect(
            swapDir(['~/m/x-mod-stash'], '/wt/x-mod-new', 'x-mod-new', nameOf),
        ).toEqual(['~/m/x-mod-stash', '/wt/x-mod-new']);
    });
});

describe('loadedFrom', () => {
    const line = (dir: string) =>
        `2026-10-11T10:24:34.482Z [DEBUG] Read hooks.json for plugin x-mod-guard (enabled=true): ${dir}/hooks/hooks.json`;

    it('names the folder the engine read the mod from', () => {
        expect(loadedFrom([line('/tmp/dev/x-mod-guard')], 'x-mod-guard')).toBe(
            '/tmp/dev/x-mod-guard',
        );
    });

    it('names the live folder when the dev copy did not load', () => {
        expect(
            loadedFrom(
                [
                    line(
                        '/Users/dima/frame/home/.claude/plugin-x/mods/x-mod-guard',
                    ),
                ],
                'x-mod-guard',
            ),
        ).toBe('/Users/dima/frame/home/.claude/plugin-x/mods/x-mod-guard');
    });

    it('is undefined when the mod never loaded', () => {
        expect(loadedFrom([], 'x-mod-guard')).toBeUndefined();
    });
});

describe('childEnv', () => {
    it('moves the plugin cache, which holds the store, under the run dir', () => {
        expect(childEnv({ PATH: '/bin' }, ['/a', '/b'], '/run')).toEqual({
            CLAUDE_CODE_PLUGIN_CACHE_DIR: '/run/plugin-cache',
            CLAUDE_CODE_PLUGIN_DIRS: '/a:/b',
            PATH: '/bin',
        });
    });
});

describe('behindFalse', () => {
    const tails = [
        ['a semicolon', 'true; touch escaped'],
        ['a newline', 'true\ntouch escaped'],
        ['an or', 'false || touch escaped'],
        ['an and', 'true && touch escaped'],
        ['a pipe', 'true | touch escaped'],
        ['a background', 'true & touch escaped'],
        ['a trailing comment', 'touch escaped # }'],
        ['a substitution', 'echo $(touch escaped)'],
    ] as const;
    it.each(tails)('never runs the tail after %s', (_, line) => {
        const dir = mkdtempSync(join(tmpdir(), 'behind-false-'));
        spawnSync('bash', ['-c', behindFalse(line)], { cwd: dir });
        expect(readdirSync(dir)).toEqual([]);
    });

    it.each([
        ['a closing brace', 'true; }; touch escaped; {'],
        ['an open quote', "echo '"],
    ])('refuses a line with %s, which could leave the group', (_, line) => {
        expect(holdsInGroup(line)).toBe(false);
    });

    it('takes a plain compound line', () => {
        expect(holdsInGroup('true; touch escaped')).toBe(true);
    });
});

describe('parseRows', () => {
    it('reads names and lines, skips comments, unfolds a newline', () => {
        expect(parseRows('# head\n\none\ttrue; ls\ntwo\ttrue\\nls\n')).toEqual([
            { line: 'true; ls', name: 'one' },
            { line: 'true\nls', name: 'two' },
        ]);
    });

    it('refuses a row with no tab', () => {
        expect(() => parseRows('no tab here')).toThrow('no tab');
    });
});

describe('rowVerdicts', () => {
    const rows = [
        { line: 'rm -rf /x', name: 'floor' },
        { line: 'ls', name: 'plain' },
        { line: 'pwd', name: 'skipped' },
    ];
    const call = (id: string, command: string) =>
        JSON.stringify({
            message: {
                content: [
                    { id, input: { command }, name: 'Bash', type: 'tool_use' },
                ],
            },
        });
    const result = (id: string, content: string, isError: boolean) =>
        JSON.stringify({
            message: {
                content: [
                    {
                        content,
                        is_error: isError,
                        tool_use_id: id,
                        type: 'tool_result',
                    },
                ],
            },
        });
    const hint = JSON.stringify({
        attachment: {
            content: ['x-mod-guard hint: a hint'],
            toolUseID: 'b-context',
            type: 'hook_additional_context',
        },
    });
    const transcript = [
        call('a', behindFalse('rm -rf /x')),
        result('a', 'nothing in this command ran — x-mod-guard', true),
        call('b', behindFalse('ls')),
        result('b', 'Exit code 1', true),
        hint,
    ].join('\n');

    it('reads a hook refusal, the short circuit and a row never called', () => {
        expect(rowVerdicts(transcript, rows)).toEqual([
            {
                context: [],
                name: 'floor',
                ran: true,
                verdict: 'refused: nothing in this command ran — x-mod-guard',
            },
            {
                context: ['x-mod-guard hint: a hint'],
                name: 'plain',
                ran: true,
                verdict: 'ran, no refusal',
            },
            {
                context: [],
                name: 'skipped',
                ran: false,
                verdict: 'never called',
            },
        ]);
    });
});

describe('probeArgv', () => {
    it('reads no user settings, so a --bg parent cannot beat the swapped plugin dirs', () => {
        const argv = probeArgv('hi', '/t/debug.log', ['--model', 'x']);
        expect(
            argv.slice(
                argv.indexOf('--setting-sources'),
                argv.indexOf('--setting-sources') + 2,
            ),
        ).toEqual(['--setting-sources', 'project,local']);
    });
});
