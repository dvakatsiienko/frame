// the board's one palette, every card's colours read from it (dima's o107, 21:17): mid-tones at 3.2:1 or more on a light
// pane and 4.2:1 on a dark one; `dim` is the theme's own gray; `calm` is the ctx meter's blue

export const PALETTE = {
    accent: '#d97757',
    calm: '#4f83e0',
    dim: 'inactive',
    // each member's dot, by name: six mid-tones at 3.6:1 or more on white and 4.2:1 on the dark pane, none a state tint
    // and no coral near the asks' orange; the 1st and 4th nudged off `calm` and `ok` (l13, `pnpm design:contrast`)
    dots: ['#6b7bdc', '#2f8f8a', '#a87f12', '#3c9472', '#9a74c9', '#c4689f'],
    hot: '#e5484d',
    ok: '#47915a',
    warn: '#d9661a',
} as const;

// the hues live in the palette's dot list
const HUES = PALETTE.dots;
// each member's hue: the one its name hashes to, so it holds across reloads, or the next free one when an earlier
// row took it — up to six members never share a colour
export function huesOf(names: string[]) {
    const used = new Set<number>();
    return names.map((name) => {
        let h = 0;
        for (const c of name) h = (h * 31 + (c.codePointAt(0) ?? 0)) >>> 0;
        let at = h % HUES.length;
        for (let n = 0; n < HUES.length && used.has(at); n++)
            at = (at + 1) % HUES.length;
        used.add(at);
        return HUES[at];
    });
}
// cc's registry status: the emoji in the row's state column, its time's tint, and whether it counts as working (the
// head's «n busy»); `shell` is a long command inside a turn. the words leave the row (dima's o106, 21:17); a status cc
// adds later reads ❔, warn
const STATUS = {
    blocked: { emoji: '🚧', isWorking: false, tint: PALETTE.hot },
    busy: { emoji: '🐆', isWorking: true, tint: PALETTE.ok },
    idle: { emoji: '💤', isWorking: false, tint: undefined },
    needs_input: { emoji: '🙋', isWorking: false, tint: PALETTE.warn },
    shell: { emoji: '🐚', isWorking: true, tint: PALETTE.ok },
    waiting: { emoji: '⏳', isWorking: false, tint: PALETTE.warn },
} as const satisfies Record<
    string,
    { emoji: string; isWorking: boolean; tint: string | undefined }
>;
const isStatus = (status: string): status is keyof typeof STATUS =>
    Object.hasOwn(STATUS, status);
export const statusOf = (status: string | undefined) =>
    status !== undefined && isStatus(status)
        ? { ...STATUS[status], isIdle: status === 'idle' }
        : { emoji: '❔', isIdle: false, isWorking: false, tint: PALETTE.warn };
// sline's bar ramp, yellow, orange, red, tuned to 3.2:1 or more on a light pane and 4.2:1 on a dark one
export const RAMP = ['#b98500', '#d9661a', '#e5484d'] as const;
// idle only: gray, amber from 30 min, red from 45 (dima's o106)
const IDLE_WARN_MS = 30 * 60_000;
const IDLE_HOT_MS = 45 * 60_000;
// the prompt cache lives an hour: an idle row past it is cold, marked ❄️ (FRM-426, W5)
const CACHE_TTL_MS = 60 * 60_000;

