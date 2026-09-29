import { useEffect, useRef, useState } from 'react';

// a voice list with a ♥ per voice: favourites sort to the top, «only ♥» filters to them. a native select cannot
// hold a button per option, so this is a small popover of rows — a select button and a ♥ toggle each.
export const VoicePicker = (props: VoicePickerProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isFavouritesOnly, setIsFavouritesOnly] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);

    // while open: an outside click closes it, Esc closes it, ↑/↓ walk the voices. the listeners go with the popover
    useEffect(() => {
        const element = root.current;
        if (!(isOpen && element)) return;
        const handlePointer = (event: PointerEvent) => {
            if (!element.contains(event.target as Node)) setIsOpen(false);
        };
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
                trigger.current?.focus();
                return;
            }
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
            event.preventDefault();
            const rows = [
                ...element.querySelectorAll<HTMLButtonElement>(
                    '[data-voice-pick]',
                ),
            ];
            const at = rows.indexOf(
                document.activeElement as HTMLButtonElement,
            );
            rows[
                (at + (event.key === 'ArrowDown' ? 1 : rows.length - 1)) %
                    rows.length
            ]?.focus();
        };
        document.addEventListener('pointerdown', handlePointer);
        element.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('pointerdown', handlePointer);
            element.removeEventListener('keydown', handleKey);
        };
    }, [isOpen]);

    const isFavourite = (id: string) => props.favourites.includes(id);
    const hasFavourites = props.options.some(([id]) => isFavourite(id));
    const sorted = [
        ...props.options.filter(([id]) => isFavourite(id)),
        ...props.options.filter(([id]) => !isFavourite(id)),
    ];
    const shown =
        isFavouritesOnly && hasFavourites
            ? sorted.filter(([id]) => isFavourite(id))
            : sorted;
    const current =
        props.options.find(([id]) => id === props.value)?.[1] ?? props.value;

    const close = () => {
        setIsOpen(false);
        trigger.current?.focus();
    };

    const rowListJSX = shown.map(([id, name]) => {
        const isFav = isFavourite(id);
        return (
            <li className='flex items-center' key={id || 'default'}>
                <button
                    aria-current={id === props.value}
                    className={`flex-1 truncate rounded px-2 py-1 text-left text-sm outline-offset-[-2px] hover:bg-surface-2 ${id === props.value ? 'font-semibold' : ''}`}
                    data-voice-pick=''
                    onClick={() => {
                        props.onChange(id);
                        close();
                    }}
                    title={name}
                    type='button'>
                    {id === props.value ? '✓ ' : ''}
                    {name}
                </button>
                {id && (
                    <button
                        aria-label={`${isFav ? 'unfavourite' : 'favourite'} ${name}`}
                        aria-pressed={isFav}
                        className={`inline-grid size-7 place-items-center rounded outline-offset-[-2px] hover:bg-surface-2 ${isFav ? 'text-accent' : 'text-muted'}`}
                        onClick={() => props.onFavourite(id, !isFav)}
                        type='button'>
                        {isFav ? '♥' : '♡'}
                    </button>
                )}
            </li>
        );
    });

    return (
        <div className='relative' ref={root}>
            <button
                aria-expanded={isOpen}
                aria-haspopup='dialog'
                aria-label={`${props.label}: ${current}`}
                className='flex w-full items-center justify-between rounded-lg border border-line bg-surface px-3 py-1.5 text-left text-sm hover:border-muted'
                onClick={() => setIsOpen(!isOpen)}
                ref={trigger}
                type='button'>
                <span className='truncate'>
                    {isFavourite(props.value) ? '♥ ' : ''}
                    {current}
                </span>
                <span aria-hidden='true' className='text-muted'>
                    ▾
                </span>
            </button>
            {isOpen && (
                <div
                    aria-label={props.label}
                    className='absolute left-0 right-0 top-full z-20 mt-1 grid gap-1 rounded-md border border-line bg-surface p-1 shadow-lg'
                    role='dialog'>
                    <label
                        className={`flex items-center gap-2 px-2 py-1 text-sm ${hasFavourites ? 'cursor-pointer' : 'cursor-not-allowed text-muted'}`}>
                        <input
                            checked={isFavouritesOnly && hasFavourites}
                            className='size-6'
                            disabled={!hasFavourites}
                            onChange={(event) =>
                                setIsFavouritesOnly(event.target.checked)
                            }
                            type='checkbox'
                        />
                        only ♥ favourites
                    </label>
                    <ul className='m-0 grid max-h-64 list-none gap-0.5 overflow-auto p-1'>
                        {rowListJSX}
                    </ul>
                </div>
            )}
        </div>
    );
};

/* Types */
interface VoicePickerProps {
    label: string;
    value: string;
    options: [string, string][];
    favourites: string[];
    onChange: (voice: string) => void;
    onFavourite: (voice: string, isFavourite: boolean) => void;
}
