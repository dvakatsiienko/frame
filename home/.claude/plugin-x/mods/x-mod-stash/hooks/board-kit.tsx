// the board draw's shared kit: the surface's elements, the view's reads, and the fold, speak, link and ask helpers
// every card draws with; drawBoard and each card take it whole

import type { EngineInterface, RenderInput } from 'claude-code';

import type { OrbitAsk } from '../types/stash.d.ts';
import {
    askBox,
    flushFields,
    forgetMountedText,
    offerBack,
    steerOf,
} from './fields.ts';
import { LANE_ROLES } from './lanes.ts';
import { cardBorder } from './look.ts';
import { CHANGED_MARK, linkLabel } from './orbit.ts';
import { pressMark } from './orbit-presses.ts';
import { changeAssumed, markAsks, orbitNow } from './orbit-store.ts';
import { keepShelf } from './session-record.ts';
import { readSwitch } from './settings-store.ts';
import { isSpeakingNow, playPress, refreshSpeaking, speak } from './speak.ts';
import { planAge } from './turn-notes.ts';
import { expandHome } from './util.ts';
import { viewDoors } from './view.ts';

// a card that only shows asks: their keys' prefix, no tick, replay, sound or steer (a lane member's, FRM-643)
export type ViewDoor = { prefix: string };
// where an ask card's tick, replay and steer go, and the prefix its keys carry
export type AskDoor = {
    prefix: string;
    mark: (a: OrbitAsk, mark: 'accepted' | 'rejected') => void;
    // resolves once the steer is written: a flush before a prompt waits on it
    steer: (a: OrbitAsk, value: string) => unknown;
};
// a glide card's member subcard or a quiet card, folded by default
const FOLDED_CARD = new RegExp(
    `^(lane:[^:]+:(${LANE_ROLES.join('|')})|quiet:.+)$`,
);
// a ticket id inside an ask or a phase; split keeps the id as every odd part
const TICKET_IDS = /\b((?:FRM|BYT)-\d+)\b/;
// a closed ask's lead, read from its closing word: dropped 🗑️, started or queued ▶️, anything else done ✅ (dima, 20:37)
export const closedMark = (word: string) =>
    /^(drop|cut|cancel|superseded|declined)/i.test(word)
        ? '🗑️'
        : /^(start|queued|running|in progress)/i.test(word)
          ? '▶️'
          : '✅';
// a file an ask links to opens in its app; `~/` is the home dir, the path an argv item, never a shell word
async function openPath($: EngineInterface, path: string) {
    const home = (await $.env.get('HOME')) ?? '';
    await $.process
        .run(['open', expandHome(path, home)])
        .catch(() => undefined);
}
// a quarter row between a block's lines: the desktop draws the fraction, the terminal rounds it away (dima, 21:22)
export const LINE_GAP = 0.25;
// what only the board pane draws, its clock included: the band never reads it, so a tick never redraws the band
const BOARD_VIEW = { key: 'board', plugin: 'x-mod-stash' } as const;
// 🪐 orbit: the session's asks to dima, ticked in the board instead of pasted back; the session writes them through
// its own tool, never a reply block
const ORBIT = { key: 'orbit', plugin: 'x-mod-stash' } as const;
// a reload keeps `$.state` and resets the module: what must outlive a mod save lives there (FRM-320)
// what the band and the board draw: renders read it, and a write redraws them, no invalidate
const VIEW = { key: 'view', plugin: 'x-mod-stash' } as const;
// a board card folded to its head row, per session (dima's o5, 17:16)
const FOLDS = { key: 'folds', plugin: 'x-mod-stash' } as const;

