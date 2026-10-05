const HEADER = /⏳\s*waiting on your word/i;

// The asks of a reply's ⏳ block, in order; null when the reply carries no block.
export function parseAsks(reply: string): string[] | null {
    const start = reply.search(HEADER);
    if (start < 0) return null;
    const fence = reply.indexOf('```', start);
    if (fence < 0) return null;
    const end = reply.indexOf('```', fence + 3);
    const body = reply.slice(
        reply.indexOf('\n', fence) + 1,
        end < 0 ? undefined : end,
    );
    const asks: string[] = [];
    for (const line of body.split('\n')) {
        if (/^\s*wispr adds\s*$/i.test(line)) break;
        const m = line.match(/^\s*\d+\.\s+(.+?)\s*$/);
        if (m?.[1]) asks.push(m[1]);
    }
    return asks;
}

const MECHANICAL =
    /\b(rename|bulk|replace|swap|date shift|reformat|codemod|find and replace|mechanical)\b/i;

// The fleet rules a subagent spawn may break, as one-line hints; heuristics on its words and length.
export function spawnHints(spawn: {
    subagentType: string;
    description: string;
    prompt: string;
}): string[] {
    const hints: string[] = [];
    if (
        spawn.subagentType !== 'chore-helper' &&
        MECHANICAL.test(`${spawn.description} ${spawn.prompt}`)
    )
        hints.push('a mechanical job belongs on chore-helper');
    if (spawn.subagentType === 'general-purpose' && spawn.prompt.length < 400)
        hints.push('a short brief is often one pass for this session itself');
    return hints;
}

// `<mode> <role emoji> <ticket> <role word>: <what>` — «☕️ 🔧 FRM-303 code: stash keep-hot»
export const FLEET_NAME = /^(☕️?|🎯)\s+\S+\s+[A-Z]{2,5}-\d+\s+[\w-]+:\s+\S/u;

type Word = { text: string; quoted: boolean };

// a heredoc body is data, never redirects; the rest of its opening line stays (`cat <<EOF > out`)
const HEREDOC =
    /<<-?[ \t]*(['"]?)(\w+)\1([^\n]*)\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/g;

// shell words, split into commands at ; && || | & and newlines; a quote keeps its text as one word
function commands(src: string): Word[][] {
    const out: Word[][] = [[]];
    let text = '';
    let quoted = false;
    let has = false;
    const push = () => {
        if (has) out[out.length - 1]?.push({ quoted, text });
        text = '';
        quoted = false;
        has = false;
    };
    for (let i = 0; i < src.length; i++) {
        const c = src[i] ?? '';
        if (c === "'" || c === '"') {
            const end = src.indexOf(c, i + 1);
            const stop = end < 0 ? src.length : end;
            text += src.slice(i + 1, stop);
            quoted = true;
            has = true;
            i = stop;
        } else if (c === '\\' && i + 1 < src.length) {
            text += src[++i];
            has = true;
        } else if (c === ' ' || c === '\t') push();
        else if (c === '&' && text.endsWith('>')) {
            text += c;
            has = true;
        } else if (c === '\n' || c === ';' || c === '|' || c === '&') {
            push();
            if (out[out.length - 1]?.length) out.push([]);
            if ((c === '&' || c === '|') && src[i + 1] === c) i++;
        } else {
            text += c;
            has = true;
        }
    }
    push();
    return out.filter((c) => c.length);
}

// the arguments that are not flags; a flag in `valued` eats the word after it
function positional(words: Word[], valued: string[]) {
    const out: Word[] = [];
    let flags = true;
    for (let i = 0; i < words.length; i++) {
        const w = words[i];
        if (!w) continue;
        if (flags && w.text === '--' && !w.quoted) flags = false;
        else if (flags && !w.quoted && /^-./.test(w.text)) {
            if (valued.includes(w.text)) i++;
        } else out.push(w);
    }
    return out;
}

// sed edits in place only with -i; macOS spells it `-i ''`, and -e or -f carries the script
function sedFiles(args: Word[]) {
    if (!args.some((a) => /^(-i|--in-place)/.test(a.text))) return [];
    const kept = args.filter(
        (a, i) => !(a.quoted && a.text === '' && args[i - 1]?.text === '-i'),
    );
    const scripted = kept.some((a) => /^-[ef]$/.test(a.text));
    const files = positional(kept, ['-e', '-f']);
    return (scripted ? files : files.slice(1)).map((w) => w.text);
}

// The files a Bash command writes, as written in it; a shape it cannot read yields nothing.
export function writeTargets(command: string): string[] {
    const targets: string[] = [];
    for (const m of command.matchAll(
        /open\(\s*['"]([^'"]+)['"]\s*,\s*['"][wax]/g,
    ))
        if (m[1]) targets.push(m[1]);
    const shell = command.replace(
        HEREDOC,
        (_m, _q, _tag, rest: string) => rest,
    );
    for (const words of commands(shell)) {
        const args: Word[] = [];
        for (let i = 0; i < words.length; i++) {
            const w = words[i];
            if (!w) continue;
            const redirect = w.quoted ? null : w.text.match(/^\d*>>?(.*)$/);
            if (!redirect) {
                args.push(w);
                continue;
            }
            const target = redirect[1] || words[++i]?.text;
            if (target && !target.startsWith('&')) targets.push(target);
        }
        while (args[0] && !args[0].quoted && /^\w+=/.test(args[0].text))
            args.shift();
        const [cmd, ...rest] = args;
        if (cmd?.text === 'tee')
            targets.push(...positional(rest, []).map((w) => w.text));
        if (cmd?.text === 'sd')
            targets.push(
                ...positional(rest, [
                    '-f',
                    '--flags',
                    '-n',
                    '--max-replacements',
                ])
                    .slice(2)
                    .map((w) => w.text),
            );
        if (cmd?.text === 'sed') targets.push(...sedFiles(rest));
    }
    return [
        ...new Set(
            targets.filter((t) => t && t !== '/dev/null' && !t.includes('$')),
        ),
    ];
}
