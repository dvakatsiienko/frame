// 🚦 the board (FRM-662): the fleet board pane's draw — the asks strip, every session's row, the kept steers — and the
// cards in their order; the orbit, glide and phases cards draw in board-orbit.tsx, board-glide.tsx and board-phases.tsx
// over board-kit.tsx's kit; the wiring's layer, beside register.tsx

import type { EngineInterface, RenderElement, RenderInput } from 'claude-code';

import { glideCards } from './board-glide.tsx';
import { LINE_GAP, boardKit } from './board-kit.tsx';
import { orbitCard } from './board-orbit.tsx';
import { phasesCard } from './board-phases.tsx';
import { dropKept, takeFieldsOnce } from './fields.ts';
import { pressHot } from './keep-warm.ts';
import {
    CTX_BAR,
    CTX_FALLBACK_AT,
    CTX_RING,
    EFFORT_CELL,
    PALETTE,
    contextFill,
    ctxBar,
    ctxBarSvg,
    ctxRingSvg,
    effortCells,
    effortLevel,
    effortSvg,
    huesOf,
    idleTint,
    markOf,
    span,
    statusOf,
} from './look.ts';
import { ticketOf, unbold, waitSpans } from './parse.ts';
import { type Member, openBoard } from './roster.ts';
import { flipKnob } from './settings-store.ts';
import { cleanTree, drawn } from './tree.ts';
import { meterNow } from './usage.ts';
import { load, publish, viewDoors } from './view.ts';
import { flipWind } from './wind.ts';
import { WIND_EMOJI, windSay } from './wind-run.ts';

const CLIO_ASKS = { key: 'clioAsks', plugin: 'x-mod-stash' } as const;
// a board card folded to its head row, per session (dima's o5, 17:16)
const FOLDS = { key: 'folds', plugin: 'x-mod-stash' } as const;