// the meters: a bar of whole cells, the reading filled and one cell marked — the pace on the 5h bar, the compaction
// point on the context one; runs of one kind come out joined, so each draws as one Text
// sline's bar ramp, cell by cell — green, yellow, orange, red — so a bar warms as it fills (sline/usage.go `barRamp`)
const BAR_RAMP = [
    '#a9b665',
    '#b5ba61',
    '#c1b25d',
    '#cdac5a',
    '#d8a657',
    '#e09852',
    '#e78a4e',
    '#e87f47',
    '#e97454',
    '#ea6962',
] as const;
export type BarRun = {
    kind: 'fill' | 'empty' | 'mark';
    text: string;
    color?: string;
    tone?: 'hi';
};
// the breathing (FRM-391), dima's pick C2 (2026-10-11 12:53, kept 13:01 over C): while a turn runs most lit cells spark
// white-hot now and then and cool back through a slow afterglow, each on its own seeded period, so a few embers are always
// cooling; the bars' length, labels and values never change, a flash may tint a cell (dima's o55), and an idle bar stands
// still (no ticks, no GPU)
// dima 12:58 «speed 0.5»: 16 s, so a cell sparks every 3.2–8.8 s
export const BREATH_MS = 16000;
// the spark's shape over its period: dark, a flash, a slow cool-down
const EMBER_KEYS = [0, 0.5, 0.56, 0.66, 0.8, 1] as const;
const EMBER_GLOW = [0, 0, 1, 0.6, 0.25, 0] as const;
// a seeded hash, so a cell sparks the same way on every redraw and both surfaces agree
function seeded(n: number) {
    let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
    x ^= x >>> 13;
    x = Math.imul(x, 0xc2b2ae35);
    x ^= x >>> 16;
    return (x >>> 0) / 2 ** 32;
}
/** a cell's spark: whether it has one, its period and its offset into it, in ms */
export function emberOf(cell: number, row: number, breathMs = BREATH_MS) {
    const k = cell * 2 + row;
    return {
        isOn: seeded(k * 3 + 1) < 0.85,
        offsetMs: seeded(k * 3 + 3) * breathMs,
        periodMs: breathMs * (0.2 + seeded(k * 3 + 2) * 0.35),
    };
}
// one bar as cells: the reading filled, one cell marked — the pace on the 5h bar, the compaction point on the context
// one; each filled cell takes the ramp by its place, so the bar warms as it fills. `scale` is the % the ramp turns red
// at: 100 for the 5h window, the compaction point for the context
export function meterCells(
    percent: number,
    width: number,
    mark?: number,
    scale = 100,
) {
    const filled = Math.min(width, Math.round((percent / 100) * width));
    const at =
        mark === undefined
            ? -1
            : Math.min(
                  width - 1,
                  Math.max(0, Math.round((mark / 100) * width)),
              );
    return Array.from({ length: width }, (_, i) => {
        const kind: BarRun['kind'] =
            i === at ? 'mark' : i < filled ? 'fill' : 'empty';
        const step = Math.floor(
            (((i + 0.5) / width) * 100 * BAR_RAMP.length) / scale,
        );
        return {
            color:
                kind === 'fill'
                    ? BAR_RAMP[Math.min(BAR_RAMP.length - 1, step)]
                    : undefined,
            kind,
        };
    });
}
// the desktop's bar in the retired breather's design language: its 5px cells, 2px gaps and light and dark palettes, the
// ramp painted through the lit cells; two cell rows tall, so it still reads as a bar
const CELL = { gap: 2, rows: 2, size: 5 } as const;
export const CELL_STEP = CELL.size + CELL.gap;
export const BAR_HEIGHT = CELL.rows * CELL_STEP - CELL.gap;
const BAR_STYLE =
    ':root{color-scheme:light dark}.off{fill:#cfcfcf;opacity:.5}.mark{fill:none;stroke:#7c7670;stroke-width:1}.r0{stop-color:#7fb83a}.r1{stop-color:#f2b400}.r2{stop-color:#ff7a1a}.r3{stop-color:#f2364d}.ember{fill:#ffe08a}' +
    '@media (prefers-color-scheme:dark){.off{fill:#504945;opacity:.45}.mark{stroke:#a89984}.r0{stop-color:#a9b665}.r1{stop-color:#d8a657}.r2{stop-color:#e78a4e}.r3{stop-color:#ea6962}.ember{fill:#fff1c2}}';
