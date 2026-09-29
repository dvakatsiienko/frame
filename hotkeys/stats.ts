// Aggregation over the jsonl the x-monitor-hotkey-stats daemon appends. Pure functions on plain
// arrays — reading the file and printing the tables is the entrypoint's job (top.ts).
import { chordOf } from './chord.ts';
import type { Hotkey } from './manual.ts';

export const eventKinds = ['chord', 'activate', 'launch'] as const;
export type EventKind = (typeof eventKinds)[number];

export interface LogEvent {
    ts: string;
    kind: EventKind;
    app: string;
    chord?: string;
}

export interface Tally {
    name: string;
    count: number;
}

export interface FeatureTally {
    feature: string;
    count: number;
    chords: { chord: string; count: number }[];
}

export interface Window {
    days?: number;
    app?: string;
    ignore?: readonly string[];
    now?: Date;
}

const isKind = (value: unknown): value is EventKind =>
    eventKinds.includes(value as EventKind);

// A daemon killed mid-write leaves a torn last line; one bad line must not lose the month.
// Lines written before app events existed carry no `kind` — those are chords.
export const parseEvents = (jsonl: string): LogEvent[] =>
    jsonl.split('\n').flatMap((line): LogEvent[] => {
        if (!line.trim()) return [];
        let parsed: unknown;
        try {
            parsed = JSON.parse(line);
        } catch {
            return [];
        }
        if (typeof parsed !== 'object' || parsed === null) return [];
        const { ts, kind, chord, app } = parsed as Record<string, unknown>;
        if (typeof ts !== 'string' || typeof app !== 'string') return [];
        const resolved: EventKind = isKind(kind) ? kind : 'chord';
        if (resolved === 'chord') {
            return typeof chord === 'string'
                ? [{ app, chord, kind: resolved, ts }]
                : [];
        }
        return [{ app, kind: resolved, ts }];
    });

export const selectEvents = (
    events: readonly LogEvent[],
    { days, app, ignore = [], now = new Date() }: Window = {},
): LogEvent[] => {
    const since =
        days === undefined ? -Infinity : now.getTime() - days * 86_400_000;
    const needle = app?.toLowerCase();
    const muted = new Set(ignore);
    return events.filter(
        (event) =>
            Date.parse(event.ts) >= since &&
            !(event.chord !== undefined && muted.has(event.chord)) &&
            (needle === undefined ||
                needle === '' ||
                event.app.toLowerCase().includes(needle)),
    );
};

export const ofKind = (events: readonly LogEvent[], kind: EventKind) =>
    events.filter((event) => event.kind === kind);

export const tally = (
    events: readonly LogEvent[],
    of: (event: LogEvent) => string,
): Tally[] => {
    const counts = new Map<string, number>();
    for (const event of events) {
        const name = of(event);
        counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts]
        .map(([name, count]) => ({ count, name }))
        .sort((a, z) => z.count - a.count || a.name.localeCompare(z.name));
};

export const byChord = (event: LogEvent) => event.chord ?? '';

// The label a chord carried when it was pressed: the binding for that chord whose `since` is the
// latest one not after the press (a row without `since` is the oldest meaning), and which had
// not already ended. A reshuffle adds a dated row and the history stays honest instead of being
// relabelled; a move ends the old row, so a press on the freed chord afterwards belongs to
// nobody rather than to whatever used to be there.
export const labelAt = (
    hotkeys: readonly Hotkey[],
    chord: string,
    ts: string,
): Hotkey | undefined =>
    hotkeys
        .filter(
            (hotkey) =>
                chordOf(hotkey) === chord &&
                (hotkey.since === undefined || hotkey.since <= ts) &&
                (hotkey.until === undefined || ts < hotkey.until),
        )
        .sort((a, z) => (a.since ?? '').localeCompare(z.since ?? ''))
        .at(-1);

