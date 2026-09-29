/* Core */

import { type ReactNode, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/* Components */
import { Notice, apiTrouble } from '@/components/Notice.tsx';
import { StatRow } from '@/components/StatRow.tsx';

/* Instruments */
import {
    type Span,
    type WindowName,
    subscribeLive,
    windowNames,
} from '@/api.ts';
import { colorOf } from '@/keyboard.ts';
import { queryKeys, useStats } from '@/queries.ts';
import { navigate } from '@/router.ts';
import { GHOST, H2, TAB } from '@/ui.ts';

const FOLD = `${GHOST} justify-self-start`;

// Two hundred rows are the point of this route — the terminal cuts them at fifteen and nothing
// here may — but they are not the point of arriving on it. Each table opens at a twenty-row
// window it can be scrolled inside, and keeps whichever answer dima gave it last. `never
// pressed` has no fold: it is thirteen rows and it is the list he came for.
//
// 607px holds twenty rows with a pixel to spare. Measured in the browser on all three lists
// rather than derived on paper, and re-measured after the typeset pass moved the ramp: twenty
// rows came to 606px, and exactly twenty stand fully inside the cap. 📌 Any pass that moves a
// type size measures this again, or "twenty rows" quietly stops being true.
const FOLD_TOP = 20;
const FOLD_HEIGHT = 607;

export const StatsPage = () => {
    const [window, setWindow] = useState<WindowName>('all');
    const queryClient = useQueryClient();
    const stats = useStats(window);
    const report = stats.data ?? null;
    // A failed refresh keeps the numbers that are already on screen — they have only stopped
    // being fresh — which is what the notice below says and what DESIGN.md asks for.
    const error = stats.error?.message ?? null;

    // The board has listened to this stream since it was built; this route was reading a
    // snapshot taken when it mounted, so a press showed up only after switching the window.
    // One EventSource for the life of the page, outside the fetch below, so changing the
    // window does not tear the stream down and build it again.
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        // The daemon replays its current counts the instant the stream opens, and that is the
        // same data the fetch below just asked for.
        let replayed = false;

        // One fetch per burst. /api/stats parses the whole log on every call and a held
        // chord arrives as a run of events.
        const soon = () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: queryKeys.stats });
            }, 1000);
        };

        const stop = subscribeLive({
            onBindings: soon,
            onPresses: () => {
                if (replayed) soon();
                replayed = true;
            },
        });

        return () => {
            clearTimeout(timer);
            stop();
        };
    }, [queryClient]);

    // Per table, because he expands the one he is reading and leaves the others alone.
    // localStorage throws outright in a private window and a throw in render blanks the page,
    // so both sides are guarded and an unreadable store simply means folded.
    const featuresFold = useFold('features');
    const chordsFold = useFold('chords');
    const chordAppsFold = useFold('chords-per-app');
    const switchAppsFold = useFold('switches-per-app');

    const windowTabListJSX = windowNames.map((name) => {
        return (
            <button
                aria-controls='stats-panel'
                aria-selected={name === window}
                className={`${TAB} ${name === window ? 'border-accent bg-sel text-ink' : 'border-line bg-transparent text-ink-2'}`}
                key={name}
                onClick={() => setWindow(name)}
                role='tab'
                type='button'>
                {name}
            </button>
        );
    });

    const retry = () => {
        stats.refetch();
    };

    // A failure only takes the page over when there is nothing behind it. With a report already
    // fetched the numbers are still true — they have only stopped being fresh — and throwing
    // them away was the defect: killing the daemon and switching the window replaced 402 good
    // rows with the browser's own «Failed to fetch».
    if (!report) {
        return error ? (
            <Notice onRetry={retry}>no stats — {apiTrouble(error)}</Notice>
        ) : (
            <p className='m-0 text-[13px] text-ink-2'>reading the log…</p>
        );
    }

    // The log is a month of lines and every table is ranked, so the first row is the scale for
    // the rest of its own section — never for another's.
    const topOf = (rows: readonly { count: number }[]) => rows[0]?.count ?? 0;

    return (
        <div className='grid gap-[22px]'>
            {error ? (
                <Notice onRetry={retry}>
                    these numbers stopped refreshing — {apiTrouble(error)}
                </Notice>
            ) : null}

            <div className='flex flex-wrap items-center gap-x-[18px] gap-y-2'>
                <div
                    aria-label='stats window'
                    className='flex flex-wrap gap-1.5'
                    role='tablist'>
                    {windowTabListJSX}
                </div>
                <SpanLabel span={report.span} />
            </div>

            <div className='flex flex-wrap gap-[22px]'>
                <Tile label='presses' value={report.presses} />
                <Tile label='chords' value={report.topChords.length} />
                <Tile label='switches' value={report.switches} />
                <Tile
                    label='never pressed'
                    of={report.boundCount}
                    value={report.neverPressed.length}
                />
            </div>

            {/*
              Four sections of very different length, and the shortest one — the rebind
              candidates — used to sit 12,000px down a single column. The board already owns
              this breakpoint and this grid, so the sections borrow it: the ranked chords lead
              on the left, the three supporting lists stack on the right, and the page stops
              being a scroll to reach its own conclusion. Reading order is unchanged — the dom
              order is still the brief's order, and each column runs top to bottom.

              The two columns are NOT equal, and the board's own 1fr 1fr is the wrong borrow
              here: a chord row carries a chord, an action and an app; an app row carries a
              name. Both numbers below were measured on the real 89 rows, not reasoned:
              1fr 1fr at 768 truncates 79 of 89 details, 1.45fr truncates 0 at full width, 5
              at 1024 and 30 at 900. So the second column is earned at 1024 and not before —
              a shorter page is not worth a third of the labels.
            */}
            <div
                className='grid grid-cols-1 items-start gap-[22px] min-[1024px]:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]'
                id='stats-panel'
                role='tabpanel'>
                <div className='grid gap-[22px]'>
                    <section className='grid gap-2.5'>
                        <h2 className={H2}>features</h2>
                        <StatList fold={featuresFold}>
                            {report.topFeatures.map((row) => {
                                return (
                                    <StatRow
                                        count={row.count}
                                        detail={row.chords
                                            .map(
                                                (each) =>
                                                    `${each.chord} ${each.count.toLocaleString('en')}`,
                                            )
                                            .join(' · ')}
                                        key={row.feature}
                                        label={row.feature}
                                        top={topOf(report.topFeatures)}
                                    />
                                );
                            })}
                        </StatList>
                        <FoldButton
                            fold={featuresFold}
                            total={report.topFeatures.length}
                        />
                    </section>

                    <section className='grid gap-2.5'>
                        <h2 className={H2}>chords</h2>
                        <StatList fold={chordsFold}>
                            {report.topChords.map((row) => {
                                return (
                                    <StatRow
                                        count={row.count}
                                        detail={
                                            row.action
                                                ? `${row.action} · ${row.app ?? ''}`
                                                : undefined
                                        }
                                        dotColor={
                                            row.app
                                                ? colorOf(row.app)
                                                : undefined
                                        }
                                        key={`${row.chord}-${row.action ?? ''}`}
                                        label={row.chord}
                                        onSelect={() => openOnBoard(row.chord)}
                                        top={topOf(report.topChords)}
                                    />
                                );
                            })}
                        </StatList>
                        <FoldButton
                            fold={chordsFold}
                            total={report.topChords.length}
                        />
                    </section>

                    <section className='grid gap-2.5'>
                        <h2 className={H2}>switches per app</h2>
                        <StatList fold={switchAppsFold}>
                            {report.switchesPerApp.map((row) => {
                                return (
                                    <StatRow
                                        count={row.count}
                                        key={row.bundleId}
                                        label={row.app}
                                        top={topOf(report.switchesPerApp)}
                                    />
                                );
                            })}
                        </StatList>
                        <FoldButton
                            fold={switchAppsFold}
                            total={report.switchesPerApp.length}
                        />
                    </section>
                </div>

                <div className='grid gap-[22px]'>
                    <section className='grid gap-2.5'>
                        <h2 className={H2}>chords per app</h2>
                        <StatList fold={chordAppsFold}>
                            {report.chordsPerApp.map((row) => {
                                return (
                                    <StatRow
                                        count={row.count}
                                        key={row.bundleId}
                                        label={row.app}
                                        top={topOf(report.chordsPerApp)}
                                    />
                                );
                            })}
                        </StatList>
                        <FoldButton
                            fold={chordAppsFold}
                            total={report.chordsPerApp.length}
                        />
                    </section>

                    <section className='grid gap-2.5'>
                        <h2 className={H2}>never pressed</h2>
                        <p className='text-[12px] text-ink-2'>
                            lifetime, whatever the window above says — a rebind
                            candidate does not stop being one because the view
                            got shorter.
                        </p>
                        <ul className='m-0 grid list-none gap-1 p-0'>
                            {report.neverPressed.map((row) => {
                                return (
                                    <li
                                        className='grid grid-cols-[64px_1fr] items-baseline gap-2.5 border-b border-line py-[3px] text-[13px]'
                                        key={row.chord}>
                                        <span />
                                        <span className='flex items-baseline gap-2 overflow-hidden'>
                                            <span
                                                className='relative top-px size-[9px] shrink-0 rounded-full'
                                                style={{
                                                    background: colorOf(
                                                        row.app,
                                                    ),
                                                }}
                                            />
                                            <button
                                                className='shrink-0 cursor-pointer border-0 bg-transparent min-w-[24px] px-0 py-[3px] -my-[3px] font-mono text-[13px] text-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
                                                onClick={() =>
                                                    openOnBoard(row.chord)
                                                }
                                                type='button'>
                                                {row.chord}
                                            </button>
                                            <span className='truncate text-[12px] text-ink-2'>
                                                {row.action} · {row.app}
                                            </span>
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                </div>
            </div>
        </div>
    );
};

/* Helpers */

// What the window actually covers, beside the control that set it. The log began six days
// before this was written, so `all`, `month` and `week` answer with the same numbers and the
// switch reads as dead — this line is the difference between a dead control and a short log.
// Absent, not just null: `pnpm chords:dev` proxies /api to the always-on daemon, which runs
// whatever is on main — so every field this app learns before a merge arrives undefined for a
// while, and a page that blanks on one is worse than a page missing one line.
const SpanLabel = (props: { span?: Span | null }) => {
    if (!props.span) return null;

    const { asked, days, from } = props.span;
    const short = asked !== null && days < asked;

    return (
        <span className='text-[12px] text-ink-2'>
            {short ? `last ${asked} days — the log starts ` : 'since '}
            <span className='font-mono'>{from}</span>
            {short ? null : ` · ${days} days`}
        </span>
    );
};

// Folded is a window, not a truncation: every row is in the dom and the rest of the list is a
// scroll away inside the section.
//
// `fold-window` lives in theme.css because the cue needs `::-webkit-scrollbar`, which no
// utility can express. It carries the overflow too, so the class is the whole folded state.
// A fade edge was the alternative and it is a gradient, which this world bans outright.
const StatList = (props: { fold: Fold; children: ReactNode }) => (
    <ul
        className={`m-0 grid list-none gap-1 p-0 ${props.fold.open ? '' : 'fold-window'}`}
        style={props.fold.open ? undefined : { maxHeight: FOLD_HEIGHT }}>
        {props.children}
    </ul>
);

const foldKey = (id: string) => `chords:fold:${id}`;

const useFold = (id: string): Fold => {
    const [open, setOpen] = useState(() => {
        try {
            return localStorage.getItem(foldKey(id)) === 'all';
        } catch {
            return false;
        }
    });

    return {
        open,
        toggle: () => {
            const next = !open;

            setOpen(next);
            try {
                localStorage.setItem(foldKey(id), next ? 'all' : 'top');
            } catch {
                // A private window refuses the write; the fold still works for this visit.
            }
        },
    };
};

// Absent on a table already shorter than the fold: a control whose two states look identical
// is worse than no control at all.
const FoldButton = (props: { fold: Fold; total: number }) =>
    props.total <= FOLD_TOP ? null : (
        <button className={FOLD} onClick={props.fold.toggle} type='button'>
            {props.fold.open
                ? `show top ${FOLD_TOP}`
                : `show all ${props.total.toLocaleString()}`}
        </button>
    );

// A chord is `mods+key`, and the board wants the two apart: the layer to open and the key to
// select. The last segment is the key, because a modifier never ends a chord.
const openOnBoard = (chord: string) => {
    const at = chord.lastIndexOf('+');
    const mods = at === -1 ? '' : chord.slice(0, at);
    const key = at === -1 ? chord : chord.slice(at + 1);

    navigate(
        `/?layer=${encodeURIComponent(mods)}&key=${encodeURIComponent(key)}`,
    );
};

const Tile = (props: TileProps) => (
    <div className='grid gap-1'>
        <span className='font-mono text-[22px]/[1] font-semibold tabular-nums text-ink'>
            {props.value.toLocaleString()}
            {props.of === undefined ? null : (
                <span className='text-[15px] font-normal text-ink-2'>
                    {' '}
                    of {props.of}
                </span>
            )}
        </span>
        <span className='font-sans text-[12px] tracking-[.06em] text-ink-2 uppercase'>
            {props.label}
        </span>
    </div>
);

/* Types */
interface Fold {
    open: boolean;
    toggle: () => void;
}
interface TileProps {
    label: string;
    of?: number;
    value: number;
}
