// The plugin's settings and the /breathe command that changes them. Pure: no engine, no surface.

import {
    EXERCISES,
    type ExerciseKey,
    exerciseOf,
    isExerciseKey,
    resolveExercise,
} from './exercises.ts';

export type Config = {
    enabled: boolean;
    exercise: ExerciseKey;
    /** Seconds Claude works before the band appears; 0 shows it at once. */
    delay: number;
    /** Whether the spinner line reads the breath's phase too. */
    spinner: boolean;
};

export const DEFAULTS: Config = {
    delay: 0,
    enabled: true,
    exercise: 'hrv',
    spinner: true,
};

/** A config from what the store held, field by field, defaults for the rest; unknown keys (a retired `style`) drop. */
export function readConfig(saved: unknown): Config {
    const s = (
        typeof saved === 'object' && saved !== null ? saved : {}
    ) as Record<string, unknown>;
    return {
        delay:
            typeof s.delay === 'number' &&
            s.delay >= 0 &&
            Number.isFinite(s.delay)
                ? s.delay
                : DEFAULTS.delay,
        enabled: typeof s.enabled === 'boolean' ? s.enabled : DEFAULTS.enabled,
        exercise: isExerciseKey(s.exercise) ? s.exercise : DEFAULTS.exercise,
        spinner: typeof s.spinner === 'boolean' ? s.spinner : DEFAULTS.spinner,
    };
}

export function statusLine(c: Config): string {
    const ex = exerciseOf(c.exercise);
    return `breathe: ${c.enabled ? 'on' : 'off'} · ${ex.name} (${ex.pattern}) · delay ${c.delay}s · spinner ${c.spinner ? 'on' : 'off'}`;
}

export const HELP = [
    '/breathe               status',
    '/breathe on | off      show or hide the breathing band while Claude works',
    ...EXERCISES.map(
        (e) => `/breathe ${e.key.padEnd(14)}${e.name}: ${e.pattern}`,
    ),
    '/breathe delay <s>     seconds Claude works before the band appears (0 = at once)',
    '/breathe spinner on|off  read the phase in the spinner line too',
].join('\n');

/** Applies one `/breathe` invocation; returns the new config and the transcript line. */
export function applyCommand(
    config: Config,
    args: string,
): { config: Config; text: string } {
    const words = args.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const [head, arg] = words;
    if (!head || head === 'status') return { config, text: statusLine(config) };
    if (head === 'help') return { config, text: HELP };
    if (head === 'on' || head === 'off') {
        const next = { ...config, enabled: head === 'on' };
        return { config: next, text: statusLine(next) };
    }
    const exercise = resolveExercise(head);
    if (exercise) {
        const next = { ...config, exercise };
        return { config: next, text: statusLine(next) };
    }
    if (head === 'delay') {
        const delay = Number(arg);
        if (arg !== undefined && Number.isFinite(delay) && delay >= 0) {
            const next = { ...config, delay };
            return { config: next, text: statusLine(next) };
        }
        return {
            config,
            text: 'breathe: delay takes a number of seconds, 0 or more',
        };
    }
    if (head === 'spinner') {
        if (arg === 'on' || arg === 'off') {
            const next = { ...config, spinner: arg === 'on' };
            return { config: next, text: statusLine(next) };
        }
        return { config, text: 'breathe: spinner on or off' };
    }
    return { config, text: `breathe: no setting called "${head}"\n${HELP}` };
}
