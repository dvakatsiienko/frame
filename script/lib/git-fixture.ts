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

const SPAWNS_GIT =
    /\b(?:spawnSync|spawn|execFileSync|execFile|execSync|exec)\(\s*['"`]git\b/;
const IMPORTS_GIT_ENV =
    /import\s*\{[^}]*\bgitEnv\b[^}]*\}\s*from\s*['"][^'"]*\/git-fixture\.ts['"]/;

// the lint: a test source that spawns git and never imports gitEnv
export function spawnsGitBare(source: string) {
    return SPAWNS_GIT.test(source) && !IMPORTS_GIT_ENV.test(source);
}
