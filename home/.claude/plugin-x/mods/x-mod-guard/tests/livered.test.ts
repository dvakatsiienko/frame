import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

const MOD = '/home/frame/mods/x-mod-demo';
const LINK = '/home/.claude/mods/x-mod-demo';

// one live mod in CLAUDE_CODE_PLUGIN_DIRS, reached through `~`; its plugin test exits `testExit`; LINK resolves into it
function world(on: On, testExit: number) {
    mock.clock(on, { now: 1_000_000 });
    mock.store(on);
    const ran: string[] = [];
    const tested: string[][] = [];
    on('session.id', () => ({ value: 'u1u1u1u1-0000' }));
    on('session.cwd', () => ({ value: '/home/frame' }));
    on('env.get', (_$, e) => ({
        value:
            e.name === 'CLAUDE_CODE_PLUGIN_DIRS'
                ? '~/frame/mods/x-mod-other:~/frame/mods/x-mod-demo'
                : e.name === 'HOME'
                  ? '/home'
                  : undefined,
    }));
    on('fs.exists', () => ({ value: false }));
    on('fs.stat', (_$, e) => ({
        value: {
            isLink: false,
            kind: 'file' as const,
            mtimeMs: 0,
            realPath: e.path.replace(LINK, MOD),
            size: 1,
        },
    }));
    on('process.run', (_$, e) => {
        if (e.argv[0] === 'claude') tested.push([...e.argv]);
        return {
            value: {
                exitCode: e.argv[0] === 'claude' ? testExit : 1,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout: '',
            },
        };
    });
    on('tool.call', (_$, e) => {
        ran.push(e.tool);
        return { result: {}, text: 'ran' };
    });
    return { ran, tested };
}

const edit = ($: Engine, file: string) =>
    $.tool.call({
        file_path: file,
        new_string: 'b',
        old_string: 'a',
        tool: 'Edit',
    });

test("an Edit under a live mod's hooks/ is refused while its plugin test is red", async ($, on) => {
    const { ran } = world(on, 1);
    const r = await edit($, `${MOD}/hooks/register.ts`);
    expect([r.deny?.includes('scratch-edit pull'), ran]).toEqual([true, []]);
});

test("an Edit under a live mod's hooks/ goes through while its plugin test is green", async ($, on) => {
    const { ran } = world(on, 0);
    await edit($, `${MOD}/hooks/register.ts`);
    expect(ran).toEqual(['Edit']);
});

test('a symlinked route into the live hooks/ is refused too', async ($, on) => {
    world(on, 1);
    const r = await edit($, `${LINK}/hooks/register.ts`);
    expect(r.deny).toContain("x-mod-demo's plugin test is red");
});

test("an Edit outside a live mod's hooks/ runs no plugin test", async ($, on) => {
    const { tested } = world(on, 1);
    await edit($, `${MOD}/tests/a.test.ts`);
    expect(tested).toEqual([]);
});
