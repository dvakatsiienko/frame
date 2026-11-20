// finding blocks in a layout tree, kept free of herdr's imports so a test can read them

/** @typedef {{ id: string, type?: string, content?: any, children?: LayoutNode[] }} LayoutNode */

/** the first block under `node` whose content passes `test`, and the node holding it
 * @param {LayoutNode} node @param {(content: any) => unknown} test @param {LayoutNode | null} [parent]
 * @returns {{ block: LayoutNode, parent: LayoutNode | null } | null} */
export function findBlock(node, test, parent = null) {
    if (!node || typeof node !== 'object') return null;
    if (test(node.content)) return { block: node, parent };
    for (const child of node.children ?? []) {
        const found = findBlock(child, test, node);
        if (found) return found;
    }
    return null;
}

/** what ⌘E shows and hides: the deck's own column when it sits in one, so the parts moved above orbit go with it
 * @param {LayoutNode} tree */
export function deckToggleId(tree) {
    const found = findBlock(
        tree,
        (c) => c?.mod === 'x-herdr-deck' && !c.props?.view,
    );
    if (!found) return null;
    return found.parent?.type === 'column' && found.parent.id !== tree.id
        ? found.parent.id
        : found.block.id;
}
