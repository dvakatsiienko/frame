import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

function world(on: On) {
    const ran: string[] = [];
    on('session.id', () => ({ value: 'w1w1w1w1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('fs.exists', () => ({ value: false }));
    on('env.get', () => ({ value: '/home' }));
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran };
}

const bash = ($: Engine, command: string) =>
    $.tool.call({ command, tool: 'Bash' });

for (const command of [
    'cat .github/workflows/ci.yml',
    'github-token-wrap gh pr edit 1 --add-label x',
    'lefthook run commit-msg',
    'bash ./script/gitlog.sh "$OUT"',
])
    test(`a command that only names git runs: ${command}`, async ($, on) => {
        mock.store(on);
        const { ran } = world(on);
        const r = await bash($, command);
        expect(r.deny).toBeUndefined();
        expect(ran).toEqual([command]);
    });
