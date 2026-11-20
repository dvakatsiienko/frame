// 🎚️ the band (FRM-662): the row above the prompt — the switches, the pace and fill meters, the 🔭 wait — drawn from
// the view the poll published; the wiring's layer, beside register.tsx

import type {
    EngineInterface,
    Next,
    RenderElement,
    RenderInput,
} from 'claude-code';

import {
    armHot,
    holdAfk,
    holdHot,
    holdWaker,
    restoreAfk,
    setAfk,
    setHot,
    setWaker,
    warm,
    writeWaker,
} from './keep-warm.ts';
import {
    BAR_HEIGHT,
    BREATH_MS,
    CELL_STEP,
    METER_TINTS,
    RAMP,
    contextFill,
    gapTint,
    meterSvg,
    span,
} from './look.ts';
import { setOverrideOn, writeOverrideOff } from './override.ts';
import { paceOf } from './pace.ts';
import { waitSpans } from './parse.ts';
import { isOpen, openBoard } from './roster.ts';
import { isLaneOwner } from './session-identity.ts';
import { hoverTip } from './settings-pane.tsx';
import {
    SPEED,
    readNumber,
    readSwitch,
    setSettingsOpen,
} from './settings-store.ts';
import { AFK_KEY } from './store-keys.ts';
import { cleanTree } from './tree.ts';
import { meterNow } from './usage.ts';
import {
    band,
    drawBand,
    patchBand,
    pressPace,
    pressSwitch,
    publish,
    viewDoors,
    viewOf,
} from './view.ts';
import { flipWind, windAfterPress } from './wind.ts';
import { WIND_EMOJI, setAutoWind } from './wind-run.ts';

// the fleet board: cc's registry gives each session's state; each session's stash adds its 🔭 wait and context fill
const BOARD = 'x-cc-deck';
// 🎛️ is a pane of its own, which the surface tabs beside 🚦: the band is capped by cc, the list outgrew it (dima's pick a of
// four homes, 16:20); a tab row inside a pane was proven too, kept as an idea in api-map.md
const SETTINGS_PANE = 'stash-settings';
// a reload keeps `$.state` and resets the module: what must outlive a mod save lives there (FRM-320)
// what the band and the board draw: renders read it, and a write redraws them, no invalidate
const VIEW = { key: 'view', plugin: 'x-mod-stash' } as const;

