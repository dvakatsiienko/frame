import { useSortable } from '@dnd-kit/react/sortable';

import { StateBadge } from '@/components/StateBadge.tsx';
import { VoicePicker } from '@/components/VoicePicker.tsx';

import {
    ENGINE_LABELS,
    type Engine,
    type EngineSettings,
    type Lang,
    type Status,
} from '@/api.ts';

export const EngineCard = (props: EngineCardProps) => {
    const label = ENGINE_LABELS[props.engine];
    const isOn = props.rank !== undefined;
    const sortable = useSortable({
        disabled: !isOn,
        group: props.lang,
        id: `${props.lang}:${props.engine}`,
        index: props.rank ?? -1,
    });

    const orderJSX = isOn && (
        <>
            <button
                aria-label={`move ${label} up`}
                className={buttonClass}
                disabled={props.rank === 0}
                onClick={() => props.onMove(-1)}
                type='button'>
                ↑
            </button>
            <button
                aria-label={`move ${label} down`}
                className={buttonClass}
                disabled={props.isLast}
                onClick={() => props.onMove(1)}
                type='button'>
                ↓
            </button>
        </>
    );

    const settingsJSX = isOn && (
        <div className='grid gap-2'>
            <VoicePicker
                favourites={props.settings.favourites ?? []}
                label={`${label} voice for ${props.lang}`}
                onChange={props.onVoice}
                onFavourite={props.onFavourite}
                options={props.voiceOptions}
                value={props.voice}
            />
            <Slider
                label='speed'
                max={2}
                min={0.5}
                name={`${label} speed`}
                onChange={(value) => props.onSettings({ speed: value })}
                step={0.05}
                value={props.settings.speed ?? 1}
            />
            {props.engine !== 'system' && (
                <Slider
                    info='loudness: 1 is the voice as the engine sends it, 2 is twice as loud'
                    label='gain'
                    max={4}
                    min={0}
                    name={`${label} gain`}
                    onChange={(value) => props.onSettings({ gain: value })}
                    step={0.1}
                    value={props.settings.gain ?? 1}
                />
            )}
        </div>
    );

    return (
        <li
            className={`grid gap-2 rounded-lg p-3 ${isOn ? 'border border-line bg-surface' : 'border border-dashed border-line'} ${sortable.isDropTarget ? 'outline-2 outline-accent' : ''}`}
            data-engine={props.engine}
            // only a chain card is sortable: dnd-kit stamps role and a tab stop on what it registers
            ref={isOn ? sortable.ref : undefined}>
            <div className='flex items-center gap-2'>
                {isOn && (
                    // dnd-kit's keyboard handle too: space picks the card up, arrows move it, space drops
                    <button
                        aria-label={`drag ${label} to reorder`}
                        className='inline-grid size-6 cursor-grab select-none place-items-center text-lg leading-none text-muted active:cursor-grabbing'
                        ref={sortable.handleRef}
                        title='drag to reorder'
                        type='button'>
                        ⠿
                    </button>
                )}
                <span className='text-sm tabular-nums text-muted'>
                    {isOn ? (props.rank ?? 0) + 1 : '–'}
                </span>
                <span className='flex-1 font-semibold'>{label}</span>
                <StateBadge state={props.status} />
            </div>
            <div className='flex items-center gap-2'>
                <label className='inline-flex cursor-pointer select-none items-center gap-1 text-sm'>
                    <input
                        aria-checked={isOn}
                        checked={isOn}
                        className='size-6'
                        onChange={(event) =>
                            props.onToggle(event.target.checked)
                        }
                        role='switch'
                        type='checkbox'
                    />
                    in the {props.lang} chain
                </label>
                <span className='flex-1' />
                {orderJSX}
                <button
                    aria-label={`preview ${label} in ${props.lang}`}
                    className={buttonClass}
                    onClick={props.onPreview}
                    type='button'>
                    ▶
                </button>
            </div>
            {settingsJSX}
        </li>
    );
};

const Slider = (props: SliderProps) => {
    return (
        <div className='grid grid-cols-[64px_1fr_40px] items-center gap-2 text-sm text-muted'>
            <span className='flex items-center gap-1'>
                {props.label}
                {props.info && <Info text={props.info} />}
            </span>
            <input
                aria-label={props.name}
                className='h-6 w-full'
                max={props.max}
                min={props.min}
                onChange={(event) => props.onChange(Number(event.target.value))}
                step={props.step}
                type='range'
                value={props.value}
            />
            <output className='text-right tabular-nums text-ink'>
                {props.value.toFixed(props.step < 0.1 ? 2 : 1)}
            </output>
        </div>
    );
};

// a small «i»: its line shows on hover and on keyboard focus, and Esc hides it
const Info = (props: { text: string }) => {
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
                className='invisible absolute bottom-full left-0 z-10 mb-1 w-56 rounded-md border border-line bg-surface p-2 text-sm text-ink shadow-md group-focus-within:visible group-hover:visible'
                role='tooltip'>
                {props.text}
            </span>
        </span>
    );
};

/* Styles */
const buttonClass =
    'min-h-8 min-w-8 rounded-md border border-line bg-surface-2 px-3 py-1 text-sm hover:border-muted hover:bg-surface disabled:opacity-50';

/* Types */
interface EngineCardProps {
    engine: Engine;
    lang: Lang;
    rank?: number;
    isLast: boolean;
    settings: EngineSettings;
    status?: NonNullable<Status['engines']>[Engine];
    voice: string;
    voiceOptions: [string, string][];
    onMove: (step: -1 | 1) => void;
    onPreview: () => void;
    onSettings: (patch: EngineSettings) => void;
    onToggle: (isOn: boolean) => void;
    onVoice: (voice: string) => void;
    onFavourite: (voice: string, isFavourite: boolean) => void;
}

interface SliderProps {
    info?: string;
    label: string;
    name: string;
    min: number;
    max: number;
    step: number;
    value: number;
    onChange: (value: number) => void;
}
