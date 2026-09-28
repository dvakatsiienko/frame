import type { ReactNode } from 'react';

import { Chord } from '@/components/Kbd.tsx';

// Three lists on this page share one row — a colour dot, a chord in mono, and whatever the
// chord means. Keeping them one component is what keeps the two columns aligned.
export const List = (props: { children: ReactNode }) => (
    <ul className='m-0 grid list-none gap-1 p-0'>{props.children}</ul>
);

export const ListRow = (props: ListRowProps) => (
    <li
        className={`grid items-center gap-2.5 border-b border-line py-1.5 text-[13px] ${props.chord ? 'grid-cols-[9px_150px_1fr]' : 'grid-cols-[9px_1fr]'}`}>
        <span
            className='size-[9px] rounded-full'
            style={{ background: props.color }}
        />
        {props.chord ? <Chord chord={props.chord} /> : null}
        <span>
            {props.children}
            {props.who ? (
                <span className='ml-1.5 text-[12px] text-ink-2'>
                    {props.who}
                </span>
            ) : null}
            {props.action}
        </span>
    </li>
);

/* Types */
interface ListRowProps {
    // A trailing control, present only where the row can do something. A row read from another
    // app's own config carries none, because nothing here may write it.
    action?: ReactNode;
    children: ReactNode;
    // Absent where the chord is already on screen, as under the selected-key header.
    chord?: string;
    color: string;
    who?: string;
}