// What is bound right now. `until` is the day a meaning ended, read exclusively — the same
// boundary labelAt uses — so a row past it is history: it still explains the presses it earned
// and it is on nobody's keyboard. Every "what is bound" question filters through this, or a
// move leaves its old row drawn on the board as a second live binding and the bound count
// climbs by one per move forever.
export const liveHotkeys = (
    hotkeys: readonly Hotkey[],
    on: string = localMinute(),
): Hotkey[] =>
    hotkeys.filter((hotkey) => hotkey.until === undefined || hotkey.until > on);

export const LABEL_SEPARATOR = '\t';

// Tally key for the chords table: the chord plus the label it had at press time, so a swapped
// chord shows one row per meaning.
export const byLabelledChord =
    (hotkeys: readonly Hotkey[]) =>
    (event: LogEvent): string => {
        const chord = event.chord ?? '';
        const hotkey = labelAt(hotkeys, chord, event.ts);
        return hotkey
            ? `${chord}${LABEL_SEPARATOR}${hotkey.action}${LABEL_SEPARATOR}${hotkey.app}`
            : chord;
    };
export const byApp = (event: LogEvent) => event.app;

export const featureOf = (hotkey: Hotkey) => hotkey.feature ?? hotkey.action;

// Presses per feature, whatever key carried it at the time: each press is labelled as of its own
// moment, then filed under that label's feature. The chords under a feature ride along, so the
// page can show where the count came from — opt+esc, then F4, then x-speak's key.
export const tallyFeatures = (
    hotkeys: readonly Hotkey[],
    events: readonly LogEvent[],
): FeatureTally[] => {
    const rows = new Map<string, Map<string, number>>();
    for (const event of events) {
        if (event.chord === undefined) continue;
        const hotkey = labelAt(hotkeys, event.chord, event.ts);
        if (!hotkey) continue;
        const chords = rows.get(featureOf(hotkey)) ?? new Map<string, number>();
        chords.set(event.chord, (chords.get(event.chord) ?? 0) + 1);
        rows.set(featureOf(hotkey), chords);
    }
    return [...rows]
        .map(([feature, chords]) => ({
            chords: [...chords]
                .map(([chord, count]) => ({ chord, count }))
                .sort((a, z) => z.count - a.count),
            count: [...chords.values()].reduce((sum, count) => sum + count, 0),
            feature,
        }))
        .sort(
            (a, z) => z.count - a.count || a.feature.localeCompare(z.feature),
        );
};

const bareModifiers = new Set([
    'cmd',
    'rcmd',
    'opt',
    'ropt',
    'ctrl',
    'rctrl',
    'shift',
    'rshift',
]);

const isStrayModifier = (chord: string) => bareModifiers.has(chord);

// ⌥ or ⌥⇧ on a printable key types a character on the birman layout (opt+9 is →, opt+- is —).
// Unbound, that is typing — the recorder stops writing it; this hides what it wrote before.
const isTypedCharacter = (chord: string) =>
    /^opt\+(shift\+)?(.|space)$/.test(chord);

// Presses the tables leave out: an unbound bare modifier (a ⌘-click, a chord abandoned half-way —
// 3,269 bare `cmd` in the first 16 days) and unbound ⌥-typing. The log keeps them; this only
// stops them ranking.
export const isUntracked = (
    hotkeys: readonly Hotkey[],
    event: LogEvent,
): boolean =>
    event.chord !== undefined &&
    (isStrayModifier(event.chord) || isTypedCharacter(event.chord)) &&
    labelAt(hotkeys, event.chord, event.ts) === undefined;

// Bound somewhere, never pressed in the window — the rebind candidates.
export const unpressed = (
    hotkeys: readonly Hotkey[],
    events: readonly LogEvent[],
): Hotkey[] => {
    const seen = new Set(
        events.flatMap((event) => (event.chord ? [event.chord] : [])),
    );
    return hotkeys.filter((hotkey) => !seen.has(chordOf(hotkey)));
};

/* Helpers */

// the log's own clock: local time, minute precision, so `until` in either form compares
export const localMinute = () => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
        .toISOString()
        .slice(0, 16);
};
