import { type Segment, type Word, parse } from '../shell.ts';
import { commandsDeep, peel } from './command.ts';

// a body set whose file this line writes is judged as it runs: its `x` becomes this function, which reads the file once,
// judges those bytes against the ticket's current body (a sign line or a `## signed` merge grant it lacks word for word,
// the judge `hasNewSignLine` runs ahead) and sends the same bytes on stdin, held in the shell, never reopened by path, so
// neither the line nor a watcher writing the file can change what was judged (dima's o43); `builtin`, since zsh's
// `command printf` runs /usr/bin/printf, where a body near ARG_MAX would fail. a body
// that does not read refuses too. the seat writes the rest of the line, so the check runs only where nothing on it can
// reach the function: every other command on an allow-list, no function, alias or path override, and every body set of
// its ids renamed; anything else is judged before the line runs, as before (wisphunter and security on 6c6c57cf)
export const SIGN_CHECK = '__x_mod_guard_sign_set';
const NO = '__x_mod_guard_sign_no';
const NEW_SIGN = [
    'function grant(L, n,   h, i, e, at, s, pre) {',
    '  h = 0; for (i = 1; i <= n; i++) if (L[i] ~ /^## signed[ \\t]*$/) h = i',
    '  if (!h) return "!"',
    '  e = n + 1; for (i = h + 1; i <= n; i++) if (L[i] ~ /^## /) { e = i; break }',
    '  at = 0; for (i = h + 1; i < e; i++) if (L[i] ~ /^✍️ (re-)?signed/) at = i',
    '  s = at ? at : h + 1; pre = 0',
    '  for (i = s; i < e; i++) {',
    '    if (L[i] ~ /^(🚫 cancelled|✍️ re-sign pending)/) return "!"',
    '    if (L[i] ~ /^merge: pre-approved[ \\t]*$/) pre = 1',
    '  }',
    '  return pre ? (at ? L[at] : "") : "!"',
    '}',
    'BEGIN { n = split(ENVIRON["XG_CUR"], C, "\\n"); for (i = 1; i <= n; i++) H[C[i]] = 1 }',
    '{ F[++m] = $0; if ($0 ~ /^✍️ (re-)?signed / && !($0 in H)) bad = 1 }',
    'END { if (!bad) { g = grant(F, m); if (g != "!" && g != grant(C, n)) bad = 1 } exit bad }',
].join('\n');
const DOOR =
    'ask dima to tick «✍️ sign $id: <title>», or to type «sign $id» himself';
const FN = [
    `${NO}() { echo "x-mod-guard refused this body set: $1. ${DOOR}" >&2; return 1; };`,
    `${SIGN_CHECK}() { local id=$3 f= p= a b cur k=0; local -a n;`,
    `case $id in FRM-[0-9]*|BYT-[0-9]*) ;; *) ${NO} "its ticket id is not the verb's first word"; return 1;; esac;`,
    'for a in "$@"; do [ "$p" = --set ] && { f=$a; k=$((k+1)); }; case $a in --set=*) f=${a#--set=}; k=$((k+1));; esac; p=$a; done;',
    `[ "$k" = 1 ] || { ${NO} "it names --set $k times"; return 1; };`,
    `b=$(command cat -- "$f" && printf x) || { ${NO} "$f did not read"; return 1; }; b=\${b%x};`,
    `cur=$(command x linear read "$id" | command jq -er '.data.tickets[0] | objects | (.description // "") | strings') || { ${NO} "$id's current body did not read, so $f counts as a new sign"; return 1; };`,
    `builtin printf %s "$b" | XG_CUR=$cur command awk '${NEW_SIGN}' || { ${NO} "$f holds a sign line or a merge grant $id's body lacks"; return 1; };`,
    'p=; for a in "$@"; do if [ "$p" = --set ]; then n+=(/dev/stdin); else case $a in --set=*) n+=(--set=/dev/stdin);; *) n+=("$a");; esac; fi; p=$a; done;',
    'builtin printf %s "$b" | command x "${n[@]}"; };',
].join(' ');

// what may share a line with a checked body set: none of these can define a function or alias, change the path, or run
// the set out of the check's sight; an empty name is a bare assignment, its names read on their own
const BESIDE = new Set([
    '',
    '[',
    'awk',
    'cat',
    'cd',
    'cp',
    'cut',
    'done',
    'echo',
    'for',
    'grep',
    'head',
    'jq',
    'ls',
    'mv',
    'node',
    'printf',
    'python',
    'python3',
    'sd',
    'sed',
    'set',
    'shift',
    'sort',
    'tail',
    'tee',
    'test',
    'tr',
    'wc',
    'while',
    'x',
]);
const SAFE_WRAPPERS = new Set([
    'caffeinate',
    'gtimeout',
    'nice',
    'nohup',
    'timeout',
]);
// a name the shell reads where it looks a command up, or reads its startup from
const PATH_LIKE = /^(\w*PATH|ENV|BASH_ENV|ZDOTDIR|IFS|HOME|SHELL)$/;

const isBodySet = (args: string[]) =>
    args[0] === 'linear' &&
    args[1] === 'body' &&
    args.some((w) => w === '--set' || w.startsWith('--set='));

// every `x linear body <id> --set` that is a command of its own, its id one of `ids` or filled by the shell, runs the
// check; undefined when the line holds anything the check cannot stand beside, or a set of these ids it cannot rename
export function withSignCheck(command: string, ids: ReadonlySet<string>) {
    const isOurs = (id: string | undefined) =>
        id !== undefined && (ids.has(id) || /[$`]/.test(id));
    for (const c of commandsDeep(command, '/')) {
        const name = c.name.split('/').at(-1) ?? c.name;
        if (
            !BESIDE.has(name) ||
            c.args[0]?.text === '{' ||
            c.name.endsWith('()') ||
            c.wrappers.some((w) => !SAFE_WRAPPERS.has(w)) ||
            c.assigns.some((a) => PATH_LIKE.test(a.split('=')[0] ?? ''))
        )
            return undefined;
    }
    const sets = commandsDeep(command, '/').filter(
        (c) =>
            (c.name.split('/').at(-1) ?? c.name) === 'x' &&
            isBodySet(c.args.map((w) => w.text)) &&
            isOurs(c.args[2]?.text),
    ).length;
    const heads: number[] = [];
    const walk = (segments: Segment[]) => {
        for (const s of segments) {
            walk(s.subst);
            const peeled = peel(s.words);
            const args = peeled.args.map((w) => w.text);
            if (
                peeled.name !== 'x' ||
                peeled.wrappers.length ||
                !isBodySet(args) ||
                !isOurs(args[2])
            )
                continue;
            const head = s.words[s.words.indexOf(peeled.args[0] as Word) - 1];
            if (head?.at !== undefined && head.text === 'x')
                heads.push(head.at);
        }
    };
    walk(parse(command).segments);
    if (!heads.length || heads.length !== sets) return undefined;
    let out = command;
    for (const at of heads.sort((a, b) => b - a))
        out = `${out.slice(0, at)}${SIGN_CHECK}${out.slice(at + 1)}`;
    return `${FN} ${out}`;
}
