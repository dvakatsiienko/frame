// a millisecond setting: a slider to feel it out, a number box to type it exactly; both edit the same value
export const MsSetting = (props: MsSettingProps) => {
    const set = (raw: string) => {
        const value = Number(raw);
        if (raw !== '' && Number.isFinite(value))
            props.onChange(Math.min(props.max, Math.max(0, Math.round(value))));
    };

    return (
        <div
            className='flex items-center gap-2 text-sm text-muted'
            title={props.hint}>
            <span className='whitespace-nowrap'>{props.label}</span>
            <input
                aria-label={`${props.label} slider`}
                className='h-6 w-28 min-w-0 sm:w-44'
                max={props.max}
                min={0}
                onChange={(event) => set(event.target.value)}
                step={1}
                type='range'
                value={props.value}
            />
            <input
                aria-label={`${props.label} in ms`}
                className='w-16 rounded-md border border-line bg-surface px-2 py-1 text-right text-sm tabular-nums text-ink'
                max={props.max}
                min={0}
                onChange={(event) => set(event.target.value)}
                step={1}
                type='number'
                value={props.value}
            />
            <span>ms</span>
        </div>
    );
};

/* Types */
interface MsSettingProps {
    label: string;
    hint: string;
    value: number;
    max: number;
    onChange: (value: number) => void;
}
