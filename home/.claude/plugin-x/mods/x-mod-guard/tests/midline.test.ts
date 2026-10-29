import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

// FRM-463: a `#` before `; cmd` comments out every command after it, with no error; warn-only until a sixth sense says clean
function world(on: On) {
    mock.clock(on, { now: 1_000_000 });
    mock.store(on);
    const ran: string[] = [];
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', () => ({ value: false }));
    on('ui.log', () => ({ value: undefined }));
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran };
}

const bash = ($: Engine, command: string) =>
    $.tool.call({ command, tool: 'Bash' });
// refused since the sixth sense's clean (FRM-427, round 2), the fix named in the refusal
const refused = (r: { deny?: string }) =>
    (r.deny ?? '').includes("move the comment to the line's end");

for (const typed of [
    'echo a # deadline: 5 s; trash x',
    'echo a # x && y',
    'echo a # x || y',
])
    test(`a comment before more commands is refused: ${typed}`, async ($, on) => {
        const w = world(on);
        expect([refused(await bash($, typed)), w.ran]).toEqual([true, []]);
    });

for (const typed of [
    'echo a; trash x # deadline: 5 s',
    "echo 'a # b; c'",
    'echo a # plain note\necho b && echo c',
])
    test(`runs unrefused: ${JSON.stringify(typed)}`, async ($, on) => {
        const w = world(on);
        const r = await bash($, typed);
        expect([w.ran, refused(r)]).toEqual([[typed], false]);
    });
