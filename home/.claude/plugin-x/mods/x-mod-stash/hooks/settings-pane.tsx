// 🎛️ the settings pane's parts (FRM-662): each switch and number row drawn with its hover card, the words a hover
// says, and the note a hover leaves for the next draw

import type { EngineInterface, RenderElement } from 'claude-code';

import type { ViewDoors } from './keep-warm.ts';
import { cardBorder } from './look.ts';
import { PARTS, flipPart } from './settings-store.ts';

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
