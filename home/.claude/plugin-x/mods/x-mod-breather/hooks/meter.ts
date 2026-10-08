import { type Exercise, cycleMs, phaseAt } from './breath/exercises.ts';

// The desktop band: sline's gruvbox VU grid, one SVG whose SMIL clock runs inside the webview's
// sandboxed frame, so the host sends it once per turn and never ticks. Each column is one rect
// whose height glides between keyframes; a mask of the grid cuts it into squares.

const WIDTH = 760;
const PAD = 4;
const ROWS = 7;
const HALF = 3;
const CELL = 5;
const GAP = 2;
const STEP = CELL + GAP;
const GRID_HEIGHT = ROWS * STEP - GAP;
const FRAME_MS = 160;
const TAU = 2 * Math.PI;

export const METER_HEIGHT = PAD + GRID_HEIGHT + PAD;

// three soft peaks wander at whole-cycle rates, so the loop closes with no seam
const PEAKS = [
    { amp: 1.0, n: 1, phase: 0.0, pulse: 2, pulsePhase: 0.1, width: 0.09 },
    { amp: 0.85, n: -1, phase: 0.37, pulse: 3, pulsePhase: 0.6, width: 0.06 },
    { amp: 0.7, n: 2, phase: 0.71, pulse: 1, pulsePhase: 0.3, width: 0.05 },
    { amp: 0.6, n: -2, phase: 0.15, pulse: 2, pulsePhase: 0.85, width: 0.04 },
] as const;

// sline's bar ramp, centre out: green, yellow, orange, red (gruvbox-material dark and light)
const STYLE =
    ':root{color-scheme:light dark}.bg{fill:none}.off{fill:#cfcfcf;opacity:.5}.r0{stop-color:#7fb83a}.r1{stop-color:#f2b400}.r2{stop-color:#ff7a1a}.r3{stop-color:#f2364d}' +
    '@media (prefers-color-scheme:dark){.bg{fill:#282828}.off{fill:#504945;opacity:.45}.r0{stop-color:#a9b665}.r1{stop-color:#d8a657}.r2{stop-color:#e78a4e}.r3{stop-color:#ea6962}}';

/** How lit a column is, 0..HALF squares above the centre row, at a point of the cycle. */
function litAt(ex: Exercise, u: number, p: number): number {
    const d = Math.abs(u * 2 - 1);
    // the inhale blooms from the middle out, the exhale folds back in: the edges lag the breath
    const lag = (((p - d * 0.15) % 1) + 1) % 1;
    const breath = phaseAt(ex, lag * cycleMs(ex)).progress / 1000;
    let shape = 0.3;
    for (const k of PEAKS) {
        const cx = 0.5 + 0.4 * Math.sin(TAU * (p * k.n + k.phase));
        const h = k.amp * (0.6 + 0.4 * Math.sin(TAU * (p * k.pulse + k.pulsePhase)));
        shape += h * Math.exp(-(((u - cx) / k.width) ** 2));
    }
    // a spectrum texture: neighbouring bars differ, and the pattern slides slowly
    const tex = 0.5 + 0.5 * Math.sin(TAU * (u * 19 + p)) * Math.sin(TAU * (u * 8.5 - p * 2));
    return Math.min(HALF, breath * Math.min(1, 1.35 * shape * (0.4 + 0.8 * tex)) * HALF * 1.1);
}

export function meterSvg(ex: Exercise): string {
    const total = cycleMs(ex);
    const dur = `${(total / 1000).toFixed(2)}s`;
    const cols = Math.floor((WIDTH + GAP) / STEP);
    const gridWidth = cols * STEP - GAP;
    const x0 = Math.floor((WIDTH - gridWidth) / 2);
    // the centre line of the middle row: the top half is drawn, the bottom half is its mirror
    const centre = PAD + HALF * STEP + CELL / 2;
    const frames = Math.round(total / FRAME_MS);

    let bars = '';
    for (let c = 0; c < cols; c++) {
        const ys: string[] = [];
        for (let f = 0; f < frames; f++) {
            const lit = litAt(ex, c / (cols - 1), f / frames);
            ys.push((centre - CELL / 2 - lit * STEP).toFixed(1));
        }
        ys.push(ys[0]!);
        // evenly spaced values need no keyTimes; linear glides between them
        bars += `<rect x="${x0 + c * STEP}" y="${ys[0]}" width="${CELL}" height="${GRID_HEIGHT}"><animate attributeName="y" values="${ys.join(';')}" calcMode="linear" dur="${dur}" repeatCount="indefinite"/></rect>`;
    }

    const ramp = [3, 2, 1, 0, 1, 2, 3]
        .map((k, i) => `<stop offset="${(i / 6).toFixed(3)}" class="r${k}"/>`)
        .join('');
    const area = `x="${x0}" y="${PAD}" width="${gridWidth}" height="${GRID_HEIGHT}"`;

    return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${METER_HEIGHT}">` +
        `<style>${STYLE}</style>` +
        '<defs>' +
        `<linearGradient id="ramp" x1="0" y1="${PAD}" x2="0" y2="${PAD + GRID_HEIGHT}" gradientUnits="userSpaceOnUse">${ramp}</linearGradient>` +
        `<pattern id="cell" x="${x0}" y="${PAD}" width="${STEP}" height="${STEP}" patternUnits="userSpaceOnUse"><rect width="${CELL}" height="${CELL}" rx="1" fill="#fff"/></pattern>` +
        `<mask id="cells"><rect ${area} fill="url(#cell)"/></mask>` +
        `<clipPath id="top"><rect x="${x0}" y="${PAD}" width="${gridWidth}" height="${centre - PAD}"/></clipPath>` +
        `<g id="bars" clip-path="url(#top)" fill="#fff">${bars}</g>` +
        `<mask id="lit"><use href="#bars"/><use href="#bars" transform="translate(0 ${2 * centre}) scale(1 -1)"/></mask>` +
        '</defs>' +
        `<rect class="bg" width="${WIDTH}" height="${METER_HEIGHT}" rx="8"/>` +
        `<rect class="off" ${area} mask="url(#cells)"/>` +
        `<g mask="url(#cells)"><rect ${area} fill="url(#ramp)" mask="url(#lit)"/></g>` +
        `</svg>`
    );
}
