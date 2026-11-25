import os from 'os';
import { InputState, h_flex } from 'gpui-base';
import { View, div, svg } from 'gpui-kit';
import {
    exec,
    focused,
    notify,
    panes,
    props,
    run,
    spaces,
    theme,
    window,
} from 'herdr';

import { takeCommands } from './commands.js';
import { WIN, gitStatus, prsFor, syncRepo } from './git.js';
import { createRepoPage } from './repo-page.js';
import { ago, createUsageView, resetText, usageWindows } from './usage.js';

/** @typedef {import('./status-types.js').Context} Context */
/** @typedef {import('./status-types.js').AsyncContext} AsyncContext */
/** @typedef {import('./status-types.js').Theme} Theme */
/** @typedef {import('./status-types.js').ExecResult} ExecResult */
/** @typedef {import('./status-types.js').PaneInfo} PaneInfo */
/** @typedef {import('./status-types.js').SpaceInfo} SpaceInfo */
/** @typedef {import('./status-types.js').GitInfo} GitInfo */
/** @typedef {import('./status-types.js').Pr} Pr */
/** @typedef {import('./status-types.js').PrEntry} PrEntry */
/** @typedef {import('./status-types.js').UsageWindow} UsageWindow */
/** @typedef {import('./status-types.js').Usage} Usage */

// x-herdr-status: the status bar, a clone of Herdr's workspace-status (0.1.10); changes: no agents count (the agents
// list shows them; the "N sub-agents working" item went too, 2026-11-05: the chat's chips show them).
// Also: "Folder" and "VS Code" open the focused terminal's folder (else the space's), on this
// computer only (`open`).
// The branch name opens a list of the repo's branches to `git switch` to; "PR #N" opens its PR.
// The branch itself is read with git every 3 s (`readGit`): Herdr's own pane/space `branch` kept
// the old name after a `git switch` typed in the terminal (0.1.11). "Sync" = fetch, then pull --ff-only.
// PRs: GitHub through gh, Azure DevOps through its REST API (azure-prs.ps1, git's stored credential).

