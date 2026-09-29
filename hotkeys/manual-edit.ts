// Rebinding and surface editing from the chords ui, written back into manual.ts — which stays
// the single source for the sealed apps, so the ui is its editor and never a second list.
//
// The edit is surgical, not a regenerate. manual.ts is as much prose as data: the group
// comments carry where each binding came from and when it was bound, and a printer that
// re-emitted the array from parsed rows would flatten every one of them. So the row's own
// literal is found in the text and only its fields move.
//
// Two literal forms exist in that file, because the repeated groups are written as tuples fed
// through .map: `['e', 'Linear']` inside a hyper group, and `{ action, app, key, mods }`
// standing alone. A tuple carries no mods of its own, so changing the layer cannot be an
// in-place edit — the tuple leaves its group and comes back as a full object row.
//
// 🚫 Nothing here guesses. Every lookup must land on exactly one place in the file; zero or
// more than one throws, and the caller answers the request with the reason.
import { canonicalMods, chordOf } from './chord.ts';
import type { Hotkey } from './manual.ts';

const TERMINATOR = '] satisfies readonly Hotkey[];';
const LINE_WIDTH = 80;
// Alphabetical, because biome sorts object keys and a row printed in another order comes back
// reformatted. Every optional field on Hotkey belongs here: one missing is silently dropped on
// the way out, which is how `until` shipped as a no-op the first time.
const FIELD_ORDER = [
    'action',
    'app',
    'feature',
    'key',
    'mods',
    'note',
    'since',
    'until',
] as const;

