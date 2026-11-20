// clio's boot: the `boot:` store key, its open and close, and the note it adds to a step
import type { EngineInterface } from 'claude-code';

import { isLaneOwner } from './session-identity.ts';
import type { IsPartOn } from './settings-store.ts';

// clio's boot is open from the clio:boot skill's load until a reply as long as the board prints; start_session's own
// «then end your turn» hint ended the 10-29 boot early (FRM-426, exit 9). the keep is the store, so a reload still knows;
// a harness nudge answered «booting, board next» is short and never closes it, a silent turn has no reply at all
const BOOT = 'boot:';
const BOOT_SKILL = /^(?:clio:)?boot$/;
const BOARD_MIN = 300;
const BOOT_MS = 3 * 60 * 60 * 1000;
const START_SESSION_TOOL = 'mcp__ccd_session__start_session';
const BOOT_NOTE = 'the boot continues; the board ends the turn';
// a clio boot whose board has not printed: the skill loaded in the last hours, no board-length reply since
async function isBootOpen($: EngineInterface) {
    if (!(await isLaneOwner($))) return false;
    const at = await $.store.get(BOOT + (await $.session.id()));
    return typeof at === 'number' && (await $.clock.now()) - at < BOOT_MS;
}
export async function openBoot($: EngineInterface, skill: string) {
    if (BOOT_SKILL.test(skill) && (await isLaneOwner($)))
        await $.store
            .set(BOOT + (await $.session.id()), await $.clock.now())
            .catch(() => undefined);
}
// a reply as long as the board closes the boot
export async function closeBoot(
    $: EngineInterface,
    sid: string,
    reply: string,
) {
    if (reply.length >= BOARD_MIN)
        await $.store.delete(BOOT + sid).catch(() => undefined);
}
// start_session's «then end your turn» hint, answered while the boot is open
export async function bootNote(
    $: EngineInterface,
    tool: string,
    isOn: IsPartOn,
) {
    return tool === START_SESSION_TOOL &&
        isOn('stash.boot') &&
        (await isBootOpen($))
        ? BOOT_NOTE
        : undefined;
}
