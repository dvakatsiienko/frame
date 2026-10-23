// a coder's job of 3+ numbered items goes through a spec (cclio:shape-lane-dispatch § 6); a list in a «>» quote or a code fence
// is someone's words, never the job — an item starts its line, so a quoted one never counts
const TO_CODER = /🔧|\bcoder\b/i;
const SPEC_PATH = /\.scratch\/[^\s/]+\/spec\.md\b/;
const ITEM = /^\s*\d{1,2}[.)]\s+\S/;
const FENCE = /^\s*(```|~~~)/;
const ITEMS_MIN = 3;

export const SPEC_WHY =
    'a 3+-item job goes through a spec (cclio:shape-lane-dispatch § 6)';
export const SPEC_DOOR =
    'write the job to .scratch/<feature>/spec.md and send its path';

export function isSpecMissing(to: string, message: string) {
    if (!TO_CODER.test(to) || SPEC_PATH.test(message)) return false;
    let isFenced = false;
    let items = 0;
    for (const line of message.split('\n')) {
        if (FENCE.test(line)) isFenced = !isFenced;
        else if (!isFenced && ITEM.test(line)) items++;
    }
    return items >= ITEMS_MIN;
}
