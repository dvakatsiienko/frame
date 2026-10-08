/* @jsx h */
import type { ClientSurface } from 'claude-code';

import { exerciseOf, phaseAt, spinnerWord } from './breath/exercises.ts';
import { levelsAt } from './breath/meter-shape.ts';

// The terminal band: the desktop's meter in block glyphs, a surface module the hooks module
// mounts above the prompt while Claude works. Its own frame clock ticks ten times a second, and
// it posts the phase to the hooks module whenever it changes so the spinner can read it.
//
// Never name a local `h` here: every JSX tag compiles to a call of `h`.

type Props = { exercise?: string; elapsedMs?: number } | undefined;
type State = { tick: number; offsetMs: number; word: string };

const TICK_MS = 100;
const BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
// sline's bar ramp, bottom row up: green, yellow, orange
const ROW_COLORS = ['#a9b665', '#d8a657', '#e78a4e'];
const UNLIT = 'subtle';

export default function Breathe(props: Props, surface: ClientSurface<State>) {
    const { Box, Text } = surface.elements;
    const exercise = exerciseOf(props?.exercise);

    if (surface.state === undefined) {
        // elapsedMs says how far into the turn the band mounted (a delay); the clock runs from there
        surface.setState({ offsetMs: props?.elapsedMs ?? 0, tick: 0, word: '' });
        surface.every(TICK_MS, () => {
            const s = surface.state;
            if (!s) return;
            const tick = s.tick + 1;
            const word = spinnerWord(phaseAt(exercise, s.offsetMs + tick * TICK_MS));
            if (word !== s.word) surface.post({ exercise: exercise.name, word });
            surface.setState({ offsetMs: s.offsetMs, tick, word });
        });
    }

    const s = surface.state;
    const elapsed = (s?.offsetMs ?? 0) + (s?.tick ?? 0) * TICK_MS;
    const width = surface.columns || 80;
    const rows = Math.min(ROW_COLORS.length, surface.rows || ROW_COLORS.length);
    // a bar is one cell and a gap, like the desktop's squares
    const levels = levelsAt(exercise, elapsed, Math.floor(width / 2), rows * BLOCKS.length);

    const rowJSX = Array.from({ length: rows }, (_, i) => {
        const row = rows - 1 - i;
        return <Text>{meterRow(levels, row).map((run) => {
            return <Text color={run.isLit ? ROW_COLORS[row] : UNLIT}>{run.text}</Text>;
        })}</Text>;
    });

    return (
        <Box flexDirection='column' width={width}>
            {rowJSX}
        </Box>
    );
}

/* Helpers */

/** One row of the meter, bottom row 0, as runs of lit and unlit text; the floor shows unlit bars as `▁`. */
function meterRow(levels: number[], row: number): Run[] {
    const runs: Run[] = [];
    for (const level of levels) {
        const fill = Math.max(0, Math.min(BLOCKS.length, level - row * BLOCKS.length));
        const isLit = fill > 0;
        const cell = isLit ? BLOCKS[fill - 1] : row === 0 ? '▁' : ' ';
        const last = runs.at(-1);
        if (last?.isLit === isLit) last.text += `${cell} `;
        else runs.push({ isLit, text: `${cell} ` });
    }
    return runs;
}

/* Types */
type Run = { isLit: boolean; text: string };
