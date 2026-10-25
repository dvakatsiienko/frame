// Every bound text, measured with Chrome's real fonts, must sit inside its container:
// a tile's text parts inside the tile (inside the diamond outline for a diamond), an arrow label's lines inside its width.
import { makeText } from './text.mjs';

const TOLERANCE = 0.5;

const outside = (shape, t, width) => {
    const left = t.x;
    const right = t.x + width;
    const top = t.y;
    const bottom = t.y + t.height;
    if (shape.type === 'diamond') {
        const cx = shape.x + shape.width / 2;
        const cy = shape.y + shape.height / 2;
        for (const px of [left, right]) {
            for (const py of [top, bottom]) {
                if (
                    Math.abs(px - cx) / (shape.width / 2) +
                        Math.abs(py - cy) / (shape.height / 2) >
                    1 + 1e-9
                )
                    return 'corner outside the diamond';
            }
        }
        return null;
    }
    if (left < shape.x - TOLERANCE || right > shape.x + shape.width + TOLERANCE)
        return 'past the left or right edge';
    if (
        top < shape.y - TOLERANCE ||
        bottom > shape.y + shape.height + TOLERANCE
    )
        return 'past the top or bottom edge';
    return null;
};

/** @returns {{checked:number, past:string[]}} */
export const checkWraps = async (elements, page) => {
    const tx = makeText(page);
    const byId = new Map(
        elements.filter((e) => !e.isDeleted).map((e) => [e.id, e]),
    );
    const past = [];
    let checked = 0;
    for (const t of byId.values()) {
        if (t.type !== 'text') continue;
        const owner = t.containerId ?? /^(.*)-t\d+$/.exec(t.id)?.[1];
        const shape = owner && byId.get(owner);
        if (!shape) continue;
        checked++;
        const lines = t.text.split('\n');
        const widest = Math.max(
            ...(await Promise.all(lines.map((l) => tx.measure(l, t.fontSize)))),
        );
        if (widest > t.width + TOLERANCE)
            past.push(
                `${t.id}: widest line ${widest.toFixed(1)} px in a ${t.width} px text box`,
            );
        if (shape.type === 'arrow') continue;
        // the visible text is its real widest line, centred or left in the box, never the box itself
        const box = {
            x: t.textAlign === 'center' ? t.x + (t.width - widest) / 2 : t.x,
            y: t.y,
            height: t.height,
        };
        const why = outside(shape, box, widest);
        if (why) past.push(`${t.id}: ${why} of ${shape.id}`);
    }
    return { checked, past };
};
