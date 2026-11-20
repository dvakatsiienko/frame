// 🚦 the board (FRM-662): the fleet board pane's draw — every session's row, its orbit, phases and glide cards, the
// steer boxes, the folds — read from the view the poll published; the wiring's layer, beside register.tsx
// size: one draw over the board's view, cut by card next (the map's board/ files)

import type { EngineInterface, RenderElement, RenderInput } from 'claude-code';

import type { OrbitAsk, StashLane, StashPlan } from '../types/stash.d.ts';
import { LINE_GAP, boardKit } from './board-kit.tsx';
import { orbitCard } from './board-orbit.tsx';
import { dropKept, field, steerOf, takeFieldsOnce } from './fields.ts';
import { pressHot } from './keep-warm.ts';
import { LANE_ROLES, changeLaneSteer, laneRows, laneSpan } from './lanes.ts';
import {
    CTX_BAR,
    CTX_FALLBACK_AT,
    CTX_RING,
    EFFORT_CELL,
    METER_TINTS,
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
import { moved } from './orbit.ts';
import { currentOrbit, inMarking, saveOrbit } from './orbit-store.ts';
import { memberBadge, ticketOf, unbold, waitSpans } from './parse.ts';
import { type Member, openBoard } from './roster.ts';
import { keepShelf } from './session-record.ts';
import { flipKnob } from './settings-store.ts';
import { cleanTree, drawn } from './tree.ts';
import { STALE_TURNS } from './turn-notes.ts';
import { meterNow } from './usage.ts';
import { load, publish, viewDoors } from './view.ts';
import { flipWind } from './wind.ts';
import { WIND_EMOJI, windSay } from './wind-run.ts';

const CLIO_ASKS = { key: 'clioAsks', plugin: 'x-mod-stash' } as const;
// a board card folded to its head row, per session (dima's o5, 17:16)
const FOLDS = { key: 'folds', plugin: 'x-mod-stash' } as const;
// 🛼 glide (FRM-385): the fleet's lanes in one shelf file, written only by the session the registry names 🦉 clio, read by
// every board on its poll; at most 5 plain steps, each ≤60 chars, stale after 8 of clio's turns with nothing moved
const LANES = { key: 'lanes', plugin: 'x-mod-stash' } as const;
const LANE_ASKS = { key: 'laneAsks', plugin: 'x-mod-stash' } as const;

const ACCENT = PALETTE.accent;
// a plan line's lead word, one short word before its colon
const PLAN_LEAD = /^[a-z]{2,10}:/i;
const PHASE_MOONS = ['🌕', '🌔', '🌓', '🌒', '🌑'];
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
                    keptJSX,
                    now,
                    me,
                    o,
                    Input,
                    age,
                    isPartOn,
                    foldedOf,
                    isFolded,
                    foldJSX,
                    cardProps,
                    speakJSX,
                    linkedJSX,
                    askJSX,
                } = k;
                const orbitJSX = orbitCard($, k);
                // 🛼 glide (FRM-385): each live lane a card on every board, its whole scope in order, done steps kept and marked, the
                // current one «← we are here»; a steer on it reaches clio's next prompt, whichever board took it
                const lanes = (await $.state.get(LANES)).value ?? [];
                const laneAsks = (await $.state.get(LANE_ASKS)).value ?? {};
                // a member's asks on the glide card: folded to their count by default, its rows marked as on the member's own board
                const memberJSX = (
                    lane: StashLane,
                    role: (typeof LANE_ROLES)[number],
                ) => {
                    const member = lane.members[role];
                    if (!member) return null;
                    const asks =
                        laneAsks[lane.memberSids?.[role] ?? member] ?? [];
                    const card = `lane:${lane.id}:${role}`;
                    const isOpen = !isFolded(card);
                    const badge = memberBadge(role);
                    return (
                        <Box
                            flexDirection='column'
                            key={card}
                            rowGap={LINE_GAP}>
                            <Box
                                alignItems='center'
                                flexDirection='row'
                                gap={1}>
                                {/* asks waiting read amber with a 🙋, the one colour dima reads as «waits on you» (dima, 19:45) */}
                                <Text
                                    bold
                                    color={
                                        asks.length ? PALETTE.warn : undefined
                                    }>
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
                // o84: dima's hand on this session's phases — a move, a tick, a steer
                const changePlan = async (
                    change: (p: StashPlan) => StashPlan,
                ) => {
                    await inMarking(async () => {
                        const was = await currentOrbit($);
                        if (!was.plan) return;
                        await saveOrbit(
                            $,
                            {
                                ...was,
                                plan: change(was.plan),
                            },
                            () => keepShelf($),
                        );
                    });
                };
                const handlePlanMove = (i: number, by: -1 | 1) =>
                    void changePlan((p) => ({
                        ...p,
                        isMoved: true,
                        lines: moved(p.lines, i, by),
                    }));
                const handlePlanTick = () =>
                    void changePlan((p) => ({
                        ...p,
                        mark: p.mark ? undefined : 'accepted',
                    }));
                const handlePlanSteer = (value: string) =>
                    changePlan((p) => ({ ...p, steer: steerOf(value) }));
                const arrowsJSX = (
                    key: string,
                    canUp: boolean,
                    canDown: boolean,
                    onMove: (by: -1 | 1) => void,
                ) => (
                    <Box
                        flexDirection='row'
                        flexShrink={0}
                        gap={1}
                        key={`${key}:arrows`}>
                        {/* every row keeps the same two buttons, so the column never drifts and no size changes (dima, 21:23–21:24);
                    an end's dead arrow is the same button, a press on it does nothing — the api has no disabled */}
                        {(['up', 'down'] as const).map((dir) => {
                            const isLive = dir === 'up' ? canUp : canDown;
                            const glyph = dir === 'up' ? '↑' : '↓';
                            return (
                                <Button
                                    key={`${key}:${dir}`}
                                    onPress={() => {
                                        if (isLive)
                                            onMove(dir === 'up' ? -1 : 1);
                                    }}
                                    plain>
                                    {glyph}
                                </Button>
                            );
                        })}
                    </Box>
                );
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
                        return (
                            <Text bold>{`🛼 glide: ${lane.title}${tail}`}</Text>
                        );
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
                                  <Box
                                      flexDirection='row'
                                      justifyContent='space-between'>
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
                                                    <Text
                                                        dimColor={item.isDone}>
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
                                                <Box
                                                    flexShrink={1}
                                                    minWidth={0}>
                                                    <Text
                                                        bold={
                                                            i === lane.current
                                                        }
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
                                                                void handleLaneTake(
                                                                    lane.id,
                                                                )
                                                            }
                                                            variant='primary'>
                                                            {`${lane.isSteerTaken ? '✅' : '🛎️'} tick`}
                                                        </Button>
                                                        {Input ? (
                                                            <Box
                                                                flexGrow={1}
                                                                minWidth={0}>
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
                                                        {keptJSX(
                                                            `lane:${lane.id}:steer`,
                                                        )}
                                                    </Box>
                                                ) : null}
                                            </Box>
                                        ))}
                                  {isFolded(`lane:${lane.id}`)
                                      ? null
                                      : LANE_ROLES.map((role) =>
                                            memberJSX(lane, role),
                                        )}
                              </Box>
                          )),
                      )
                    : null;
                // the lanes and the phases stick to the board's bottom, the lanes on top of the phases: a docked board fills its rows
                // and a gap grows above them (dima, 11:07; the lanes, 20:12)
                const phasesJSX = drawn('phases', () =>
                    o.plan && isPartOn('stash.phases')
                        ? [
                              <Box
                                  key='phases'
                                  {...cardProps}
                                  marginTop={1}
                                  rowGap={LINE_GAP}>
                                  {/* one row: the title, then one tick and one steer for the whole order at the right, then 📂 — every
                              part centered on the row (dima's o84; moved into the head, 21:26: «looks off and steals vertical space») */}
                                  <Box
                                      alignItems='center'
                                      flexDirection='row'
                                      gap={1}
                                      justifyContent='space-between'
                                      key='phases:head'>
                                      <Box flexShrink={0}>
                                          <Text bold>
                                              {`🌔 phases${age !== undefined && age >= STALE_TURNS ? ` · stale, untouched ${age} turns` : ''}`}
                                          </Text>
                                      </Box>
                                      {isFolded('phases') ? null : (
                                          <Box
                                              alignItems='center'
                                              flexDirection='row'
                                              flexGrow={1}
                                              flexShrink={1}
                                              gap={1}
                                              justifyContent='flex-end'
                                              key='plan:act'
                                              minWidth={0}>
                                              <Button
                                                  key='plan:tick'
                                                  onPress={handlePlanTick}
                                                  variant='primary'>
                                                  {`${o.plan.mark ? '✅' : '🛎️'} tick`}
                                              </Button>
                                              {Input ? (
                                                  <Box
                                                      flexShrink={1}
                                                      minWidth={0}
                                                      width={24}>
                                                      <Input
                                                          key={
                                                              field(
                                                                  $,
                                                                  'plan:steer',
                                                                  o.plan
                                                                      .steer ??
                                                                      '',
                                                              ).key
                                                          }
                                                          onInput={(
                                                              value: string,
                                                          ) => {
                                                              field(
                                                                  $,
                                                                  'plan:steer',
                                                                  o.plan
                                                                      ?.steer ??
                                                                      '',
                                                              ).type(
                                                                  value,
                                                                  () =>
                                                                      handlePlanSteer(
                                                                          value,
                                                                      ),
                                                              );
                                                          }}
                                                          onSubmit={(
                                                              value: string,
                                                          ) =>
                                                              void handlePlanSteer(
                                                                  value,
                                                              )
                                                          }
                                                          placeholder='steer'
                                                          value={
                                                              field(
                                                                  $,
                                                                  'plan:steer',
                                                                  o.plan
                                                                      .steer ??
                                                                      '',
                                                              ).value
                                                          }
                                                      />
                                                  </Box>
                                              ) : null}
                                              {keptJSX('plan:steer')}
                                          </Box>
                                      )}
                                      {foldJSX('phases')}
                                  </Box>
                                  {(isFolded('phases') ? [] : o.plan.lines).map(
                                      (line, i) => {
                                          // a line's lead word — `now:`, `next:`, `then:` — prints bold (dima, 20:40)
                                          const lead = line.match(PLAN_LEAD);
                                          return (
                                              // the moon fills by nearness, the then lines dim (dima, 20:58); only the now lead is green (21:08)
                                              <Box
                                                  alignItems='center'
                                                  flexDirection='row'
                                                  gap={1}
                                                  // biome-ignore lint/suspicious/noArrayIndexKey: a plan line's place is its identity
                                                  key={`plan:${i}`}>
                                                  <Box
                                                      flexGrow={1}
                                                      flexShrink={1}
                                                      minWidth={0}>
                                                      <Text dimColor={i > 1}>
                                                          {/* a siesta is a pause, not a step: 🌤️ in place of its moon (dima, 20:37) */}
                                                          {`${/^siesta:/i.test(line) ? '🌤️' : PHASE_MOONS[Math.min(i, PHASE_MOONS.length - 1)]} `}
                                                          {lead ? (
                                                              <Text
                                                                  bold
                                                                  color={
                                                                      i === 0
                                                                          ? METER_TINTS.calm5h
                                                                          : undefined
                                                                  }>
                                                                  {lead[0]}
                                                              </Text>
                                                          ) : null}
                                                          {linkedJSX(
                                                              lead
                                                                  ? line.slice(
                                                                        lead[0]
                                                                            .length,
                                                                    )
                                                                  : line,
                                                              `plan:${i}`,
                                                          )}
                                                      </Text>
                                                  </Box>
                                                  {arrowsJSX(
                                                      `plan:${i}`,
                                                      i > 0,
                                                      i <
                                                          (o.plan?.lines
                                                              .length ?? 0) -
                                                              1,
                                                      (by) =>
                                                          handlePlanMove(i, by),
                                                  )}
                                              </Box>
                                          );
                                      },
                                  )}
                              </Box>,
                          ]
                        : null,
                );
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
