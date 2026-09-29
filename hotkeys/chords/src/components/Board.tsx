import type { ReactNode } from 'react';
import {
    type CSSProperties,
    useEffect,
    useEffectEvent,
    useRef,
    useState,
} from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/react';
import { chordOf } from '@hotkeys/chord.ts';
import type { Hotkey } from '@hotkeys/manual.ts';

import {
    capFamily,
    capLabel,
    colorOf,
    layerMods,
    layerName,
    layout,
    modKeys,
} from '@/keyboard.ts';

// A press is the cap sinking into its lip: 2px down, the lip gone, 70ms in and out. A click
// does it under the finger; a real press reported by the daemon does it once on the board.
const BASE =
    'relative flex min-h-[46px] cursor-pointer flex-col justify-between rounded-md border-0 px-[7px] py-[5px] text-left font-mono text-[12px]/[1.15] font-medium select-none transition-[transform,box-shadow] duration-75 ease-out active:translate-y-[2px] active:shadow-none data-[pressing]:translate-y-[2px] data-[pressing]:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-[current=true]:outline-2 aria-[current=true]:outline-offset-1 aria-[current=true]:outline-accent';
// Hover deepens the lip rather than tinting the cap. The lip is the only depth this world
// carries, a firmer edge reads as a key taken under a finger, and no new tone or motion enters
// the system to say it. Zero blur holds: the offset is still 2px and the radius still 0.
//
// Ink Muted rather than Ink Faint, measured against the deck the caps sit in: faint managed
// 2.43:1 in light, which is under the 3:1 a mark owes and too quiet to read as an answer. This
// pair is 4.78:1 light and 6.85:1 dark. The accent would have cleared too and is not available
// — it marks chosen, pressed and annotated, and a pointer resting on a key is none of them.
const FLAT =
    'shadow-[0_2px_0_var(--color-cap-edge)] hover:shadow-[0_2px_0_var(--color-ink-2)]';
// A bound key nobody has ever pressed is ringed rather than greyed: it is not disabled, it is
// a question — why is this here.
const COLD =
    'shadow-[0_2px_0_var(--color-cap-edge),inset_0_0_0_1.5px_var(--color-ink-3)] hover:shadow-[0_2px_0_var(--color-ink-2),inset_0_0_0_1.5px_var(--color-ink-3)]';
// The three faces a key wears while something is being dragged. A landing place is a dashed
// ring and the selection tint; the one under the pointer fills solid; anything that cannot take
// the drop — a modifier, a taken key, the key being dragged — fades and says so with the
// cursor, so the answer is never colour alone.
const CAN_DROP =
    'bg-sel outline-2 outline-dashed outline-offset-1 outline-accent hover:shadow-[0_2px_0_var(--color-cap-edge)]';
const OVER =
    'bg-accent text-on-accent outline-2 outline-offset-1 outline-accent';
const CANNOT_DROP = 'cursor-not-allowed opacity-45';
// The cap in flight: a slight lift and lean, transform only, so reduced-motion has nothing to
// object to — there is no animation, just a pose.
// Written out, not built from the family name: tailwind emits only the classes it can read.
const FAMILY_TONE = {
    arrow: 'bg-cap-arrow',
    esc: 'bg-cap-esc',
    fn: 'bg-cap-fn',
    help: 'bg-cap-help',
    num: 'bg-cap-num',
    snip: 'bg-cap-snip',
} as const;
const LEDS = ['b1', 'b2', 'g1', 'g2', 'y1', 'y2', 'o1', 'r1'] as const;

const LIFTED =
    'z-10 rotate-[-2deg] scale-105 shadow-[0_10px_24px_-8px_rgba(0,0,0,.45)] outline-2 outline-accent';

