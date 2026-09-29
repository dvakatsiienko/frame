// The board dima actually types on — a NuPhy Air75, drawn as six rows of spans over a 64
// column grid. The numbers are keycap widths in those columns, so `['tab', 6]` is a tab key
// one and a half units wide; an empty label is the gap above the arrow cluster.
// biome-ignore format: one line per keyboard row — the shape of this table IS the keyboard
export const layout = [
    [['esc', 4], ['f1', 4], ['f2', 4], ['f3', 4], ['f4', 4], ['f5', 4], ['f6', 4], ['f7', 4], ['f8', 4], ['f9', 4], ['f10', 4], ['f11', 4], ['f12', 4], ['snip', 4], ['help', 4], ['', 4]],
    [['`', 4], ['1', 4], ['2', 4], ['3', 4], ['4', 4], ['5', 4], ['6', 4], ['7', 4], ['8', 4], ['9', 4], ['0', 4], ['-', 4], ['=', 4], ['backspace', 8], ['pageup', 4]],
    [['tab', 6], ['q', 4], ['w', 4], ['e', 4], ['r', 4], ['t', 4], ['y', 4], ['u', 4], ['i', 4], ['o', 4], ['p', 4], ['[', 4], [']', 4], ['\\', 6], ['pagedown', 4]],
    [['caps', 7], ['a', 4], ['s', 4], ['d', 4], ['f', 4], ['g', 4], ['h', 4], ['j', 4], ['k', 4], ['l', 4], [';', 4], ["'", 4], ['return', 9], ['home', 4]],
    [['shift', 9], ['z', 4], ['x', 4], ['c', 4], ['v', 4], ['b', 4], ['n', 4], ['m', 4], [',', 4], ['.', 4], ['/', 4], ['rshift', 7], ['up', 4], ['end', 4]],
    [['ctrl', 5], ['opt', 5], ['cmd', 5], ['space', 25], ['rcmd', 4], ['fn', 4], ['rctrl', 4], ['left', 4], ['down', 4], ['right', 4]],
] as const satisfies readonly (readonly (readonly [string, number])[])[];

// dima's reading order for the layer tabs (2026-09-29): hyper, then a group per leading modifier —
// cmd, ctrl, opt, shift — each growing from its bare layer outward, and no modifier last. A rule,
// not a list, so a layer that appears later sorts itself.
const leadRank = ['hyper', 'cmd', 'ctrl', 'opt', 'shift'];

const layerRank = (layer: string): [number, number, string] => {
    if (layer === '') return [99, 0, ''];
    const shown = layerName(layer).split('+');
    const lead = leadRank.indexOf(shown[0] ?? '');
    return [lead === -1 ? 50 : lead, shown.length, shown.join('+')];
};

export const compareLayers = (a: string, z: string) => {
    const [aLead, aSize, aName] = layerRank(a);
    const [zLead, zSize, zName] = layerRank(z);
    return aLead - zLead || aSize - zSize || aName.localeCompare(zName);
};

// Reach, for the rebind advisor: how far a key sits from the resting hands. Rows away from the
// home row cost most (the f-row 2.5, numbers 2, the letter rows 1), then the sideways distance
// to the nearest home key, then each held modifier. A heuristic, not a measurement — it ranks.
const rowCost = [2.5, 2, 1, 0, 1, 1.5];
const homeKeys = ['a', 's', 'd', 'f', 'j', 'k', 'l', ';'];

const keyPlace = new Map<string, { row: number; x: number }>(
    layout.flatMap((row, at) => {
        let left = 0;
        return row.map(([key, width]) => {
            const place = [key, { row: at, x: left + width / 2 }] as const;
            left += width;
            return place;
        });
    }),
);

const homeX = homeKeys.flatMap((key) => keyPlace.get(key)?.x ?? []);

export const reachOf = (key: string): number | undefined => {
    const place = keyPlace.get(key);
    if (!place || key === '') return undefined;
    if (key === 'space') return 0.5;
    const sideways = Math.min(...homeX.map((x) => Math.abs(place.x - x)));
    return (rowCost[place.row] ?? 2) + (sideways / 4) * 0.5;
};

