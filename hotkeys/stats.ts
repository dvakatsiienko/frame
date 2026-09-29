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
    // what the press did, stamped by the recorder at press time (or by the one-time backfill)
    feature?: string;
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
        const { ts, kind, chord, app, feature } = parsed as Record<
            string,
            unknown
        >;
        if (typeof ts !== 'string' || typeof app !== 'string') return [];
        const resolved: EventKind = isKind(kind) ? kind : 'chord';
        if (resolved === 'chord') {
            if (typeof chord !== 'string') return [];
            return typeof feature === 'string'
                ? [{ app, chord, feature, kind: resolved, ts }]
                : [{ app, chord, kind: resolved, ts }];
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
//
// An in-app binding (its `scope` names the bundles it works in) means something only while its
// app is in front, so it labels a press only from that app, and there it wins over a global one
// on the same chord — 631 esc presses had once all gone to an editor's in-app esc. `app` is the
// press's bundle id; without one, every row is a candidate.
export const labelAt = (
    hotkeys: readonly Hotkey[],
    chord: string,
    ts: string,
    app?: string,
): Hotkey | undefined =>
    hotkeys
        .filter(
            (hotkey) =>
                chordOf(hotkey) === chord &&
                (hotkey.since === undefined || hotkey.since <= ts) &&
                (hotkey.until === undefined || ts < hotkey.until) &&
                (app === undefined || isInScope(hotkey, app)),
        )
        .sort(
            (a, z) =>
                Number(a.scope !== undefined) - Number(z.scope !== undefined) ||
                (a.since ?? '').localeCompare(z.since ?? ''),
        )
        .at(-1);

const isInScope = (hotkey: Hotkey, app: string) =>
    hotkey.scope?.includes(app) ?? true;

// What a press did. The recorder stamps it at press time, so a line carries its own meaning and
// no ended binding has to be remembered to explain it; a line written before stamping falls back
// to the binding that held its chord at that moment.
export const featureAt = (
    hotkeys: readonly Hotkey[],
    event: LogEvent,
): string | undefined => {
    if (event.feature !== undefined) return event.feature;
    if (event.chord === undefined) return undefined;
    const hotkey = labelAt(hotkeys, event.chord, event.ts, event.app);
    return hotkey && featureOf(hotkey);
};

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

// Tally key for the chords table: the chord and the live binding that does the press's feature
// on it. A press on a key its feature has left (opt+esc, now read aloud lives on F4) has no row
// here and answers '' — its count lives on in the feature, and the table shows the keyboard as
// it is.
export const byLabelledChord =
    (hotkeys: readonly Hotkey[]) =>
    (event: LogEvent): string => {
        const chord = event.chord ?? '';
        const feature = featureAt(hotkeys, event);
        const hotkey = hotkeys.find(
            (each) =>
                chordOf(each) === chord &&
                featureOf(each) === feature &&
                isInScope(each, event.app),
        );
        return hotkey
            ? `${chord}${LABEL_SEPARATOR}${hotkey.action}${LABEL_SEPARATOR}${hotkey.app}`
            : '';
    };
export const byApp = (event: LogEvent) => event.app;

export const featureOf = (hotkey: Hotkey) => hotkey.feature ?? hotkey.action;

// An app's time in front: each activation lasts until the next one. The log has no lock, sleep or
// idle events, so a gap is capped — past 15 minutes dima was most likely away, not reading.
export const IDLE_CAP_MS = 15 * 60_000;

const awayApps = new Set([
    'com.apple.loginwindow',
    'com.apple.ScreenSaver.Engine',
]);

export const timeInFront = (events: readonly LogEvent[]): Tally[] => {
    const switches = events
        .filter((event) => event.kind === 'activate')
        .map((event) => ({ app: event.app, at: Date.parse(event.ts) }))
        .sort((a, z) => a.at - z.at);
    const minutes = new Map<string, number>();
    switches.forEach((each, at) => {
        // the lock screen coming to the front is dima leaving: its span is away time, not an app
        if (awayApps.has(each.app)) return;
        const next =
            switches[at + 1]?.at ?? Math.min(Date.now(), each.at + IDLE_CAP_MS);
        const spent = Math.min(next - each.at, IDLE_CAP_MS) / 60_000;
        minutes.set(each.app, (minutes.get(each.app) ?? 0) + spent);
    });
    return [...minutes]
        .map(([name, count]) => ({ count: Math.round(count), name }))
        .filter((row) => row.count > 0)
        .sort((a, z) => z.count - a.count || a.name.localeCompare(z.name));
};

// Presses per feature, whatever key carried it at the time: each press is labelled as of its own
// moment, then filed under that label's feature. The chords under a feature ride along, so the
// page can show where the count came from — opt+esc, then F4, then x-speak's key.
export const tallyFeatures = (
    hotkeys: readonly Hotkey[],
    events: readonly LogEvent[],
): FeatureTally[] => {
    const rows = new Map<string, Map<string, number>>();
    for (const event of events) {
        const feature = featureAt(hotkeys, event);
        if (event.chord === undefined || feature === undefined) continue;
        const chords = rows.get(feature) ?? new Map<string, number>();
        chords.set(event.chord, (chords.get(event.chord) ?? 0) + 1);
        rows.set(feature, chords);
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

// A press counts only while its feature is on the keyboard: some live binding does it. That
// drops what was never a hotkey (a ⌘-click read as bare cmd, a birman ⌥-character, an app's own
// cmd+r nobody mapped) and what dima stopped using (a binding removed takes its presses off the
// page with it). The log keeps every line. (dima, 2026-09-29)
export const liveFeatures = (hotkeys: readonly Hotkey[]) =>
    new Set(liveHotkeys(hotkeys).map(featureOf));

export const isUntracked = (
    hotkeys: readonly Hotkey[],
    event: LogEvent,
    live: ReadonlySet<string> = liveFeatures(hotkeys),
): boolean => {
    if (event.chord === undefined) return false;
    const feature = featureAt(hotkeys, event);
    return feature === undefined || !live.has(feature);
};

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
