// x-herdr-chat-header's rules, with no drawing in them: what the row shows for one thread, and what each press does.
// one row for both views: above the chat it shows the chat's thread, on a Terminal pane that pane

/** @typedef {'chat' | 'terminal'} View */
/** @typedef {'files' | 'changes'} Panel */
/** @typedef {'split-right' | 'split-down' | 'zoom' | 'close' | 'new-tab' | Panel | 'search' | 'settings'} ControlKind */
/** @typedef {ControlKind | 'switch'} PressKind */
/**
 * the fields of herdr's PaneInfo the row reads
 * @typedef {{ pane: string, terminal: string | null, title: string, cwd: string | null, status: string | null,
 *   app: string | null, zoomed: boolean, program: { name: string, agent: boolean, shell: boolean } }} PaneLike
 */
/**
 * @typedef {{ view: View, pane: PaneLike, home: string, panels: string[], shownPanel: Panel | null,
 *   hasTabButtons: boolean, isFirstOfTab: boolean, isFindOpen: boolean, hasViews: boolean }} HeaderInput
 */
/** @typedef {{ kind: ControlKind, label: string, icon: string, isOn: boolean, isHoverOnly: boolean, hasText: boolean }} Control */
/** @typedef {{ name: string, place: string, status: 'working' | 'blocked' | 'done' | null, controls: Control[], hasSwitch: boolean }} Header */
/**
 * one thing a press does: a herdr command, an overlay to open, an ask to the chat on screen, or the chat's settings
 * @typedef {{ run: [string, Record<string, unknown>] } | { overlay: { mod: string, kind: 'popup', width: number, height: number } } | { ask: 'find' | 'escape' } | { settings: true }} Effect
 */
/** @typedef {{ pane: PaneLike, stack: string | undefined, other: string | undefined, shownPanel: Panel | null, isFindOpen: boolean }} PressInput */

const PANE_ICON = 'mods/pane';
const CHROME_ICON = 'mods/workspace-chrome';

/** @type {readonly { kind: Panel, label: string, icon: string }[]} */
const PANELS = [
    { icon: 'mods/files/file.svg', kind: 'files', label: 'Files' },
    { icon: 'mods/changes/changes.svg', kind: 'changes', label: 'Changes' },
];

/** an agent shows its thread's title, a shell its program (its title is a prompt), anything else its title @param {PaneLike} p */
function threadName(p) {
    if (p.program.agent) return p.title || p.program.name;
    if (p.program.shell) return p.program.name;
    return p.title || p.program.name || 'shell';
}

/** a folder from home as ~ @param {string | null} cwd @param {string} home */
function homeRelative(cwd, home) {
    if (!cwd) return '';
    if (cwd === home) return '~';
    return cwd.startsWith(`${home}/`) ? `~${cwd.slice(home.length)}` : cwd;
}

/** the folder after the name, unless the name already holds it as a word or a path inside it @param {string} name @param {string} folder */
const placeBeside = (name, folder) =>
    name
        .split(/\s+/)
        .some((word) => word === folder || word.startsWith(`${folder}/`))
        ? ''
        : folder;

/** @param {string | null} status @returns {Header['status']} */
const statusMark = (status) =>
    status === 'working' || status === 'blocked' || status === 'done'
        ? status
        : null;

/**
 * @param {ControlKind} kind @param {string} label @param {string} icon
 * @param {Partial<Pick<Control, 'isOn' | 'isHoverOnly' | 'hasText'>>} [is]
 * @returns {Control}
 */
const control = (kind, label, icon, is = {}) => ({
    hasText: false,
    icon,
    isHoverOnly: false,
    isOn: false,
    kind,
    label,
    ...is,
});