export const Board = (props: BoardProps) => {
    const bound = new Map<string, Hotkey[]>();

    for (const hotkey of props.binds) {
        const existing = bound.get(hotkey.key);

        if (existing) existing.push(hotkey);
        else bound.set(hotkey.key, [hotkey]);
    }

    const lit = layerMods(props.layer);

    const rowListJSX = layout.map((row) => {
        // The first keycap names the row — a fixed board never reorders, and a row index would
        // be a key that means nothing.
        const rowId = row[0][0];
        const keyListJSX = row.map(([label, width]) => {
            if (!label) {
                // The Air75 has one gap on its top row, and the volume knob sits in it. Here it
                // turns the layer: a click steps forward, the wheel goes either way.
                return rowId === 'esc' ? (
                    <Knob
                        key='knob'
                        layer={props.layer}
                        layers={props.layers}
                        onLayer={props.onLayer}
                        width={width}
                    />
                ) : (
                    <span
                        className='invisible'
                        key={`gap-${rowId}`}
                        style={{ gridColumn: `span ${width}` }}
                    />
                );
            }

            return (
                <Keycap
                    binds={bound.get(label) ?? []}
                    dragging={props.dragging}
                    isLit={modKeys.has(label) && lit.has(label)}
                    key={label}
                    label={label}
                    layer={props.layer}
                    noted={props.noted.has(label)}
                    onSelect={props.onSelect}
                    pending={props.pending.includes(label)}
                    pressed={props.pressed}
                    presses={props.presses}
                    selected={props.selected === label}
                    width={width}
                />
            );
        });

        return (
            <div
                className='grid grid-cols-[repeat(64,minmax(0,1fr))] gap-1.5'
                key={`row-${rowId}`}>
                {keyListJSX}
            </div>
        );
    });

    // The rails sit on the deck outside the key grid, the way the lights sit on the case and
    // not between the caps.
    // `key` on the rail re-mounts it when a rebind lands, which is what plays the sweep once.
    const railJSX = (side: 'left' | 'right') => (
        <span
            aria-hidden
            className='led-rail'
            data-side={side}
            data-sweep={props.landedAt ? '' : undefined}
            key={`${side}-${props.landedAt ?? 0}`}>
            {LEDS.map((led, at) => (
                <i key={led} style={{ '--at': at } as CSSProperties} />
            ))}
        </span>
    );

    // The strip is the deck's top band — part of the body, flush with its rounded edge.
    return (
        <div className='overflow-x-auto rounded-[14px] bg-board'>
            {props.strip}
            <div className='grid min-w-[760px] grid-cols-[auto_minmax(0,1fr)_auto] gap-2.5 p-3.5 pt-2.5'>
                {railJSX('left')}
                <div className='grid gap-1.5'>{rowListJSX}</div>
                {railJSX('right')}
            </div>
        </div>
    );
};

