// 🛼 the board's glide cards: each live lane's steps in order, «← we are here», its steer, its members' asks folded

import type { EngineInterface } from 'claude-code';

import type { OrbitAsk, StashLane } from '../types/stash.d.ts';
import { type BoardKit, LINE_GAP } from './board-kit.tsx';
import { field, steerOf } from './fields.ts';
import { LANE_ROLES, changeLaneSteer, laneRows, laneSpan } from './lanes.ts';
import { PALETTE } from './look.ts';
import { memberBadge } from './parse.ts';
import { drawn } from './tree.ts';

// 🛼 glide (FRM-385): the fleet's lanes in one shelf file, written only by the session the registry names 🦉 clio, read by
// every board on its poll; at most 5 plain steps, each ≤60 chars, stale after 8 of clio's turns with nothing moved
const LANES = { key: 'lanes', plugin: 'x-mod-stash' } as const;
const LANE_ASKS = { key: 'laneAsks', plugin: 'x-mod-stash' } as const;

export async function glideCards($: EngineInterface, k: BoardKit) {
    const {
        Box,
        Text,
        Button,
        Link,
        keptJSX,
        Input,
        isPartOn,
        isFolded,
        foldJSX,
        cardProps,
        askJSX,
    } = k;
    // 🛼 glide (FRM-385): each live lane a card on every board, its whole scope in order, done steps kept and marked, the
    // current one «← we are here»; a steer on it reaches clio's next prompt, whichever board took it
    const lanes = (await $.state.get(LANES)).value ?? [];
    const laneAsks = (await $.state.get(LANE_ASKS)).value ?? {};
    // a member's asks on the glide card: folded to their count by default, its rows marked as on the member's own board
    const memberJSX = (lane: StashLane, role: (typeof LANE_ROLES)[number]) => {
        const member = lane.members[role];
        if (!member) return null;
        const asks = laneAsks[lane.memberSids?.[role] ?? member] ?? [];
        const card = `lane:${lane.id}:${role}`;
        const isOpen = !isFolded(card);
        const badge = memberBadge(role);
        return (
            <Box flexDirection='column' key={card} rowGap={LINE_GAP}>
                <Box alignItems='center' flexDirection='row' gap={1}>
                    {/* asks waiting read amber with a 🙋, the one colour dima reads as «waits on you» (dima, 19:45) */}
                    <Text bold color={asks.length ? PALETTE.warn : undefined}>
                        {`${asks.length ? '🙋 ' : ''}${badge} ${role.replace('-', ' ')} · ${asks.length} ask${asks.length === 1 ? '' : 's'}`}
                    </Text>
                    {foldJSX(card)}
                </Box>
                {isOpen
                    ? asks.map((a, i) =>
                          askJSX(a as OrbitAsk, i, {
                              prefix: card,
                          }),
                      )
                    : null}
            </Box>
        );
    };
    const handleLaneSteer = (id: string, value: string) =>
        changeLaneSteer($, id, (n) => ({
            ...n,
            steer: steerOf(value),
        }));
    const handleLaneTake = (id: string) =>
        changeLaneSteer($, id, (n) => ({
            ...n,
            isTaken: !n.isTaken || undefined,
        }));
    // the running ticket in a card's title opens in linear (FRM-649:W39)
    const laneTitleJSX = (lane: StashLane, tail: string) => {
        const [, head, ticket, rest] =
            /^(.*? — )([A-Z]+-\d+)( .*)$/.exec(lane.title) ?? [];
        if (!ticket || ticket !== lane.ticket)
            return <Text bold>{`🛼 glide: ${lane.title}${tail}`}</Text>;
        return (
            <Box flexDirection='row' flexShrink={1}>
                <Text bold>{`🛼 glide: ${head}`}</Text>
                <Link
                    href={`https://linear.app/x-com/issue/${ticket}`}
                    key={`lane:${lane.id}:title-ticket`}>
                    {ticket}
                </Link>
                <Text bold>{`${rest}${tail}`}</Text>
            </Box>
        );
    };
    const laneJSX = isPartOn('stash.glide')
        ? lanes.map((lane) =>
              drawn(`lane ${lane.id}`, () => (
                  <Box
                      key={`lane:${lane.id}`}
                      {...cardProps}
                      marginTop={1}
                      rowGap={LINE_GAP}>
                      <Box flexDirection='row' justifyContent='space-between'>
                          {laneTitleJSX(
                              lane,
                              `${laneSpan(lane)}${lane.isPlanGone ? ' · plan file gone' : lane.isPlanStale ? ' · steps stale, x lane plan-steps failed' : ''}`,
                          )}
                          {foldJSX(`lane:${lane.id}`)}
                      </Box>
                      {isFolded(`lane:${lane.id}`)
                          ? null
                          : laneRows(lane).map(({ i, item }) => (
                                <Box
                                    alignItems='center'
                                    flexDirection='row'
                                    gap={1}
                                    // biome-ignore lint/suspicious/noArrayIndexKey: a lane step's place is its identity
                                    key={`lane:${lane.id}:${i}`}>
                                    <Box flexShrink={0}>
                                        <Text dimColor={item.isDone}>
                                            {item.isDone
                                                ? '✅'
                                                : i === lane.current
                                                  ? '➡️'
                                                  : '⬜'}{' '}
                                        </Text>
                                    </Box>
                                    {/* the ticket leads the step's text (dima's shot, 2026-10-23 19:44) */}
                                    {item.ticket ? (
                                        <Box flexShrink={0}>
                                            <Link
                                                href={`https://linear.app/x-com/issue/${item.ticket}`}
                                                key={`lane:${lane.id}:t:${i}`}>
                                                {item.ticket}
                                            </Link>
                                        </Box>
                                    ) : null}
                                    {/* the step's text gives way first: the link, tick and steer keep their room (dima's shots, 17:41, 17:46) */}
                                    <Box flexShrink={1} minWidth={0}>
                                        <Text
                                            bold={i === lane.current}
                                            dimColor={item.isDone}
                                            wrap='truncate-end'>
                                            {item.text}
                                        </Text>
                                    </Box>
                                    {/* tick leads, the steer follows, on the step's own line after its link (dima's shot, 17:46) */}
                                    {i === lane.current ? (
                                        <Box
                                            alignItems='center'
                                            flexDirection='row'
                                            flexGrow={1}
                                            flexShrink={0}
                                            gap={1}
                                            key={`lane:${lane.id}:act`}
                                            minWidth={24}>
                                            {/* the steer waits as a draft until 🛎️ tick sends it; no replay, a steer has nothing to redo (dima, 20:51) */}
                                            <Button
                                                key={`lane:${lane.id}:take`}
                                                onPress={() =>
                                                    void handleLaneTake(lane.id)
                                                }
                                                variant='primary'>
                                                {`${lane.isSteerTaken ? '✅' : '🛎️'} tick`}
                                            </Button>
                                            {Input ? (
                                                <Box flexGrow={1} minWidth={0}>
                                                    <Input
                                                        key={
                                                            field(
                                                                $,
                                                                `lane:${lane.id}:steer`,
                                                                lane.steer ??
                                                                    '',
                                                            ).key
                                                        }
                                                        onInput={(
                                                            value: string,
                                                        ) => {
                                                            field(
                                                                $,
                                                                `lane:${lane.id}:steer`,
                                                                lane.steer ??
                                                                    '',
                                                            ).type(
                                                                value,
                                                                () => {
                                                                    return handleLaneSteer(
                                                                        lane.id,
                                                                        value,
                                                                    );
                                                                },
                                                            );
                                                        }}
                                                        onSubmit={(
                                                            value: string,
                                                        ) =>
                                                            void handleLaneSteer(
                                                                lane.id,
                                                                value,
                                                            )
                                                        }
                                                        placeholder='steer'
                                                        value={
                                                            field(
                                                                $,
                                                                `lane:${lane.id}:steer`,
                                                                lane.steer ??
                                                                    '',
                                                            ).value
                                                        }
                                                    />
                                                </Box>
                                            ) : null}
                                            {keptJSX(`lane:${lane.id}:steer`)}
                                        </Box>
                                    ) : null}
                                </Box>
                            ))}
                      {isFolded(`lane:${lane.id}`)
                          ? null
                          : LANE_ROLES.map((role) => memberJSX(lane, role))}
                  </Box>
              )),
          )
        : null;
    return laneJSX;
}
