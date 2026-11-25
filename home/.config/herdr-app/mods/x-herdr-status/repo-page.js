// a repo's page, the popup above the git item: its status, PR and Sync, its branches and «New branch…». it owns what only
// the page reads; what the bar reads too stays on the bar (main.js) and comes through `deps`

import { Input, h_flex, v_flex } from 'gpui-base';
import { div, svg } from 'gpui-kit';
import { closeOverlay, exec, notify, openOverlay, props } from 'herdr';

import { baseName, branchInfo, gitStatus, prsFor } from './git.js';

/** @typedef {import('./status-types.js').Context} Context */
/** @typedef {import('./status-types.js').AsyncContext} AsyncContext */
/** @typedef {import('./status-types.js').Color} Color */
/** @typedef {import('./status-types.js').Theme} Theme */
/** @typedef {import('./status-types.js').ExecResult} ExecResult */
/** @typedef {import('./status-types.js').GitInfo} GitInfo */
/** @typedef {import('./status-types.js').Pr} Pr */
/** @typedef {import('./status-types.js').PrEntry} PrEntry */
/** @typedef {import('./status-types.js').Anchor} Anchor */
/** @typedef {import('./status-types.js').RepoSet} RepoSet */
/** @typedef {import('./status-types.js').BranchInfo} BranchInfo */

/**
 * @typedef {object} RepoPageDeps
 * @property {() => Record<string, GitInfo | null>} git folder -> its status, the bar's own reads
 * @property {() => import('gpui-base').InputState} newBox the new branch's name box
 * @property {() => Record<string, PrEntry>} prs "<folder>|<branch>" -> its PR
 * @property {(prs: Record<string, PrEntry>) => void} setPrs
 * @property {(folder: string, cx: Context, after?: (cx: AsyncContext) => void) => void} sync
 * @property {() => Set<string>} syncing folders being synced
 */