// One keycap is both ends of a rebind: the draggable when it carries a hand-kept binding, the
// droppable when it is free. Only a row that lives in manual.ts can move — everything else is
// read out of its own app's config, so a write here would be a lie the next scan erases.
const Keycap = (props: KeycapProps) => {
    const isMod = modKeys.has(props.label);
    const chord = chordOf({ key: props.label, mods: props.layer });
    const hits = props.binds.length ? (props.presses[chord] ?? 0) : 0;
    const movable = props.binds.find((bind) => bind.source === 'manual');
    const isSource = props.dragging?.key === props.label;
    const canDrop = Boolean(
        props.dragging &&
            !isMod &&
            !isSource &&
            !props.pending &&
            props.binds.length === 0,
    );

    const drag = useDraggable({
        data: { hotkey: movable },
        disabled: !movable || props.pending,
        id: `cap:${props.label}`,
    });
    const drop = useDroppable({
        data: { key: props.label },
        disabled: !canDrop,
        id: `key:${props.label}`,
    });
    const cap = useRef<HTMLButtonElement | null>(null);
    const [pressing, setPressing] = useState(false);

    // The daemon's press stream names the chord that just fired; this cap sinks for 140ms when
    // it was the one.
    useEffect(() => {
        if (!props.pressed || props.pressed.chord !== chord) return;

        setPressing(true);
        const timer = setTimeout(() => setPressing(false), 140);
        return () => clearTimeout(timer);
    }, [props.pressed, chord]);

    // The selected key is where the keyboard is: a click lands focus here anyway, and a rebind
    // or a stats link selects without a click, so the cap takes it — never the note field.
    useEffect(() => {
        if (props.selected) cap.current?.focus({ preventScroll: true });
    }, [props.selected]);

    // 📌 The surface says unbound, the label does not. A free key and an unheld modifier are
    // focusable, operable buttons — clicking one selects it — so their legend is an accessible
    // name and owes 4.5:1, which Ink Faint never had here (2.55:1 light, 3.36:1 dark). The grey
    // cap keeps carrying the meaning; only the text that has to be read moved.
    const family = capFamily[props.label];
    const tone = [
        props.isLit
            ? 'bg-sel'
            : props.binds.length
              ? 'bg-cap'
              : family
                ? FAMILY_TONE[family]
                : 'bg-cap-free',
        isMod
            ? props.isLit
                ? 'text-ink'
                : 'text-ink-2'
            : props.binds.length
              ? 'text-ink'
              : 'text-ink-2',
        props.binds.length ? 'border-t-4' : '',
    ].join(' ');
    const dragTone = drag.isDragging
        ? LIFTED
        : props.dragging
          ? drop.isDropTarget
              ? OVER
              : canDrop
                ? CAN_DROP
                : CANNOT_DROP
          : '';
    const lip = props.binds.length && !hits ? COLD : FLAT;

    return (
        <button
            aria-busy={props.pending}
            // 📌 Selection cannot ride aria-pressed here. dnd-kit writes its own a11y set
            // straight onto this node — aria-roledescription, aria-grabbed, and aria-pressed,
            // which for it means "grabbed" — so React's value is overwritten the moment the
            // cap becomes draggable, which is every cap worth picking. The outline never
            // appeared on the board and only :focus-visible was ever showing, which dies as
            // soon as focus moves to the note field. aria-current is the right word anyway:
            // this is the current item in a set, not a toggle.
            aria-current={props.selected}
            className={`${BASE} ${tone} ${lip} ${dragTone} ${movable && !props.pending ? 'cursor-grab active:cursor-grabbing' : ''} ${props.pending ? 'cursor-progress outline-2 outline-dashed outline-offset-1 outline-ink-3' : ''}`}
            data-pressing={pressing ? '' : undefined}
            onClick={() => {
                // The pointer comes up on the cap it dragged, so a drop ends in a click on the
                // source — which is not a selection.
                if (drag.isDragging || drag.isDropping || props.pending) return;
                props.onSelect(props.label);
            }}
            ref={(element) => {
                cap.current = element;
                drag.ref(element);
                drop.ref(element);
            }}
            style={{
                borderTopColor: props.binds[0]
                    ? colorOf(props.binds[0].app)
                    : undefined,
                gridColumn: `span ${props.width}`,
            }}
            title={
                props.binds.map((b) => `${b.app}: ${b.action}`).join('\n') ||
                `${chord} — free`
            }
            type='button'>
            {/*
              The count rides the legend line rather than the bottom-right corner it used to sit
              in. Both it and the action label owed 12px — the fleet floor for dense data — and
              at 12px in the corner the count's clearance ate the narrow keycaps' labels down to
              one character and an ellipsis: 19 of 34 on the cmd layer. Up here the legend is
              short and the count is short, the two of them fit the tightest 1u cap together,
              and the label gets the whole second line instead of two thirds of it.
            */}
            <span className='flex items-baseline justify-between gap-1'>
                <span className='min-w-0 overflow-hidden'>
                    {props.label === 'caps' && props.layer === 'hyper'
                        ? 'hyper'
                        : (capLabel[props.label] ?? props.label)}
                </span>
                {props.binds.length > 0 && (
                    <span
                        className={`font-mono text-[12px]/none font-medium tabular-nums ${hits ? 'text-accent' : 'text-ink-3'}`}>
                        {props.pending ? '…' : hits || '—'}
                    </span>
                )}
            </span>
            <span className='overflow-hidden font-sans text-[12px]/[1.15] font-normal text-ellipsis whitespace-nowrap text-ink-2'>
                {props.pending && !props.binds[0]
                    ? 'was here…'
                    : props.binds[0]
                      ? props.binds[0].action +
                        (props.binds.length > 1
                            ? ` +${props.binds.length - 1}`
                            : '')
                      : ''}
            </span>
            {/* The corner the count left. A 7px dot fits anywhere; the count did not. */}
            {props.noted && (
                <span className='absolute right-1.5 bottom-1.5 size-[7px] rounded-full bg-accent' />
            )}
        </button>
    );
};