const ACCENT = PALETTE.accent;
async function pressWind($: EngineInterface, sid: string) {
    await flipWind($, sid);
    await load($);
}
// each fact column's width in cells, sized to its usual reading — `🪐 12`, `FRM-306`, `ctx 54%`, `idle 12m` — so little slack shows between columns; a longer one is cut at its end
const COLUMNS = {
    asks: 4,
    // the terminal's 10-wide ctx bar; the desktop's svg takes its own width (CTX_COLUMNS)
    context: 10,
    ticket: 9,
} as const;
export async function drawBoard($: EngineInterface, e: RenderInput<'Pane'>) {
    // a reload can draw the board before its start: the kept boxes come back first, or each remounts under a new key
    await takeFieldsOnce($);
    try {
        return cleanTree(
            await (async () => {
                const k = await boardKit($, e);
                const {
                    Box,
                    Text,
                    Button,
                    Link,
                    Svg,
                    board,
                    keptDrawn,
                    now,
                    me,
                    isPartOn,
                    foldedOf,
                    isFolded,
                    foldJSX,
                    cardProps,
                    speakJSX,
                } = k;
                const orbitJSX = orbitCard($, k);
                const laneJSX = await glideCards($, k);
                // 🙋 the board's top while a clio's own orbit asks wait on dima: their count, then each clio, a press scrolls
                // to its asks; a member's asks show only on its lane card, since they reach dima through a clio (FRM-643)
                const waitingOn = isPartOn('stash.orbit')
                    ? ((await $.state.get(CLIO_ASKS)).value ?? [])
                    : [];
                const waitingCount = waitingOn.reduce((sum, w) => sum + w.n, 0);
                const stripJSX = drawn('asks', () =>
                    waitingCount ? (
                        <Box
                            key='asks-strip'
                            {...cardProps}
                            alignItems='center'
                            borderColor={PALETTE.warn}
                            columnGap={1}
                            flexDirection='row'
                            flexWrap='wrap'
                            marginBottom={1}>
                            <Text bold color={PALETTE.warn}>
                                {`🙋 ${waitingCount} ask${waitingCount === 1 ? ' waits' : 's wait'} for you`}
                            </Text>
                            {waitingOn.map((w) => (
                                <Button
                                    key={`asks-strip:${w.sid}`}
                                    onPress={() =>
                                        void $.ui
                                            .scroll({
                                                block: 'start',
                                                to: {
                                                    key: w.isSelf
                                                        ? 'orbit'
                                                        : 'sessions',
                                                },
                                            })
                                            .catch(() => undefined)
                                    }
                                    plain>
                                    {`· ${w.name} ${w.n}`}
                                </Button>
                            ))}
                        </Box>
                    ) : null,
                );
                const phasesJSX = await phasesCard($, k);
                const fill =
                    e.props.placement === 'dock'
                        ? e.props.scroll.bodyRows
                        : undefined;
                // the board top to bottom: what the sessions part shows, orbit, then a gap that docks the glide and phase cards at
                // the bottom (dima's shot, 20:12)
                const probes = board?.staleProbes ?? [];
                const probesJSX = probes.length ? (
                    <Text color={PALETTE.warn} key='probes' wrap='truncate-end'>
                        {`🧪 stale probe mods in ~/.claude/dev-mods, unload them: ${probes.join(', ')}`}
                    </Text>
                ) : null;
                // a kept steer whose box is not drawn (its ask resolved, its lane gone or folded): shown here with a ✕, the way
                // out, read after every card drew its own offers
                const keptElsewhereJSX = () =>
                    Object.entries(board?.keptSteers ?? {})
                        .filter(([key]) => !keptDrawn.has(key))
                        .map(([key, list]) => (
                            <Box
                                flexDirection='row'
                                gap={1}
                                key={`kept-elsewhere:${key}`}>
                                <Box flexShrink={1} minWidth={0}>
                                    <Text dimColor wrap='truncate-end'>
                                        {`↩️ kept, its box is not on the board: «${list.at(-1) ?? ''}»${list.length > 1 ? ` +${list.length - 1}` : ''}`}
                                    </Text>
                                </Box>
                                <Button
                                    key={`kept-drop:${key}`}
                                    onPress={() =>
                                        dropKept($, key, viewDoors($))
                                    }
                                    plain>
                                    ✕
                                </Button>
                            </Box>
                        ));
                const arranged = (top: RenderElement) => (
                    <Box flexDirection='column' minHeight={fill}>
                        {stripJSX}
                        {probesJSX}
                        {keptElsewhereJSX()}
                        {top}
                        {isPartOn('stash.orbit') ? orbitJSX : null}
                        <Box flexGrow={1} key='phases:gap' />
                        {laneJSX}
                        {phasesJSX}
                    </Box>
                );
                const list = board?.members;
                if (!list)
                    return arranged(
                        <Text dimColor>
                            the session registry is unreadable
                        </Text>,
                    );
                if (!list.length)
                    return arranged(<Text dimColor>no live sessions</Text>);
                const isColour = board.isColour;
                // the band's ctx ramp needs this session's compaction point, which the rows share; unknown, it falls back to 80, the
                // old red line, so a full session never reads calm
                const compactAt =
                    (await meterNow($))?.compactAt ?? CTX_FALLBACK_AT;
                // the desktop's ctx meter as dima switched it: the ring takes 7 cells, the bar 5, the terminal's text bar 10
                const isRing = board.isRing;
                const ctxTake = isRing ? CTX_RING : CTX_BAR;
                const contextColumns = Svg ? (isRing ? 7 : 5) : COLUMNS.context;
                const hues = huesOf(list.map((m) => m.name));
                // the ticket column is drawn only when some row names a ticket: empty on every row, it was 9 cells of nothing (dima, 15:41)
                const hasTickets = list.some((m) => ticketOf(m.name));
                // the state column as wide as the board's longest time, its emoji and gap included: a fixed 9 left «1m» rows a
                // gap before their 🪐 n (dima, 10-13 17:45)
                const stateColumns = Math.max(
                    ...list.map(
                        (m) =>
                            4 +
                            (m.statusSince === undefined
                                ? 0
                                : span(now - m.statusSince).length),
                    ),
                );
                const row = (m: Member, i: number) => {
                    const status = statusOf(m.status);
                    const sinceMs =
                        m.statusSince === undefined
                            ? undefined
                            : now - m.statusSince;
                    // the time's tint: idle by its thresholds alone, a working row always green, the rest with colour on
                    const timeTint = status.isIdle
                        ? idleTint(sinceMs ?? 0)
                        : status.isWorking || isColour
                          ? status.tint
                          : undefined;
                    const ticket = ticketOf(m.name);
                    const mark = markOf({
                        isIdle: status.isIdle,
                        isOffPattern: !!m.offPattern,
                        ms: sinceMs ?? 0,
                    });
                    const name = m.sid === me ? `${m.name} (here)` : m.name;
                    const line = m.tip
                        ? `👀 ${m.tip}`
                        : m.wait && `🔭 ${unbold(m.wait)}`;
                    // «opus 5.5 · medium» as kept: the model in words, its effort as cells beside it on the name's line
                    const [model, effort] = (m.model ?? '').split(' · ');
                    const level = effortLevel(effort);
                    const effortJSX =
                        level === undefined ? (
                            effort ? (
                                <Text dimColor>{effort}</Text>
                            ) : null
                        ) : Svg ? (
                            <Svg
                                alt={`effort ${effort}`}
                                height={EFFORT_CELL}
                                key={`m:${m.sid}:effort`}
                                source={effortSvg(level)}
                            />
                        ) : (
                            <Text>
                                {effortCells(level).map((c, k) => {
                                    return (
                                        // biome-ignore lint/suspicious/noArrayIndexKey: a cell's place is its identity
                                        <Text
                                            color={c.color}
                                            dimColor={!c.color}
                                            key={`c:${k}`}>
                                            {c.kind === 'fill' ? '▮' : '▯'}
                                        </Text>
                                    );
                                })}
                            </Text>
                        );
                    return (
                        <Box
                            flexDirection='column'
                            key={`m:${m.sid}`}
                            // the desktop's rows sit closer, the cards mock's spacing (dima, 17:27); a terminal row cannot be split
                            marginTop={
                                i > 0 ? (e.surface === 'desktop' ? 0.6 : 1) : 0
                            }
                            rowGap={LINE_GAP}>
                            <Box
                                flexDirection='row'
                                gap={1}
                                justifyContent='space-between'>
                                {/* the name side gives way, clipped, so a long name never pushes the fact columns out of line */}
                                <Box
                                    flexDirection='row'
                                    flexGrow={1}
                                    flexShrink={1}
                                    gap={1}
                                    minWidth={0}
                                    overflow='hidden'>
                                    {/* the dot leads the row, the reference's cue: with colour on, the member's own hue, dimmed while idle */}
                                    <Box flexShrink={0}>
                                        <Text
                                            color={
                                                isColour ? hues[i] : undefined
                                            }
                                            dimColor={
                                                !isColour || status.isIdle
                                            }>
                                            ●
                                        </Text>
                                    </Box>
                                    {/* every name bold text, no control: the board opens no session (dima, 17:42) */}
                                    <Text bold wrap='truncate-end'>
                                        {name}
                                    </Text>
                                    {mark === '⚠' ? (
                                        <Text color={ACCENT}>⚠</Text>
                                    ) : mark ? (
                                        <Text>{mark}</Text>
                                    ) : null}
                                    {/* quiet comms: the member pings held for clio's next turn, nothing at 0 */}
                                    {m.held ? (
                                        <Box flexShrink={0}>
                                            <Button
                                                key={`fold:quiet:${m.sid}`}
                                                onPress={async () => {
                                                    const was =
                                                        (
                                                            await $.state.get(
                                                                FOLDS,
                                                            )
                                                        ).value ?? {};
                                                    await $.state.set(FOLDS, {
                                                        ...was,
                                                        [`quiet:${m.sid}`]:
                                                            !foldedOf(
                                                                was,
                                                                `quiet:${m.sid}`,
                                                            ),
                                                    });
                                                }}
                                                plain>
                                                {m.isHeldStuck ? (
                                                    <Text color='error'>
                                                        {`🤫 ${m.held.length}`}
                                                    </Text>
                                                ) : (
                                                    `🤫 ${m.held.length}`
                                                )}
                                            </Button>
                                        </Box>
                                    ) : null}
                                    {/* the name's line: the model and its effort cells right of the name (dima, 15:27; o6, 15:49) */}
                                    {model && isPartOn('stash.rowmeta') ? (
                                        <Box
                                            alignItems='center'
                                            flexDirection='row'
                                            flexShrink={0}
                                            gap={
                                                e.surface === 'desktop'
                                                    ? 0.5
                                                    : 1
                                            }>
                                            <Text dimColor>{model}</Text>
                                            {effortJSX}
                                        </Box>
                                    ) : null}
                                </Box>
                                {/* one fixed-width, right-aligned cell per fact, drawn empty when it has no reading, so the columns line up across rows (dima, 2026-10-05) */}
                                <Box
                                    flexDirection='row'
                                    flexShrink={0}
                                    gap={e.surface === 'desktop' ? 0.5 : 1}>
                                    {/* no hover card in the pane: an absolute card in a narrow row wraps and clips (dima, 2026-10-05) */}
                                    {hasTickets ? (
                                        <Box
                                            justifyContent='flex-end'
                                            width={COLUMNS.ticket}>
                                            {ticket ? (
                                                // never wraps: `FRM-306` broke at its hyphen in the desktop font
                                                <Text
                                                    dimColor
                                                    wrap='truncate-end'>
                                                    <Link
                                                        href={`https://linear.app/x-com/issue/${ticket}`}>
                                                        {ticket}
                                                    </Link>
                                                </Text>
                                            ) : null}
                                        </Box>
                                    ) : null}
                                    {/* 🔥 keep-hot for any session, a --bg one included: the band's own toggle, filled while its key is in
                                        the store, plain while not — a faint dim read the same both ways (FRM-499, dima's 20:41 shots) */}
                                    {isPartOn('stash.hot') ? (
                                        <Box flexShrink={0}>
                                            <Button
                                                key={`hot:${m.sid}`}
                                                onPress={() =>
                                                    pressHot(
                                                        $,
                                                        m.sid,
                                                        viewDoors($),
                                                    )
                                                }
                                                {...(m.isHot
                                                    ? {
                                                          variant:
                                                              'secondary' as const,
                                                      }
                                                    : {
                                                          plain: true as const,
                                                      })}>
                                                🔥
                                            </Button>
                                        </Box>
                                    ) : null}
                                    {/* 🐦‍🔥 second wind beside the meter it answers: the emoji alone, its state under the row */}
                                    {isPartOn('stash.second-wind') ? (
                                        <Box flexShrink={0}>
                                            <Button
                                                key={`wind:${m.sid}`}
                                                onPress={() =>
                                                    pressWind($, m.sid)
                                                }
                                                plain>
                                                {
                                                    WIND_EMOJI[
                                                        m.wind?.state ?? 'idle'
                                                    ]
                                                }
                                            </Button>
                                        </Box>
                                    ) : null}
                                    <Box
                                        justifyContent='flex-end'
                                        width={contextColumns}>
                                        {/* every row's meter one width, its % merged in, stepping to red at the compaction point */}
                                        {m.context ===
                                        undefined ? null : Svg ? (
                                            <Svg
                                                alt={`ctx ${m.context}%`}
                                                height={ctxTake.height}
                                                key={`ctx:${m.sid}`}
                                                source={(isRing
                                                    ? ctxRingSvg
                                                    : ctxBarSvg)(
                                                    m.context,
                                                    compactAt,
                                                )}
                                            />
                                        ) : (
                                            <Text
                                                color={contextFill(
                                                    m.context,
                                                    compactAt,
                                                )}>
                                                {ctxBar(m.context)}
                                            </Text>
                                        )}
                                    </Box>
                                    {/* the state: its emoji in a column of its own, the time right-aligned beside it, so every row lines up
                                (dima's o106, 21:17) */}
                                    {/* the emoji sits against its time, both packed left: they say one thing, the state and how long
                                (dima, 22:11: «join pace emojis with time»), and every row's emoji lines up (dima, 10-13 16:59:
                                right-aligned, they read as a ladder) */}
                                    {/* a little air after the ctx meter (dima's shot, 18:14: «slightly more breathing room») */}
                                    <Box
                                        flexDirection='row'
                                        gap={1}
                                        justifyContent='flex-start'
                                        key={`state:${m.sid}`}
                                        marginLeft={
                                            e.surface === 'desktop' ? 1 : 0
                                        }
                                        width={stateColumns}>
                                        <Text>{status.emoji}</Text>
                                        {sinceMs === undefined ? null : (
                                            <Text
                                                bold
                                                color={timeTint}
                                                dimColor={!timeTint}
                                                wrap='truncate-end'>
                                                {span(sinceMs)}
                                            </Text>
                                        )}
                                    </Box>
                                    {/* the asks close the row, always drawn: `🪐 0` dimmed when none (dima, 2026-10-05) */}
                                    <Box
                                        justifyContent='flex-end'
                                        width={COLUMNS.asks}>
                                        <Text
                                            bold={!!m.asks}
                                            color={
                                                m.asks
                                                    ? PALETTE.warn
                                                    : undefined
                                            }
                                            dimColor={!m.asks}>
                                            🪐 {m.asks}
                                        </Text>
                                    </Box>
                                </Box>
                            </Box>
                            {/* the second line, under the name: crow's 👀 tip with speak's buttons, or the 🔭 wait — one clipped row,
                        so a session waiting on many things never pushes the name's line (dima's o6, 15:49) */}
                            {(m.tip || line) && isPartOn('stash.rowmeta') ? (
                                <Box
                                    alignItems='center'
                                    flexDirection='row'
                                    gap={1}
                                    paddingLeft={2}>
                                    {/* read, pause and stop all lead the tip (dima's shots, 18:29, 19:40) */}
                                    {m.tip
                                        ? speakJSX(`crow:${m.sid}`, m.tip)
                                        : null}
                                    {m.tip ? (
                                        <Box
                                            flexShrink={1}
                                            height={1}
                                            minWidth={0}
                                            overflow='hidden'>
                                            <Text dimColor wrap='truncate-end'>
                                                {line}
                                            </Text>
                                        </Box>
                                    ) : line &&
                                      (m.wait ?? '').includes('; ') ? (
                                        // several waits are one plain run: styled pieces wrap on the desktop, and the clip then showed the
                                        // middle of two lines (dima's shot, 19:36: «what is this? looks off»)
                                        <Box
                                            flexShrink={1}
                                            height={1}
                                            minWidth={0}
                                            overflow='hidden'>
                                            <Text dimColor wrap='truncate-end'>
                                                {line}
                                            </Text>
                                        </Box>
                                    ) : line ? (
                                        // one row, clipped: the desktop wraps a run of styled pieces instead of cutting it (dima, 15:41)
                                        <Box
                                            flexShrink={1}
                                            height={1}
                                            minWidth={0}
                                            overflow='hidden'>
                                            <Text dimColor wrap='truncate-end'>
                                                {/* each «waiting on <who>» part prints <who> bold, as the band does (dima, 17:20) */}
                                                {'🔭 '}
                                                {(m.wait ?? '')
                                                    .split('; ')
                                                    .map((part, k) => (
                                                        <Text key={`w:${k}`}>
                                                            {k > 0 ? '; ' : ''}
                                                            {waitSpans(
                                                                part,
                                                            ).map((span, j) =>
                                                                span.isBold ? (
                                                                    <Text
                                                                        bold
                                                                        key={`s:${j}`}>
                                                                        {
                                                                            span.text
                                                                        }
                                                                    </Text>
                                                                ) : (
                                                                    span.text
                                                                ),
                                                            )}
                                                        </Text>
                                                    ))}
                                            </Text>
                                        </Box>
                                    ) : null}
                                </Box>
                            ) : null}
                            {/* a pane draws no hover card (engine.md), so second wind names its state and wait here */}
                            {m.wind && isPartOn('stash.second-wind') ? (
                                <Box key={`wind:say:${m.sid}`} paddingLeft={2}>
                                    <Text dimColor wrap='truncate-end'>
                                        {`🐦‍🔥 second wind: ${windSay(m.wind)} (${span(Math.max(0, now - m.wind.at))})`}
                                    </Text>
                                </Box>
                            ) : null}
                            {/* the held member pings, opened from 🤫 n: sender, age, first line (dima's o34) */}
                            {m.held && !isFolded(`quiet:${m.sid}`) ? (
                                <Box
                                    flexDirection='column'
                                    key={`quiet:${m.sid}`}
                                    paddingLeft={2}>
                                    {m.held.map((p, k) => {
                                        return (
                                            // biome-ignore lint/suspicious/noArrayIndexKey: a held ping's place is its identity
                                            <Text
                                                dimColor
                                                key={`quiet:${m.sid}:${k}`}
                                                wrap='truncate-end'>
                                                {`🤫 ${p.from} · ${span(now - p.at)} ago: ${p.text.split('\n')[0]}`}
                                            </Text>
                                        );
                                    })}
                                </Box>
                            ) : null}
                        </Box>
                    );
                };
                const busyCount = list.filter(
                    (m) => statusOf(m.status).isWorking,
                ).length;
                return arranged(
                    <Box key='sessions' {...cardProps}>
                        {/* the head: what the pane holds on the left, how many work right now on the right */}
                        <Box
                            flexDirection='row'
                            justifyContent='space-between'
                            marginBottom={isFolded('sessions') ? 0 : 1}>
                            <Text bold>🌌 sessions</Text>
                            <Box
                                alignItems='center'
                                flexDirection='row'
                                gap={1}>
                                {/* the mock's head: the count and the busy on the right, the busy bold (dima, 17:00) */}
                                <Text>
                                    <Text
                                        dimColor>{`${list.length} on this mac · `}</Text>
                                    <Text
                                        bold
                                        color={
                                            busyCount ? PALETTE.ok : undefined
                                        }>
                                        {`${busyCount} busy`}
                                    </Text>
                                </Text>
                                {foldJSX('sessions')}
                            </Box>
                        </Box>
                        {isFolded('sessions')
                            ? null
                            : list.map((m, i) =>
                                  drawn(`session ${m.sid}`, () => row(m, i)),
                              )}
                    </Box>,
                );
            })(),
        );
    } catch (err) {
        $.ui.log(`x-mod-stash: the board failed to draw: ${String(err)}`);
        const { Box, Text } = $.ui.resolve(e);
        return cleanTree(
            <Box>
                <Text color='error'>
                    ⚠️ x-mod-stash: the board failed to draw, the debug log names
                    why
                </Text>
            </Box>,
        );
    }
}

// `/board`, `/board colour`, `/board breathe`
export async function boardCommand($: EngineInterface, args: string) {
    if (args.trim() === 'breathe') {
        const isOn = await flipKnob($, 'always', () => publish($));
        return {
            text: `bars breathe ${isOn ? 'all the time' : 'only while a turn runs'}`,
        };
    }
    const isColourFlip = /^colou?r$/.test(args.trim());
    const isColour = isColourFlip
        ? await flipKnob($, 'colour', () => publish($))
        : undefined;
    await openBoard($);
    await publish($);
    if (isColour === undefined) return { text: 'fleet board opened' };
    return { text: `fleet board colour ${isColour ? 'on' : 'off'}` };
}