export async function boardKit($: EngineInterface, e: RenderInput<'Pane'>) {
    const ui = $.ui.resolve(e);
    const { Box, Text, Button, Link } = ui;
    const Svg = e.surface === 'desktop' && 'Svg' in ui ? ui.Svg : undefined;
    // the poll read the registry into the view; the pane only draws it, so a draw costs no file or process read
    const board = (await $.state.get(BOARD_VIEW)).value;
    // a steer the store refused three times, offered back beside its box: a press saves it (dima's o123)
    const keptDrawn = new Set<string>();
    const keptJSX = (key: string) => {
        const list = board?.keptSteers?.[key] ?? [];
        const kept = list.at(-1);
        if (kept !== undefined) keptDrawn.add(key);
        return kept === undefined ? null : (
            <Box flexShrink={0} key={`kept:${key}`}>
                <Button
                    key={`kept:${key}`}
                    onPress={() => offerBack($, key, viewDoors($))}
                    plain>
                    {`↩️ kept «${kept.length > 40 ? `${kept.slice(0, 39)}…` : kept}»${list.length > 1 ? ` +${list.length - 1}` : ''}`}
                </Button>
            </Box>
        );
    };
    const now = board?.at ?? 0;
    const me = (await $.state.get(VIEW)).value?.selfId;
    // the board's lower half: this session's orbit and its plan, read here so a mark or a tool call redraws it
    const o = (await $.state.get(ORBIT)).value ?? orbitNow();
    // mobile draws no Input: its steers wait for another surface
    const Input = 'Input' in ui ? ui.Input : undefined;
    const open = o.asks.filter((a) => !a.isResolved);
    const age = planAge(o);
    // 🛎️ and ↩️ are one toggle each, side by side at the row's left: lit while it holds, plain while it does not
    // an ask card's door: this session's own orbit; a lane card passes a view door, which draws no control
    const ownDoor: AskDoor = {
        mark: (a, mark) => void pressMark($, a.id, mark),
        prefix: 'orbit',
        steer: (a, value) => handleSteer(a.id, value),
    };
    const markJSX = (
        a: OrbitAsk,
        mark: 'accepted' | 'rejected',
        door: AskDoor = ownDoor,
    ) => (
        <Button
            key={`${door.prefix}:${mark}:${a.id}`}
            onPress={() => door.mark(a, mark)}
            // take is always the filled button (dima, 17:08); a held mark swaps its emoji for ✅, so the size never
            // changes (dima's o7, 17:16) — one mark per ask, so only one of the two ever shows ✅
            {...(mark === 'accepted' ? { variant: 'primary' as const } : {})}>
            {`${a.mark === mark ? (a.isLocked ? '🔓' : '✅') : mark === 'accepted' ? '🛎️' : '🔁'} ${mark === 'accepted' ? 'tick' : 'replay'}`}
        </Button>
    );
    const handleAssumedSteer = (id: string, value: string) =>
        changeAssumed(
            $,
            () => keepShelf($),
            (y) => (y.id === id ? { ...y, steer: steerOf(value) } : y),
        );
    // the steer keeps every keystroke, no Enter needed
    const handleSteer = (id: string, value: string) =>
        markAsks(
            $,
            () => keepShelf($),
            (x) => (x.id === id ? { ...x, steer: steerOf(value) } : x),
            false,
            id,
        );
    // a locked ask is the running turn's: no control at all, its mark and steer as dim text (the api has no disabled)
    // speak reads, pauses or stops through its control socket: a mod's text can't be selected for F4 on the desktop
    // (claude-code#101090) — a workaround, see mods/workarounds.md
    const boardShown = (await $.state.get(VIEW)).value?.shown ?? {};
    const isPartOn = (key: string) => boardShown[key] !== false;
    const speakAssumed = await readSwitch($, 'speak');
    const folds = (await $.state.get(FOLDS)).value ?? {};
    // one fold rule for every card: open until folded, but a glide card's member subcard starts folded to its count
    const foldedOf = (kept: Record<string, boolean>, card: string) =>
        kept[card] ?? FOLDED_CARD.test(card);
    const isFolded = (card: string) => foldedOf(folds, card);
    // 📂 sits at the far right of each card's head line and folds the card to that line, then reads 📁 (dima's o5, 17:21)
    const foldJSX = (card: string) => (
        <Button
            key={`fold:${card}`}
            onPress={async () => {
                // a fold remounts its fields: they draw the stored text again
                await flushFields($, viewDoors($));
                await forgetMountedText($);
                const was = (await $.state.get(FOLDS)).value ?? {};
                await $.state.set(FOLDS, {
                    ...was,
                    [card]: !foldedOf(was, card),
                });
            }}
            plain>
            {isFolded(card) ? '📁' : '📂'}
        </Button>
    );
    // every card's frame; a card adds its key, its margin and its row gap
    const cardProps = {
        borderColor: cardBorder(e.surface),
        borderStyle: 'round',
        flexDirection: 'column',
        paddingX: 1,
        paddingY: 0.5,
    } as const;
    // ⏸️ while speak reads, ▶️ when it is paused or quiet: a press pauses, resumes, or reads this row (dima, 15:51)
    const isSpeaking = await isSpeakingNow($);
    // an ask's one link: an https url opens as a link, a file path or an obsidian:// url through `open` (a mod Link takes https only)
    const askLinkJSX = (id: string, target: string) => {
        return target.startsWith('https://') ? (
            <Link href={target} key={`ask:link:${id}`}>
                {`🔗 ${target.slice('https://'.length).split('/')[0]}`}
            </Link>
        ) : (
            <Button
                key={`ask:link:${id}`}
                onPress={() => void openPath($, target)}
                plain>
                {`🔗 ${linkLabel(target)}`}
            </Button>
        );
    };
    const speakJSX = (id: string, text: string) =>
        !isPartOn('stash.speak')
            ? []
            : [
                  <Button
                      key={`orbit:read:${id}`}
                      onPress={() =>
                          void speak($, {
                              op: 'read',
                              text,
                          }).then(() => refreshSpeaking($))
                      }
                      plain>
                      🔊
                  </Button>,
                  <Button
                      key={`orbit:pause:${id}`}
                      onPress={() => void playPress($, text)}
                      plain>
                      {isSpeaking ? '⏸️' : '▶️'}
                  </Button>,
                  <Button
                      key={`orbit:stop:${id}`}
                      onPress={() =>
                          void speak($, { op: 'stop' }).then(() =>
                              refreshSpeaking($),
                          )
                      }
                      plain>
                      ⏹️
                  </Button>,
              ];
    // a ticket id in an ask or a phase opens its linear page, as a session row's does (dima's o62, 22:13)
    const linkedJSX = (text: string, key: string) =>
        text.split(TICKET_IDS).map((part, i) => {
            if (i % 2 === 0) return part;
            return (
                <Link
                    href={`https://linear.app/x-com/issue/${part}`}
                    key={`${key}:${i}`}>
                    {part}
                </Link>
            );
        });
    // the ask on its own line, the bold id leading it; under it one row: the steer, 🛎️ ↩️, then speak's 🔊 ⏯ ⏹
    // (dima, 20:08); a full row of air between asks (dima, 19:52)
    // an ask resolved with a closing word draws dim, the word after its text and no controls, for its turn and one more
    // no card: its emoji from the word and the ask on one line, the word under it, dim and whole (dima's shots,
    // 20:37 and 10-13 18:20: on one line the word got cut)
    const closedJSX = (a: OrbitAsk, i: number, door: AskDoor | ViewDoor) => (
        <Box
            flexDirection='column'
            key={`${door.prefix}:ask:${a.id}`}
            marginTop={i > 0 ? 0.5 : 0}
            paddingX={1}>
            <Text dimColor wrap='truncate-end'>
                {`${closedMark(a.word ?? '')} ${a.id}: ${a.text}`}
            </Text>
            <Text bold dimColor>
                {`➡️ ${a.word}`}
            </Text>
        </Box>
    );
    const askJSX = (
        a: OrbitAsk,
        i: number,
        door: AskDoor | ViewDoor = ownDoor,
    ) =>
        a.word ? (
            closedJSX(a, i, door)
        ) : (
            <Box
                borderDimColor
                borderStyle='round'
                flexDirection='column'
                key={`${door.prefix}:ask:${a.id}`}
                marginTop={i > 0 ? 0.5 : 0}
                paddingX={1}
                rowGap={LINE_GAP}>
                <Box flexDirection='row' gap={1}>
                    <Box
                        flexDirection='column'
                        flexGrow={1}
                        flexShrink={1}
                        minWidth={0}
                        rowGap={LINE_GAP}>
                        {/* the id and the pick bold, so the proposal stands out (dima, 20:30) */}
                        {/* an ask answered this turn leads its line with 👀 until the turn ends — inline, so the row keeps its left
                edge; a hover card would need a box of its own (dima, 20:34, 20:39) */}
                        <Text>
                            {a.isResolved ? '👀 ' : ''}
                            {/* a joined ask's mark leads its line, so the row below holds only 🔊 and the steer (dima, 11:57) */}
                            {a.isChanged ? `${CHANGED_MARK} ` : ''}
                            <Text bold>{a.id}</Text>
                            {': '}
                            {linkedJSX(a.text, `ask:${a.id}`)}
                        </Text>
                        {/* the pick on a line of its own, the mock's card shape (dima, 17:00) */}
                        <Text>
                            {'➡️ '}
                            <Text bold>
                                {linkedJSX(a.pick, `pick:${a.id}`)}
                            </Text>
                        </Text>
                    </Box>
                </Box>
                {/* the buttons lead, the steer follows them, on the line under the pick — never beside it (dima, 20:19; 20:23) */}
                {'mark' in door ? (
                    <Box
                        alignItems='center'
                        flexDirection='row'
                        gap={1}
                        key={`${door.prefix}:row:${a.id}`}>
                        {/* a joined ask keeps both buttons; the held one reads 🔓 while the turn holds it (dima, 17:42) */}
                        {[
                            markJSX(a, 'accepted', door),
                            markJSX(a, 'rejected', door),
                        ]}
                        {/* reading aloud edits nothing, so a locked row keeps 🔊 ⏯️ ⏹️ (dima, 20:25) */}
                        {/* 🔊 reads what the card shows, no «pick» word (dima, 17:14) */}
                        {speakJSX(a.id, `${a.text}. ${a.pick}`)}
                        {a.isLocked ? (
                            a.steer ? (
                                <Box flexShrink={1} minWidth={0}>
                                    <Text dimColor wrap='truncate-end'>
                                        {/* a sent steer leads with 💬, drawn for dima only: the model gets «his steer: …» (dima, 18:14) */}
                                        {`💬 «${a.steer}»`}
                                    </Text>
                                </Box>
                            ) : null
                        ) : Input ? (
                            <Box flexGrow={1} flexShrink={1} minWidth={0}>
                                <Input
                                    key={askBox($, a).key}
                                    onInput={(value: string) => {
                                        askBox($, a).type(value, () => {
                                            return door.steer(a, value);
                                        });
                                    }}
                                    onSubmit={(value: string) =>
                                        door.steer(a, value)
                                    }
                                    placeholder='steer'
                                    value={askBox($, a).value}
                                />
                            </Box>
                        ) : null}
                        {/* a locked row takes no steer, so it offers none */}
                        {a.isLocked
                            ? null
                            : keptJSX(`${door.prefix}:steer:${a.id}`)}
                        {/* the steer comes first, the file link after it, at the row's end (dima's shot, 20:57) */}
                        {a.link ? askLinkJSX(a.id, a.link) : null}
                    </Box>
                ) : a.link ? (
                    <Box key={`${door.prefix}:row:${a.id}`}>
                        {askLinkJSX(a.id, a.link)}
                    </Box>
                ) : null}
            </Box>
        );
    return {
        Box,
        Button,
        Input,
        Link,
        Svg,
        Text,
        age,
        askJSX,
        askLinkJSX,
        board,
        boardShown,
        cardProps,
        closedJSX,
        foldJSX,
        foldedOf,
        folds,
        handleAssumedSteer,
        handleSteer,
        isFolded,
        isPartOn,
        isSpeaking,
        keptDrawn,
        keptJSX,
        linkedJSX,
        markJSX,
        me,
        now,
        o,
        open,
        ownDoor,
        speakAssumed,
        speakJSX,
        ui,
    };
}

export type BoardKit = Awaited<ReturnType<typeof boardKit>>;
