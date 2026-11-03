import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

// FRM-472 06c: the shapes the reader now opens, each harmless body still runs, unwarned
function world(on: On) {
    mock.clock(on, { now: 1_000_000 });
    mock.store(on);
    const ran: string[] = [];
    on('session.id', () => ({ value: 'r1r1r1r1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('fs.exists', () => ({ value: false }));
    on('env.get', () => ({ value: '/home' }));
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran };
}

const PASSES = [
    ['a heredoc into ssh', 'ssh host <<EOF\nls\nEOF'],
    ["ssh's remote command", "ssh -p 22 host 'uptime'"],
    ['ssh with no command', 'ssh -o BatchMode=yes host'],
    ['an eval of a cat heredoc', 'eval "$(cat <<EOF\nls\nEOF\n)"'],
    ['a head echoed past -n', 'x=$(echo -n ls); $x -la'],
    ['a cat herestring into a shell', "cat <<<'ls' | bash"],
    ['xargs feeding bash -c', "printf 'ls\\0' | xargs -0 bash -c"],
    ['gtimeout', 'gtimeout 5 ls'],
    ['flock', 'flock /tmp/l ls'],
    ['watch', 'watch -n 1 ls'],
    // FRM-472 review P0: a %% before a conversion never loops the reader
    ['a printf with %% and a conversion', "printf '100%%d\\n' 5"],
    ['a printf of %%s alone', "printf '%%s' x"],
] as const;
for (const [shape, command] of PASSES)
    test(`a harmless command the reader opens runs unwarned: ${shape}`, async ($, on) => {
        const { ran } = world(on);
        const r = await $.tool.call({
            command,
            run_in_background: true,
            tool: 'Bash',
        });
        expect([
            r.deny,
            JSON.stringify(r).includes('would refuse'),
            ran,
        ]).toEqual([undefined, false, [command]]);
    });
