// The payload behind /api/stats: the four tables `hotkeys:top` prints, as data instead of as
// aligned text. top.ts stays the terminal's formatter and the chords app is the page's; both
// call the same primitives in stats.ts, so a number can only differ by the window it was asked
// for. Nothing here re-implements an aggregation — it selects, tallies and reshapes.
import { cachedAppName } from './app-name.ts';
import { chordOf } from './chord.ts';
import type { Hotkey } from './manual.ts';
import {
    type FeatureTally,
    LABEL_SEPARATOR,
    type LogEvent,
    byApp,
    byLabelledChord,
    featureOf,
    isUntracked,
    liveFeatures,
    liveHotkeys,
    ofKind,
    selectEvents,
    tally,
    tallyFeatures,
    timeInFront,
    unpressed,
} from './stats.ts';

// Words, not numbers — dima's call (2026-09-20). `all` is the default because the lifetime
// record is what he opens this for; the shorter two answer "what have I been reaching for
// lately", which is a different question.
export const windowDays = { all: undefined, month: 30, week: 7 } as const;

export const isWindowName = (value: unknown): value is WindowName =>
    typeof value === 'string' && Object.hasOwn(windowDays, value);

export const buildReport = (
    events: readonly LogEvent[],
    bindings: readonly Hotkey[],
    window: WindowName,
): StatsReport => {
    // Two different questions over one list. The chords table asks what a press meant at the
    // time, so it reads every row a move ever ended; the bound count and the never-pressed list
    // ask what is on the keyboard today, so they read only the live ones.
    const live = liveHotkeys(bindings);
    const tracked = liveFeatures(bindings);
    const selected = selectEvents(events, { days: windowDays[window] });
    const chords = ofKind(selected, 'chord').filter(
        (event) => !isUntracked(bindings, event, tracked),
    );
    const switches = ofKind(selected, 'activate');

    // Never pressed means never, on purpose, and so it reads the whole log rather than the
    // selection. It is the rebind-candidate list: one that shrank because the view got shorter
    // would be making a different claim in the same words.
    const cold = unpressed(live, ofKind(events, 'chord'));

    const counted = ofKind(events, 'chord').filter(
        (event) => !isUntracked(bindings, event, tracked),
    );
    const weekOf = (fromDays: number, toDays: number) => {
        const now = Date.now();
        const inWeek = counted.filter((event) => {
            const age = (now - Date.parse(event.ts)) / 86_400_000;
            return age >= fromDays && age < toDays;
        });
        return new Map(
            tallyFeatures(bindings, inWeek).map((row) => [
                row.feature,
                row.count,
            ]),
        );
    };
    const liveChordsOf = (feature: string) =>
        new Set(
            live.filter((hotkey) => featureOf(hotkey) === feature).map(chordOf),
        );
    const thisWeek = weekOf(0, 7);
    const lastWeek = weekOf(7, 14);

    return {
        boundCount: live.length,
        neverPressed: cold.map((hotkey) => ({
            action: hotkey.action,
            app: hotkey.app,
            chord: chordOf(hotkey),
        })),
        presses: chords.length,
        span: spanOf(selected, windowDays[window]),
        switches: switches.length,
        switchesPerApp: tally(switches, byApp).map(toAppRow),
        timePerApp: timeInFront(selected).map(toAppRow),
        topChords: tally(chords, byLabelledChord(bindings))
            .filter((row) => row.name !== '')
            .map(toChordRow),
        // the trend is always the last seven days against the seven before, whatever the window
        topFeatures: tallyFeatures(bindings, chords).map((row) => ({
            ...row,
            // the keys the feature lives on now; presses from keys it has left fold into one sum
            chords: row.chords.filter((each) =>
                liveChordsOf(row.feature).has(each.chord),
            ),
            earlier: row.chords
                .filter((each) => !liveChordsOf(row.feature).has(each.chord))
                .reduce((sum, each) => sum + each.count, 0),
            lastWeek: lastWeek.get(row.feature) ?? 0,
            thisWeek: thisWeek.get(row.feature) ?? 0,
        })),
        window,
    };
};

/* Helpers */

// What the window actually covers, which is not what it was asked for. The log began on
// 2026-09-14, so `month` and `week` answer with the same rows as `all` and the control reads as
// dead — this is the fact that says otherwise. One pass over the selection rather than a sort:
// it runs per request over tens of thousands of events.
const spanOf = (
    events: readonly LogEvent[],
    asked: number | undefined,
): Span | null => {
    let from: string | null = null;
    let to: string | null = null;

    for (const event of events) {
        const day = event.ts.slice(0, 10);

        if (from === null || day < from) from = day;
        if (to === null || day > to) to = day;
    }

    if (from === null || to === null) return null;

    const days =
        Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;

    return { asked: asked ?? null, days, from, to };
};

// The log stores bundle ids, and nobody reads com.todesktop.230313mzl4w4u92 as Cursor. The id
// travels beside the name because it is the stable key and the lookup is the thing that can fail.
const toAppRow = ({
    name,
    count,
}: {
    name: string;
    count: number;
}): AppRow => ({
    app: cachedAppName(name),
    bundleId: name,
    count,
});

// byLabelledChord joins the chord to the meaning it carried at press time; the same separator
// takes it apart. A chord with no binding behind it arrives as the bare chord and keeps a null
// action rather than an invented one.
const toChordRow = ({
    name,
    count,
}: {
    name: string;
    count: number;
}): ChordRow => {
    const [chord, action, app] = name.split(LABEL_SEPARATOR);

    return {
        action: action ?? null,
        app: app ?? null,
        chord: chord ?? name,
        count,
    };
};

/* Types */
export type WindowName = keyof typeof windowDays;

export interface ChordRow {
    chord: string;
    action: string | null;
    app: string | null;
    count: number;
}
export interface AppRow {
    app: string;
    bundleId: string;
    count: number;
}
export interface ColdRow {
    chord: string;
    action: string;
    app: string;
}
export interface Span {
    from: string;
    to: string;
    days: number;
    // Days the window asked for, `null` for the lifetime view. The page compares it to `days`
    // to tell "a week of log" from "a week of a longer log" — which is why a switch between
    // two windows can change nothing at all without the control being broken.
    asked: number | null;
}
export interface StatsReport {
    window: WindowName;
    span: Span | null;
    presses: number;
    switches: number;
    boundCount: number;
    topChords: ChordRow[];
    topFeatures: (FeatureTally & {
        // presses from keys the feature no longer lives on
        earlier: number;
        thisWeek: number;
        lastWeek: number;
    })[];
    switchesPerApp: AppRow[];
    // minutes in front, an idle gap capped at 15
    timePerApp: AppRow[];
    neverPressed: ColdRow[];
}
