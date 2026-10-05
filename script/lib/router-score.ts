/* Instruments */
import type { Raw, Suggestion, Thresholds } from './skill-router.ts';
import { decide, defaultThresholds, mustNotMiss } from './skill-router.ts';

/** a third of the fixtures, fixed by the prompt's own hash: thresholds never see them */
export const isHeld = (prompt: string) =>
    [...prompt].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 3 === 0;

/**
 * a verdict answers the reply before it — a numbered answer list, or a handful of words that
 * have a reply to answer («boot» with no reply before it is a command, not a verdict)
 */
export const isVerdict = (fx: RouterFixture) =>
    /^\s*(lane\s+)?\d+\.\s/.test(fx.state.prompt) ||
    (Boolean(fx.state.recent_context) &&
        fx.state.prompt.trim().split(/\s+/).length <= 6);

/** the skills a fixture wants loaded; with memory on, one already in the session is not owed */
export function owed(fx: RouterFixture, hasMemory: boolean) {
    const want = [fx.expect].flat().filter((s) => s !== 'none');
    return hasMemory ? want.filter((s) => !fx.seen?.includes(s)) : want;
}

/**
 * the cookbook's rates, split so each failure reads alone: `wrong` — a covered prompt got a load
 * it does not want; `missed` — a covered prompt got none of what it wants; `needless` — an
 * uncovered prompt got any load; `critical` — recall over the must-not-miss skills a prompt wants
 */
export function metrics(
    rows: readonly { fx: RouterFixture; s: Suggestion }[],
    hasMemory: boolean,
): Metrics {
    const scored = rows.map(({ fx, s }) => {
        const want = owed(fx, hasMemory);
        const got = s.loads.map((l) => l.name);
        return { got, want };
    });
    const covered = scored.filter((r) => r.want.length);
    const uncovered = scored.filter((r) => !r.want.length);
    const loads = scored.flatMap((r) => r.got.map((g) => r.want.includes(g)));
    const critical = scored.flatMap((r) =>
        r.want
            .filter((w) => mustNotMiss.includes(w))
            .map((w) => r.got.includes(w)),
    );
    const rate = (n: number, of: number) => (of ? n / of : 0);
    return {
        critical: rate(critical.filter(Boolean).length, critical.length),
        criticalN: critical.length,
        missed: rate(
            covered.filter((r) => !r.got.some((g) => r.want.includes(g)))
                .length,
            covered.length,
        ),
        n: rows.length,
        needless: rate(
            uncovered.filter((r) => r.got.length).length,
            uncovered.length,
        ),
        // a router that loads nothing has no precision to keep
        precision: rate(loads.filter(Boolean).length, loads.length),
        wrong: rate(
            covered.filter((r) => r.got.some((g) => !r.want.includes(g)))
                .length,
            covered.length,
        ),
    };
}

const steps = (from: number, to: number) =>
    Array.from({ length: Math.round((to - from) / 0.05) + 1 }, (_, i) =>
        Number((from + i * 0.05).toFixed(2)),
    );

/**
 * thresholds picked on the tune split only: the fewest wrong + needless + missed loads plus
 * critical misses, precision breaking ties; a sweep is pure arithmetic over kept raws. a hard
 * «critical ≥ 95 %» wall was tried first: nothing on the tune split reached it, every candidate
 * paid the same penalty, and the sweep switched the gate off
 */
export function sweep(
    rows: readonly { fx: RouterFixture; raws: readonly Raw[] }[],
    parts: { hasGate: boolean; hasNeed: boolean; hasMemory: boolean },
): Thresholds {
    let best = { cost: Number.POSITIVE_INFINITY, t: defaultThresholds };
    for (const fits of steps(0.3, 0.8))
        for (const margin of steps(0, 0.6))
            for (const need of parts.hasNeed
                ? steps(0.2, 0.8)
                : [defaultThresholds.need])
                for (const gate of parts.hasGate
                    ? steps(0.2, 0.9)
                    : [defaultThresholds.gate]) {
                    const t = {
                        ...defaultThresholds,
                        fits,
                        gate,
                        margin,
                        need,
                    };
                    const runs = rows[0]?.raws.length ?? 0;
                    const per = Array.from({ length: runs }, (_, run) =>
                        metrics(
                            rows.map(({ fx, raws }) => ({
                                fx,
                                s: decide(raws[run] as Raw, t),
                            })),
                            parts.hasMemory,
                        ),
                    );
                    const avg = (f: (m: Metrics) => number) =>
                        per.reduce((n, m) => n + f(m), 0) / per.length;
                    const cost =
                        avg((m) => m.wrong + m.needless + m.missed) +
                        (1 - avg((m) => m.critical)) -
                        avg((m) => m.precision) / 100;
                    if (cost < best.cost) best = { cost, t };
                }
    return best.t;
}

/* Types */
export type RouterFixture = {
    state: { prompt: string; recent_context?: string };
    expect: string | string[];
    seen?: string[];
    label?: 'observed' | 'inferred' | 'synthetic';
    note?: string;
};
export type Metrics = {
    critical: number;
    criticalN: number;
    missed: number;
    n: number;
    needless: number;
    precision: number;
    wrong: number;
};
