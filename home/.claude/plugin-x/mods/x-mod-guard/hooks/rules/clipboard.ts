import {
    type Command,
    type Context,
    type Refusal,
    printed,
} from './command.ts';

export const CLIPBOARD = 'clipboard';
const DOOR = 'write a fixture file, or ask your coordinator';
// a runner's program is refused for the word alone, so its refusal also names the way on for one that writes nothing
const NAMED =
    'a program that only names the word: drop the word, or write the program to a file';
const refused = (target: string, isProgram = false): Refusal => ({
    door: isProgram ? `${DOOR}; ${NAMED}` : DOOR,
    rule: CLIPBOARD,
    targets: [target],
    why: "a member session never writes dima's clipboard: a probe's write cost him his own text (FRM-612)",
});
// a word of the line that is code, never a file name or a flag: it holds a space, a bracket, a quote or a `;` `=`
const CODE = /[\s()[\]{}'"`;=]/;
// any runner's flag that takes a program as its next word, alone or closing a cluster (`-c`, `-Ic`, `-lE`, `-r`, `-p`)
const PROGRAM_FLAG =
    /^(?:-[A-Za-z]*[ceEprR]|--eval|--print|--execute|--command)$/;
// the program a script runner is handed on the line, whatever flag or subcommand carries it: each word that is code or
// follows a program flag (a `<<<` string is such a word), a heredoc, what a pipe feeds it
function programs(c: Command) {
    const texts = c.args.map((w) => w.text);
    return [
        ...texts.filter(
            (t, i) => CODE.test(t) || PROGRAM_FLAG.test(texts[i - 1] ?? ''),
        ),
        ...c.bodies,
        ...c.feeders.flatMap(printed),
    ];
}
// what runs a program written on the line, in its own language; a shell's script is read as commands (command.ts)
const RUNNER =
    /^(?:python[\d.]*|ruby|perl|node|bun|deno|swift|[gmn]?awk|lua(?:jit)?|php|tclsh|expect|Rscript|julia|elixir)$/;
// what such a program names to write the pasteboard: the class, or `pbcopy` run through its own shell call
const WRITER = /NSPasteboard|\bpbcopy\b/;
const PASTEBOARD = /clipboard|NSPasteboard|\bpbcopy\b/i;
// a System Events key press with the command key held, in AppleScript or JXA
const COMMAND_KEY = /\b(?:keystroke|key ?code)\b[^\n]*\bcommand down\b/i;
const COPY_PASTE = /^(?:cmd|command)\+[cv]$/i;
// what writes the macos pasteboard, in a lane member's session: `pbcopy` run, a program naming the pasteboard, a copy or
// paste key press. a word only named or read by a plain command (`rg pbcopy`, `pbpaste`) is no command of that name, so
// it runs; a runner's program that only names the word is refused all the same, cheaper than reading every language
export function clipboard(c: Command, ctx: Context): Refusal | undefined {
    if (!ctx.isMember) return undefined;
    if (c.name === 'pbcopy') return refused('pbcopy');
    if (
        c.name === 'osascript' &&
        programs(c).some((p) => PASTEBOARD.test(p) || COMMAND_KEY.test(p))
    )
        return refused('osascript', true);
    if (RUNNER.test(c.name) && programs(c).some((p) => WRITER.test(p)))
        return refused(c.name, true);
    const [verb, ...rest] = c.args.map((w) => w.text);
    if (
        c.name === 'hc' &&
        (verb === 'keys' || verb === 'send') &&
        rest.some((w) => COPY_PASTE.test(w))
    )
        return refused(`hc ${verb}`);
    return undefined;
}
