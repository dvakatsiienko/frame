// a small reading of a shell command: enough to name each simple command, its words and what joins them.
// quoted text, heredoc bodies and comments are never read as commands; a `$( … )` or a backtick pair is read as a command of its own.

// at: the word's offset in the command, kept only for a bare word — plain characters, no quote, escape or expansion
export type Word = { text: string; isExpanding: boolean; at?: number };
export type Sep = ';' | '&&' | '||' | '|' | '&' | '(' | ')';
// subst: the commands inside this command's `$( … )` and backticks
export type Segment = { words: Word[]; sep: Sep; subst: Segment[] };
export type Parsed = {
    segments: Segment[];
    comments: string[];
    unbraced: string[];
};

type Frame = {
    kind: 'dq' | 'subst' | 'group' | 'tick';
    words: Word[];
    subst: Segment[];
    text: string;
    isWord: boolean;
    isExpanding: boolean;
    isBare: boolean;
    at: number;
    from: number;
};

// a `$` the shell expands: a name, a digit, `{`, `(` or a special parameter
const EXPANDS = /[A-Za-z0-9_{(@*#?!$-]/;
const NAME = /[A-Za-z_][A-Za-z0-9_]*/y;

export function parse(command: string): Parsed {
    const segments: Segment[] = [];
    const comments: string[] = [];
    const unbraced: string[] = [];
    const heredocs: string[] = [];
    const stack: Frame[] = [];
    let words: Word[] = [];
    let subst: Segment[] = [];
    let text = '';
    let isWord = false;
    let isExpanding = false;
    let isQuoted = false;
    let isBare = false;
    let at = 0;
    let i = 0;

    const endWord = () => {
        if (isWord)
            words.push(
                isBare ? { at, isExpanding, text } : { isExpanding, text },
            );
        text = '';
        isWord = false;
        isExpanding = false;
        isBare = false;
    };
    const endSegment = (sep: Sep) => {
        endWord();
        if (words.length) segments.push({ sep, subst, words });
        else {
            // `(a) | b`: the pipe joins the group's last command to what follows
            const last = segments.at(-1);
            if (last?.sep === ')' && sep !== ')') last.sep = sep;
        }
        words = [];
        subst = [];
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
            from: segments.length,
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
        ({ words, text, isWord, isExpanding, isBare, at } = frame);
        subst = [...frame.subst, ...inner];
        if (frame.kind === 'group') return;
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
                from: segments.length,
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
        if (next === '(' && command[i + 2] === '(') {
            // arithmetic: no command and no heredoc inside
            const end = command.indexOf('))', i + 3);
            add(command.slice(i, end < 0 ? undefined : end + 2));
            i = end < 0 ? command.length : end + 2;
            return;
        }
        if (next === '(') {
            i += 2;
            quoted('subst');
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
        while (heredocs.length) {
            const delimiter = heredocs.shift();
            while (i < command.length) {
                const end = command.indexOf('\n', i);
                const line = command.slice(i, end < 0 ? undefined : end);
                i = end < 0 ? command.length : end + 1;
                if (line.trim() === delimiter) break;
            }
        }
    };
    const heredoc = () => {
        endWord();
        i += 2;
        if (command[i] === '-') i++;
        while (command[i] === ' ' || command[i] === '\t') i++;
        const quote = command[i];
        let delimiter = '';
        if (quote === "'" || quote === '"') {
            const end = command.indexOf(quote, i + 1);
            delimiter = command.slice(i + 1, end < 0 ? undefined : end);
            i = end < 0 ? command.length : end + 1;
        } else {
            while (
                i < command.length &&
                !/[\s;&|<>()]/.test(command[i] ?? '')
            ) {
                delimiter += command[i] === '\\' ? '' : command[i];
                i++;
            }
        }
        if (delimiter) heredocs.push(delimiter);
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
            i += 2;
        } else if (c === "'") {
            const end = command.indexOf("'", i + 1);
            add(command.slice(i + 1, end < 0 ? undefined : end));
            i = end < 0 ? command.length : end + 1;
        } else if (c === '"') {
            isWord = true;
            isBare = false;
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
        } else if (c === '|') {
            if (next === '|') {
                i += 2;
                endSegment('||');
            } else {
                i += next === '&' ? 2 : 1;
                endSegment('|');
            }
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
