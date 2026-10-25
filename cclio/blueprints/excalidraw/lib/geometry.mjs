export const center = (b) => [b.x + b.w / 2, b.y + b.h / 2];

/** where the line from a's centre to b's centre leaves a's outline (rectangle or diamond) */
export const perimeterPoint = (a, b, kind) => {
    const [ax, ay] = center(a);
    const [bx, by] = center(b);
    const dx = bx - ax;
    const dy = by - ay;
    if (!dx && !dy) return [ax, ay];
    const t =
        kind === 'diamond'
            ? 1 / (Math.abs(dx) / (a.w / 2) + Math.abs(dy) / (a.h / 2))
            : Math.min(
                  dx ? a.w / 2 / Math.abs(dx) : Infinity,
                  dy ? a.h / 2 / Math.abs(dy) : Infinity,
              );
    return [ax + dx * t, ay + dy * t];
};

export const resolveArg = (p) =>
    new URL(p, `file://${process.env.INIT_CWD ?? process.cwd()}/`).pathname;
