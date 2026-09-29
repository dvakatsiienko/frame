// a small «i» beside a heading: its one line shows on hover and on keyboard focus, and Esc hides it
export const Info = (props: InfoProps) => {
    return (
        <span className='group relative inline-flex align-middle'>
            <button
                aria-label={props.text}
                className='inline-grid size-6 cursor-help place-items-center rounded-full text-ink-2 hover:text-ink'
                onKeyDown={(event) =>
                    event.key === 'Escape' && event.currentTarget.blur()
                }
                type='button'>
                <svg
                    aria-hidden='true'
                    className='size-3.5'
                    viewBox='0 0 16 16'>
                    <circle
                        cx='8'
                        cy='8'
                        fill='none'
                        r='6.5'
                        stroke='currentColor'
                        strokeWidth='1.3'
                    />
                    <rect
                        fill='currentColor'
                        height='4.5'
                        rx='0.6'
                        width='1.4'
                        x='7.3'
                        y='7'
                    />
                    <circle cx='8' cy='4.9' fill='currentColor' r='0.85' />
                </svg>
            </button>
            <span
                className='invisible absolute top-full left-0 z-20 mt-1 w-72 rounded-md border border-line bg-ground p-2 font-sans text-[14px] font-normal normal-case tracking-normal text-ink group-focus-within:visible group-hover:visible'
                role='tooltip'>
                {props.text}
            </span>
        </span>
    );
};

/* Types */
interface InfoProps {
    text: string;
}