export function meterSvg(
    percent: number,
    width: number,
    mark?: number,
    scale = 100,
    breathAt?: number,
    breathMs = BREATH_MS,
) {
    const w = width * CELL_STEP - CELL.gap;
    // the ramp reaches red where `scale` sits on the bar: the whole bar for the 5h window, the compaction point for ctx
    const redAt = Math.max(CELL_STEP, (Math.min(scale, 100) / 100) * w);
    // a redraw rebuilds the svg and restarts its clock: each spark's begin carries where its period stands at `breathAt`,
    // so a rebuild resumes every ember mid-flight instead of snapping back (the breather's fix, FRM-354)
    const sparkOf = (i: number, x: number, y: number, row: number) => {
        if (breathAt === undefined) return '';
        const e = emberOf(i, row, breathMs);
        if (!e.isOn) return '';
        const into = ((breathAt + e.offsetMs) % e.periodMs) / 1000;
        return `<rect class="ember" x="${x}" y="${y}" width="${CELL.size}" height="${CELL.size}" rx="1" opacity="0"><animate attributeName="opacity" values="${EMBER_GLOW.join(';')}" keyTimes="${EMBER_KEYS.join(';')}" dur="${(e.periodMs / 1000).toFixed(2)}s" begin="-${into.toFixed(2)}s" repeatCount="indefinite"/></rect>`;
    };
    const cells = meterCells(percent, width, mark, scale).flatMap((c, i) => {
        const x = i * CELL_STEP;
        // the mark is a hollow cell in the grid: a 2px bar across both rows read as a stray bar (dima's wisp, 10-28)
        return Array.from({ length: CELL.rows }, (_, r) => {
            const y = r * CELL_STEP;
            if (c.kind === 'mark')
                return `<rect class="mark" x="${x + 0.5}" y="${y + 0.5}" width="${CELL.size - 1}" height="${CELL.size - 1}" rx="1"/>`;
            return c.kind === 'fill'
                ? `<rect x="${x}" y="${y}" width="${CELL.size}" height="${CELL.size}" rx="1" fill="url(#ramp)"/>${sparkOf(i, x, y, r)}`
                : `<rect class="off" x="${x}" y="${y}" width="${CELL.size}" height="${CELL.size}" rx="1"/>`;
        });
    });
    return (
        // the desktop clamps an Svg to its slot and never stretches one: the bar is drawn a little wider than the slot and
        // squeezed in, so it always ends at the % (dima's wisp, 10-28; a `width="100%"` fell to the 300 px default)
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${BAR_HEIGHT}" viewBox="0 0 ${w} ${BAR_HEIGHT}" preserveAspectRatio="none">` +
        `<style>${BAR_STYLE}</style>` +
        `<defs><linearGradient id="ramp" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${redAt.toFixed(1)}" y2="0">` +
        '<stop class="r0" offset="0"/><stop class="r1" offset=".45"/><stop class="r2" offset=".75"/><stop class="r3" offset="1"/>' +
        '</linearGradient>' +
        `</defs>${cells.join('')}</svg>`
    );
}
// cc's effort words, low to max: a row draws its session's as that many of 5 cells, in the bars' own cells and ramp
// (dima's o4, 15:35: «b, but coloured», the 5h bar's look in one row)
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export const effortLevel = (word: string | undefined) => {
    const i = EFFORTS.indexOf(word as (typeof EFFORTS)[number]);
    return i < 0 ? undefined : i + 1;
};
export const effortCells = (level: number) =>
    meterCells((level / EFFORTS.length) * 100, EFFORTS.length);
// a session row's two meters, effort and context, in one bright look (dima, 10-13 16:50: «looks like a swamp. make
// prettier, brighter»): five steps, green, lime, amber, orange, red, never blended — an RGB mix of green and amber is
// the olive he saw; light mode takes tailwind's 600s (3:1 or more on white), dark its 400s (6:1 or more)
export const ROW_STEPS = {
    dark: ['#4ade80', '#a3e635', '#fbbf24', '#fb923c', '#f87171'],
    light: ['#16a34a', '#65a30d', '#d97706', '#ea580c', '#dc2626'],
} as const;
const TRACK = { dark: '#3a3836', light: '#e5e7eb' } as const;
const ROW_CELL = { gap: 2, size: 6 } as const;
const ROW_STEP = ROW_CELL.size + ROW_CELL.gap;
// the step at t: four below the compaction point (t < 1), red from it on
const stepOf = (t: number) => (t >= 1 ? 4 : Math.max(0, Math.floor(t * 4)));
const themed = (light: string, dark: string) =>
    `:root{color-scheme:light dark}${light}@media (prefers-color-scheme:dark){${dark}}`;
