// a small reading of a shell command: enough to name each simple command, its words and what joins them.
// quoted text and comments are never read as commands; a `$( … )`, a `$(( … ))` or a backtick pair is read as a command of its
// own, and a heredoc's body is kept on its segment for the walker to read when a shell consumes it.

// at: the word's offset in the command, kept only for a bare word — plain characters, no quote, escape or expansion
// hasQuote: some of the word sat in quotes or behind a backslash, so the shell neither splits nor globs that part
// isFilled: the walker wrote it from a variable's value or a printed substitution, never typed
export type Word = {
    text: string;
    isExpanding: boolean;
    at?: number;
    hasQuote?: boolean;
    isFilled?: boolean;
};
export type Sep = ';' | '&&' | '||' | '|' | '&' | '(' | ')';
// subst: the commands inside this command's `$( … )` and backticks; bodies: its heredocs' text, in order
export type Segment = {
    words: Word[];
    sep: Sep;
    subst: Segment[];
    bodies: { text: string }[];
};
export type Parsed = {
    segments: Segment[];
    comments: string[];
    unbraced: string[];
};

type Frame = {
    kind: 'dq' | 'subst' | 'group' | 'tick';
    words: Word[];
    subst: Segment[];
    bodies: { text: string }[];
    text: string;
    isWord: boolean;
    isExpanding: boolean;
    isBare: boolean;
    hasQuote: boolean;
    at: number;
    from: number;
};