// biome's string style, measured rather than assumed (2026-09-20): single quotes win unless the
// value holds MORE singles than doubles, and the losing mark is escaped rather than switched to.
// Getting this wrong writes a file biome then refuses, which fails the next commit.
//
// The control characters are not paranoia about the api — that boundary rejects them. They can
// arrive from manual.ts itself, where `'a\nb'` parses to a real newline, and re-emitting one raw
// would end the string mid-line and take the rest of the file with it.
const quote = (value: string) => {
    const mark =
        (value.match(/'/g)?.length ?? 0) > (value.match(/"/g)?.length ?? 0)
            ? '"'
            : "'";
    const body = value
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
        .replaceAll(mark, `\\${mark}`);

    return `${mark}${body}${mark}`;
};

const sameRow = (row: Hotkey, ref: ManualRowRef) =>
    row.app === ref.app &&
    row.key === ref.key &&
    row.action === ref.action &&
    canonicalMods(row.mods) === canonicalMods(ref.mods);

const indexesOf = (text: string, needle: string) => {
    const found: number[] = [];

    for (
        let at = text.indexOf(needle);
        at !== -1;
        at = text.indexOf(needle, at + 1)
    ) {
        found.push(at);
    }

    return found;
};

const onlyIndex = (text: string, needle: string, what: string) => {
    const found = indexesOf(text, needle);

    if (found.length === 0) return null;
    if (found.length > 1) {
        throw new ManualEditError(
            `${what} appears ${found.length} times in manual.ts — edit it by hand`,
        );
    }

    return found[0] as number;
};

// The braces around a row hold only string fields, so the nearest pair in each direction is
// the whole literal — no nesting to balance.
const objectBlockAt = (text: string, fieldAt: number) => {
    const open = text.lastIndexOf('{', fieldAt);
    const close = text.indexOf('}', fieldAt);

    if (open === -1 || close === -1) {
        throw new ManualEditError('the row is not inside an object literal');
    }

    return { close: close + 1, open, text: text.slice(open, close + 1) };
};

// Every block whose action, key and mods read as this row. After a move the file carries the
// ended row and the live one under the same action, so this alone names two places — the
// callers below each add the half they mean.
const blocksOf = (text: string, row: Hotkey) =>
    indexesOf(text, `action: ${quote(row.action)}`)
        .map((at) => objectBlockAt(text, at))
        .filter(
            (block) =>
                block.text.includes(`key: ${quote(row.key)}`) &&
                block.text.includes(`mods: ${quote(row.mods)}`),
        );

// The live row is the one whose block carries no `until`.
const liveBlockOf = (text: string, row: Hotkey) => {
    const blocks = blocksOf(text, row).filter(
        (block) => !/\buntil:/.test(block.text),
    );

    if (blocks.length === 0) {
        throw new ManualEditError(
            'the row is not written literally in manual.ts',
        );
    }
    if (blocks.length > 1) {
        throw new ManualEditError(
            `${blocks.length} live rows read ${quote(row.action)} on that chord — edit manual.ts by hand`,
        );
    }

    return blocks[0] as ReturnType<typeof objectBlockAt>;
};

const setField = (block: string, field: string, next: string) => {
    const pattern = new RegExp(
        `(\\b${field}:\\s*)(('(?:[^'\\\\]|\\\\.)*')|("(?:[^"\\\\]|\\\\.)*"))`,
    );

    if (!pattern.test(block)) {
        throw new ManualEditError(`the row has no ${field} field to change`);
    }

    return block.replace(pattern, `$1${quote(next)}`);
};

// biome keeps an object on one line while it fits the 80-column budget and explodes it the
// moment it does not — matched here so a written row needs no reformat before it commits.
export const printRow = (row: Hotkey) => `    ${rowLiteral(row, '    ')},`;

// The `{ … }` on its own, at a given indent. Shared so a row rewritten in place comes out
// formatted exactly like one that was appended — biome rejects the file otherwise, and the two
// paths drifting apart is how that happens.
const rowLiteral = (row: Hotkey, indent: string) => {
    const fields = FIELD_ORDER.filter((name) => row[name] !== undefined).map(
        (name) => [name, String(row[name])] as const,
    );
    const inline = fields
        .map(([name, value]) => `${name}: ${quote(value)}`)
        .join(', ');

    // The comma and the indent count toward biome's budget, so they are measured here even
    // though the caller is the one that adds them.
    if (`${indent}{ ${inline} },`.length <= LINE_WIDTH) return `{ ${inline} }`;

    const lines = fields.map(
        ([name, value]) => `${indent}    ${name}: ${quote(value)},`,
    );

    return ['{', ...lines, `${indent}}`].join('\n');
};

export const editManualText = (
    text: string,
    rows: readonly Hotkey[],
    edit: ManualEdit,
) => {
    const row = onlyMatch(rows, edit.from);
    const mods = canonicalMods(edit.to.mods);
    const next: Hotkey = {
        ...row,
        action: edit.to.action,
        key: edit.to.key,
        mods,
    };

    const tuple = `[${quote(row.key)}, ${quote(row.action)}]`;
    const tupleAt = onlyIndex(text, tuple, `the pair ${tuple}`);

    if (tupleAt !== null) {
        if (mods === canonicalMods(row.mods)) {
            return text.replace(
                tuple,
                `[${quote(next.key)}, ${quote(next.action)}]`,
            );
        }

        return appendRow(dropTupleLine(text, tupleAt), next);
    }

    const block = liveBlockOf(text, row);
    let edited = setField(block.text, 'action', next.action);
    edited = setField(edited, 'key', next.key);
    edited = setField(edited, 'mods', next.mods);

    return text.slice(0, block.open) + edited + text.slice(block.close);
};

/* Helpers */

// The text search alone cannot tell which layer a tuple sits in, so the parsed rows are what
// prove the target is the row the ui meant. One match, or nothing happens.
const onlyMatch = (rows: readonly Hotkey[], ref: ManualRowRef): Hotkey => {
    const matched = rows.filter(
        (row) => row.until === undefined && sameRow(row, ref),
    );

    if (matched.length === 0) {
        throw new ManualEditError('no hand-kept row matches that chord');
    }
    if (matched.length > 1) {
        throw new ManualEditError(
            `${matched.length} hand-kept rows match that chord — edit manual.ts by hand`,
        );
    }

    return matched[0] as Hotkey;
};

// A tuple owns its whole line in that file, and taking the line takes the trailing comma and
// the indent with it; leaving a bare `,` behind would not parse.
const dropTupleLine = (text: string, tupleAt: number) => {
    const lineStart = text.lastIndexOf('\n', tupleAt) + 1;
    const lineEnd = text.indexOf('\n', tupleAt);

    if (text.slice(lineStart, tupleAt).trim() !== '') {
        throw new ManualEditError(
            'that pair shares its line — edit manual.ts by hand',
        );
    }

    return text.slice(0, lineStart) + text.slice(lineEnd + 1);
};

const appendRow = (text: string, row: Hotkey) => {
    const at = text.lastIndexOf(TERMINATOR);

    if (at === -1) {
        throw new ManualEditError(
            'manual.ts does not end in the shape this writer knows',
        );
    }

    return `${text.slice(0, at)}${printRow(row)}\n${text.slice(at)}`;
};

/* Types */
export class ManualEditError extends Error {}

export interface ManualRowRef {
    app: string;
    mods: string;
    key: string;
    action: string;
}
export interface ManualEdit {
    from: ManualRowRef;
    to: { mods: string; key: string; action: string };
}
