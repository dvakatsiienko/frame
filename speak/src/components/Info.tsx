// a small «i»: its line shows on hover and on keyboard focus, and Esc hides it. `below` opens it under the «i»,
// for a row near the top of the page where the sticky header would cover it
export const Info = (props: InfoProps) => {
    return (
        <span className='group relative inline-flex'>
            <button
                aria-label={props.text}
                className='inline-grid size-6 cursor-help place-items-center rounded-full text-xs text-muted hover:text-ink'
                onKeyDown={(event) =>
                    event.key === 'Escape' && event.currentTarget.blur()
                }
                type='button'>
                ⓘ
            </button>
            <span
                className={`invisible absolute left-0 z-40 w-64 whitespace-normal rounded-md border border-line bg-surface p-2 text-sm text-ink shadow-md group-focus-within:visible group-hover:visible ${props.below ? 'top-full mt-1' : 'bottom-full mb-1'}`}
                role='tooltip'>
                {props.text}
            </span>
        </span>
    );
};

/* Types */
interface InfoProps {
    text: string;
    below?: boolean;
}
