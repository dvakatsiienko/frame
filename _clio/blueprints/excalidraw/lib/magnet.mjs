// Excalidraw's router reads the side of a fixed point from its offset to the shape's centre, in pixels: on a wide shape
// a bottom magnet left of centre by more than half the height reads as a west exit, and the arrow detours sideways.
const MARGIN = 0.9;

/** @returns {{fp: number[], fits: boolean}} the magnet as drawn, or moved along its side to where the router reads it right */
export const fitMagnet = ([fx, fy], { w, h }) => {
    if (fy === 0 || fy === 1) {
        const limit = (0.5 * h * MARGIN) / w;
        return Math.abs(fx - 0.5) <= limit
            ? { fp: [fx, fy], fits: true }
            : { fp: [0.5 + Math.sign(fx - 0.5) * limit, fy], fits: false };
    }
    if (fx === 0 || fx === 1) {
        const limit = (0.5 * w * MARGIN) / h;
        return Math.abs(fy - 0.5) <= limit
            ? { fp: [fx, fy], fits: true }
            : { fp: [fx, 0.5 + Math.sign(fy - 0.5) * limit], fits: false };
    }
    return { fp: [fx, fy], fits: true };
};

const normal = ([x, y]) =>
    y === 0
        ? [0, -1]
        : y === 1
          ? [0, 1]
          : x === 0
            ? [-1, 0]
            : x === 1
              ? [1, 0]
              : null;
const heading = ([ax, ay], [bx, by]) => [
    Math.sign(bx - ax),
    Math.sign(by - ay),
];

/** every elbow arrow must leave its start magnet outward and arrive at its end magnet inward */
export const routeSideProblems = (elements) => {
    const problems = [];
    for (const a of elements.filter(
        (e) => e.type === 'arrow' && e.elbowed && !e.isDeleted,
    )) {
        const p = a.points;
        const out = normal(a.startBinding.fixedPoint);
        const into = normal(a.endBinding.fixedPoint);
        const first = heading(p[0], p[1]);
        const last = heading(p.at(-2), p.at(-1));
        if (out && (first[0] !== out[0] || first[1] !== out[1]))
            problems.push(`${a.id}: leaves its start magnet against the side`);
        if (into && (last[0] !== -into[0] || last[1] !== -into[1]))
            problems.push(`${a.id}: enters its end magnet against the side`);
    }
    return problems;
};