// a `$` the shell expands: a name, a digit, `{`, `(` or a special parameter
const EXPANDS = /[A-Za-z0-9_{(@*#?!$-]/;
const NAME = /[A-Za-z_][A-Za-z0-9_]*/y;
const ANSI_LETTERS: Record<string, string> = {
    E: '\x1b',
    a: '\x07',
    b: '\b',
    e: '\x1b',
    f: '\f',
    n: '\n',
    r: '\r',
    t: '\t',
    v: '\v',
};
const ANSI_CODES = [
    [/^[0-7]{1,3}/, 8, 0],
    [/^x([0-9A-Fa-f]{1,2})/, 16, 1],
    [/^u([0-9A-Fa-f]{1,4})/, 16, 1],
    [/^U([0-9A-Fa-f]{1,8})/, 16, 1],
] as const;
// the text one `$'…'` escape after its backslash stands for, and the chars it used: bash's whole set, so `$'\x64ima'` is dima
function ansiEscape(command: string, at: number): [string, number] {
    const rest = command.slice(at, at + 9);
    for (const [shape, base, skip] of ANSI_CODES) {
        const m = rest.match(shape);
        if (m)
            return [
                String.fromCodePoint(
                    Number.parseInt(m[0].slice(skip), base) % 0x110000,
                ),
                m[0].length,
            ];
    }
    const esc = rest[0] ?? '';
    if (esc === 'c' && rest[1])
        return [
            String.fromCharCode(
                (rest[1].toUpperCase().charCodeAt(0) ?? 0) & 31,
            ),
            2,
        ];
    return [ANSI_LETTERS[esc] ?? esc, esc ? 1 : 0];
}

export function parse(command: string): Parsed {
    const segments: Segment[] = [];
    const comments: string[] = [];
    const unbraced: string[] = [];
    const stack: Frame[] = [];
    let words: Word[] = [];
    let subst: Segment[] = [];
    let bodies: { text: string }[] = [];
    // into: the substitutions of the command that owns an unquoted heredoc, where its body's `$( … )` and backticks join
    const pending: {
        delimiter: string;
        body: { text: string };
        into?: Segment[];
    }[] = [];
    let text = '';
    let isWord = false;
    let isExpanding = false;
    let isQuoted = false;
    let isBare = false;
    let hasQuote = false;
    let at = 0;
    let i = 0;

    const endWord = () => {
        if (isWord)
            words.push({
                isExpanding,
                text,
                ...(isBare && { at }),
                ...(hasQuote && { hasQuote }),
            });
        text = '';
        isWord = false;
        isExpanding = false;
        isBare = false;
        hasQuote = false;
    };
    const endSegment = (sep: Sep) => {
        endWord();
        if (words.length) segments.push({ bodies, sep, subst, words });
        else {
            // `(a) | b`: the pipe joins the group's last command to what follows
            const last = segments.at(-1);
            if (last?.sep === ')' && sep !== ')') last.sep = sep;
        }
        words = [];
        subst = [];
        bodies = [];
    };
    // plain: one literal character read as itself; anything else ends the word's bareness
    const add = (s: string, isPlain = false) => {
        if (!isWord) at = i;
        isBare = isPlain && (isBare || !isWord);
        text += s;
        isWord = true;
    };
    const open = (kind: Frame['kind']) => {
        stack.push({
            at,
            bodies,
            from: segments.length,
            hasQuote,
            isBare,
            isExpanding,
            isWord,
            kind,
            subst,
            text,
            words,
        });
        words = [];
        subst = [];
        bodies = [];
        text = '';
        isWord = false;
        isExpanding = false;
        isQuoted = false;
    };
    // the inner commands end; the outer one goes on where it stopped, the substitution standing in its word
    const close = () => {
        endSegment(')');
        const frame = stack.pop();
        if (!frame) return;
        const inner = segments.slice(frame.from);
        ({ words, text, isWord, isExpanding, isBare, at, hasQuote, bodies } =
            frame);
        subst = [...frame.subst, ...inner];
        // `f()` ends the name: the `{` after it opens the body, a word of its own
        if (frame.kind === 'group') {
            if (!inner.length) endWord();
            return;
        }
        add('$(…)');
        isExpanding = true;
    };
    // a substitution that sat inside double quotes resumes them
    const resume = () => {
        if (stack.at(-1)?.kind !== 'dq') return;
        stack.pop();
        isQuoted = true;
    };
    // a quote around a substitution is a marker frame: closing the substitution resumes the quote
    const quoted = (kind: Frame['kind']) => {
        if (isQuoted)
            stack.push({
                at: 0,
                bodies: [],
                from: segments.length,
                hasQuote: false,
                isBare: false,
                isExpanding: false,
                isWord: false,
                kind: 'dq',
                subst: [],
                text: '',
                words: [],
            });
        open(kind);
    };
    const dollar = () => {
        const next = command[i + 1] ?? '';
        if (EXPANDS.test(next)) isExpanding = true;
        // `$(( … ))` with no command inside is arithmetic, kept as one word (its `<<` is a shift, no heredoc); one holding a
        // `$( … )` or a backtick is read as a substitution holding a group, and a `$((` with no `))` is bash's subshell
        if (next === '(' && command[i + 2] === '(') {
            const end = command.indexOf('))', i + 3);
            const inner = end < 0 ? '' : command.slice(i + 3, end);
            if (end >= 0 && !/\$\(|`/.test(inner)) {
                add(command.slice(i, end + 2));
                i = end + 2;
                return;
            }
        }
        if (next === '(') {
            i += 2;
            quoted('subst');
            return;
        }
        // ansi-c quoting: `$'rm'` is the word rm
        if (next === "'") {
            let j = i + 2;
            let out = '';
            while (j < command.length && command[j] !== "'") {
                const ch = command[j] ?? '';
                if (ch === '\\') {
                    const [text, used] = ansiEscape(command, j + 1);
                    out += text;
                    j += 1 + used;
                } else {
                    out += ch;
                    j++;
                }
            }
            add(out);
            hasQuote = true;
            i = j + 1;
            return;
        }
        NAME.lastIndex = i + 1;
        const name = NAME.exec(command)?.[0];
        if (!name) {
            add('$');
            i++;
            return;
        }
        // zsh reads `$name:x` as a modifier when x is a letter; bash reads a non-ascii character as part of the name
        const after = command[i + 1 + name.length] ?? '';
        const modifier = command[i + 2 + name.length] ?? '';
        if (
            (after === ':' && /[A-Za-z]/.test(modifier)) ||
            after.charCodeAt(0) > 127
        )
            unbraced.push(`$${name}${after}`);
        add(`$${name}`);
        i += name.length + 1;
    };
    const skipHeredocs = () => {
        while (pending.length) {
            const { delimiter, body, into } = pending.shift() ?? {
                body: { text: '' },
                delimiter: '',
            };
            const lines: string[] = [];
            while (i < command.length) {
                const end = command.indexOf('\n', i);
                const line = command.slice(i, end < 0 ? undefined : end);
                i = end < 0 ? command.length : end + 1;
                if (line.trim() === delimiter) break;
                lines.push(line);
            }
            body.text = lines.join('\n');
            // an unquoted body expands as a double-quoted string does, so its substitutions run as it is read: commands of
            // the line, and feeders of the command that owns the heredoc; the last segment is the string itself
            if (into) {
                const inner = parse(
                    `"${body.text.replace(/"/g, '\\"')}"`,
                ).segments;
                segments.push(...inner.slice(0, -1));
                into.push(...inner.flatMap((s) => s.subst));
            }
        }
    };
    const heredoc = () => {
        endWord();
        i += 2;
        if (command[i] === '-') i++;
        while (command[i] === ' ' || command[i] === '\t') i++;
        // the delimiter is one word with its quotes removed, as bash reads it: `<<E"F"` and `<<"E"F` both end at EF
        let delimiter = '';
        let isQuotedEnd = false;
        while (i < command.length && !/[\s;&|<>()]/.test(command[i] ?? '')) {
            const ch = command[i] ?? '';
            if (ch === "'" || ch === '"' || ch === '\\') isQuotedEnd = true;
            if (ch === "'" || ch === '"') {
                const end = command.indexOf(ch, i + 1);
                delimiter += command.slice(i + 1, end < 0 ? undefined : end);
                i = end < 0 ? command.length : end + 1;
            } else if (ch === '\\') {
                delimiter += command[i + 1] ?? '';
                i += 2;
            } else {
                delimiter += ch;
                i++;
            }
        }
        if (delimiter) {
            const body = { text: '' };
            pending.push({
                body,
                delimiter,
                ...(!isQuotedEnd && { into: subst }),
            });
            bodies.push(body);
        }
    };

    while (i < command.length) {
        const c = command[i] ?? '';
        const next = command[i + 1] ?? '';
        if (isQuoted) {
            if (c === '"') {
                isQuoted = false;
                i++;
            } else if (c === '\\') {
                add(next);
                i += 2;
            } else if (c === '$') dollar();
            else if (c === '`') {
                i++;
                quoted('tick');
            } else {
                add(c);
                i++;
            }
        } else if (c === '\n') {
            i++;
            endSegment(';');
            skipHeredocs();
        } else if (c === ' ' || c === '\t') {
            endWord();
            i++;
        } else if (c === '#' && !isWord) {
            const end = command.indexOf('\n', i);
            comments.push(command.slice(i + 1, end < 0 ? undefined : end));
            i = end < 0 ? command.length : end;
        } else if (c === '\\') {
            add(next === '\n' ? '' : next);
            hasQuote = true;
            i += 2;
        } else if (c === "'") {
            const end = command.indexOf("'", i + 1);
            add(command.slice(i + 1, end < 0 ? undefined : end));
            hasQuote = true;
            i = end < 0 ? command.length : end + 1;
        } else if (c === '"') {
            isWord = true;
            isBare = false;
            hasQuote = true;
            isQuoted = true;
            i++;
        } else if (c === '$') {
            dollar();
        } else if (c === '`') {
            i++;
            if (stack.at(-1)?.kind === 'tick') {
                close();
                resume();
            } else open('tick');
        } else if (c === '(') {
            i++;
            open('group');
        } else if (c === ')') {
            i++;
            close();
            resume();
        } else if (c === ';') {
            i += next === ';' ? 2 : 1;
            endSegment(';');
        } else if (c === '&') {
            if (next === '&') {
                i += 2;
                endSegment('&&');
            } else if (next === '>' || /[<>]$/.test(text)) {
                add('&');
                i++;
            } else {
                i++;
                endSegment('&');
            }
        } else if (c === '|' && /^\d*&?>$/.test(text)) {
            // `>|` truncates its target like `>`
            add('|');
            i++;
        } else if (c === '|') {
            if (next === '|') {
                i += 2;
                endSegment('||');
            } else {
                i += next === '&' ? 2 : 1;
                endSegment('|');
            }
        } else if (c === '<' && next === '<' && command[i + 2] === '<') {
            // a herestring: `<<<` is a word of its own, its string the next
            endWord();
            add('<<<');
            endWord();
            i += 3;
        } else if (c === '<' && next === '<' && command[i + 2] !== '<') {
            heredoc();
        } else {
            add(c, true);
            i++;
        }
    }
    while (stack.length)
        if (stack.at(-1)?.kind === 'dq') stack.pop();
        else close();
    endSegment(';');
    return { comments, segments, unbraced };
}
