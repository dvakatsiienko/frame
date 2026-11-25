// the deck's place in his layout, and the one way it shows and hides: ⌘E and the band's 🚦 both come here

import { DECK_TOGGLED } from './chat-asks.js';

/** @typedef {{ id: string, type?: string, hidden?: boolean, content?: any, children?: LayoutNode[] }} LayoutNode */

/** the first block under `node` whose content passes `test`, and the node holding it
 * @param {LayoutNode} node @param {(content: any) => unknown} test @param {LayoutNode | null} [parent]
 * @returns {{ block: LayoutNode, parent: LayoutNode | null } | null} */
function findBlock(node, test, parent = null) {
    if (!node || typeof node !== 'object') return null;
    if (test(node.content)) return { block: node, parent };
    for (const child of node.children ?? []) {
        const found = findBlock(child, test, node);
        if (found) return found;
    }
    return null;
}

/** what shows and hides as the deck: its own column when it sits in one, so the parts moved above orbit go with it
 * @param {any} tree herdr's `layout()` @returns {LayoutNode | null} */
export function deckNode(tree) {
    const root = tree?.root ?? tree;
    const found = findBlock(
        root,
        (c) => c?.mod === 'x-herdr-deck' && !c.props?.view,
    );
    if (!found) return null;
    return found.parent?.type === 'column' && found.parent.id !== root.id
        ? found.parent
        : found.block;
}

/**
 * the deck shown or hidden, the time written so it forgets a hover made before; a layout with no deck has none to toggle
 * @param {{ layout: () => unknown, run: (command: string, args: any) => unknown, setShared: (key: string, value: any) => unknown }} herdr
 */
export function toggleDeck({ layout, run, setShared }) {
    const id = deckNode(layout())?.id;
    if (!id) return;
    setShared(DECK_TOGGLED, Date.now());
    run('layout.toggle', { id });
}
