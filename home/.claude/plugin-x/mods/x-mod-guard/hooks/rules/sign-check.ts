import { type Segment, type Word, parse } from '../shell.ts';
import { peel } from './command.ts';

// a body set whose file this line writes is judged as it runs: its `x` becomes this function, which reads the file as
// the set will send it and refuses a sign line, or a `## signed` merge grant, the ticket's current body lacks word for
// word, the same judge as `hasNewSignLine`; a body that does not read refuses too. a sign written inside a python
// subprocess, or behind a wrapper (`timeout`, `xargs`), never reaches the function and stays judged before the line runs
export const SIGN_CHECK = '__x_mod_guard_sign_set';
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
const FN = `${SIGN_CHECK}() { local a p= id= f= cur; for a in "$@"; do [ "$p" = --set ] && f=$a; case $a in --set=*) f=\${a#--set=};; esac; if [ -z "$id" ]; then case $a in FRM-[0-9]*|BYT-[0-9]*) id=$a;; esac; fi; p=$a; done; if [ -n "$f" ]; then cur=$(command x linear read "$id" | jq -er '.data.tickets[0].description | strings') || { echo "x-mod-guard refused this body set: $id's current body did not read, so $f counts as a new sign. ${DOOR}" >&2; return 1; }; XG_CUR=$cur awk '${NEW_SIGN}' "$f" || { echo "x-mod-guard refused this body set: $f holds a sign line or a merge grant $id's body lacks. ${DOOR}" >&2; return 1; }; fi; command x "$@"; };`;

// every `x linear body <id> --set` that is a command of its own, its id one of `ids` or filled by the shell, runs the check
export function withSignCheck(command: string, ids: ReadonlySet<string>) {
    const heads: number[] = [];
    const walk = (segments: Segment[]) => {
        for (const s of segments) {
            walk(s.subst);
            const peeled = peel(s.words);
            const args = peeled.args.map((w) => w.text);
            const id = args[2];
            if (
                peeled.name !== 'x' ||
                peeled.wrappers.length ||
                args[0] !== 'linear' ||
                args[1] !== 'body' ||
                !args.some((w) => w === '--set' || w.startsWith('--set=')) ||
                id === undefined ||
                !(ids.has(id) || /[$`]/.test(id))
            )
                continue;
            const head = s.words[s.words.indexOf(peeled.args[0] as Word) - 1];
            if (head?.at !== undefined && head.text === 'x')
                heads.push(head.at);
        }
    };
    walk(parse(command).segments);
    if (!heads.length) return undefined;
    let out = command;
    for (const at of heads.sort((a, b) => b - a))
        out = `${out.slice(0, at)}${SIGN_CHECK}${out.slice(at + 1)}`;
    return `${FN} ${out}`;
}