export const chordCost = (mods: string, key: string): number | undefined => {
    const reach = reachOf(key);
    if (reach === undefined) return undefined;
    const held =
        mods === '' ? 0 : mods === 'hyper' ? 1 : mods.split('+').length;
    return reach + held * 0.75;
};

export const layoutKeys = [...keyPlace.keys()].filter((key) => key !== '');

export const modKeys = new Set([
    'ctrl',
    'opt',
    'cmd',
    'shift',
    'fn',
    'caps',
    'rctrl',
    'ropt',
    'rcmd',
    'rshift',
]);

// The right-hand modifiers need their own identity for the binding lookup — wispr's
// push-to-talk lives on right cmd alone — but the keycap is printed the same on both sides.
// What is printed on the cap, which is not always what the chord calls the key. The arrows are
// the reason this map grew: `right` plus a three-digit count is 67px of content in a 52px 1u
// cap and the text escaped the key. An Air75 prints an arrow there, and this board draws the
// keyboard as the keyboard — the chord strings keep the words.
export const capLabel: Record<string, string> = {
    down: '↓',
    left: '←',
    pagedown: 'pgdn',
    pageup: 'pgup',
    rcmd: 'cmd',
    rctrl: 'ctrl',
    right: '→',
    ropt: 'opt',
    rshift: 'shift',
    up: '↑',
};

// The caps on dima's own board, from his photo: cream letters, a red number row, lavender
// function row with the backtick, a mint esc, blue arrows, a yellow help key beside a white snip key. The board tints only a
// FREE cap by its family — a bound cap stays white under its app bar, so bound and free still
// read apart the way they always did.
export const capFamily: Record<
    string,
    'esc' | 'fn' | 'num' | 'arrow' | 'help' | 'snip'
> = {
    '-': 'num',
    '=': 'num',
    '`': 'fn',
    down: 'arrow',
    esc: 'esc',
    help: 'help',
    left: 'arrow',
    right: 'arrow',
    snip: 'snip',
    up: 'arrow',
    ...Object.fromEntries(
        Array.from({ length: 12 }, (_, i) => [`f${i + 1}`, 'fn']),
    ),
    ...Object.fromEntries(
        Array.from({ length: 10 }, (_, i) => [String(i), 'num']),
    ),
};

const appColor: Record<string, string> = {
    '1password': 'var(--app-1password)',
    bartender: 'var(--app-bartender)',
    cleanshot: 'var(--app-cleanshot)',
    cursor: 'var(--app-cursor)',
    macos: 'var(--app-macos)',
    magnet: 'var(--app-magnet)',
    raycast: 'var(--app-raycast)',
    'wispr flow': 'var(--app-wispr)',
};

// An app nobody has given a colour to reads as system grey rather than as nothing at all.
export const colorOf = (app: string) => appColor[app] ?? 'var(--app-macos)';

// Which keycaps light up as held while a layer is shown. Hyper is one physical key — caps
// lock, remapped — and not the four modifiers it stands for.
export const layerMods = (layer: string) =>
    layer === 'hyper'
        ? new Set(['caps'])
        : new Set(layer.split('+').filter(Boolean));

// ⌘ leads any modifier set it is part of — dima reads cmd+ctrl, not ctrl+cmd (2026-09-29). display
// only: the log and the bindings key on the stored order (hotkeys/chord.ts), and renaming that
// would orphan every press already written
const cmdFirst = (mods: string[]) =>
    mods.includes('cmd')
        ? ['cmd', ...mods.filter((mod) => mod !== 'cmd')]
        : mods;

export const showChord = (chord: string) => {
    const tokens = chord.split('+');
    return tokens.length < 2
        ? chord
        : [...cmdFirst(tokens.slice(0, -1)), tokens.at(-1)].join('+');
};

export const layerName = (layer: string) =>
    layer === '' ? 'no modifier' : cmdFirst(layer.split('+')).join('+');
