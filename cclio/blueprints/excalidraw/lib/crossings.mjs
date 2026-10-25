// node lib/crossings.mjs <board.excalidraw>
// Tests every arrow segment against every tile and diamond that is not that arrow's own start or end.
// Bands (ungrouped rectangles) hold the tiles, so an arrow inside one is not a crossing; they are not tested.
import { readFileSync } from 'node:fs';
import { resolveArg } from './geometry.mjs';

const EPS = 0.5;

const polygonOf = (e) => {
    const { x, y, width: w, height: h } = e;
    return e.type === 'diamond'
        ? [
              [x + w / 2, y],
              [x + w, y + h / 2],
              [x + w / 2, y + h],
              [x, y + h / 2],
          ]
        : [
              [x, y],
              [x + w, y],
              [x + w, y + h],
              [x, y + h],
          ];
};

/** Cyrus-Beck: does the segment p->q touch the interior of the convex polygon (shrunk by EPS)? */
export const segmentHitsPolygon = (p, q, poly) => {
    const cx = poly.reduce((s, v) => s + v[0], 0) / poly.length;
    const cy = poly.reduce((s, v) => s + v[1], 0) / poly.length;
    let t0 = 0;
    let t1 = 1;
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    for (let i = 0; i < poly.length; i++) {
        const [ax, ay] = poly[i];
        const [bx, by] = poly[(i + 1) % poly.length];
        let nx = by - ay;
        let ny = ax - bx;
        if (nx * (cx - ax) + ny * (cy - ay) > 0) {
            nx = -nx;
            ny = -ny;
        }
        const len = Math.hypot(nx, ny);
        const num = (nx * (ax - p[0]) + ny * (ay - p[1])) / len - EPS;
        const den = (nx * dx + ny * dy) / len;
        if (den === 0) {
            if (num < 0) return false;
            continue;
        }
        const t = num / den;
        if (den > 0) t1 = Math.min(t1, t);
        else t0 = Math.max(t0, t);
        if (t0 > t1) return false;
    }
    return true;
};

export const findCrossings = (elements) => {
    const live = elements.filter((e) => !e.isDeleted);
    const obstacles = live.filter(
        (e) =>
            e.type === 'diamond' ||
            (e.type === 'rectangle' && e.groupIds.length),
    );
    const crossings = [];
    let segments = 0;
    for (const a of live.filter((e) => e.type === 'arrow')) {
        const own = new Set([
            a.startBinding?.elementId,
            a.endBinding?.elementId,
        ]);
        const abs = a.points.map(([px, py]) => [a.x + px, a.y + py]);
        for (let i = 0; i < abs.length - 1; i++) {
            segments++;
            for (const o of obstacles) {
                if (own.has(o.id)) continue;
                if (segmentHitsPolygon(abs[i], abs[i + 1], polygonOf(o)))
                    crossings.push({
                        arrow: a.id,
                        segment: i,
                        obstacle: o.id,
                        elbowed: a.elbowed,
                        points: a.points.length,
                    });
            }
        }
    }
    return {
        crossings,
        segments,
        arrows: live.filter((e) => e.type === 'arrow').length,
        obstacles: obstacles.length,
    };
};

const main = () => {
    const arg = process.argv[2];
    if (!arg)
        throw new Error('usage: pnpm --dir out crossings <board.excalidraw>');
    const { crossings, segments, arrows, obstacles } = findCrossings(
        JSON.parse(readFileSync(resolveArg(arg), 'utf8')).elements,
    );
    console.log(
        `${arrows} arrows, ${segments} segments, ${obstacles} obstacles (tiles and diamonds): ${crossings.length} crossings`,
    );
    for (const c of crossings) {
        const why = c.elbowed
            ? `elbow arrow routed by Excalidraw's router (${c.points} points); its router only clears the arrow's own two ends`
            : 'straight arrow (edgeStyle=none in draw.io), not routed: drawn centre to centre as draw.io drew it';
        console.log(
            `🔴 ${c.arrow} segment ${c.segment} crosses ${c.obstacle} — ${why}`,
        );
    }
};

if (import.meta.url === `file://${process.argv[1]}`) main();