/** the row for one thread @param {HeaderInput} at @returns {Header} */
export function headerOf(at) {
    const p = at.pane;
    const name = threadName(p);
    const isClaude = p.app === 'claude-code';
    const isTerminal = at.view === 'terminal';
    /** @type {Control[]} */
    const controls = [];
    if (isTerminal) {
        const hover = { isHoverOnly: true };
        controls.push(
            control(
                'split-right',
                'Split right',
                `${PANE_ICON}/split-right.svg`,
                hover,
            ),
            control(
                'split-down',
                'Split down',
                `${PANE_ICON}/split-down.svg`,
                hover,
            ),
            p.zoomed
                ? control('zoom', 'Unzoom', `${PANE_ICON}/unzoom.svg`, hover)
                : control('zoom', 'Zoom', `${PANE_ICON}/zoom.svg`, hover),
            control('close', 'Close pane', `${PANE_ICON}/close.svg`, hover),
        );
    }
    // a layout with no tab bar asks for its buttons here; a split tab draws them once, in its first pane
    if (at.hasTabButtons && (!isTerminal || at.isFirstOfTab)) {
        controls.push(control('new-tab', 'New tab', `${CHROME_ICON}/plus.svg`));
        for (const panel of PANELS)
            if (at.panels.includes(panel.kind))
                controls.push(
                    control(panel.kind, panel.label, panel.icon, {
                        hasText: true,
                        isOn: at.shownPanel === panel.kind,
                    }),
                );
    }
    if (!isTerminal)
        controls.push(
            control(
                'search',
                'Search this chat (⌘F)',
                `${CHROME_ICON}/search.svg`,
                { isOn: at.isFindOpen },
            ),
        );
    if (isClaude)
        controls.push(
            control('settings', 'Chat settings', `${CHROME_ICON}/settings.svg`),
        );
    return {
        controls,
        hasSwitch: at.hasViews && isClaude,
        name,
        place: placeBeside(name, homeRelative(p.cwd, at.home)),
        status: statusMark(p.status),
    };
}

/** what a press runs, in order @param {PressKind} kind @param {PressInput} at @returns {Effect[]} */
export function pressOf(kind, at) {
    const pane = at.pane.pane;
    switch (kind) {
        case 'split-right':
            return [{ run: ['pane.split', { direction: 'right', pane }] }];
        case 'split-down':
            return [{ run: ['pane.split', { direction: 'down', pane }] }];
        case 'zoom':
            return [{ run: ['pane.zoom', { pane }] }];
        case 'close':
            return [{ run: ['pane.close', { pane }] }];
        // herdr's own new-tab menu, as its tab bar's + opens it
        case 'new-tab':
            return [
                {
                    overlay: {
                        height: 512,
                        kind: 'popup',
                        mod: 'new-menu',
                        width: 250,
                    },
                },
            ];
        case 'files':
        case 'changes':
            return at.shownPanel === kind
                ? [{ run: ['layout.hide', { id: 'panel' }] }]
                : [
                      {
                          run: [
                              'layout.select',
                              { child: kind, stack: 'panel-body' },
                          ],
                      },
                      { run: ['layout.show', { id: 'panel' }] },
                  ];
        case 'search':
            return [{ ask: at.isFindOpen ? 'escape' : 'find' }];
        case 'settings':
            return [{ settings: true }];
        case 'switch':
            return [
                ...(at.pane.terminal
                    ? [
                          /** @type {Effect} */ ({
                              run: [
                                  'pane.focus',
                                  { terminal: at.pane.terminal },
                              ],
                          }),
                      ]
                    : []),
                ...(at.stack && at.other
                    ? [
                          /** @type {Effect} */ ({
                              run: [
                                  'layout.select',
                                  { child: at.other, stack: at.stack },
                              ],
                          }),
                      ]
                    : []),
            ];
        default:
            return /** @type {never} */ (kind);
    }
}

/**
 * the side panel shown now, read off the layout: the `panel` column visible and its `panel-body` stack's child
 * @param {unknown} tree @returns {Panel | null}
 */
export function shownPanelIn(tree) {
    const panel = findNode(tree, 'panel');
    const body = findNode(tree, 'panel-body');
    if (!panel || panel.hidden) return null;
    return PANELS.find((p) => p.kind === body?.active)?.kind ?? null;
}

/** whether a stack with this id is in the layout @param {unknown} tree @param {string | undefined} id */
export const hasNode = (tree, id) => Boolean(id && findNode(tree, id));

/** @param {unknown} node @param {string} id @returns {{ id?: string, hidden?: boolean, active?: string } | null} */
function findNode(node, id) {
    const n =
        /** @type {{ id?: string, hidden?: boolean, active?: string, children?: unknown[] } | null} */ (
            node
        );
    if (!n || typeof n !== 'object') return null;
    if (n.id === id) return n;
    for (const child of n.children ?? []) {
        const found = findNode(child, id);
        if (found) return found;
    }
    return null;
}

/** herdr's side panels switched on in its settings (shared `workspace.panels`); both until he picks @param {unknown} stored */
export const panelsEnabled = (stored) =>
    Array.isArray(stored) ? stored.map(String) : PANELS.map((p) => p.kind);
