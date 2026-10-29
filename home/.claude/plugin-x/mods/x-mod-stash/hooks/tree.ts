import type { RenderElement } from 'claude-code';

// a Text's string may hold a newline and no other control character, or the engine refuses the whole tree: one control
// character in one data row blanked every tab of a production mod (claude-code#91870, 10-16); a tab becomes a space
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching control characters is this regex's job
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F]/g;
const clean = (s: string) => s.replace(/\t/g, ' ').replace(CONTROL, '');

const isElement = (node: unknown): node is Element =>
    typeof node === 'object' &&
    node !== null &&
    !Array.isArray(node) &&
    typeof (node as Element).type === 'string';

// what a child that is no node draws instead, so one bad child blanks alone and its siblings stay
const brokenText = (text: string): RenderElement => ({
    children: [text],
    props: { dimColor: true },
    type: 'Text',
});

function soundChild(child: unknown): unknown {
    if (Array.isArray(child)) return child.map(soundChild);
    if (child === null || child === undefined || typeof child === 'boolean')
        return child;
    if (typeof child === 'number')
        return Number.isFinite(child)
            ? child
            : brokenText('⚠ a node could not draw');
    if (typeof child === 'string') return clean(child);
    return isElement(child)
        ? cleanTree(child)
        : brokenText('⚠ a node could not draw');
}

// every string in a render tree, children and props alike, with its control characters gone; a child that is no node
// (a function, a bare object, a non-finite number) is replaced by a marker, never refused with the whole tree
export function cleanTree<T>(node: T): T {
    if (typeof node === 'string') return clean(node) as T;
    if (Array.isArray(node)) return node.map(cleanTree) as T;
    if (isElement(node)) {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(node))
            out[k] = k === 'children' ? soundChild(v) : cleanTree(v);
        return out as T;
    }
    if (node && typeof node === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(node)) out[k] = cleanTree(v);
        return out as T;
    }
    return node;
}

// a section built from data that may be broken: a throw in its build draws a marker box in its place
export function drawn<T>(name: string, build: () => T): T | RenderElement {
    try {
        return build();
    } catch {
        return {
            children: [brokenText(`⚠ ${name} could not draw`)],
            props: { key: `broken:${name}` },
            type: 'Box',
        };
    }
}

/* Types */

type Element = { children?: unknown; props?: unknown; type: string };