// The dial's notch points at the current layer: the layer's index around the full turn. The
// angle accumulates whole turns so last → first keeps turning forward instead of unwinding.
const Knob = (props: KnobProps) => {
    const at = Math.max(0, props.layers.indexOf(props.layer));
    const count = props.layers.length;
    const turns = useRef({ at, whole: 0 });

    if (turns.current.at !== at) {
        if (turns.current.at === count - 1 && at === 0)
            turns.current.whole += 1;
        if (turns.current.at === 0 && at === count - 1)
            turns.current.whole -= 1;
        turns.current.at = at;
    }

    const angle = (360 / count) * (at + turns.current.whole * count);
    const step = (delta: number) => {
        const next =
            props.layers[
                (at + delta + props.layers.length) % props.layers.length
            ];

        if (next !== undefined) props.onLayer(next);
    };

    // React attaches onWheel as a passive listener, so its preventDefault is ignored and the page
    // scrolls under the dial. A native listener with passive: false makes the browser wait for it.
    const knob = useRef<HTMLButtonElement | null>(null);
    const onWheel = useEffectEvent((event: WheelEvent) => {
        event.preventDefault();
        step(event.deltaY > 0 ? 1 : -1);
    });

    useEffect(() => {
        const element = knob.current;

        if (!element) return;

        element.addEventListener('wheel', onWheel, { passive: false });
        return () => element.removeEventListener('wheel', onWheel);
    }, []);

    return (
        <span
            className='flex items-center justify-center'
            style={{ gridColumn: `span ${props.width}` }}>
            <button
                aria-label={`layer dial — ${layerName(props.layer)}`}
                className='knob relative size-[38px] cursor-pointer rounded-full border-0 p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
                onClick={() => step(1)}
                ref={knob}
                style={{ transform: `rotate(${angle}deg)` }}
                title='turn: next layer · wheel: either way'
                type='button'>
                <span className='knob-notch' />
            </button>
        </span>
    );
};

/* Types */
interface KnobProps {
    layer: string;
    layers: readonly string[];
    onLayer: (layer: string) => void;
    width: number;
}
interface BoardProps {
    binds: readonly Hotkey[];
    // The binding in flight, while a drag is on; the board draws every landing place from it.
    dragging: Hotkey | null;
    // The moment the last rebind's rescan arrived; the rails sweep once per value.
    landedAt: number | null;
    layer: string;
    layers: readonly string[];
    noted: ReadonlySet<string>;
    onLayer: (layer: string) => void;
    onSelect: (key: string) => void;
    // The two keys of a rebind in flight — where it left and where it landed — held until the
    // daemon writes and rescans.
    pending: readonly string[];
    // The chord the daemon last saw fire, and when — one sink on the board per press.
    pressed: { chord: string; at: number } | null;
    presses: Record<string, number>;
    selected: string | null;
    strip: ReactNode;
}
interface KeycapProps {
    binds: readonly Hotkey[];
    dragging: Hotkey | null;
    isLit: boolean;
    label: string;
    layer: string;
    noted: boolean;
    onSelect: (key: string) => void;
    pending: boolean;
    pressed: { chord: string; at: number } | null;
    presses: Record<string, number>;
    selected: boolean;
    width: number;
}
