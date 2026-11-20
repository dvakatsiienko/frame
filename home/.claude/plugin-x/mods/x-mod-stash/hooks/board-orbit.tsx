// 🪐 the board's orbit card: this session's open asks, its assumptions, the closed ones dim for a turn

import type { EngineInterface } from 'claude-code';

import { type BoardKit, LINE_GAP } from './board-kit.tsx';
import { field } from './fields.ts';
import { isAllAsksMarkable } from './orbit.ts';
import { pressAllAsks } from './orbit-presses.ts';
import { changeAssumed } from './orbit-store.ts';
import { keepShelf } from './session-record.ts';
import { drawn } from './tree.ts';

export function orbitCard($: EngineInterface, k: BoardKit) {
    const {
        Box,
        Text,
        Button,
        keptJSX,
        o,
        Input,
        open,
        handleAssumedSteer,
        isPartOn,
        speakAssumed,
        isFolded,
        foldJSX,
        cardProps,
        speakJSX,
        askJSX,
    } = k;
    const orbitJSX = drawn('orbit', () => (
        <Box key='orbit' {...cardProps} marginTop={1} rowGap={0.5}>
            <Box flexDirection='row' justifyContent='space-between'>
                <Text bold>🪐 orbit</Text>
                <Box alignItems='center' flexDirection='row' gap={1}>
                    {open.some(isAllAsksMarkable) ? (
                        <Button
                            key='orbit:all'
                            onPress={() =>
                                void pressAllAsks(
                                    $,
                                    open.map(({ id, text }) => ({
                                        id,
                                        text,
                                    })),
                                )
                            }
                            plain>
                            ✅
                        </Button>
                    ) : null}
                    {foldJSX('orbit')}
                </Box>
            </Box>
            {/* an answered ask stays until its turn ends, so dima sees it go */}
            {isFolded('orbit') ? null : o.asks.map((a, i) => askJSX(a, i))}
            {!isFolded('orbit') &&
            o.assumed?.length &&
            isPartOn('stash.assumed') ? (
                <Box
                    flexDirection='column'
                    key='orbit:assumed'
                    marginTop={1}
                    rowGap={LINE_GAP}>
                    <Text bold>assumed</Text>
                    {o.assumed.map((x) => {
                        return (
                            <Box
                                flexDirection='column'
                                key={`orbit:assumption:${x.id}`}
                                rowGap={LINE_GAP}>
                                <Text>
                                    <Text bold>{x.id}</Text>
                                    {`: ${x.text}`}
                                </Text>
                                <Box
                                    alignItems='center'
                                    flexDirection='row'
                                    gap={1}>
                                    <Button
                                        key={`orbit:right:${x.id}`}
                                        onPress={() =>
                                            void changeAssumed(
                                                $,
                                                () => keepShelf($),
                                                (y) =>
                                                    y.id === x.id
                                                        ? undefined
                                                        : y,
                                                true,
                                            )
                                        }
                                        plain>
                                        🛎️
                                    </Button>
                                    <Button
                                        key={`orbit:wrong:${x.id}`}
                                        onPress={() =>
                                            void changeAssumed(
                                                $,
                                                () => keepShelf($),
                                                (y) =>
                                                    y.id === x.id
                                                        ? {
                                                              ...y,
                                                              isWrong:
                                                                  !y.isWrong,
                                                          }
                                                        : y,
                                                true,
                                            )
                                        }
                                        {...(x.isWrong
                                            ? {
                                                  variant: 'secondary' as const,
                                              }
                                            : {
                                                  plain: true as const,
                                              })}>
                                        ↩️
                                    </Button>
                                    {speakAssumed
                                        ? speakJSX(x.id, x.text)
                                        : null}
                                    {Input ? (
                                        <Box
                                            flexGrow={1}
                                            flexShrink={1}
                                            minWidth={0}>
                                            <Input
                                                key={
                                                    field(
                                                        $,
                                                        `orbit:asteer:${x.id}`,
                                                        x.steer ?? '',
                                                    ).key
                                                }
                                                onInput={(value: string) => {
                                                    field(
                                                        $,
                                                        `orbit:asteer:${x.id}`,
                                                        x.steer ?? '',
                                                    ).type(value, () => {
                                                        return handleAssumedSteer(
                                                            x.id,
                                                            value,
                                                        );
                                                    });
                                                }}
                                                onSubmit={(value: string) =>
                                                    handleAssumedSteer(
                                                        x.id,
                                                        value,
                                                    )
                                                }
                                                placeholder='steer'
                                                value={
                                                    field(
                                                        $,
                                                        `orbit:asteer:${x.id}`,
                                                        x.steer ?? '',
                                                    ).value
                                                }
                                            />
                                        </Box>
                                    ) : null}
                                    {keptJSX(`orbit:asteer:${x.id}`)}
                                </Box>
                            </Box>
                        );
                    })}
                </Box>
            ) : null}
        </Box>
    ));
    return orbitJSX;
}
