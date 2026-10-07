/* Core */
import stringWidth from 'string-width';

/* Instruments */
import { bb, bold, dim, gb, mb, rb, yb } from './print.ts';

// one colour per lane, the same in every jev script, so the eye learns it once
const laneColor: Record<string, (text: string) => string> = {
    answer: gb,
    drop: dim,
    fold: yb,
    memory: bb,
    pocket: bb,
    rule: yb,
    story: mb,
    ticket: mb,
};

const confColor = (conf: number) => (conf >= 70 ? gb : conf >= 30 ? yb : rb);

/** the cells of one judged line: painted lane · graded conf · dim probabilities · the text */
export const laneCells = (
    lane: string,
    confidence: number,
    probabilities: Record<string, number>,
    text: string,
    width = 90,
) => {
    const conf = Math.round(confidence * 100);
    const ranked = Object.entries(probabilities)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${Math.round(v * 100)}`)
        .join('  ');
    const paint = laneColor[lane] ?? bb;
    return [
        paint(lane),
        confColor(conf)(bold(String(conf))),
        dim(`[${ranked}]`),
        text.slice(0, width),
    ];
};

/** pads every column to its widest cell by VISIBLE width, so colour codes and emoji do not skew it */
export const printTable = (rows: string[][], gap = 2) => {
    const widths = rows.reduce<number[]>((acc, row) => {
        row.forEach((cell, i) => {
            acc[i] = Math.max(acc[i] ?? 0, stringWidth(cell));
        });
        return acc;
    }, []);
    for (const row of rows) {
        const line = row
            .map((cell, i) =>
                i === row.length - 1
                    ? cell
                    : cell + ' '.repeat((widths[i] ?? 0) - stringWidth(cell)),
            )
            .join(' '.repeat(gap));
        console.log(line);
    }
};

export const tailLine = (count: number, unit: string, tokens: number) =>
    dim(`${count} ${unit} · ${tokens} input tokens`);
