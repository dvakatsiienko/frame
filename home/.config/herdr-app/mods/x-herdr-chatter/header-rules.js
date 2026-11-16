// the thread header's rules with no drawing in them; the same file in x-herdr-chatter-header and x-herdr-chatter, held
// equal by chatter-header.test.ts

/**
 * the folder a pane's row prints after its title: none when the title already holds it (a shell's title is its folder)
 * @param {string} title @param {string} where
 */
export const folderBeside = (title, where) =>
    where && !title.includes(where) && !/^[~/]/.test(title) ? where : '';

/** @typedef {{ hidden?: boolean, active?: string } | null | undefined} LayoutNode */

/** @param {string} id @param {LayoutNode} panel @param {LayoutNode} body */
export const isPanelShown = (id, panel, body) =>
    Boolean(panel) && !panel?.hidden && body?.active === id;

/**
 * what a press on Files or Changes runs, in order: the shown one hides the side panel, the other one shows it there
 * @param {string} id @param {LayoutNode} panel @param {LayoutNode} body
 * @returns {[string, Record<string, string>][]}
 */
export const panelPress = (id, panel, body) =>
    isPanelShown(id, panel, body)
        ? [['layout.hide', { id: 'panel' }]]
        : [
              ['layout.select', { child: id, stack: 'panel-body' }],
              ['layout.show', { id: 'panel' }],
          ];

/**
 * the side panels herdr's settings switch on (shared `workspace.panels`); both until he picks
 * @param {unknown} stored @returns {string[]}
 */
export const panelsEnabled = (stored) =>
    Array.isArray(stored) ? stored.map(String) : ['files', 'changes'];

/**
 * a layout node by its id, anywhere under `node`
 * @param {any} node @param {string} id @returns {any}
 */
export function findNode(node, id) {
    if (node?.id === id) return node;
    for (const child of node?.children ?? []) {
        const found = findNode(child, id);
        if (found) return found;
    }
    return null;
}
