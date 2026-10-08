// the commit hook runs the suite with GIT_DIR, GIT_INDEX_FILE and friends set for frame: a git a test spawns with them
// works on frame, not its fixture — one `git init` set core.bare=true in frame and git refused every command for ~3 min (2026-10-08)
export function gitEnv(): NodeJS.ProcessEnv {
    return {
        ...Object.fromEntries(
            Object.entries(process.env).filter(
                ([key]) => !key.startsWith('GIT_'),
            ),
        ),
        GIT_AUTHOR_EMAIL: 'fixture@example.com',
        GIT_AUTHOR_NAME: 'fixture',
        GIT_COMMITTER_EMAIL: 'fixture@example.com',
        GIT_COMMITTER_NAME: 'fixture',
        GIT_CONFIG_GLOBAL: '/dev/null',
    };
}

const CALL = /\b(spawnSync|spawn|execFileSync|execFile|execSync|exec)\(/g;
const IMPORTS_GIT_ENV =
    /import\s*\{[^}]*\bgitEnv\b[^}]*\}\s*from\s*['"][^'"]*\/git-fixture\.ts['"]/;

// a call's argument text up to its closing paren; a paren inside a string never closes it
function argsFrom(source: string, open: number) {
    let depth = 1;
    let quote = '';
    for (let i = open; i < source.length; i++) {
        const ch = source[i];
        if (quote) {
            if (ch === '\\') i++;
            else if (ch === quote) quote = '';
        } else if (ch === "'" || ch === '"' || ch === '`') quote = ch;
        else if (ch === '(') depth++;
        else if (ch === ')' && --depth === 0) return source.slice(open, i);
    }
    return source.slice(open);
}

// git as the binary, or inside a shell string: `execSync('cd x && git init')`, `spawnSync('sh', ['-c', 'git init'])`
function runsGit(callee: string, args: string) {
    if (/^\s*['"`]git['"`]/.test(args)) return true;
    const isShell =
        callee === 'exec' ||
        callee === 'execSync' ||
        /^\s*['"`](?:ba|z)?sh['"`]/.test(args);
    return isShell && /['"`][^'"`]*\bgit\s/.test(args);
}

// `env: gitEnv()`, or an env naming a binding the file made from gitEnv() — `{ env }`, `{ env: fixtureEnv }`
function passesGitEnv(args: string, bound: Set<string>) {
    if (/\benv\s*:\s*gitEnv\(\)/.test(args)) return true;
    const named = args.match(/\benv\s*:\s*(\w+)\s*[,}\n]/)?.[1];
    if (named) return bound.has(named);
    return /\benv\s*[,}\n]/.test(args) && bound.has('env');
}

// the lint: the 1-based line of every git call that does not pass gitEnv's env
export function bareGitSpawns(source: string) {
    const isImported = IMPORTS_GIT_ENV.test(source);
    const bound = new Set(
        [...source.matchAll(/\b(?:const|let)\s+(\w+)\s*=\s*gitEnv\(\)/g)].map(
            (m) => m[1] ?? '',
        ),
    );
    const lines: number[] = [];
    for (const m of source.matchAll(CALL)) {
        const args = argsFrom(source, m.index + m[0].length);
        if (!runsGit(m[1] ?? '', args)) continue;
        if (isImported && passesGitEnv(args, bound)) continue;
        lines.push(source.slice(0, m.index).split('\n').length);
    }
    return lines;
}
