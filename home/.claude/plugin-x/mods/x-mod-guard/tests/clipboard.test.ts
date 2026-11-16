import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

const SID = 'c1c1c1c1-0000';
const DOOR = 'write a fixture file, or ask your coordinator';

// role: the role in this session's thread record; threads: the whole threads.json text in its place; name: the registry name
type Seat = {
    role?: string;
    threads?: string;
    name?: string;
    hasNoId?: boolean;
};
const CODIE: Seat = { name: 'mods', role: 'codie' };
const COORDINATOR: Seat = { name: '🦉 clio', role: 'coordinator' };

function world(on: On, seat: Seat) {
    mock.clock(on, { now: 1_000_000 });
    mock.store(on);
    const ran: string[] = [];
    const reads: string[] = [];
    const threads =
        seat.threads ??
        JSON.stringify({
            threads: seat.role ? [{ role: seat.role, sessionId: SID }] : [],
            v: 1,
        });
    on('session.id', () => ({ value: seat.hasNoId ? '' : SID }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', () => ({ value: false }));
    on('fs.list', () => ({
        value: [
            {
                isLink: false,
                kind: 'file' as const,
                mtimeMs: 0,
                name: '1.json',
                size: 1,
            },
        ],
    }));
    on('fs.read', (_$, e) => {
        reads.push(e.path);
        if (e.path === '/home/.claude/shelf/threads.json')
            return { value: threads };
        if (e.path === '/home/.claude/sessions/1.json' && seat.name)
            return {
                value: JSON.stringify({ name: seat.name, sessionId: SID }),
            };
        return { deny: 'no such file' };
    });
    // the harness records the call and runs nothing: no test here executes a pasteboard writer
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran, reads };
}
const bash = ($: Engine, command: string) =>
    $.tool.call({ command, run_in_background: true, tool: 'Bash' });

const WRITERS = [
    ['pbcopy at a pipeline end', 'printf x | pbcopy'],
    ['pbcopy by its path', 'echo hi | /usr/bin/pbcopy'],
    ['env pbcopy', 'env pbcopy < notes.txt'],
    ['command pbcopy', 'command pbcopy < notes.txt'],
    ['xargs pbcopy', 'ls | xargs pbcopy'],
    ['pbcopy inside sh -c', "sh -c 'date | pbcopy'"],
    ['pbcopy after &&', 'make && pbcopy < out.txt'],
    ['pbcopy after ;', 'cd /tmp; pbcopy < a.txt'],
    [
        'pbcopy as a line of a heredoc fed to a shell',
        'bash <<EOF\ndate | pbcopy\nEOF',
    ],
    ['pbcopy split by quotes', 'date | pb"cop"y'],
    [
        'osascript setting the clipboard',
        `osascript -e 'set the clipboard to "x"'`,
    ],
    [
        'osascript in JavaScript naming NSPasteboard',
        `osascript -l JavaScript -e '$.NSPasteboard.generalPasteboard.clearContents'`,
    ],
    [
        'osascript fed a heredoc',
        'osascript <<EOF\nset the clipboard to "x"\nEOF',
    ],
    ['osascript fed a here-string', `osascript <<< 'set the clipboard to "x"'`],
    ['osascript fed by a pipe', `echo 'set the clipboard to "x"' | osascript`],
    [
        'a System Events keystroke with command down',
        `osascript -e 'tell application "System Events" to keystroke "v" using command down'`,
    ],
    [
        'a System Events key code with command down',
        `osascript -e 'tell application "System Events" to key code 8 using {command down}'`,
    ],
    [
        'a JXA keyCode with command down',
        `osascript -l JavaScript -e 'Application("System Events").keyCode(9,{using:"command down"})'`,
    ],
    ['pbcopy behind x as', 'date | x as codie -- pbcopy'],
    ['pbcopy in an eval', `eval 'date | pbcopy'`],
    ['pbcopy in a find -exec', 'find . -name a.txt -exec pbcopy {} ;'],
    ['pbcopy in a command substitution', 'echo "$(date | pbcopy)"'],
    ['pbcopy behind a backslash', 'date | \\pbcopy'],
    [
        'python3 -Ic naming NSPasteboard',
        `python3 -Ic 'from AppKit import NSPasteboard'`,
    ],
    [
        'python3.12 -c naming NSPasteboard',
        `python3.12 -c 'from AppKit import NSPasteboard'`,
    ],
    ['hc keys cmd+v', 'hc keys t7 cmd+v'],
    ['hc keys cmd+c', 'hc keys t7 cmd+c'],
    ['hc send cmd+v', 'hc send t7 cmd+v'],
    ['hc keys command+v', 'hc keys t7 command+v'],
    [
        'python -c naming NSPasteboard',
        `python -c 'from AppKit import NSPasteboard'`,
    ],
    [
        'python3 -c naming NSPasteboard',
        `python3 -c 'from AppKit import NSPasteboard'`,
    ],
    [
        'swift -e naming NSPasteboard',
        `swift -e 'import AppKit; NSPasteboard.general.clearContents()'`,
    ],
] as const;

for (const [shape, command] of WRITERS) {
    test(`a member's pasteboard write is refused, naming the door: ${shape}`, async ($, on) => {
        const { ran } = world(on, CODIE);
        const { deny } = await bash($, command);
        expect([deny?.includes(DOOR), ran]).toEqual([true, []]);
    });
    test(`a coordinator's thread keeps the clipboard: ${shape}`, async ($, on) => {
        const { ran } = world(on, COORDINATOR);
        const { deny } = await bash($, command);
        expect([deny, ran]).toEqual([undefined, [command]]);
    });
}

// ten hostile inputs and more: each names or reads the pasteboard and writes nothing
const READERS = [
    ['pbpaste', 'pbpaste'],
    ['a search for the word', 'rg pbcopy'],
    ['an echo of the word', "echo 'use pbcopy'"],
    ['a heredoc fed to cat', 'cat <<EOF\ndate | pbcopy\nEOF'],
    ['a commit message', 'git commit -m "pbcopy is refused for members"'],
    ['a manual page', 'man pbcopy'],
    ['a lookup of the binary', 'which pbcopy'],
    ['a path holding the word', 'cat docs/pbcopy.md'],
    ['a comment', 'ls # pbcopy'],
    ['a variable holding the word, never run', 'tool=pbcopy; echo "$tool"'],
    [
        'an osascript that names no pasteboard',
        `osascript -e 'display notification "hi"'`,
    ],
    [
        'a keystroke with no command key',
        `osascript -e 'tell application "System Events" to keystroke "v"'`,
    ],
    [
        'an echo of an osascript line',
        `echo 'osascript -e "set the clipboard to 1"'`,
    ],
    ['hc keys with ctrl+c', 'hc keys t7 ctrl+c'],
    ['an echo of the key names', 'echo keys cmd+v'],
    ['hc send whose text names the keys', 'hc send t7 "press cmd+c to copy"'],
    ['hc read of a terminal named cmd+v', 'hc read cmd+v'],
    ['a python program with no pasteboard', `python3 -c 'print(1)'`],
    ['a python file whose name holds the word', 'python3 NSPasteboard.py'],
    ['a swift build', 'swift build'],
    [
        'a python module run whose argument names the class',
        'python3 -m pydoc NSPasteboard',
    ],
] as const;

for (const [shape, command] of READERS)
    test(`a member's command that only reads or names the pasteboard runs: ${shape}`, async ($, on) => {
        const { ran } = world(on, CODIE);
        const { deny } = await bash($, command);
        expect([deny, ran]).toEqual([undefined, [command]]);
    });

const OTHER = JSON.stringify({
    threads: [{ role: 'codie', sessionId: 'another-session' }],
    v: 1,
});
const SIGNS: readonly (readonly [string, Seat, boolean])[] = [
    ['a codie record', { name: 'mods', role: 'codie' }, true],
    ['a sixth sense record', { name: 'mods', role: 'sixth-sense' }, true],
    ['a probe record', { name: 'zz', role: 'probe' }, true],
    ['a codie record and no registry row', { role: 'codie' }, true],
    ['no record, a name carrying 🔧', { name: '⚡ 🔧 mods | FRM-612' }, true],
    ['no record, a name carrying 🔎', { name: '⚡ 🔎 mods | main' }, true],
    ['no record, a name carrying 🐕', { name: '⚡ 🐕 strays | chores' }, true],
    ['no record, a name starting «probe»', { name: 'probe a' }, true],
    [
        'a coordinator record whose name carries 🔧',
        { name: '🔧 fix', role: 'coordinator' },
        true,
    ],
    [
        'a torn threads file, a name carrying 🔧',
        { name: '🔧 mods', threads: '{"threads":[' },
        true,
    ],
    ['a coordinator record', { name: '🦉 clio', role: 'coordinator' }, false],
    ['an adviser record', { name: '🐦‍⬛ crow', role: 'adviser' }, false],
    ['no record and a plain name', { name: 'my own thread' }, false],
    [
        'no record, a name that only holds «probe»',
        { name: 'the probe plan' },
        false,
    ],
    [
        'a codie record of another session',
        { name: 'my own thread', threads: OTHER },
        false,
    ],
    [
        'a torn threads file and a plain name',
        { name: 'my own thread', threads: '{"threads":[' },
        false,
    ],
    [
        'a threads file of another shape',
        { name: 'my own thread', threads: '{"threads":{"role":"codie"}}' },
        false,
    ],
    ['no record and no registry row', {}, false],
];

for (const [shape, seat, isMember] of SIGNS)
    test(`${isMember ? 'a member by its sign is refused' : 'a session with no member sign keeps the clipboard'}: ${shape}`, async ($, on) => {
        const { ran } = world(on, seat);
        const command = 'printf x | pbcopy';
        const { deny } = await bash($, command);
        expect([deny?.includes(DOOR) ?? false, ran]).toEqual(
            isMember ? [true, []] : [false, [command]],
        );
    });

test('the want line: a codie is refused naming the door', async ($, on) => {
    const { ran } = world(on, CODIE);
    const { deny } = await bash($, 'printf x | pbcopy');
    expect(deny).toContain('nothing in this command ran');
    expect(deny).toContain(DOOR);
    expect(ran).toEqual([]);
});

test('the want line: a coordinator runs the same text', async ($, on) => {
    const { ran } = world(on, COORDINATOR);
    const { deny } = await bash($, 'printf x | pbcopy');
    expect([deny, ran]).toEqual([undefined, ['printf x | pbcopy']]);
});

test('a member line with no pasteboard writer reads no thread record', async ($, on) => {
    const { reads } = world(on, CODIE);
    await bash($, 'ls');
    expect(reads.filter((p) => p.endsWith('threads.json'))).toEqual([]);
});

test('a session with an empty id has no member sign, so the line runs', async ($, on) => {
    const { ran } = world(on, { ...CODIE, hasNoId: true });
    const { deny } = await bash($, 'printf x | pbcopy');
    expect([deny, ran]).toEqual([undefined, ['printf x | pbcopy']]);
});
