import type { Exercise } from './breath/exercises.ts';

// The desktop band: one SVG whose SMIL clock runs inside the webview's sandboxed frame,
// so the host sends it once per turn and never ticks.

const WARM = '#f7835d';
const GLOW = '#ffc4a8';

type Segment = { label: string; ms: number };

const segments = (ex: Exercise): Segment[] => [
    { label: 'breathe in', ms: ex.inhaleMs },
    { label: ex.sip ? 'sip in' : 'hold', ms: ex.hold1Ms },
    { label: 'breathe out', ms: ex.exhaleMs },
    { label: 'hold', ms: ex.hold2Ms },
];

export function orbSvg(ex: Exercise): string {
    const segs = segments(ex);
    const total = segs.reduce((n, s) => n + s.ms, 0);
    const marks = [0];
    for (const s of segs) marks.push((marks.at(-1) ?? 0) + s.ms / total);
    const keyTimes = marks.map((t) => Math.min(1, t).toFixed(4)).join(';');
    const dur = `${(total / 1000).toFixed(1)}s`;
    const r = (rest: number, full: number) =>
        [rest, ex.sip ? full * 0.82 : full, full, rest, rest].join(';');
    const ease = Array(4).fill('0.45 0 0.55 1').join(';');
    const swell = (rest: number, full: number, opacity: string) =>
        `<animate attributeName="r" values="${r(rest, full)}" keyTimes="${keyTimes}" calcMode="spline" keySplines="${ease}" dur="${dur}" repeatCount="indefinite"/>` +
        `<animate attributeName="opacity" values="${opacity}" keyTimes="${keyTimes}" calcMode="spline" keySplines="${ease}" dur="${dur}" repeatCount="indefinite"/>`;
    const labels = segs
        .map((s, i) =>
            s.ms === 0
                ? ''
                : `<text x="300" y="104" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="13" letter-spacing="2" fill="${WARM}" opacity="0">${s.label}` +
                  `<animate attributeName="opacity" values="${segs.map((_, j) => (j === i ? 1 : 0)).join(';')};0" keyTimes="${keyTimes}" calcMode="discrete" dur="${dur}" repeatCount="indefinite"/></text>`,
        )
        .join('');
    return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 124" width="600" height="124">` +
        `<defs><radialGradient id="orb"><stop offset="0" stop-color="${GLOW}"/><stop offset="0.55" stop-color="${WARM}"/><stop offset="1" stop-color="${WARM}" stop-opacity="0"/></radialGradient></defs>` +
        `<circle cx="300" cy="48" r="40" fill="none" stroke="${WARM}" stroke-width="1">${swell(26, 46, '0.08;0.3;0.3;0.08;0.08')}</circle>` +
        `<circle cx="300" cy="48" r="30" fill="none" stroke="${WARM}" stroke-width="1.5">${swell(18, 36, '0.15;0.5;0.5;0.15;0.15')}</circle>` +
        `<circle cx="300" cy="48" r="20" fill="url(#orb)">${swell(12, 28, '0.6;1;1;0.6;0.6')}</circle>` +
        labels +
        `<text x="300" y="120" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="10" fill="${WARM}" opacity="0.5">${ex.name.toLowerCase()}</text>` +
        `</svg>`
    );
}