/** @param {RepoPageDeps} deps */
export function createRepoPage(deps) {
    /** @type {Record<string, GitInfo | null>} */
    let repos = {}; // the repo page's folder → gitStatus
    /** @type {boolean} */
    let readingRepos;
    /** @type {(cx: Context | AsyncContext) => void} */
    let reread;
    /** @type {number} */
    let prsAt;
    /** @type {boolean} */
    let lookingUp;
    /** @type {string | null} */
    let switching;
    /** @type {string | null} */
    let error;
    /** @type {boolean} */
    let naming;

    // A popup's own reads while open (statuses every 4 s, PRs on open and every minute).
    /** @param {RepoSet} ws @param {Context} cx */
    function initRepos(ws, cx) {
        repos = { ...(ws.status ?? {}) };
        deps.setPrs({ ...(ws.prs ?? {}) });
        /** @param {Context} cx */
        const read = (cx) => {
            if (readingRepos) return;
            readingRepos = true;
            cx.spawn(async (cx) => {
                const got = await Promise.all(ws.dirs.map(gitStatus));
                readingRepos = false;
                const changed = ws.dirs.some(
                    (d, i) =>
                        JSON.stringify(repos[d] ?? null) !==
                        JSON.stringify(got[i]),
                );
                ws.dirs.forEach((d, i) => {
                    repos[d] = /** @type {GitInfo | null} */ (got[i]);
                });
                if (changed) cx.notify();
                if (Date.now() - (prsAt ?? 0) > 60000)
                    view.readPrs(ws.dirs, cx);
            });
        };
        reread = read;
        read(cx);
        cx.timer.every(4000, read);
    }

    /** @param {string[]} dirs @param {Context | AsyncContext} cx @param {boolean} [force] */
    function readPrs(dirs, cx, force) {
        if (lookingUp && !force) return;
        lookingUp = true;
        prsAt = Date.now();
        cx.spawn(async (cx) => {
            const list = dirs
                .filter((d) => repos[d]?.branch)
                .map((d) => ({
                    branch: /** @type {GitInfo} */ (repos[d]).branch,
                    folder: d,
                    oid: /** @type {GitInfo} */ (repos[d]).oid,
                }));
            const got = await prsFor(list);
            for (const [k, v] of Object.entries(got))
                deps.prs()[k] = { ...v, at: Date.now() };
            lookingUp = false;
            cx.notify();
        });
    }

    // The repo's page, a popup just above the bar item: `anchor` = where the item is (at the pointer,
    // popups ran off the window's bottom); sized to its content.
    /** @param {string} dir @param {Anchor} anchor @param {Context} cx */
    function openPage(dir, anchor, cx) {
        cx.spawn(async () => {
            const info = await branchInfo(dir);
            if (!info)
                return notify({
                    body: dir,
                    level: 'warning',
                    title: 'Not a git repo',
                });
            const notes = (info.agentsHere > 1 ? 1 : 0) + (info.dirty ? 1 : 0);
            // title row, notes, up to 10 branches, the "New branch" row, padding
            const height =
                34 +
                notes * 26 +
                Math.min(info.branches.length, 10) * 30 +
                34 +
                16;
            const st = deps.git()?.[dir] ?? null;
            const pr = st ? deps.prs()[`${dir}|${st.branch}`] : null;
            openOverlay({
                at: {
                    x: Math.max(4, anchor.x),
                    y: Math.max(4, anchor.y - height),
                },
                height,
                kind: 'popup',
                mod: 'x-herdr-status',
                // what's known of it, under git's own name for the folder
                props: {
                    repo: {
                        dir: info.root,
                        info,
                        prs: pr
                            ? {
                                  [`${info.root}|${/** @type {GitInfo} */ (st).branch}`]:
                                      pr,
                              }
                            : {},
                        status: st ? { [info.root]: st } : {},
                    },
                },
                width: 440,
            });
        });
    }

    /** @param {GitInfo | null | undefined} g */
    function counts(g) {
        return g
            ? [g.ahead > 0 && `↑${g.ahead}`, g.behind > 0 && `↓${g.behind}`]
                  .filter(Boolean)
                  .join(' ')
            : '';
    }
    /** @param {boolean} spin */
    function syncIcon(spin) {
        const s = svg('mods/x-herdr-status/sync.svg').size(12);
        return spin ? s.spin(900) : s;
    }

    // A repo's PR: "#N" (or "PR #N" with `long`), a dim "…" while looking, "no PR".
    /** @param {Theme} t @param {string} dir @param {GitInfo | null | undefined} g @param {boolean} long */
    function prLink(t, dir, g, long) {
        const pr = g?.branch ? deps.prs()[`${dir}|${g.branch}`] : null;
        const name = baseName(dir);
        if (!pr)
            return div()
                .text_color(t.dim)
                .child(g?.branch ? '…' : '');
        if (!pr.pr)
            return div()
                .id(`nopr-${name}`)
                .text_color(t.dim)
                .child(pr.error ? 'PR ?' : 'no PR')
                .when(Boolean(pr.error), (s) =>
                    s.tooltip(/** @type {string} */ (pr.error)),
                );
        const state = pr.pr.isDraft ? 'draft' : pr.pr.state.toLowerCase();
        return h_flex()
            .id(`pr-${name}`)
            .gap(5)
            .items_center()
            .cursor_pointer()
            .text_color(
                state === 'merged'
                    ? t.ansi5
                    : state === 'closed'
                      ? t.dim
                      : t.muted,
            )
            .hover((s) => s.text_color(t.foreground))
            .tooltip(`${pr.pr.title} (${state}) · open`)
            .on_click((_e, cx) => cx.open_url(/** @type {Pr} */ (pr.pr).url))
            .child(svg('mods/workspace-chrome/git-compare.svg').size(12))
            .child(`${long ? 'PR ' : ''}#${pr.pr.number}`);
    }

    // Fetch, then pull --ff-only; with `label`, "Sync" / "syncing…" beside the icon.
    /** @param {Theme} t @param {string} dir @param {GitInfo} g the status row, which `when(Boolean(g))` guards @param {boolean} label @param {(cx: AsyncContext) => void} after */
    function syncButton(t, dir, g, label, after) {
        const syncing = deps.syncing().has(dir);
        return h_flex()
            .id(`sync-${baseName(dir)}`)
            .gap(6)
            .flex_none()
            .justify_center()
            .items_center()
            .text_color(t.muted)
            .when(!label, (s) => s.w(18))
            .when(Boolean(g), (s) =>
                s
                    .cursor_pointer()
                    .hover((s) => s.text_color(t.foreground))
                    .tooltip(
                        g.upstream
                            ? `Fetch and pull (fast-forward) · ${g.upstream}${g.behind ? ` · ${g.behind} to pull` : ''}${g.ahead ? ` · ${g.ahead} to push` : ''}`
                            : 'Fetch · no upstream branch to pull from',
                    )
                    .on_click((_e, cx) => deps.sync(dir, cx, after)),
            )
            .child(view.syncIcon(syncing))
            .when(label, (s) => s.child(syncing ? 'syncing…' : 'Sync'));
    }

    // After a switch or a new branch the page closes: the bar reads the new branch.
    function leavePage() {
        closeOverlay(props().overlay);
    }

    // `git switch -c <name>` off the current branch (spaces become "-"); git's refusal shows in the popup.
    /** @param {Context} cx */
    function createBranch(cx) {
        const { repo } = props();
        const root = repo.dir;
        const name = deps.newBox().value().trim().replace(/\s+/g, '-');
        if (!name || switching) return;
        switching = name;
        error = null;
        cx.notify();
        cx.spawn(async (cx) => {
            const r = await exec('git', ['switch', '-c', name], {
                cwd: root,
            }).catch(
                (/** @type {unknown} */ e) =>
                    /** @type {ExecResult} */ ({ code: 1, stderr: String(e) }),
            );
            switching = null;
            if (r.code) {
                error = (r.stderr || r.stdout || 'git switch -c failed').trim();
                cx.notify();
            } else {
                notify({
                    body: baseName(root),
                    title: `On new branch ${name}`,
                });
                view.leavePage();
            }
        });
    }

    // One repo's page: its upstream, ahead/behind, PR and Sync on top, then its local branches
    // (click = `git switch`; git's refusal shows here) and "New branch…".
    /** @param {Theme} t */
    function repoPage(t) {
        const { repo } =
            /** @type {{ repo: { dir: string, info: BranchInfo } }} */ (
                props()
            );
        const { dir, info } = repo;
        const { branches, agentsHere, dirty } = info;
        const g = repos[dir];
        /** @param {string} text @param {Color} color */
        const note = (text, color) =>
            div()
                .px(8)
                .h(26)
                .flex_none()
                .flex()
                .items_center()
                .text_size(11.2)
                .text_color(color)
                .child(text);
        /** @param {string} name @param {Context} cx */
        const pick = (name, cx) => {
            switching = name;
            error = null;
            cx.notify();
            cx.spawn(async (cx) => {
                const r = await exec('git', ['switch', name], {
                    cwd: dir,
                }).catch(
                    (/** @type {unknown} */ e) =>
                        /** @type {ExecResult} */ ({
                            code: 1,
                            stderr: String(e),
                        }),
                );
                switching = null;
                if (r.code) {
                    error = (
                        r.stderr ||
                        r.stdout ||
                        'git switch failed'
                    ).trim();
                    cx.notify();
                } else view.leavePage();
            });
        };
        return v_flex()
            .w_full()
            .p(5)
            .bg(t.popover)
            .text_size(12.8)
            .child(
                h_flex()
                    .h(30)
                    .flex_none()
                    .px(8)
                    .gap(12)
                    .items_center()
                    .child(
                        h_flex()
                            .flex_1()
                            .min_w(0)
                            .gap(8)
                            .items_center()
                            .child(
                                div()
                                    .flex_none()
                                    .text_color(t.foreground)
                                    .child(baseName(dir)),
                            )
                            .child(
                                div()
                                    .min_w(0)
                                    .truncate()
                                    .text_size(11)
                                    .text_color(t.dim)
                                    .child(g?.upstream ?? ''),
                            ),
                    )
                    .child(
                        div()
                            .flex_none()
                            .text_color(g?.behind ? t.accent : t.muted)
                            .child(view.counts(g)),
                    )
                    .child(
                        div()
                            .flex_none()
                            .child(view.prLink(t, dir, g, true)),
                    )
                    .child(
                        view.syncButton(
                            t,
                            dir,
                            /** @type {GitInfo} */ (g),
                            true,
                            (cx) => {
                                reread?.(cx);
                                view.readPrs([dir], cx, true);
                            },
                        ),
                    ),
            )
            .when(agentsHere > 1, (el) =>
                el.child(
                    note(
                        `${agentsHere} agents work in this repo: their files change too`,
                        t.blocked,
                    ),
                ),
            )
            .when(dirty > 0, (el) =>
                el.child(
                    note(
                        `${dirty} uncommitted change${dirty === 1 ? '' : 's'} come along (or git refuses)`,
                        t.muted,
                    ),
                ),
            )
            .when(Boolean(error), (el) =>
                el.child(
                    div()
                        .px(8)
                        .py(5)
                        .text_size(11.2)
                        .text_color(t.blocked)
                        .child(/** @type {string} */ (error)),
                ),
            )
            .child(
                v_flex()
                    .id('branches')
                    .flex_none()
                    .h(Math.min(branches.length, 10) * 30)
                    .overflow_y_scrollbar()
                    .children(
                        branches.map((b) =>
                            h_flex()
                                .id(`br-${b.name}`)
                                .h(30)
                                .flex_none()
                                .px(8)
                                .gap(8)
                                .rounded(7)
                                .items_center()
                                .text_color(b.current ? t.foreground : t.muted)
                                .when(!b.current, (el) =>
                                    el
                                        .cursor_pointer()
                                        .hover((s) =>
                                            s
                                                .bg(t.hover)
                                                .text_color(t.foreground),
                                        )
                                        .on_click((_e, cx) => pick(b.name, cx)),
                                )
                                .child(
                                    h_flex()
                                        .w(14)
                                        .flex_none()
                                        .justify_center()
                                        .when(b.current, (el) =>
                                            el.child(
                                                svg(
                                                    'mods/workspace-chrome/check.svg',
                                                )
                                                    .size(13)
                                                    .text_color(t.accent),
                                            ),
                                        ),
                                )
                                .child(div().flex_1().truncate().child(b.name))
                                .child(
                                    div()
                                        .flex_none()
                                        .text_size(11)
                                        .text_color(t.dim)
                                        .child(
                                            switching === b.name
                                                ? 'switching…'
                                                : b.when,
                                        ),
                                ),
                        ),
                    ),
            )
            .child(div().h(1).mt(1).mb(2).flex_none().bg(t.border))
            .child(
                naming
                    ? h_flex()
                          .id('new-branch')
                          .h(30)
                          .flex_none()
                          .px(8)
                          .gap(8)
                          .items_center()
                          .child(
                              h_flex()
                                  .w(14)
                                  .flex_none()
                                  .justify_center()
                                  .child(
                                      svg('mods/workspace-chrome/plus.svg')
                                          .size(13)
                                          .text_color(t.dim),
                                  ),
                          )
                          .child(
                              div()
                                  .flex_1()
                                  .min_w(0)
                                  .h(26)
                                  .px(6)
                                  .flex()
                                  .items_center()
                                  .rounded(6)
                                  .bg(t.background)
                                  .border(1)
                                  .border_color(t.input)
                                  .text_color(t.foreground)
                                  .child(Input.new(deps.newBox())),
                          )
                          .when(
                              Boolean(switching) &&
                                  !branches.some((b) => b.name === switching),
                              (el) =>
                                  el.child(
                                      div()
                                          .flex_none()
                                          .text_size(11)
                                          .text_color(t.dim)
                                          .child('creating…'),
                                  ),
                          )
                    : h_flex()
                          .id('new-branch')
                          .h(30)
                          .flex_none()
                          .px(8)
                          .gap(8)
                          .rounded(7)
                          .items_center()
                          .text_color(t.muted)
                          .cursor_pointer()
                          .hover((s) => s.bg(t.hover).text_color(t.foreground))
                          .tooltip(
                              `New branch from ${branches.find((b) => b.current)?.name ?? 'HEAD'}, switch to it`,
                          )
                          .on_click((_e, cx) => {
                              naming = true;
                              cx.notify();
                              cx.timer.after(30, () => deps.newBox().focus());
                          })
                          .child(
                              h_flex()
                                  .w(14)
                                  .flex_none()
                                  .justify_center()
                                  .child(
                                      svg(
                                          'mods/workspace-chrome/plus.svg',
                                      ).size(13),
                                  ),
                          )
                          .child(
                              div().flex_1().truncate().child('New branch…'),
                          ),
            );
    }

    const view = {
        counts,
        createBranch,
        initRepos,
        leavePage,
        openPage,
        prLink,
        readPrs,
        repoPage,
        syncButton,
        syncIcon,
    };
    return view;
}
