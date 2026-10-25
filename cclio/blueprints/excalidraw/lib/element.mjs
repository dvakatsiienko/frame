// Excalidraw element skeletons with every volatile field pinned, so two runs write the same bytes.
import { LINE, HELVETICA } from './text.mjs';

export const INK = '#1E1E1E';
const UPDATED = 1761390000000;

// fractional index keys a0..a9, b10..b99, c100..c999, d1000..
export const indexKey = (n) => String.fromCharCode(96 + String(n).length) + n;
export const hash = (s) =>
    [...s].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7);

export const makeFactory = () => {
    let n = 0;
    const base = (id, type, x, y, width, height, extra) => ({
        id,
        type,
        x,
        y,
        width,
        height,
        angle: 0,
        strokeColor: INK,
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 3,
        strokeStyle: 'solid',
        roughness: 0,
        opacity: 100,
        groupIds: [],
        frameId: null,
        index: indexKey(n++),
        roundness: null,
        seed: hash(id),
        version: 1,
        versionNonce: hash(`${id}!`),
        isDeleted: false,
        boundElements: null,
        updated: UPDATED,
        link: null,
        locked: false,
        ...extra,
    });
    const text = (id, x, y, width, str, size, extra) =>
        base(
            id,
            'text',
            x,
            y,
            width,
            Math.round(str.split('\n').length * size * LINE * 100) / 100,
            {
                strokeWidth: 1,
                text: str,
                originalText: str,
                fontSize: size,
                fontFamily: HELVETICA,
                textAlign: 'center',
                verticalAlign: 'top',
                containerId: null,
                autoResize: false,
                lineHeight: LINE,
                ...extra,
            },
        );
    return { base, text };
};
