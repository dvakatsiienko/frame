// biome-ignore-all assist/source/useSortedKeys: keyCap's order is pinned — see its own note.
// One spelling for one chord, shared by the scanner (what is bound) and the reader (what was
// pressed) so the two can be joined. The swift daemon builds the same string independently —
// see the modifier order note in schedule/jobs/x-monitor-hotkey-stats/main.swift.
import type { Hotkey } from './manual.ts';

// Carbon key codes → key caps (us layout). THE one table: the swift daemon's copy in
// schedule/jobs/x-monitor-hotkey-stats/keycodes.swift is generated from this by
// `pnpm monitor-hotkey:keycodes`, and a test fails the commit if the two drift.
//
// It sits here rather than in scan.ts because scan.ts is an entrypoint — it writes
// hotkeys.json and prints at import time — so any reader wanting to name a key code would run
// a whole hotkey scan to get the table.
//
// 📌 The daemon only ever looks a code up on a keyDown, and the modifier codes (54–63) never
// produce one; they are here for the config readers, which do see them, and are inert on the
// swift side. The daemon's separate `modifierName` table is a different question — which
// physical modifier moved during flagsChanged — and is not generated from this.
// 📌 The numeric order below is pinned. biome's key comparator is lexicographic, which files
// 126 between 125 and 13; in a keycode table the sequence IS the data, and `keyboard.ts` is
// pinned for the same reason — the shape of that table is the keyboard.
export const keyCap: Record<number, string> = {
    0: 'a',
    1: 's',
    2: 'd',
    3: 'f',
    4: 'h',
    5: 'g',
    6: 'z',
    7: 'x',
    8: 'c',
    9: 'v',
    11: 'b',
    12: 'q',
    13: 'w',
    14: 'e',
    15: 'r',
    16: 'y',
    17: 't',
    18: '1',
    19: '2',
    20: '3',
    21: '4',
    22: '6',
    23: '5',
    24: '=',
    25: '9',
    26: '7',
    27: '-',
    28: '8',
    29: '0',
    30: ']',
    31: 'o',
    32: 'u',
    33: '[',
    34: 'i',
    35: 'p',
    36: 'return',
    37: 'l',
    38: 'j',
    39: "'",
    40: 'k',
    41: ';',
    42: '\\',
    43: ',',
    44: '/',
    45: 'n',
    46: 'm',
    47: '.',
    48: 'tab',
    49: 'space',
    50: '`',
    51: 'backspace',
    53: 'esc',
    54: 'rcmd',
    55: 'cmd',
    56: 'shift',
    58: 'opt',
    59: 'ctrl',
    60: 'rshift',
    61: 'ropt',
    62: 'rctrl',
    63: 'fn',
    65: 'keypad.',
    67: 'keypad*',
    69: 'keypad+',
    71: 'clear',
    75: 'keypad/',
    76: 'keypadenter',
    78: 'keypad-',
    81: 'keypad=',
    82: 'keypad0',
    83: 'keypad1',
    84: 'keypad2',
    85: 'keypad3',
    86: 'keypad4',
    87: 'keypad5',
    88: 'keypad6',
    89: 'keypad7',
    91: 'keypad8',
    92: 'keypad9',
    96: 'f5',
    97: 'f6',
    98: 'f7',
    99: 'f3',
    100: 'f8',
    101: 'f9',
    103: 'f11',
    105: 'f13',
    107: 'f14',
    109: 'f10',
    111: 'f12',
    113: 'f15',
    114: 'help',
    115: 'home',
    116: 'pageup',
    117: 'del',
    118: 'f4',
    119: 'end',
    120: 'f2',
    121: 'pagedown',
    122: 'f1',
    123: 'left',
    124: 'right',
    125: 'down',
    126: 'up',
};

export const modOrder = ['hyper', 'ctrl', 'opt', 'shift', 'cmd'];

export const canonicalMods = (mods: string) =>
    mods
        .split('+')
        .filter(Boolean)
        .sort((a, z) => modOrder.indexOf(a) - modOrder.indexOf(z))
        .join('+');

export const canonical = (hotkey: Hotkey): Hotkey => ({
    ...hotkey,
    mods: canonicalMods(hotkey.mods),
});

// A typed filter query, spelled the way chordOf spells a chord. dima reaches for the modifiers
// in whatever order his hand finds them, so `cmd+shift+l` has to match the canonical
// `shift+cmd+l`. Tokens this file knows as modifiers are sorted into modOrder; anything else
// keeps its place behind them, which is what lets a query that is not a chord at all pass
// through unchanged and still match a note's prose.
export const canonicalQuery = (text: string) => {
    const parts = text.split('+').filter(Boolean);
    const mods = parts.filter((part) => modOrder.includes(part));
    const rest = parts.filter((part) => !modOrder.includes(part));

    return [canonicalMods(mods.join('+')), ...rest].filter(Boolean).join('+');
};

// The chord a press stream update is about. One 2s tick can move a real chord and the bare
// modifier released after it (`ctrl+shift+cmd+4`, then `ctrl`); the real chord wins, or a rebind
// hears only the modifier and drops the press.
export const pressedChord = (
    previous: Record<string, number>,
    counts: Record<string, number>,
) => {
    const moved = Object.keys(counts).filter(
        (chord) => (counts[chord] ?? 0) > (previous[chord] ?? 0),
    );

    return moved.find((chord) => chord.includes('+')) ?? moved[0];
};

// Takes the two fields it reads rather than a whole Hotkey, so the map can spell a free key's
// chord — a key with no binding has no row to hand over.
export const chordOf = (hotkey: Pick<Hotkey, 'key' | 'mods'>) => {
    const mods = canonicalMods(hotkey.mods);
    return mods ? `${mods}+${hotkey.key}` : hotkey.key;
};
