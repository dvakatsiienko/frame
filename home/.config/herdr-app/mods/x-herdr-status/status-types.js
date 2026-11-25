// the types the status bar's modules share: what herdr hands a view, a repo, a PR, a usage window

/** @typedef {import('gpui-kit').Context} Context */
/** @typedef {import('gpui-kit').AsyncContext} AsyncContext */
/** @typedef {import('gpui-kit').Color} Color */
/** @typedef {Record<'accent' | 'ansi5' | 'background' | 'blocked' | 'border' | 'chrome' | 'dim' | 'foreground' | 'hover' | 'input' | 'muted' | 'popover', Color>} Theme */
/** @typedef {import('herdr').ExecResult} ExecResult */
/** @typedef {import('herdr').PaneInfo} PaneInfo */
/** @typedef {import('herdr').SpaceInfo} SpaceInfo */
/** @typedef {{ ahead: number, behind: number, branch: string | null, dirty: number, oid: string | null, upstream: string | null }} GitInfo */
/** @typedef {{ url: string, number: number, state: string, isDraft: boolean, title: string, head?: string }} Pr */
/** @typedef {{ pr: Pr | null, error?: string, at?: number }} PrEntry */
/** @typedef {{ x: number, y: number }} Anchor */
/** @typedef {{ dirs: string[], prs?: Record<string, PrEntry>, status?: Record<string, GitInfo | null> }} RepoSet */
/** @typedef {{ current: boolean, name: string, when: string }} Branch */
/** @typedef {{ agentsHere: number, branches: Branch[], dirty: number, root: string }} BranchInfo */
/** @typedef {{ key: string, name: string, pct: number, reset: boolean, resets: number | null, short: string | null, spend: string | null }} UsageWindow */
/** @typedef {{ at?: number, rate_limits?: Record<string, { used_percentage?: number, resets_at?: number | string, used_usd?: number, limit_usd?: number, period?: string }> }} Usage */
/** @typedef {{ folder: string, branch: string | null, oid: string | null | undefined }} PrQuery */
/** @typedef {Omit<Extract<Forge, { kind: 'azure' }>, 'kind'> & { key: string, branch: string }} AzureQuery */
/** @typedef {{ kind: 'azure', host: string, org?: string, project?: string, repo?: string, user?: string } | { kind: 'github' }} Forge */

export {};