/** @param {string} folder @param {'code' | 'folder'} what */
function openFolder(folder, what) {
    const [cmd, args] =
        what === 'code'
            ? WIN
                ? ['cmd', ['/c', 'code', folder]]
                : ['code', [folder]] // code is code.cmd on Windows
            : // Not explorer itself: exec starts programs hidden, and so is the window explorer opens.
              WIN
              ? ['cmd', ['/c', 'start', '', folder.replace(/\//g, '\\')]]
              : [os.platform() === 'darwin' ? 'open' : 'xdg-open', [folder]];
    exec(cmd, args).then(
        (/** @type {ExecResult} */ r) => {
            if (what === 'code' && r.code)
                notify({
                    body:
                        (r.stderr || r.stdout).trim() ||
                        'Is `code` on the PATH?',
                    level: 'error',
                    title: "Couldn't open VS Code",
                });
        },
        (/** @type {unknown} */ e) =>
            notify({
                body: String(e),
                level: 'error',
                title: `Couldn't run ${cmd}`,
            }),
    );
}

export default class WorkspaceStatus extends View {
    page = createRepoPage({
        git: () => this.git,
        newBox: () => this.newBox,
        prs: () => this.prs,
        setPrs: (prs) => {
            this.prs = prs;
        },
        sync: (folder, cx, after) => this.sync(folder, cx, after),
        syncing: () => this.syncing,
    });
    /** @type {Usage | null} */
    usage = null;
    usageView = createUsageView({
        setUsage: (usage) => {
            this.usage = usage;
        },
        usage: () => this.usage,
    });
    /** @param {unknown} _props @param {Context} cx */
    init(_props, cx) {
        /** @type {Record<string, PrEntry>} */
        this.prs = {}; // "<folder>|<branch>" → { pr, error?, at }
        /** @type {Set<string>} */
        this.syncing = new Set(); // folders being synced
        const p = props() ?? {};
        if (p.repo) {
            // "+ New branch": a name box (shown on click), Enter = `git switch -c <name>` from the current branch.
            /** @type {InputState} */
            this.newBox = InputState.new({
                placeholder: 'New branch name, Enter to create',
            });
            this.newBox.on('submit', (_e, cx) => this.page.createBranch(cx));
            return this.page.initRepos(
                { dirs: [p.repo.dir], prs: p.repo.prs, status: p.repo.status },
                cx,
            );
        }
        if (p.usage) return this.usageView.initUsage(cx, false);
        this.usageView.initUsage(cx, true);
        // x-herdr keys (FRM-577) land here: the status bar is always placed, while the chat sits behind the Terminal
        // view half the time, and herdr calls a command of a mod that is not drawn «unknown»
        cx.spawn(takeCommands);
        /** @type {Record<string, GitInfo | null>} */
        this.git = {}; // folder -> { branch, upstream, ahead, behind, dirty } | null (not a repo)
        cx.timer.every(3000, (cx) => {
            this.readGit(cx);
            this.lookup(cx);
        });
    }

    // The bar's folder, read with git. Only redraws when something changed.
    /** @param {Context} cx */
    readGit(cx) {
        const folder = this.folder;
        if (!folder || this.reading) return;
        this.reading = true;
        cx.spawn(async (cx) => {
            const info = await gitStatus(folder);
            this.reading = false;
            if (
                JSON.stringify(this.git[folder] ?? null) !==
                JSON.stringify(info)
            ) {
                this.git[folder] = info;
                cx.notify();
            }
        });
    }

    // Sync one repo, its result as a toast.
    /** @param {string} folder @param {Context} cx @param {(cx: AsyncContext) => void} [after] */
    sync(folder, cx, after) {
        if (this.syncing.has(folder)) return;
        this.syncing.add(folder);
        cx.notify();
        cx.spawn(async (cx) => {
            const r = await syncRepo(folder);
            this.syncing.delete(folder);
            notify({
                body: r.body,
                level: r.ok
                    ? r.title === 'Fetched'
                        ? 'info'
                        : 'success'
                    : 'error',
                title: r.title,
                ...(r.ok ? { timeout: 4000 } : {}),
            });
            after?.(cx);
            cx.notify();
        });
    }

    /** @param {Context} cx */
    lookup(cx) {
        const key = this.key;
        if (
            !key ||
            !((key.split('|')[0] ?? '') in this.git) ||
            this.busy ||
            Date.now() - (this.prs[key]?.at ?? 0) < 60000
        )
            return;
        this.busy = true;
        cx.spawn(async (cx) => {
            const [folder, branch] = /** @type {[string, string]} */ (
                key.split('|')
            );
            const got = /** @type {PrEntry} */ (
                (
                    await prsFor([
                        { branch, folder, oid: this.git[folder]?.oid },
                    ])
                )[key]
            );
            const changed =
                JSON.stringify(this.prs[key]?.pr ?? null) !==
                JSON.stringify(got.pr);
            this.prs[key] = { ...got, at: Date.now() };
            this.busy = false;
            if (changed) cx.notify();
        });
    }

    render() {
        const t = /** @type {Theme} */ (theme());
        if (props()?.repo) return this.page.repoPage(t);
        if (props()?.usage) return this.usageView.usagePopup(t);
        // Plan usage: "5h 17% · wk 37%" (click = the popup); amber from 90%.
        const uw = usageWindows(this.usage);
        const usageText = uw.some((w) => w.short)
            ? uw
                  .filter((w) => w.short)
                  .map((w) => `${w.short} ${w.pct}%`)
                  .join(' · ')
            : uw.length
              ? `${/** @type {UsageWindow} */ (uw[0]).pct}%`
              : '';
        const usageTip = [
            ...uw.map(
                (w) =>
                    `${w.name}: ${w.pct}% used${w.resets ? ` · ${resetText(w).toLowerCase()}` : ''}`,
            ),
            this.usage?.at ? `Updated ${ago(this.usage.at)}` : null,
            'Click: details',
        ]
            .filter(Boolean)
            .join('\n');
        const space = spaces().find((/** @type {SpaceInfo} */ s) => s.active);
        /** @param {string} icon @param {string} text */
        const label = (icon, text) =>
            h_flex()
                .gap(6)
                .items_center()
                .child(svg(`mods/workspace-chrome/${icon}.svg`).size(13))
                .child(text);
        const folder =
            space && !space.machine ? focused()?.cwd || space.folder : '';
        /** @param {string} id @param {string} icon @param {string} text @param {'code' | 'folder'} what */
        const button = (id, icon, text, what) =>
            label(icon, text)
                .id(id)
                .cursor_pointer()
                .hover((s) => s.text_color(t.foreground))
                .tooltip(
                    `${what === 'code' ? 'Open in VS Code' : 'Open in Explorer'}: ${folder}`,
                )
                .on_click(() => openFolder(folder, what));
        const f = focused();
        const gitDir = folder;
        this.folder = gitDir; // what readGit reads on its next tick
        const g = gitDir ? this.git[gitDir] : null;
        // git's own answer first; Herdr's until it has been read (or on another machine).
        const branch =
            g?.branch ||
            (f?.pane &&
                panes().find((/** @type {PaneInfo} */ p) => p.pane === f.pane)
                    ?.branch) ||
            space?.branch;
        this.key = gitDir && branch ? `${gitDir}|${branch}` : null;
        const pr = /** @type {Pr} */ (this.key ? this.prs[this.key]?.pr : null);
        const prState = pr
            ? pr.isDraft
                ? 'draft'
                : pr.state.toLowerCase()
            : '';
        // One git item: the bar's repo, its branch and how far ahead/behind. Click = this repo's page.
        const counts = this.page.counts(g);
        const text = branch ? `${branch}${counts ? ` ${counts}` : ''}` : '';
        const tip = [
            g?.upstream
                ? `${g.upstream}${g.behind ? ` · ${g.behind} to pull` : ''}${g.ahead ? ` · ${g.ahead} to push` : ''}`
                : null,
            g?.dirty
                ? `${g.dirty} uncommitted change${g.dirty === 1 ? '' : 's'}`
                : null,
            'Click: sync, switch branch, new branch',
        ]
            .filter(Boolean)
            .join('\n');
        return (
            h_flex()
                .size_full()
                .px(14)
                .gap(16)
                .items_center()
                .bg(t.chrome)
                .border_t(1)
                .border_color(t.border)
                .text_size(11.8)
                .text_color(t.muted)
                .when(Boolean(text), (el) =>
                    el.child(
                        label(branch ? 'branch' : 'layers', text)
                            .id('git')
                            .when((g?.behind ?? 0) > 0, (s) =>
                                s.text_color(t.accent),
                            )
                            .when(Boolean(folder) && Boolean(g), (s) =>
                                s
                                    .cursor_pointer()
                                    .hover((s) => s.text_color(t.foreground))
                                    .tooltip(tip)
                                    // mouse down, not click: it carries where (the popup goes above the bar)
                                    .on_mouse_down('left', (e, cx) => {
                                        const anchor = {
                                            x: e.position.x - 16,
                                            y:
                                                e.position.y -
                                                (e.local_position?.y ?? 8) -
                                                8,
                                        };
                                        this.page.openPage(folder, anchor, cx);
                                    }),
                            ),
                    ),
                )
                .when(Boolean(folder), (el) =>
                    el
                        .child(
                            button('open-folder', 'folder', 'Folder', 'folder'),
                        )
                        .child(
                            button('open-code', 'file-text', 'VS Code', 'code'),
                        ),
                )
                .when(Boolean(pr), (el) =>
                    el.child(
                        label('git-compare', `PR #${pr.number}`)
                            .id('open-pr')
                            .cursor_pointer()
                            .when(prState === 'merged', (s) =>
                                s.text_color(t.ansi5),
                            )
                            .when(prState === 'closed', (s) =>
                                s.text_color(t.dim),
                            )
                            .hover((s) => s.text_color(t.foreground))
                            .tooltip(`${pr.title} (${prState}) · open`)
                            .on_click((_e, cx) => cx.open_url(pr.url)),
                    ),
                )
                .child(div().flex_1())
                .when(Boolean(usageText), (el) =>
                    el.child(
                        label('clock', usageText)
                            .id('usage')
                            .cursor_pointer()
                            .when(
                                uw.some((w) => w.pct >= 90),
                                (s) => s.text_color(t.blocked),
                            )
                            .hover((s) => s.text_color(t.foreground))
                            .tooltip(usageTip)
                            .on_mouse_down('left', (e) =>
                                this.usageView.openUsage({
                                    x: e.position.x,
                                    y:
                                        e.position.y -
                                        (e.local_position?.y ?? 8) -
                                        8,
                                }),
                            ),
                    ),
                )
                .child(
                    div()
                        .id('palette')
                        .text_color(t.dim)
                        .on_click(() => run('app.palette'))
                        .child(
                            `${window()?.platform === 'macos' ? '⌘' : 'Ctrl'} Shift P  commands`,
                        ),
                )
                // The machine, last: rarely looked at (the user's call 2026-11-01).
                .child(
                    label(
                        space?.machine ? 'server' : 'monitor',
                        space?.machine ?? 'This computer',
                    ),
                )
        );
    }
}
