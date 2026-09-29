import type { CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/react/sortable';

import { BRAND_HUE, EngineMark } from '@/components/EngineMark.tsx';
import { Info } from '@/components/Info.tsx';
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
    // a quota refusal fails every preview until the credits come back, so ▶ is locked; the badge says why
    const quotaNote =
        props.status?.state === 'no quota' ? props.status.note : undefined;
    const sortable = useSortable({
        disabled: !isOn,
        group: props.lang,
        id: `${props.lang}:${props.engine}`,
        index: props.rank ?? -1,
    });

    // ▶ starts a preview; while this card plays, ⏸ / ▶ pause and resume it and ■ stops it
    const playJSX = props.playState ? (
        <>
            <button
                aria-label={`${props.playState === 'paused' ? 'resume' : 'pause'} ${label}`}
                className={buttonClass}
                onClick={props.onPause}
                type='button'>
                {props.playState === 'paused' ? '▶' : '⏸'}
            </button>
            <button
                aria-label={`stop ${label}`}
                className={buttonClass}
                onClick={props.onStop}
                type='button'>
                ■
            </button>
        </>
    ) : (
        <button
            aria-label={`preview ${label} in ${props.lang}`}
            className={buttonClass}
            disabled={quotaNote !== undefined}
            onClick={props.onPreview}
            title={quotaNote && 'out of quota — nothing to preview'}
            type='button'>
            ▶
        </button>
    );

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
                info='how fast the voice talks. too fast → lower it. try 1.0'
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
                    info='how loud the voice is. too quiet → raise it. try 1.5'
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
            className={`grid gap-3 rounded-2xl p-4 ${isOn ? 'brand-wash border border-line' : 'border border-dashed border-line'} ${sortable.isDropTarget ? 'outline-2 outline-accent' : ''}`}
            data-engine={props.engine}
            // only a chain card is sortable: dnd-kit stamps role and a tab stop on what it registers
            ref={isOn ? sortable.ref : undefined}
            style={{ '--brand': BRAND_HUE[props.engine] } as CSSProperties}>
            <div className='flex items-center gap-2.5'>
                {isOn && (
                    // dnd-kit's keyboard handle too: space picks the card up, arrows move it, space drops
                    <button
                        aria-label={`drag ${label} to reorder`}
                        className='-ml-1.5 inline-grid h-7 w-6 cursor-grab select-none place-items-center rounded text-base leading-none text-muted hover:text-ink active:cursor-grabbing'
                        ref={sortable.handleRef}
                        title='drag to reorder'
                        type='button'>
                        ⠿
                    </button>
                )}
                <EngineMark engine={props.engine} isDim={!isOn} />
                <span className='flex-1 font-semibold'>{label}</span>
                <StateBadge state={props.status} />
            </div>
            <div className='flex items-center gap-2'>
                <label className='inline-flex min-h-8 cursor-pointer select-none items-center gap-2.5 text-sm'>
                    <input
                        aria-checked={isOn}
                        checked={isOn}
                        className='size-4'
                        onChange={(event) =>
                            props.onToggle(event.target.checked)
                        }
                        role='switch'
                        type='checkbox'
                    />
                    {isOn
                        ? `${ordinal((props.rank ?? 0) + 1)} in the ${props.lang} chain`
                        : `in the ${props.lang} chain`}
                </label>
                <span className='flex-1' />
                {orderJSX}
                {playJSX}
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

/* Styles */
// the pill's button, on the page: a round hairline
const buttonClass =
    'inline-grid size-8 place-items-center rounded-full border border-line bg-surface-2 text-sm hover:border-muted hover:bg-surface disabled:opacity-40';

/* Helpers */
const ordinal = (n: number) =>
    `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;

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
    onPause: () => void;
    onStop: () => void;
    playState?: 'playing' | 'paused';
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
