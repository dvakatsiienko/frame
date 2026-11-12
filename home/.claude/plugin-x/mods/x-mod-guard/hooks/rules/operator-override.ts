// wispr types «Operator override PRs.», so case and a closing period pass; anything else around the words reads as talk about them
const WORD =
    /^operator[- ]override (all|prs|off)(?: until ([01]?\d|2[0-3])[:.]([0-5]\d))?\.?$/i;
const SHIFT = /^\/clio:shift\s+\S+$/;

const NOTE_OPEN = '<system-reminder>';
const NOTE_CLOSE = '</system-reminder>';

// the app glues queued session notes before his composer text. a note quotes a child's words, so only what follows the
// last close counts: the app writes that close, so a quoted one can never end the last note early
export function typedPart(text: string) {
    const prompt = text.trim();
    const lastClose = prompt.lastIndexOf(NOTE_CLOSE);
    if (!prompt.startsWith(NOTE_OPEN) || lastClose < 0) return prompt;
    return prompt.slice(lastClose + NOTE_CLOSE.length).trim();
}

// what a whole prompt asks of the switch, undefined for anything else; an «until» names a clock time, local, and only
// the all switch carries one
export function overrideAsked(text: string): OverrideAsk | undefined {
    const prompt = typedPart(text);
    if (SHIFT.test(prompt)) return { by: 'shift', scope: 'prs' };
    const [, word, hour, minute] = prompt.match(WORD) ?? [];
    const scope = word?.toLowerCase();
    if (scope === 'all')
        return {
            by: 'word',
            scope,
            ...(hour && minute
                ? { until: { hour: Number(hour), minute: Number(minute) } }
                : {}),
        };
    if (hour) return undefined;
    if (scope === 'prs' || scope === 'off') return { by: 'word', scope };
    return undefined;
}

// the next time the clock reads hour:minute, local: an «until 09:00» typed at 22:00 ends tomorrow morning
export function untilAt(now: number, until: { hour: number; minute: number }) {
    const at = new Date(now);
    at.setHours(until.hour, until.minute, 0, 0);
    if (at.getTime() <= now) at.setDate(at.getDate() + 1);
    return at.toISOString();
}

/* Types */
export type OverrideAsk =
    | { by: 'shift' | 'word'; scope: 'prs' }
    | {
          by: 'word';
          scope: 'all';
          until?: { hour: number; minute: number };
      }
    | { by: 'word'; scope: 'off' };

export type OverrideGrants = Record<
    string,
    { at: string; by: string; until?: string; sid?: string }
>;
