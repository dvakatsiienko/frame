import { type Exercise, cycleMs, phaseAt } from './exercises.ts';

// The meter's motion, shared by both renderers: the desktop bakes it into SMIL, the terminal
// samples it every frame into block glyphs. A tweak here lands on both surfaces.

const TAU = 2 * Math.PI;

// soft peaks wander at whole-cycle rates, so the loop closes with no seam
const PEAKS = [
    { amp: 1.0, n: 1, phase: 0.0, pulse: 2, pulsePhase: 0.1, width: 0.09 },
    { amp: 0.85, n: -1, phase: 0.37, pulse: 3, pulsePhase: 0.6, width: 0.06 },
    { amp: 0.7, n: 2, phase: 0.71, pulse: 1, pulsePhase: 0.3, width: 0.05 },
    { amp: 0.6, n: -2, phase: 0.15, pulse: 2, pulsePhase: 0.85, width: 0.04 },
] as const;

/** How lit column `u` (0..1 across) is at point `p` (0..1) of the cycle, 0..1. */
export function levelAt(ex: Exercise, u: number, p: number): number {
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
    return Math.min(1, breath * Math.min(1, 1.35 * shape * (0.4 + 0.8 * tex)) * 1.1);
}

/** Every column's level at `elapsedMs`, in whole steps of `steps`. */
export function levelsAt(ex: Exercise, elapsedMs: number, columns: number, steps: number): number[] {
    const total = cycleMs(ex);
    const p = (((elapsedMs % total) + total) % total) / total;
    return Array.from({ length: columns }, (_, c) => {
        return Math.round(levelAt(ex, columns > 1 ? c / (columns - 1) : 0.5, p) * steps);
    });
}