export async function renderBand(
    $: EngineInterface,
    e: RenderInput<'AbovePrompt'>,
    next: Next<'ui.render', RenderInput<'AbovePrompt'>>,
) {
    try {
        return cleanTree(
            await (async () => {
                if (e.surface !== 'terminal' && e.surface !== 'desktop')
                    return next(e);
                // the published view, never the module's value: reading it subscribes this band, and a write redraws it
                const view = (await $.state.get(VIEW)).value ?? viewOf(false);
                const ui = $.ui.resolve(e);
                const { Box, Text, Button } = ui;
                // off only: a session's Bash can press a band button through rex (probed 2026-11-07), so no press turns it on
                const handleOverrideOff = () =>
                    pressSwitch(
                        $,
                        '🔓',
                        { isOverrideOn: false },
                        async () => {
                            await writeOverrideOff($);
                        },
                        async () => {
                            setOverrideOn(view.isOverrideOn === true);
                        },
                    );
                const handleAfkFlip = () => {
                    holdAfk(!view.afk);
                    let isRead = false;
                    let was:
                        | {
                              at?: number;
                              on?: boolean;
                              wakerBefore?: boolean;
                          }
                        | undefined;
                    return pressSwitch(
                        $,
                        '💨',
                        { afk: warm.afk },
                        async () => {
                            // the store's value, never the module copy: another session may have flipped it since the last poll
                            const read = (await $.store.get(AFK_KEY)) as
                                | typeof was
                                | undefined;
                            isRead = true;
                            was = await setAfk($, !read?.on);
                        },
                        async () => {
                            holdAfk(view.afk === true);
                            holdWaker(view.isWaker === true);
                            // a read that failed wrote nothing, so nothing goes back
                            if (isRead) await restoreAfk($, was);
                        },
                    );
                };
                // one switch for every session, kept in the store so a restart keeps it
                const handleWakerFlip = () => {
                    const wanted = !view.isWaker;
                    holdWaker(wanted);
                    return pressSwitch(
                        $,
                        '⏰',
                        { isWaker: warm.isWaker },
                        // a poll already past load's guard may have read the old value
                        () => setWaker($, wanted),
                        async () => {
                            holdWaker(view.isWaker === true);
                            await writeWaker($, warm.isWaker).catch(
                                () => undefined,
                            );
                        },
                    );
                };
                const handleWindFlip = () => {
                    const sid = view.selfId ?? '';
                    const wanted = windAfterPress(view.wind);
                    patchBand({ selfWind: wanted });
                    return pressSwitch(
                        $,
                        '🐦‍🔥',
                        { wind: wanted },
                        async () => {
                            patchBand({ selfWind: await flipWind($, sid) });
                        },
                        async () => {
                            patchBand({ selfWind: view.wind });
                        },
                    );
                };
                const handleAutoWindFlip = async () => {
                    const wasOn = band.isAutoWindOn;
                    patchBand({ isAutoWindOn: !view.isAutoWind });
                    await pressSwitch(
                        $,
                        '🍃',
                        { isAutoWind: band.isAutoWindOn },
                        () => setAutoWind($, band.isAutoWindOn),
                        async () => {
                            patchBand({ isAutoWindOn: wasOn });
                        },
                    );
                };
                const handleHotFlip = async () => {
                    const hotWas = warm.hot;
                    const isWanted = !warm.hot;
                    await pressSwitch(
                        $,
                        '🔥',
                        { isHot: isWanted },
                        // a poll already past followHot's guard may have read the old value
                        () => setHot($, isWanted),
                        async () => {
                            holdHot(hotWas);
                        },
                    );
                    await armHot($, viewDoors($));
                };
                const tip = (
                    key: string,
                    words: string,
                    control: RenderElement,
                    place: { left: number } | { right: number },
                    press?: { hotkey: string; onPress: () => void },
                ) => hoverTip(ui, key, words, control, place, press);
                const boardOpen = view.isBoardOpen;
                const isShown = (key: string) => view.shown?.[key] !== false;
                const isPaceSeat =
                    isShown('stash.pace-watch') && (await isLaneOwner($));
                const isPaceWatched = view.isPaced === true;
                const handleSettingsFlip = async () => {
                    const isSettingsOpen = !view.isSettingsOpen;
                    setSettingsOpen(isSettingsOpen);
                    await drawBand($, { isSettingsOpen });
                    if (isSettingsOpen)
                        await $.ui.open({
                            id: SETTINGS_PANE,
                            title: '🎛️ settings',
                        });
                    else await $.ui.close({ id: SETTINGS_PANE });
                    await publish($);
                };
                const handleBoardFlip = async () => {
                    await drawBand($, { isBoardOpen: !view.isBoardOpen });
                    if (await isOpen($)) await $.ui.close({ id: BOARD });
                    else await openBoard($);
                    await publish($);
                };
                // a terminal draws a chromed Button as `[ label ]`
                const leftOf = (label: string, chrome: boolean) => ({
                    right: [...label].length + (chrome ? 4 : 0) + 1,
                });

                // the meters: two short bars in the row, each ending in its %; the readings sit beside them
                const meter = await meterNow($);
                const now = await $.clock.now();
                const Svg =
                    e.surface === 'desktop' ? $.ui.resolve(e).Svg : undefined;
                const isBreathing =
                    (Boolean(e.props.isWorking) &&
                        (await readSwitch($, 'breathe'))) ||
                    (await readSwitch($, 'always'));
                // the 🎛️ speed: 1× sparks a cell every 1.6–4.4 s, 0.5× (the default, dima 12:58) twice as slow
                const breathMs =
                    (BREATH_MS * SPEED.of) / (await readNumber($, 'speed'));
                const five = meter?.fiveHour;
                const pace =
                    five?.resetsAt === undefined
                        ? undefined
                        : paceOf(five.resetsAt, now);
                const gap =
                    five && pace !== undefined
                        ? Math.round(five.used - pace)
                        : undefined;
                const fiveTint = gapTint(gap ?? 0);
                const ctx = meter?.context;
                const ctxTint = contextFill(ctx ?? 0, meter?.compactAt);
                // the meters run the band's full width, one bar a row under the row (dima, 20:45: «bring back old wide meters»);
                // the band knows only its columns: 9.6 px a column overshoots every desktop seen (7.8 once, ~9 after the 10-28
                // update), and the slot clamps the bar back to its width
                const svgCells = Math.max(
                    8,
                    Math.floor((e.props.bodyColumns * 9.6 - 90) / CELL_STEP),
                );
                const barJSX = (
                    key: string,
                    label: string,
                    words: string,
                    tint: string,
                    bar?: {
                        percent: number;
                        mark?: number;
                        scale?: number;
                    },
                    marginTop = 0,
                ) => (
                    <Box
                        alignItems='center'
                        flexDirection='row'
                        gap={Svg ? 0.5 : 1}
                        key={key}
                        marginTop={marginTop}>
                        <Box flexShrink={0} width={Svg ? 5 : 6}>
                            {tip(
                                key,
                                words,
                                <Text wrap='truncate-end'>{label}</Text>,
                                {
                                    left: [...label].length + 1,
                                },
                            )}
                        </Box>
                        {bar === undefined ? (
                            <Text dimColor>no reading yet</Text>
                        ) : (
                            // the % ends on the band's right edge, under the row's last button
                            <Box
                                alignItems='center'
                                flexDirection='row'
                                flexGrow={1}
                                gap={1}
                                justifyContent='space-between'>
                                {Svg ? (
                                    <Box flexGrow={1} minWidth={0}>
                                        <Svg
                                            alt={`${label} ${Math.round(bar.percent)}%`}
                                            height={BAR_HEIGHT}
                                            key={`${key}:svg`}
                                            source={meterSvg(
                                                bar.percent,
                                                svgCells,
                                                bar.mark,
                                                bar.scale,
                                                isBreathing ? now : undefined,
                                                breathMs,
                                            )}
                                        />
                                    </Box>
                                ) : null}
                                <Box
                                    flexShrink={0}
                                    justifyContent='flex-end'
                                    width={4}>
                                    <Text bold color={tint}>
                                        {`${Math.round(bar.percent)}%`}
                                    </Text>
                                </Box>
                            </Box>
                        )}
                    </Box>
                );
                const meterInfoJSX = (
                    <Box
                        flexDirection='row'
                        flexShrink={1}
                        gap={1}
                        key='meter:info'
                        minWidth={0}>
                        {!isShown('stash.pace') || gap === undefined
                            ? null
                            : tip(
                                  'pace',
                                  gap > 0
                                      ? 'behind the 5h pace'
                                      : 'ahead of the 5h pace',
                                  // room reads 🔋 green, over the pace 🪫 red at any size (dima's o46, 21:37)
                                  <Text
                                      bold
                                      color={
                                          gap > 0 ? RAMP[2] : METER_TINTS.calm5h
                                      }>
                                      {gap > 0 ? `🪫 -${gap}%` : `🔋 +${-gap}%`}
                                  </Text>,
                                  { left: 10 },
                              )}
                        {!isShown('stash.reset') ||
                        five?.resetsAt === undefined ||
                        five.resetsAt <= now
                            ? null
                            : tip(
                                  'reset',
                                  'until the 5h window resets',
                                  // rounded up like cc's own «resets in 1 min», so it never reads 0m (o103)
                                  <Text>
                                      ⏳{' '}
                                      {span(
                                          Math.ceil(
                                              (five.resetsAt - now) / 60_000,
                                          ) * 60_000,
                                      )}
                                  </Text>,
                                  { left: 9 },
                              )}
                    </Box>
                );
                const switches = (
                    <Box
                        flexDirection='row'
                        flexShrink={0}
                        gap={e.surface === 'desktop' ? 0.6 : 1}
                        key='switches'>
                        {!isShown('stash.second-wind') || !view.selfId
                            ? null
                            : tip(
                                  'wind',
                                  'second wind',
                                  <Button
                                      key='wind'
                                      onPress={() => void handleWindFlip()}
                                      {...(view.wind
                                          ? {
                                                variant: 'secondary' as const,
                                            }
                                          : { plain: true as const })}>
                                      {WIND_EMOJI[view.wind ?? 'idle']}
                                  </Button>,
                                  leftOf(
                                      WIND_EMOJI[view.wind ?? 'idle'],
                                      !!view.wind,
                                  ),
                              )}
                        {!isShown('stash.second-wind-auto') || !view.selfId
                            ? null
                            : tip(
                                  'auto-wind',
                                  'second wind auto',
                                  <Button
                                      key='auto-wind'
                                      onPress={() => void handleAutoWindFlip()}
                                      {...(view.isAutoWind
                                          ? {
                                                variant: 'secondary' as const,
                                            }
                                          : { plain: true as const })}>
                                      🍃
                                  </Button>,
                                  leftOf('🍃', !!view.isAutoWind),
                              )}
                        {!isShown('stash.hot')
                            ? null
                            : tip(
                                  'hot',
                                  'keep cache hot',
                                  <Button
                                      key='hot'
                                      onPress={() => void handleHotFlip()}
                                      {...(view.isHot
                                          ? {
                                                variant: 'secondary' as const,
                                            }
                                          : { plain: true as const })}>
                                      🔥
                                  </Button>,
                                  leftOf('🔥', !!view.isHot),
                              )}
                        {!isPaceSeat
                            ? null
                            : tip(
                                  'pace-watch',
                                  'pace watch: this session',
                                  <Button
                                      key='pace-watch'
                                      onPress={() => void pressPace($)}
                                      {...(isPaceWatched
                                          ? {
                                                variant: 'secondary' as const,
                                            }
                                          : { plain: true as const })}>
                                      🔋
                                  </Button>,
                                  leftOf('🔋', isPaceWatched),
                              )}
                        {!isShown('stash.waker')
                            ? null
                            : tip(
                                  'waker',
                                  'fleet wake',
                                  <Button
                                      key='waker'
                                      onPress={() => void handleWakerFlip()}
                                      {...(view.isWaker
                                          ? {
                                                variant: 'secondary' as const,
                                            }
                                          : { plain: true as const })}>
                                      ⏰
                                  </Button>,
                                  leftOf('⏰', view.isWaker),
                              )}
                        {!isShown('stash.afk')
                            ? null
                            : tip(
                                  'afk',
                                  'afk',
                                  <Button
                                      key='afk'
                                      onPress={() => void handleAfkFlip()}
                                      {...(view.afk
                                          ? {
                                                variant: 'secondary' as const,
                                            }
                                          : { plain: true as const })}>
                                      💨
                                  </Button>,
                                  leftOf('💨', view.afk),
                              )}
                        {!view.isOverrideOn
                            ? null
                            : tip(
                                  'operator-override',
                                  'operator override',
                                  <Button
                                      key='operator-override'
                                      onPress={() => void handleOverrideOff()}
                                      variant='secondary'>
                                      🔓
                                  </Button>,
                                  leftOf('🔓', true),
                              )}
                        {tip(
                            'settings',
                            'settings',
                            <Button
                                key='settings'
                                onPress={() => void handleSettingsFlip()}
                                {...(view.isSettingsOpen
                                    ? { variant: 'secondary' as const }
                                    : { plain: true as const })}>
                                🎛️
                            </Button>,
                            leftOf('🎛️', view.isSettingsOpen),
                        )}
                        {!isShown('stash.board')
                            ? null
                            : tip(
                                  'board',
                                  'board',
                                  <Button
                                      key='board'
                                      onPress={() => void handleBoardFlip()}
                                      {...(boardOpen
                                          ? {
                                                variant: 'secondary' as const,
                                            }
                                          : { plain: true as const })}>
                                      🚦
                                  </Button>,
                                  leftOf('🚦', boardOpen),
                                  {
                                      hotkey: 'b',
                                      onPress: () => void handleBoardFlip(),
                                  },
                              )}
                    </Box>
                );
                // the readings pack left, then this session's 🔭 mark, always drawn; the switches hold the right
                // edge (dima's o6 and o7, 22:03)
                // each «waiting on <who>» part of a 🔭 wait prints <who> bold, its «— how» tail plain (dima, 2026-10-10 23:54)
                const waitJSX = (wait: string) =>
                    wait.split('; ').map((part, i) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: a wait's place in the line is its identity
                        <Text key={`wait:${i}`}>
                            {i > 0 ? '; ' : ''}
                            {waitSpans(part).map((span, k) =>
                                span.isBold ? (
                                    // biome-ignore lint/suspicious/noArrayIndexKey: a span's place in the part is its identity
                                    <Text bold key={`span:${k}`}>
                                        {span.text}
                                    </Text>
                                ) : (
                                    span.text
                                ),
                            )}
                        </Text>
                    ));
                const row = (
                    <Box
                        alignItems='center'
                        flexDirection='row'
                        gap={1}
                        justifyContent='space-between'
                        key='row'>
                        <Box
                            alignItems='center'
                            flexDirection='row'
                            flexGrow={1}
                            flexShrink={1}
                            gap={1}
                            key='row:readings'
                            minWidth={0}>
                            {meterInfoJSX}
                            {isShown('stash.wait') ? (
                                <Box flexShrink={1} key='wait' minWidth={0}>
                                    <Text color='inactive' wrap='truncate-end'>
                                        {'🔭 '}
                                        {view.wait
                                            ? waitJSX(view.wait)
                                            : 'not waiting'}
                                    </Text>
                                </Box>
                            ) : null}
                        </Box>
                        {switches}
                    </Box>
                );
                // desktop air above and between the bars; a terminal row cannot be split, so none there
                const air = e.surface === 'desktop';
                const meters = (
                    <Box
                        flexDirection='column'
                        flexShrink={0}
                        key='meters'
                        marginTop={air ? 0.5 : 0}
                        paddingRight={air ? 1 : 0}>
                        {!isShown('stash.5h')
                            ? null
                            : barJSX(
                                  'meter:5h',
                                  '🔥 5h',
                                  '5h window used',
                                  fiveTint,
                                  five
                                      ? { mark: pace, percent: five.used }
                                      : undefined,
                              )}
                        {!isShown('stash.ctx')
                            ? null
                            : barJSX(
                                  'meter:ctx',
                                  '🧠 ctx',
                                  'context window used',
                                  ctxTint,
                                  ctx === undefined
                                      ? undefined
                                      : {
                                            mark: meter?.compactAt,
                                            percent: ctx,
                                            scale: meter?.compactAt ?? 100,
                                        },
                                  air ? 0.4 : 0,
                              )}
                    </Box>
                );
                return (
                    <Box flexDirection='column'>
                        {row}
                        {/* the terminal reads the 5h and ctx on sline's line; the desktop keeps the bars (dima, 15:06) */}
                        {Svg ? meters : null}
                        {meter?.note ? (
                            <Text color='error' wrap='truncate-end'>
                                {meter.note}
                            </Text>
                        ) : null}
                        {await next(e)}
                    </Box>
                );
            })(),
        );
    } catch (err) {
        $.ui.log(`x-mod-stash: the band failed to draw: ${String(err)}`);
        const { Box, Text } = $.ui.resolve(e);
        return cleanTree(
            <Box>
                <Text color='error'>
                    ⚠️ x-mod-stash: the band failed to draw, the debug log names
                    why
                </Text>
            </Box>,
        );
    }
}
