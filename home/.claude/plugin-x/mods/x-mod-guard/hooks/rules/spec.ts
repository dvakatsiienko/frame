// a lane job to a coder or verifier goes through a spec (cclio:shape-lane-dispatch § 2): one naming a ticket at any
// item count, one naming none at 3+; a list in a «>» quote or a code fence is someone's words, never the job — an
// item starts its line, so a quoted one never counts
const TO_MEMBER = /🔧|🔎|\bcoder\b|\bverifier\b/i;
const SPEC_PATH = /\.scratch\/[^\s/]+\/spec\.md\b/;
const TICKET = /\b(FRM|BYT)-\d+\b/;
const ITEM = /^\s*\d{1,2}[.)]\s+\S/;
const FENCE = /^\s*(```|~~~)/;
const ITEMS_MIN = 3;

export const SPEC_WHY =
    "a lane job goes through a spec (cclio:shape-lane-dispatch § 2): a ticket's job at any size, any other at 3+ items";
export const SPEC_DOOR =
    'write the job to .scratch/<feature>/spec.md and send its path';

export function isSpecMissing(to: string, message: string) {
    if (!TO_MEMBER.test(to) || SPEC_PATH.test(message)) return false;
    let isFenced = false;
    let items = 0;
    for (const line of message.split('\n')) {
        if (FENCE.test(line)) isFenced = !isFenced;
        else if (!isFenced && ITEM.test(line)) items++;
    }
    return items >= (TICKET.test(message) ? 1 : ITEMS_MIN);
}
