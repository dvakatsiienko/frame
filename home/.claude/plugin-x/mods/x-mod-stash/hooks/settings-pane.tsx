// 🎛️ the settings pane's parts (FRM-662): each switch and number row drawn with its hover card, the words a hover
// says, and the note a hover leaves for the next draw

import type { EngineInterface, RenderElement, RenderInput } from 'claude-code';

import { field } from './fields.ts';
import { PACE, type ViewDoors, isPaceOn } from './keep-warm.ts';
import { cardBorder } from './look.ts';
import { PACE_KEYS, PACE_SETTINGS } from './pace.ts';
import { currentId } from './session-identity.ts';
import {
    NUMBERS,
    type NumberName,
    PARTS,
    QUIET_KINDS,
    SWITCHES,
    type SwitchName,
    flipKnob,
    flipPart,
    knobRefusals,
    partsShown,
    readNumber,
    readSwitch,
    setKnobNumber,
} from './settings-store.ts';
import { cleanTree } from './tree.ts';
import { meterNow, setCompactAt } from './usage.ts';
import { pressPace, publish, viewDoors } from './view.ts';

// a reload keeps `$.state` and resets the module: what must outlive a mod save lives there (FRM-320)
// what the band and the board draw: renders read it, and a write redraws them, no invalidate
const VIEW = { key: 'view', plugin: 'x-mod-stash' } as const;

// every control names itself on hover; the card stays on the control's row, since a one-row site clips the rest
// the 🎛️ pane's switch list: a column per group
export function settingsListJSX(
    $: EngineInterface,
    ui: ReturnType<EngineInterface['ui']['resolve']>,
    shownNow: Record<string, boolean>,
    air: boolean,
    view: ViewDoors,
) {
    const { Box, Text, Button } = ui;
    const groups = [...new Set(PARTS.map((p) => p.group))];
    return groups.map((group) => (
        <Box
            borderColor={cardBorder(air ? 'desktop' : 'terminal')}
            borderStyle='round'
            flexDirection='column'
            key={`settings:${group}`}
            paddingX={1}
            paddingY={air ? 0.5 : 0}
            rowGap={air ? 0.3 : 0}>
            <Text bold>{group}</Text>
            <Box flexDirection='column' rowGap={air ? 0.3 : 0}>
                {PARTS.filter((p) => p.group === group).map((p) => (
                    <Box flexDirection='row' key={`settings:row:${p.key}`}>
                        <Button
                            key={`part:${p.key}`}
                            onPress={() =>
                                void flipPart($, p.key, () => view.publish())
                            }
                            {...(shownNow[p.key] !== false
                                ? { variant: 'primary' as const }
                                : { dimColor: true })}>
                            {p.label}
                        </Button>
                    </Box>
                ))}
            </Box>
        </Box>
    ));
}
// a pane's hover note: in the row's flow, between its label and its input; an absolute card wraps over its neighbours there
export function noteOnHover(
    ui: ReturnType<EngineInterface['ui']['resolve']>,
    words: string,
) {
    const { Box, Text } = ui;
    return (
        <Box display='none' flexShrink={0} hover={{ display: 'flex' }}>
            <Text dimColor>{words}</Text>
        </Box>
    );
}
export function hoverTip(
    ui: ReturnType<EngineInterface['ui']['resolve']>,
    key: string,
    words: string,
    control: RenderElement,
    place: { left: number } | { right: number },
    press?: { hotkey: string; onPress: () => void },
) {
    const { Box, Text, Button } = ui;
    return (
        <Box key={`tip:${key}`}>
            {control}
            <Box
                display='none'
                hover={{ display: 'flex' }}
                position='absolute'
                top={0}
                {...place}>
                {/* the key rides the card, not the icon: the surface draws its own key badge beside a Button with a hotkey */}
                {press ? (
                    <Button
                        dimColor
                        hotkey={press.hotkey}
                        key={`key:${key}`}
                        onPress={press.onPress}
                        plain>
                        {words}
                    </Button>
                ) : (
                    <Text dimColor>{words}</Text>
                )}
            </Box>
        </Box>
    );
}

