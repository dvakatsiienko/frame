// the second-wind store, `~/.claude/shelf/second-wind.json`: the five wind texts and the applied values, the file any
// app reads (herdr today). data, never code: `v`, a closed list of named rows each with its `default` and its `text`,
// a cap per text; a row name this mod does not know is kept as it was found

export const WIND_STORE_FILE = 'second-wind.json';
export const WIND_TEXT_CAP = 4000;
export const WIND_ROWS = [
    'stash.wind.text.press',
    'stash.wind.text.notice',
    'stash.wind.text.at',
    'stash.wind.text.at.coordinator',
    'stash.wind.text.propose',
] as const;
export type WindRow = (typeof WIND_ROWS)[number];
export const isWindRow = (row: string): row is WindRow =>
    (WIND_ROWS as readonly string[]).includes(row);

// the store key the edit door and herdr's changed rows write, row → text; a poll folds it into the file
export const WIND_TEXT_EDITS = 'wind-text-edits';

export type WindApplied = {
    'second-wind': boolean;
    'second-wind-auto': boolean;
    'wind-at': number;
    'wind-notice': number;
};
type WindSession = { auto: boolean; pid: number };
type WindFile = {
    applied?: Partial<WindApplied> & { sessions?: Record<string, unknown> };
    rows?: Record<string, unknown>;
};

// an unreadable or foreign file reads as empty: no read throws
export function windFileOf(raw: string | undefined): WindFile {
    try {
        const file: unknown = JSON.parse(raw ?? '');
        return file && typeof file === 'object' && !Array.isArray(file)
            ? (file as WindFile)
            : {};
    } catch {
        return {};
    }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

// a row's own text: a blank or missing one is the default, one past the cap is refused
export function windTextOf(file: WindFile, row: WindRow) {
    const entry = isRecord(file.rows) ? file.rows[row] : undefined;
    const text = isRecord(entry) ? entry.text : undefined;
    if (typeof text !== 'string' || !text.trim()) return {};
    return text.length > WIND_TEXT_CAP ? { isOverCap: true } : { text };
}

const sessionOf = (v: unknown): WindSession | undefined =>
    isRecord(v) && typeof v.auto === 'boolean' && typeof v.pid === 'number'
        ? { auto: v.auto, pid: v.pid }
        : undefined;

// every other session's pid in the file, for the liveness read
export const windPidsOf = (file: WindFile) =>
    Object.values(
        isRecord(file.applied?.sessions) ? file.applied.sessions : {},
    ).flatMap((v) => sessionOf(v)?.pid ?? []);

// the file as this session leaves it: the defaults of today's code, the folded edits, the applied values, its own 🍃
// entry, every other live session's entry kept; `gone` are the pids read as dead, `undefined` when none was read
export function windFileWith(
    file: WindFile,
    change: {
        applied: WindApplied;
        defaults: Record<WindRow, string>;
        edits: Record<string, unknown>;
        gone?: ReadonlySet<number>;
        self?: { auto: boolean; pid: number; sid: string };
    },
) {
    const rows: Record<string, unknown> = isRecord(file.rows)
        ? { ...file.rows }
        : {};
    for (const row of WIND_ROWS) {
        const was = isRecord(rows[row]) ? rows[row] : {};
        const edit = change.edits[row];
        rows[row] = {
            ...was,
            default: change.defaults[row],
            text:
                typeof edit === 'string' && edit.length <= WIND_TEXT_CAP
                    ? edit
                    : typeof was.text === 'string'
                      ? was.text
                      : '',
        };
    }
    const kept = Object.entries(
        isRecord(file.applied?.sessions) ? file.applied.sessions : {},
    ).flatMap(([sid, v]) => {
        const s = sessionOf(v);
        return s && !change.gone?.has(s.pid) && sid !== change.self?.sid
            ? [[sid, s] as const]
            : [];
    });
    const { self } = change;
    const sessions = Object.fromEntries(
        [
            ...kept,
            ...(self
                ? [[self.sid, { auto: self.auto, pid: self.pid }] as const]
                : []),
        ].sort(([a], [b]) => a.localeCompare(b)),
    );
    return {
        ...file,
        applied: { ...change.applied, sessions },
        cap: WIND_TEXT_CAP,
        rows,
        v: 1,
    };
}
