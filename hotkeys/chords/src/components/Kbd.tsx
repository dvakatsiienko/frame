import { capLabel, showChord } from '@/keyboard.ts';

// A chord printed as the caps it is: one small keycap per token, modifiers as the glyphs the
// caps carry on a mac. `hyper` is the caps-lock remap, so it wears its own mark.
const glyph: Record<string, string> = {
    cmd: '⌘',
    ctrl: '⌃',
    fn: 'fn',
    hyper: '✦',
    opt: '⌥',
    rcmd: '⌘',
    rctrl: '⌃',
    ropt: '⌥',
    rshift: '⇧',
    shift: '⇧',
};

const CAP =
    'inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-[4px] bg-cap px-1.5 font-mono text-[12px]/none font-medium text-ink shadow-[0_2px_0_var(--color-cap-edge)]';

export const Chord = (props: ChordProps) => {
    const capListJSX = showChord(props.chord)
        .split('+')
        .map((token, at) => {
            // The modifier marks are not in Plex Mono; the system face has every one of them.
            const mark = glyph[token] !== undefined && glyph[token] !== 'fn';

            return (
                <kbd
                    className={`${CAP} ${props.size === 'lg' ? 'h-[28px] min-w-[28px] text-[14px]' : ''} ${mark ? 'font-[system-ui]' : ''}`}
                    key={`${token}-${at}`}
                    title={token}>
                    {glyph[token] ?? capLabel[token] ?? token}
                </kbd>
            );
        });

    return (
        <span className='inline-flex items-center gap-1 align-middle'>
            {capListJSX}
        </span>
    );
};

/* Types */
interface ChordProps {
    chord: string;
    size?: 'lg';
}