export async function drawSettingsPane(
    $: EngineInterface,
    e: RenderInput<'Pane'>,
) {
    try {
        return cleanTree(
            await (async () => {
                const ui = $.ui.resolve(e);
                const { Box, Text, Button } = ui;
                const meter = await meterNow($);
                // mobile draws no Input
                const Input = 'Input' in ui ? ui.Input : undefined;
                // the knobs: a switch saves on its press, a number on each keystroke that makes a valid value
                const isPaceWatched = isPaceOn(
                    await $.store.get(PACE + ((await currentId($)) ?? '')),
                );
                const isHotShown = (await partsShown($))('stash.hot');
                const isAutoWindShown = (await partsShown($))(
                    'stash.second-wind-auto',
                );
                const isPaceShown = (await partsShown($))('stash.pace-watch');
                const settingNumbers = await Promise.all(
                    PACE_KEYS.map(
                        async (name) =>
                            [name, await readNumber($, name)] as const,
                    ),
                );
                const knobs = {
                    always: await readSwitch($, 'always'),
                    breathe: await readSwitch($, 'breathe'),
                    colour: await readSwitch($, 'colour'),
                    guard: !(await readSwitch($, 'silent')),
                    lines: await readNumber($, 'lines'),
                    quiet: await readSwitch($, 'quiet'),
                    quietKinds: await Promise.all(
                        QUIET_KINDS.map(async (k) => ({
                            ...k,
                            isOn: await readSwitch($, k.name),
                        })),
                    ),
                    quietWait: await readNumber($, 'quietWait'),
                    ring: await readSwitch($, 'ring'),
                    speak: await readSwitch($, 'speak'),
                    speed: await readNumber($, 'speed'),
                };
                const switchJSX = (
                    name: SwitchName,
                    label: string,
                    isOn: boolean,
                    note?: string,
                ) => (
                    <Box
                        alignItems='flex-start'
                        flexDirection={note ? 'column' : 'row'}
                        key={`knob:${SWITCHES[name].key}`}>
                        <Button
                            key={`knob:${SWITCHES[name].key}`}
                            onPress={() =>
                                void flipKnob($, name, () => publish($))
                            }
                            {...(isOn
                                ? { variant: 'primary' as const }
                                : { dimColor: true })}>
                            {label}
                        </Button>
                        {/* a keyed Box is its own hover scope (engine.md), so the note lives inside this one */}
                        {note ? noteOnHover(ui, note) : null}
                    </Box>
                );
                const numberJSX = (
                    name: NumberName,
                    label: string,
                    value: number,
                    unit: string,
                ) => {
                    const { key, range } = NUMBERS[name];
                    const refusal = knobRefusals.get(name);
                    const row = Input ? (
                        <Box
                            alignItems='center'
                            flexDirection='row'
                            gap={1}
                            key={`knob:${key}`}>
                            <Text>{label}</Text>
                            <Box flexGrow={1} />
                            {noteOnHover(
                                ui,
                                `${unit} (${range.min}–${range.max})`,
                            )}
                            <Box flexShrink={0} width={8}>
                                <Input
                                    key={
                                        field($, `knob:${key}`, String(value))
                                            .key
                                    }
                                    onInput={(text) => {
                                        field(
                                            $,
                                            `knob:${key}`,
                                            String(value),
                                        ).type(text, () => {
                                            return setKnobNumber($, name, text);
                                        });
                                    }}
                                    onSubmit={(text) =>
                                        void setKnobNumber($, name, text)
                                    }
                                    value={
                                        field($, `knob:${key}`, String(value))
                                            .value
                                    }
                                />
                            </Box>
                        </Box>
                    ) : null;
                    return row && refusal ? (
                        <Box flexDirection='column' key={`knob-field:${key}`}>
                            {row}
                            <Text dimColor>{`🛑 not saved: ${refusal}`}</Text>
                        </Box>
                    ) : (
                        row
                    );
                };
                const air = e.surface === 'desktop';
                const knobsJSX = (
                    <Box
                        borderColor={cardBorder(e.surface)}
                        borderStyle='round'
                        flexDirection='column'
                        key='settings:knobs'
                        paddingX={1}
                        paddingY={air ? 0.5 : 0}
                        rowGap={air ? 0.3 : 0}>
                        <Text bold>stash · knobs</Text>
                        {isPaceShown ? (
                            <Box flexDirection='row' key='knob:pace-watch'>
                                <Button
                                    key='knob:pace-watch'
                                    onPress={() => void pressPace($)}
                                    {...(isPaceWatched
                                        ? {
                                              variant: 'primary' as const,
                                          }
                                        : { dimColor: true })}>
                                    🔋 pace watch: this session
                                </Button>
                            </Box>
                        ) : null}
                        {switchJSX('colour', '🎨 board colour', knobs.colour)}
                        {/* one of two shapes, so two buttons, the one in use lit (dima, 10-13 17:45) */}
                        <Box
                            alignItems='center'
                            flexDirection='row'
                            gap={1}
                            key='knob:ctx-shape'>
                            <Text>🧠 sessions: ctx meter type</Text>
                            {(
                                [
                                    ['ring', '◯ ring', true],
                                    ['bar', '▬ bar', false],
                                ] as const
                            ).map(([shape, label, isRing]) => {
                                return (
                                    <Button
                                        key={`knob:ctx-${shape}`}
                                        onPress={() =>
                                            void (knobs.ring === isRing
                                                ? undefined
                                                : flipKnob($, 'ring', () =>
                                                      publish($),
                                                  ))
                                        }
                                        {...(knobs.ring === isRing
                                            ? {
                                                  variant: 'primary' as const,
                                              }
                                            : { dimColor: true })}>
                                        {label}
                                    </Button>
                                );
                            })}
                        </Box>
                        {numberJSX(
                            'lines',
                            '🌔 phase lines',
                            knobs.lines,
                            'lines',
                        )}
                        {switchJSX(
                            'speak',
                            '🔊 read-aloud on assumptions',
                            knobs.speak,
                        )}
                        {/* the switch reads «shown» while lit, so it flips the stored «silent» the other way */}
                        <Box flexDirection='row' key='knob:guard-silent'>
                            <Button
                                key='knob:guard-silent'
                                onPress={() =>
                                    void flipKnob($, 'silent', () => publish($))
                                }
                                {...(knobs.guard
                                    ? { variant: 'primary' as const }
                                    : { dimColor: true })}>
                                🛡️ guard notes to the model
                            </Button>
                        </Box>
                    </Box>
                );
                // the bars' animation, its own card at the pane's bottom beside the context (dima, 18:06)
                const barsJSX = (
                    <Box
                        borderColor={cardBorder(e.surface)}
                        borderStyle='round'
                        flexDirection='column'
                        key='settings:bars'
                        paddingX={1}
                        paddingY={air ? 0.5 : 0}
                        rowGap={air ? 0.3 : 0}>
                        <Text bold>🔥 bars</Text>
                        {switchJSX(
                            'breathe',
                            '🔥 bars breathe while a turn runs',
                            knobs.breathe,
                        )}
                        {switchJSX(
                            'always',
                            '🔥 bars breathe all the time',
                            knobs.always,
                        )}
                        {numberJSX(
                            'speed',
                            '🔥 breath speed',
                            knobs.speed,
                            '×',
                        )}
                    </Box>
                );
                // quiet comms' own card: the wait before an idle append (dima's brief 5, 16:53)
                const quietJSX = (
                    <Box
                        borderColor={cardBorder(e.surface)}
                        borderStyle='round'
                        flexDirection='column'
                        key='settings:quiet'
                        paddingX={1}
                        paddingY={air ? 0.5 : 0}
                        rowGap={air ? 0.3 : 0}>
                        <Text bold>🤫 quiet comms</Text>
                        {switchJSX(
                            'quiet',
                            "🤫 hold members' messages unless they push",
                            knobs.quiet,
                        )}
                        {knobs.quietKinds.map(({ cost, isOn, kind, name }) =>
                            knobs.quiet ? (
                                switchJSX(
                                    name,
                                    `🤫 [${kind}] starts clio's turn`,
                                    isOn,
                                    cost,
                                )
                            ) : (
                                <Box
                                    flexDirection='column'
                                    key={`quiet-kind:${kind}`}>
                                    <Text
                                        dimColor>{`🤫 [${kind}] starts clio's turn`}</Text>
                                    {noteOnHover(ui, cost)}
                                </Box>
                            ),
                        )}
                        {numberJSX(
                            'quietWait',
                            '🤫 held pings wait',
                            knobs.quietWait,
                            'min',
                        )}
                        {settingNumbers
                            .filter(([name]) =>
                                name.startsWith('hot-')
                                    ? isHotShown
                                    : name.startsWith('wind-')
                                      ? isAutoWindShown
                                      : isPaceShown,
                            )
                            .map(([name, value]) =>
                                numberJSX(
                                    name,
                                    PACE_SETTINGS[name].label,
                                    value,
                                    '',
                                ),
                            )}
                    </Box>
                );
                // the auto-compact point lives only in 🎛️, its last section (dima, 15:35: «move full autocompact part to settings»)
                const compactJSX = Input ? (
                    <Box
                        borderColor={cardBorder(e.surface)}
                        borderStyle='round'
                        flexDirection='column'
                        key='settings:compact'
                        paddingX={1}
                        paddingY={e.surface === 'desktop' ? 0.5 : 0}>
                        <Text bold>context</Text>
                        <Box
                            alignItems='center'
                            flexDirection='row'
                            gap={1}
                            key='knob-row:compact'>
                            <Text>📦 auto-compact at</Text>
                            <Box flexGrow={1} />
                            {noteOnHover(ui, '% of the context window')}
                            <Box flexShrink={0} width={8}>
                                <Input
                                    key={
                                        field(
                                            $,
                                            'compact-at',
                                            meter?.compactAt === undefined
                                                ? ''
                                                : String(meter.compactAt),
                                        ).key
                                    }
                                    onInput={(value) => {
                                        field(
                                            $,
                                            'compact-at',
                                            meter?.compactAt === undefined
                                                ? ''
                                                : String(meter.compactAt),
                                        ).type(value, () => {
                                            return setCompactAt($, value, true);
                                        });
                                    }}
                                    onSubmit={(value) =>
                                        void setCompactAt($, value)
                                    }
                                    placeholder='70'
                                    value={
                                        field(
                                            $,
                                            'compact-at',
                                            meter?.compactAt === undefined
                                                ? ''
                                                : String(meter.compactAt),
                                        ).value
                                    }
                                />
                            </Box>
                        </Box>
                    </Box>
                ) : null;
                return (
                    // two columns of cards: the switches left, the knobs and the number tiles right
                    <Box
                        flexDirection='column'
                        gap={1}
                        key='settings:view'
                        minHeight={
                            e.props.placement === 'dock'
                                ? e.props.scroll.bodyRows
                                : undefined
                        }>
                        <Box flexDirection='row' gap={1} key='settings:columns'>
                            <Box
                                flexDirection='column'
                                flexGrow={1}
                                gap={1}
                                width={0}>
                                {settingsListJSX(
                                    $,
                                    ui,
                                    (await $.state.get(VIEW)).value?.shown ??
                                        {},
                                    e.surface === 'desktop',
                                    viewDoors($),
                                )}
                            </Box>
                            <Box
                                flexDirection='column'
                                flexGrow={1}
                                gap={1}
                                width={0}>
                                {knobsJSX}
                                {barsJSX}
                                {quietJSX}
                                {compactJSX}
                            </Box>
                        </Box>
                    </Box>
                );
            })(),
        );
    } catch (err) {
        $.ui.log(`x-mod-stash: the settings failed to draw: ${String(err)}`);
        const { Box, Text } = $.ui.resolve(e);
        return cleanTree(
            <Box>
                <Text color='error'>
                    ⚠️ x-mod-stash: the settings failed to draw, the debug log
                    names why
                </Text>
            </Box>,
        );
    }
}
