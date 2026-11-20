// 🌔 the board's phases card: this session's plan, each line moved, ticked or steered by dima's hand

import type { EngineInterface } from 'claude-code';

import type { StashPlan } from '../types/stash.d.ts';
import { type BoardKit, LINE_GAP } from './board-kit.tsx';
import { field, steerOf } from './fields.ts';
import { METER_TINTS } from './look.ts';
import { moved } from './orbit.ts';
import { currentOrbit, inMarking, saveOrbit } from './orbit-store.ts';
import { keepShelf } from './session-record.ts';
import { drawn } from './tree.ts';
import { STALE_TURNS } from './turn-notes.ts';

const PHASE_MOONS = ['🌕', '🌔', '🌓', '🌒', '🌑'];
// a plan line's lead word, one short word before its colon
const PLAN_LEAD = /^[a-z]{2,10}:/i;

export async function phasesCard($: EngineInterface, k: BoardKit) {
    const {
        Box,
        Text,
        Button,
        keptJSX,
        o,
        Input,
        age,
        isPartOn,
        isFolded,
        foldJSX,
        cardProps,
        linkedJSX,
    } = k;
    // o84: dima's hand on this session's phases — a move, a tick, a steer
    const changePlan = async (change: (p: StashPlan) => StashPlan) => {
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
        <Box flexDirection='row' flexShrink={0} gap={1} key={`${key}:arrows`}>
            {/* every row keeps the same two buttons, so the column never drifts and no size changes (dima, 21:23–21:24);
        an end's dead arrow is the same button, a press on it does nothing — the api has no disabled */}
            {(['up', 'down'] as const).map((dir) => {
                const isLive = dir === 'up' ? canUp : canDown;
                const glyph = dir === 'up' ? '↑' : '↓';
                return (
                    <Button
                        key={`${key}:${dir}`}
                        onPress={() => {
                            if (isLive) onMove(dir === 'up' ? -1 : 1);
                        }}
                        plain>
                        {glyph}
                    </Button>
                );
            })}
        </Box>
    );
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
                                                      o.plan.steer ?? '',
                                                  ).key
                                              }
                                              onInput={(value: string) => {
                                                  field(
                                                      $,
                                                      'plan:steer',
                                                      o.plan?.steer ?? '',
                                                  ).type(value, () =>
                                                      handlePlanSteer(value),
                                                  );
                                              }}
                                              onSubmit={(value: string) =>
                                                  void handlePlanSteer(value)
                                              }
                                              placeholder='steer'
                                              value={
                                                  field(
                                                      $,
                                                      'plan:steer',
                                                      o.plan.steer ?? '',
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
                                                            lead[0].length,
                                                        )
                                                      : line,
                                                  `plan:${i}`,
                                              )}
                                          </Text>
                                      </Box>
                                      {arrowsJSX(
                                          `plan:${i}`,
                                          i > 0,
                                          i < (o.plan?.lines.length ?? 0) - 1,
                                          (by) => handlePlanMove(i, by),
                                      )}
                                  </Box>
                              );
                          },
                      )}
                  </Box>,
              ]
            : null,
    );
    return phasesJSX;
}
