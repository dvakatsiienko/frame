import { type Exercise, cycleMs } from './breath/exercises.ts';
import { levelAt } from './breath/meter-shape.ts';

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

export const METER_HEIGHT = PAD + GRID_HEIGHT + PAD;

// sline's bar ramp, centre out: green, yellow, orange, red (gruvbox-material dark and light)
const STYLE =
    ':root{color-scheme:light dark}.bg{fill:none}.off{fill:#cfcfcf;opacity:.5}.r0{stop-color:#7fb83a}.r1{stop-color:#f2b400}.r2{stop-color:#ff7a1a}.r3{stop-color:#f2364d}' +
    '@media (prefers-color-scheme:dark){.bg{fill:#282828}.off{fill:#504945;opacity:.45}.r0{stop-color:#a9b665}.r1{stop-color:#d8a657}.r2{stop-color:#e78a4e}.r3{stop-color:#ea6962}}';

// the desktop rebuilds an Svg on every band redraw (x-mod-stash polls every 4 s), restarting its SMIL clock; a negative
// begin at the breath's own phase makes each rebuild resume mid-breath instead of snapping to the floor (FRM-354)
export function meterSvg(ex: Exercise, breathMs = 0): string {
    const total = cycleMs(ex);
    const dur = `${(total / 1000).toFixed(2)}s`;
    const begin = `-${((breathMs % total) / 1000).toFixed(2)}s`;
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
            const lit = levelAt(ex, c / (cols - 1), f / frames) * HALF;
            ys.push((centre - CELL / 2 - lit * STEP).toFixed(1));
        }
        ys.push(ys[0]!);
        // evenly spaced values need no keyTimes; linear glides between them
        bars += `<rect x="${x0 + c * STEP}" y="${ys[0]}" width="${CELL}" height="${GRID_HEIGHT}"><animate attributeName="y" values="${ys.join(';')}" calcMode="linear" dur="${dur}" begin="${begin}" repeatCount="indefinite"/></rect>`;
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
