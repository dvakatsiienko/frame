import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// x-mod-stash's hook entry as cc's own validator reads it: a split of register.tsx that drops one `on(...)` loses a
// feature with no test of its own to notice, so the hooks list is pinned (FRM-662 exit 2); a new hook adds its row
const MOD = join(import.meta.dirname, 'x-mod-stash');
// cc's validator runs on this mac only: the ci runner has no claude, and every move lands through the local commit
// gate, which runs this file; so the run reads its binary from a list, and ci skips it
const VALIDATE = ['claude', 'plugin', 'validate'] as const;
const isOnCi = process.env.CI === 'true';
const HOOKS = [
    'session.start',
    'skill.prompt',
    'ui.press',
    'prompt.submit',
    'session.append{door=response}',
    'ui.render{component=AssistantMessage}',
    'classic.Stop',
    'turn.complete',
    'session.compact',
    'session.measure',
    'turn.step',
    'session.receive',
    'command.run{command=quiet-delivery-test}',
    'command.run{command=quiet}',
    'command.run{command=board}',
    'ui.close',
    'session.detach',
    'session.attach',
    'ui.render{component=Pane, requestId=stash-settings}',
    'ui.render{component=Pane, requestId=x-cc-deck}',
    'session.end',
    'command.run',
    'tool.call',
    'ui.render{component=AbovePrompt}',
];

function hooksOf(report: string) {
    const line = /❯ \.\/register\.tsx hooks: (.*)$/m.exec(report)?.[1] ?? '';
    return line
        .replace(/ \(default matcher key: [^)]*\)/g, '')
        .split(/, (?![^{]*\})/)
        .filter(Boolean);
}

describe('x-mod-stash: the hook entry registers every hook', () => {
    it('reads a hooks line with matchers and notes', () => {
        expect(
            hooksOf(
                '  ❯ ./register.tsx hooks: a, ui.press (default matcher key: plugin, component), b{x=1, y=2}\n',
            ),
        ).toEqual(['a', 'ui.press', 'b{x=1, y=2}']);
    });

    it.skipIf(isOnCi)('validates with the pinned hooks', () => {
        const [bin, ...args] = VALIDATE;
        const run = spawnSync(bin, [...args, MOD], {
            encoding: 'utf8',
            timeout: 60_000,
        });
        expect(hooksOf(`${run.stdout}${run.stderr}`)).toEqual(HOOKS);
    });
});
