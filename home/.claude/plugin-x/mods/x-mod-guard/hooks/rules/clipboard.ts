import {
    type Command,
    type Context,
    type Refusal,
    herestrings,
    printed,
} from './command.ts';

export const CLIPBOARD = 'clipboard';
const refused = (target: string): Refusal => ({
    door: 'write a fixture file, or ask your coordinator',
    rule: CLIPBOARD,
    targets: [target],
    why: "a member session never writes dima's clipboard: a probe's write cost him his own text (FRM-612)",
});
// the program a script runner is handed on the line: each value of its inline flag, a heredoc, a `<<<` string, what a
// pipe feeds it
function programs(c: Command, flag: RegExp) {
    const texts = c.args.map((w) => w.text);
    return [
        ...texts.filter((_t, i) => flag.test(texts[i - 1] ?? '')),
        ...c.bodies,
        ...herestrings(texts),
        ...c.feeders.flatMap(printed),
    ];
}
const PASTEBOARD = /clipboard|NSPasteboard|\bpbcopy\b/i;
// what a program in any other language names to write it: the class, or `pbcopy` run through its own shell call
const WRITER = /NSPasteboard|\bpbcopy\b/;
// a System Events key press with the command key held, in AppleScript or JXA
const COMMAND_KEY = /\b(?:keystroke|key ?code)\b[^\n]*\bcommand down\b/i;
const COPY_PASTE = /^(?:cmd|command)\+[cv]$/i;
// a runner's inline-program flag, alone or closing a cluster (`python3 -Ic`); python by any version (`python3.12`)
const E_FLAG = /^-e$/;
const C_FLAG = /^-[A-Za-z]*c$/;
const PYTHON = /^python[\d.]*$/;
// perl clusters its flags (`-ne`, `-lE`); node, bun and deno also print (`-p`) and spell the flag out
const PERL_FLAG = /^-[A-Za-z]*[eE]$/;
const JS_FLAG = /^(?:-e|-p|--eval|--print)$/;
const INLINE = new Map([
    ['swift', E_FLAG],
    ['ruby', E_FLAG],
    ['perl', PERL_FLAG],
    ['node', JS_FLAG],
    ['bun', JS_FLAG],
    ['deno', JS_FLAG],
]);
const inlineFlag = (name: string) =>
    PYTHON.test(name) ? C_FLAG : INLINE.get(name);
// what writes the macos pasteboard, in a lane member's session: `pbcopy` run, a script naming the pasteboard, a copy or
// paste key press. a word only named or read (`rg pbcopy`, `pbpaste`) is no command of that name, so it runs
export function clipboard(c: Command, ctx: Context): Refusal | undefined {
    if (!ctx.isMember) return undefined;
    if (c.name === 'pbcopy') return refused('pbcopy');
    if (
        c.name === 'osascript' &&
        programs(c, E_FLAG).some(
            (p) => PASTEBOARD.test(p) || COMMAND_KEY.test(p),
        )
    )
        return refused('osascript');
    const flag = inlineFlag(c.name);
    if (flag && programs(c, flag).some((p) => WRITER.test(p)))
        return refused(c.name);
    const [verb, ...rest] = c.args.map((w) => w.text);
    if (
        c.name === 'hc' &&
        (verb === 'keys' || verb === 'send') &&
        rest.some((w) => COPY_PASTE.test(w))
    )
        return refused(`hc ${verb}`);
    return undefined;
}
