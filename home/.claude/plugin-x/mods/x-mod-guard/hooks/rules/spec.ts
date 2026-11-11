import { TICKET_KEY } from './command.ts';

// a list or a ticket in a «>» quote or a code fence is someone's words, never the job
const SPEC_PATH = /\.scratch\/[^\s/]+\/spec\.md\b/;
const TICKET = new RegExp(`\\b(${TICKET_KEY})-\\d+\\b`);
const ITEM = /^\s*\d{1,2}[.)]\s+\S/;
const QUOTE = /^\s*>/;
const FENCE = /^\s*(```|~~~)/;
const ITEMS_MIN = 3;
const TICKET_ITEMS_MIN = 1;

export const SPEC_WHY =
    "a lane job goes through a spec (clio:shape-lane-dispatch § 2): a ticket's job from 1 item, any other from 3";
export const SPEC_DOOR =
    'write the job to .scratch/<feature>/spec.md and send its path';

// the job's shape alone: who it goes to is the thread record's (FRM-570 rule 9), read by the caller
export function isSpecMissing(message: string) {
    if (SPEC_PATH.test(message)) return false;
    let isFenced = false;
    let items = 0;
    let isTicket = false;
    for (const line of message.split('\n')) {
        if (FENCE.test(line)) isFenced = !isFenced;
        if (isFenced || QUOTE.test(line)) continue;
        if (ITEM.test(line)) items++;
        if (TICKET.test(line)) isTicket = true;
    }
    return items >= (isTicket ? TICKET_ITEMS_MIN : ITEMS_MIN);
}
