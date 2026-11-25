// git and the forges, pure of the view: a repo's status, its sync, its branches, the PR of a branch

import os from 'os';
import { appHome, exec, panes } from 'herdr';

/** @typedef {import('./status-types.js').ExecResult} ExecResult */
/** @typedef {import('./status-types.js').PaneInfo} PaneInfo */
/** @typedef {import('./status-types.js').GitInfo} GitInfo */
/** @typedef {import('./status-types.js').PrEntry} PrEntry */
/** @typedef {import('./status-types.js').BranchInfo} BranchInfo */
/** @typedef {import('./status-types.js').PrQuery} PrQuery */
/** @typedef {import('./status-types.js').AzureQuery} AzureQuery */
/** @typedef {import('./status-types.js').Forge} Forge */

export const WIN = /^win/.test(os.platform()); // "windows" here, not node's "win32"

// A path with "." and ".." resolved, its slashes as the bar shows them.
/** @param {string} p */
function resolvePath(p) {
    const parts = [];
    for (const s of String(p).split(/[\\/]+/)) {
        if (s === '..') parts.pop();
        else if (s && s !== '.') parts.push(s);
    }
    return WIN ? parts.join('\\') : '/' + parts.join('/');
}
/** @param {string} p */
const pathKey = (p) => resolvePath(p).toLowerCase();
/** @param {string} child @param {string} parent */
const inside = (child, parent) => {
    const c = pathKey(child),
        p = pathKey(parent);
    return c === p || c.startsWith(p + (WIN ? '\\' : '/'));
};
/** @param {string} p */
export const baseName = (p) =>
    /** @type {string} */ (resolvePath(p).split(/[\\/]/).pop());

// One repo's branch, upstream, ahead/behind and changed files, from one `git status` (the call
// Herdr's `spaces` list makes). core.filemode off: a repo cloned in a Linux container has it on,
// and from Windows every file then looks changed (684 files in one repo, 2026-11-03).
/** @param {string} folder @returns {Promise<GitInfo | null>} */
export async function gitStatus(folder) {
    try {
        const r = await exec(
            'git',
            [
                '--no-optional-locks',
                '-c',
                'core.fsmonitor=false',
                '-c',
                'core.filemode=false',
                'status',
                '--porcelain=v2',
                '--branch',
            ],
            { cwd: folder },
        );
        if (r.code) return null;
        /** @type {GitInfo} */
        const info = {
            ahead: 0,
            behind: 0,
            branch: null,
            dirty: 0,
            oid: null,
            upstream: null,
        };
        for (const line of r.stdout.split('\n')) {
            if (line.startsWith('# branch.head '))
                info.branch = line.slice(14).trim();
            else if (line.startsWith('# branch.oid '))
                info.oid = line.slice(13).trim();
            else if (line.startsWith('# branch.upstream '))
                info.upstream = line.slice(18).trim();
            else if (line.startsWith('# branch.ab ')) {
                const [a, b] = line.slice(12).trim().split(' ');
                info.ahead =
                    Math.abs(parseInt(/** @type {string} */ (a), 10)) || 0;
                info.behind =
                    Math.abs(parseInt(/** @type {string} */ (b), 10)) || 0;
            } else if (line.trim() && !line.startsWith('#')) info.dirty++;
        }
        return info;
    } catch {
        return null;
    } // no git
}

// Fetch, then pull --ff-only when there's an upstream. Anything git refuses (diverged, changes in
// the way) comes back as the note; the terminal is where that gets sorted.
/** @param {string} folder */
export async function syncRepo(folder) {
    /** @param {...string} args */
    const git = (...args) =>
        exec('git', args, { cwd: folder }).catch(
            (/** @type {unknown} */ e) => ({
                code: 1,
                stderr: String(e),
                stdout: '',
            }),
        );
    /** @param {ExecResult} r */
    const tail = (r) =>
        (r.stderr || r.stdout).trim().split('\n').slice(-3).join('\n');
    const repo = baseName(folder);
    const before = (await git('rev-parse', 'HEAD')).stdout.trim();
    const fetched = await git('fetch', '--prune');
    if (fetched.code)
        return {
            body: tail(fetched) || repo,
            ok: false,
            title: "Couldn't fetch",
        };
    const upstream = await git('rev-parse', '--abbrev-ref', '@{u}');
    if (upstream.code)
        return {
            body: `${repo}: no upstream branch to pull from`,
            ok: true,
            title: 'Fetched',
        };
    const pulled = await git('pull', '--ff-only');
    if (pulled.code)
        return {
            body: tail(pulled),
            ok: false,
            title: "Couldn't pull",
        };
    const after = (await git('rev-parse', 'HEAD')).stdout.trim();
    const n =
        before === after
            ? 0
            : parseInt(
                  (await git('rev-list', '--count', `${before}..${after}`))
                      .stdout,
                  10,
              ) || 0;
    return {
        body: `${repo} · ${upstream.stdout.trim()}`,
        ok: true,
        title: n ? `Pulled ${n} commit${n === 1 ? '' : 's'}` : 'Up to date',
    };
}