const svgOf = (w: number, h: number, style: string, body: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><style>${style}</style>${body}</svg>`;
const NUMBER_FONT =
    'font-family="-apple-system,system-ui,sans-serif" font-size="12" font-weight="650" style="font-variant-numeric:tabular-nums"';
export function effortSvg(level: number) {
    const w = EFFORTS.length * ROW_STEP - ROW_CELL.gap;
    const css = (mode: 'light' | 'dark') =>
        `.off{fill:${TRACK[mode]}}${ROW_STEPS[mode].map((c, i) => `.e${i}{fill:${c}}`).join('')}`;
    const cells = effortCells(level).map(
        (c, i) =>
            `<rect class="${c.kind === 'fill' ? `e${i}` : 'off'}" x="${i * ROW_STEP}" y="0" width="${ROW_CELL.size}" height="${ROW_CELL.size}" rx="1.5"/>`,
    );
    return svgOf(
        w,
        ROW_CELL.size,
        themed(css('light'), css('dark')),
        cells.join(''),
    );
}
export const EFFORT_CELL = ROW_CELL.size;

const rgbOf = (hex: string) =>
    [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
const hexOf = (rgb: number[]) =>
    `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const mix = (a: string, b: string, t: number) => {
    const [x, y] = [rgbOf(a), rgbOf(b)];
    return hexOf(x.map((v, i) => v + ((y[i] ?? v) - v) * t));
};
// WCAG's contrast ratio of two #rrggbb colours
export function contrastOf(a: string, b: string) {
    const lum = (hex: string) => {
        const [r = 0, g = 0, bl = 0] = rgbOf(hex).map((v) => {
            const c = v / 255;
            return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    };
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}
// a light-pane text tint darkened until it reads at 4.5:1 on white; the dark steps read at 6:1 or more as they are
const readable = (tint: string) => {
    let c = tint;
    for (let k = 1; contrastOf(c, '#ffffff') < 4.5 && k <= 20; k++)
        c = mix(tint, '#000000', k * 0.05);
    return c;
};

// a row's context, its % merged into the meter (dima, 10-13 16:50), the meter and the % in the step the fill has reached,
// red at the session's compaction point (80 when it is unknown); two takes he switches in 🎛️ (17:00: «i like B (more
// compact) and C (more pretty)»)
export const CTX_FALLBACK_AT = 80;
const ctxStyle = (
    percent: number,
    compactAt: number,
    mark: 'fill' | 'stroke',
) => {
    const i = stepOf(percent / compactAt);
    const css = (mode: 'light' | 'dark') => {
        const tint = ROW_STEPS[mode][i] ?? '';
        return `.t{${mark}:${TRACK[mode]}}.c{${mark}:${tint}}.n{fill:${mode === 'light' ? readable(tint) : tint}}`;
    };
    return themed(css('light'), css('dark'));
};
const pctOf = (percent: number) =>
    Math.min(100, Math.max(0, Math.round(percent)));
// B: the % with a 3-px bar under it, as wide as «100%»
export const CTX_BAR = { height: 18, width: 34 } as const;
export function ctxBarSvg(percent: number, compactAt = CTX_FALLBACK_AT) {
    const { height: h, width: w } = CTX_BAR;
    const p = pctOf(percent);
    const fill = (p / 100) * w;
    return svgOf(
        w,
        h,
        ctxStyle(p, compactAt, 'fill'),
        `<text class="n" x="${w}" y="10" text-anchor="end" ${NUMBER_FONT}>${p}%</text>` +
            `<rect class="t" x="0" y="14" width="${w}" height="3" rx="1.5"/>` +
            (p > 0
                ? `<rect class="c" x="0" y="14" width="${fill.toFixed(1)}" height="3" rx="1.5"/>`
                : ''),
    );
}
// C: a ring filled to the %, the % beside it
export const CTX_RING = { height: 16, width: 50 } as const;
export function ctxRingSvg(percent: number, compactAt = CTX_FALLBACK_AT) {
    const { height: h, width: w } = CTX_RING;
    const p = pctOf(percent);
    const [r, c] = [6, 8];
    const whole = 2 * Math.PI * r;
    return svgOf(
        w,
        h,
        ctxStyle(p, compactAt, 'stroke'),
        `<circle class="t" cx="${c}" cy="${c}" r="${r}" fill="none" stroke-width="3"/>` +
            (p > 0
                ? `<circle class="c" cx="${c}" cy="${c}" r="${r}" fill="none" stroke-width="3" stroke-linecap="round" stroke-dasharray="${((p / 100) * whole).toFixed(2)} ${whole.toFixed(2)}" transform="rotate(-90 ${c} ${c})"/>`
                : '') +
            `<text class="n" x="${w}" y="${h / 2}" dy=".35em" text-anchor="end" ${NUMBER_FONT}>${p}%</text>`,
    );
}
// the terminal's pill: five cells and the %, always 10 wide
export const ctxBar = (percent: number) => {
    const p = Math.min(100, Math.max(0, Math.round(percent)));
    const on = Math.round(p / 20);
    return `${'▮'.repeat(on)}${'▯'.repeat(5 - on)} ${`${p}%`.padStart(4)}`;
};
// a calm meter's fill: the board's green and blue mid-tones, 3.6:1 or more on white and 4.2:1 on a dark pane
export const METER_TINTS = {
    calm5h: PALETTE.ok,
    calmCtx: PALETTE.calm,
} as const;
// used − pace: spare at 0 or under, a debt up to 10 is amber, past it red
export const gapTint = (gap: number) =>
    gap <= 0 ? METER_TINTS.calm5h : gap <= 10 ? RAMP[1] : RAMP[2];
// the context fill reads calm until 10 points short of its compaction point, then amber, red at and past it
export const contextFill = (percent: number, compactAt?: number) =>
    compactAt === undefined || percent < compactAt - 10
        ? METER_TINTS.calmCtx
        : percent < compactAt
          ? RAMP[1]
          : RAMP[2];
// a threshold dima types: a whole 10 to 99, else the one line that refuses it
export const thresholdOf = (text: string) => {
    const n = Number(text.trim());
    return Number.isInteger(n) && n >= 10 && n <= 99
        ? { value: n }
        : {
              refusal: `compaction point must be a whole 10–99, got «${text.trim()}»`,
          };
};
export const idleTint = (ms: number) =>
    ms >= IDLE_HOT_MS
        ? PALETTE.hot
        : ms >= IDLE_WARN_MS
          ? PALETTE.warn
          : undefined;

// the mark beside a row's name: ⚠ for a fault (a background name off the fleet pattern) beats ❄️ for an idle row past the cache
export const markOf = (m: {
    isIdle: boolean;
    ms: number;
    isOffPattern: boolean;
}) =>
    m.isOffPattern ? '⚠' : m.isIdle && m.ms >= CACHE_TTL_MS ? '❄️' : undefined;

export const span = (ms: number) => {
    // a status stamped a moment ahead of this clock reads 0m, never -1m
    const m = Math.max(0, Math.floor(ms / 60000));
    return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
};

// the board's sections sit in cards, no colour (dima, 16:48 «colors are ugly»): the desktop a 30 % grey that reads the same on
// light and dark, a touch softer than `subtle` (16:54 too faint, 17:00 «too hard», 17:08 «slightly less»); the terminal `subtle`
export const cardBorder = (surface: string) =>
    surface === 'desktop' ? '#8080804d' : 'subtle';
