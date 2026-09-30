import type { ReactNode } from 'react';

/**
 * One ranked row: count, bar, label — the shape `hotkeys:top` already prints, on one line.
 *
 * The bar is a div with a width, not a chart. Three of this page's four tables are ranked
 * magnitude, which is the form a bar list answers better than any library would, and the bar
 * lives in a fixed column beside its number rather than running the width of the page: a
 * two-hundred-row list has to stay scannable, and a bar you must track across 1100px is not.
 *
 * It wears the keycap-lip grey rather than the accent, because the Earned Accent Rule keeps
 * Signal Blue for chosen, pressed and annotated — two hundred blue bars would retire it.
 */
export const StatRow = (props: StatRowProps) => {
    const width =
        props.top > 0 ? Math.max(1, (props.count / props.top) * 100) : 0;

    return (
        <li
            className={`grid items-center gap-3 border-b border-line py-[3px] text-[13px] ${props.icon ? 'grid-cols-[16px_64px_140px_minmax(0,1fr)]' : 'grid-cols-[64px_140px_minmax(0,1fr)]'}`}>
            {/* the marks lead the line: one column down the left edge the eye scans for products (dima's A/B, 2026-09-30) */}
            {props.icon ? (
                <span className='flex self-center'>{props.icon}</span>
            ) : null}
            <span className='text-right font-mono text-[13px] tabular-nums text-ink'>
                {props.value ?? props.count.toLocaleString()}
            </span>
            <span
                aria-hidden='true'
                className='h-[7px] rounded-[3px] bg-cap-free'>
                <span
                    className='block h-full rounded-[3px] bg-bar'
                    style={{ width: `${width}%` }}
                />
            </span>
            <span className='flex items-baseline gap-2 overflow-hidden'>
                {props.dotColor ? (
                    <span
                        className='relative top-px size-[9px] shrink-0 rounded-full'
                        style={{ background: props.dotColor }}
                    />
                ) : null}
                {props.onSelect ? (
                    <button
                        className='shrink-0 cursor-pointer border-0 bg-transparent min-w-[24px] px-0 py-[3px] -my-[3px] font-mono text-[13px] text-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
                        onClick={props.onSelect}
                        title={`open ${props.label} on the board`}
                        type='button'>
                        {props.label}
                    </button>
                ) : (
                    <span className='shrink-0 font-mono text-[13px]'>
                        {props.label}
                    </span>
                )}
                {props.detail ? (
                    <span
                        className='truncate text-[12px] text-ink-2'
                        title={props.detail}>
                        {props.detail}
                    </span>
                ) : null}
            </span>
        </li>
    );
};

/* Types */
interface StatRowProps {
    count: number;
    // what the number column prints when the count is not the reading (minutes as «4h 12m»)
    value?: string;
    detail?: string;
    dotColor?: string;
    // a mark before the label: an app's logo, or a blank slot that keeps a list's labels aligned
    icon?: ReactNode;
    label: string;
    // Present only where the label names a chord the board can open. An app row has nowhere to
    // go, so it stays plain text rather than a button that does nothing.
    onSelect?: () => void;
    top: number;
}