// Where a repo's PRs live, from its origin's URL (read once per folder).
/** @type {Map<string, string>} */
const origins = new Map();
/** @param {string} folder @returns {Promise<Forge | null>} */
async function forgeOf(folder) {
    if (!origins.has(folder)) {
        const r = await exec('git', ['remote', 'get-url', 'origin'], {
            cwd: folder,
        }).catch(() => /** @type {ExecResult} */ ({ code: 1 }));
        origins.set(folder, r.code ? '' : r.stdout.trim());
    }
    const url = /** @type {string} */ (origins.get(folder));
    let m =
        /^https:\/\/(?:([^@/]+)@)?dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/([^/?#]+)/i.exec(
            url,
        );
    if (m)
        return {
            host: 'dev.azure.com',
            kind: 'azure',
            org: m[2],
            project: m[3],
            repo: m[4],
            user: m[1] ?? m[2],
        };
    m =
        /^https:\/\/(?:([^@/]+)@)?([^./]+)\.visualstudio\.com\/(?:DefaultCollection\/)?([^/]+)\/_git\/([^/?#]+)/i.exec(
            url,
        );
    if (m)
        return {
            host: `${m[2]}.visualstudio.com`,
            kind: 'azure',
            org: m[2],
            project: m[3],
            repo: m[4],
            user: m[1] ?? '',
        };
    m =
        /^(?:ssh:\/\/)?git@ssh\.dev\.azure\.com:(?:22\/)?v3\/([^/]+)\/([^/]+)\/([^/]+?)$/i.exec(
            url,
        );
    if (m)
        return {
            host: 'dev.azure.com',
            kind: 'azure',
            org: m[1],
            project: m[2],
            repo: m[3],
            user: m[1],
        };
    if (/github\.com[:/]/i.test(url)) return { kind: 'github' };
    return null;
}

// The PR of each { folder, branch, oid }: { "<folder>|<branch>": { pr, error? } }, pr as gh gives
// it ({ url, number, state: OPEN|MERGED|CLOSED, isDraft, title, head }) or null. GitHub: `gh pr
// view` (needs gh signed in). Azure DevOps: one PowerShell call for all of them (~2 s).
// A merged or closed PR counts only while the branch is still at its last commit: a long-lived
// branch (main, a shared lane) otherwise shows some old PR that once came from it.
/** @param {PrQuery[]} list @returns {Promise<Record<string, PrEntry>>} */
export async function prsFor(list) {
    /** @type {Record<string, PrEntry>} */
    const out = {};
    /** @type {AzureQuery[]} */
    const azure = [];
    /** @type {Record<string, string | null | undefined>} */
    const oids = {};
    await Promise.all(
        list.map(async ({ folder, branch, oid }) => {
            oids[`${folder}|${branch}`] = oid;
            const key = `${folder}|${branch}`;
            out[key] = { pr: null };
            if (!branch || branch.startsWith('(')) return; // detached
            const forge = await forgeOf(folder);
            if (forge?.kind === 'azure') {
                const { kind, ...rest } = forge;
                azure.push({ key, ...rest, branch });
            } else if (forge?.kind === 'github') {
                try {
                    const r = await exec(
                        'gh',
                        [
                            'pr',
                            'view',
                            branch,
                            '--json',
                            'url,number,state,isDraft,title,headRefOid',
                        ],
                        { cwd: folder },
                    );
                    if (r.code === 0) {
                        const { headRefOid, ...pr } = JSON.parse(r.stdout);
                        /** @type {PrEntry} */ (out[key]).pr = {
                            ...pr,
                            head: headRefOid,
                        };
                    }
                } catch {} // no gh
            }
        }),
    );
    if (azure.length) {
        try {
            const b64 = btoa(
                unescape(encodeURIComponent(JSON.stringify(azure))),
            );
            const r = await exec(WIN ? 'powershell' : 'pwsh', [
                '-NoProfile',
                '-NonInteractive',
                '-ExecutionPolicy',
                'Bypass',
                '-File',
                `${appHome()}/mods/x-herdr-status/azure-prs.ps1`,
                b64,
            ]);
            for (const res of JSON.parse(r.stdout.trim() || '[]'))
                out[res.key] = { error: res.error, pr: res.pr ?? null };
        } catch (e) {
            for (const a of azure) {
                /** @type {NonNullable<(typeof out)[string]>} */ (
                    out[a.key]
                ).error = String(e);
            }
        }
    }
    for (const [key, res] of Object.entries(out)) {
        const pr = res.pr,
            oid = oids[key];
        if (pr && pr.state !== 'OPEN' && oid && pr.head && pr.head !== oid)
            res.pr = null;
    }
    return out;
}

// A repo's page: its top folder, local branches (most recent first), uncommitted changes and
// how many agents work in it. null when it isn't a repo.
/** @param {string} folder @returns {Promise<BranchInfo | null>} */
export async function branchInfo(folder) {
    /** @param {...string} args */
    const git = (...args) =>
        exec('git', args, { cwd: folder }).catch(() => ({
            code: 1,
            stderr: '',
            stdout: '',
        }));
    const [top, refs, status] = await Promise.all([
        git('rev-parse', '--show-toplevel'),
        git(
            'for-each-ref',
            '--sort=-committerdate',
            '--format=%(HEAD)|%(refname:short)|%(committerdate:relative)',
            'refs/heads',
        ),
        git('-c', 'core.filemode=false', 'status', '--porcelain'),
    ]);
    if (top.code) return null;
    const root = resolvePath(top.stdout.trim()); // git says C:/x; the bar's folders are C:\x
    const branches = refs.stdout
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((/** @type {string} */ l) => {
            const [head, name, when] = /** @type {[string, string, string]} */ (
                l.split('|')
            );
            return { current: head === '*', name, when };
        });
    const agentsHere = panes().filter(
        (/** @type {PaneInfo} */ p) => p.status && p.cwd && inside(p.cwd, root),
    ).length;
    const dirty = status.stdout.trim().split('\n').filter(Boolean).length;
    return { agentsHere, branches, dirty, root };
}
