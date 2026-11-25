// what an ask says (FRM-695): a title, the topic alone, and a body, the fact that decides; its `text` is built from the two,
// since a press, the guard and herdr read the whole question. a session on the old schema still sends `text`; a pure rule

import type { OrbitAsk } from '../types/stash.d.ts';
import { askKind, askWords } from './orbit-ask-kind.ts';
import {
    ORBIT_BODY_MAX,
    ORBIT_TITLE_MAX,
    ORBIT_TITLE_WORDS,
    oneLine,
} from './util.ts';

export const RETIRED_TEXT = `; text is retired: title (the topic, ≤${ORBIT_TITLE_WORDS} words) and body`;
const SHAPE = 'an ask is { title, body, pick, area, why }';
export const NO_FIELDS = `«no title»: title is missing; body is missing; ${SHAPE}`;
// a leading «[tag]», one short word past the emoji before it, counts in neither title cap; a markdown link is no tag
const TAG = /^([^\p{L}\p{N}[]*)\[[\p{L}\p{N}-]{1,16}\](?!\()\s*/u;

// «1️⃣» is an emoji, its digit no word
const KEYCAP = /[0-9#*]\uFE0F?\u20E3/gu;

// his list in a body stays a list: the line breaks are kept, each line's spaces collapsed
const bodyOf = (v: unknown) =>
    typeof v === 'string' ? v.split('\n').map(oneLine).join('\n').trim() : '';

// an add's item or a follow's input as the ask will hold it; a follow keeps the field it leaves out; undefined: it says
// nothing at all
export function askFields(
    input: Record<string, unknown>,
    was?: OrbitAsk,
):
    | {
          fields: Pick<OrbitAsk, 'body' | 'kind' | 'text' | 'title'>;
          isRetired: boolean;
          name: string;
      }
    | { deny: string; name: string }
    | undefined {
    const text = oneLine(input.text);
    if (input.title === undefined && input.body === undefined) {
        if (!text) return undefined;
        const typed = askKind(text, input.kind, was?.kind);
        return 'deny' in typed
            ? { deny: typed.deny, name: text }
            : { fields: typed, isRetired: true, name: text };
    }
    // a `text` beside a body alone is neither form; beside a title it is ignored
    const title =
        input.title === undefined && !text
            ? (was?.title ?? '')
            : oneLine(input.title);
    const body =
        input.body === undefined ? (was?.body ?? '') : bodyOf(input.body);
    const typed = askKind(title, input.kind, was?.kind, 'title');
    // a refused kind's lead is still on the title, so only the kind is told, never a cap the lead breaks
    const isTyped = !('deny' in typed);
    const topic = isTyped ? askWords(typed) : title;
    const counted = topic.replace(TAG, '$1');
    const words = counted
        .split(' ')
        .filter((x) => /[\p{L}\p{N}]/u.test(x.replace(KEYCAP, '')));
    const chars = [...counted].length;
    const misses = [
        words.length ? ('deny' in typed ? typed.deny : '') : 'title is missing',
        isTyped && words.length > ORBIT_TITLE_WORDS
            ? `title is ${words.length} words, keep ≤${ORBIT_TITLE_WORDS}`
            : '',
        isTyped && chars > ORBIT_TITLE_MAX
            ? `title is ${chars} chars, keep it ≤${ORBIT_TITLE_MAX}`
            : '',
        body ? '' : 'body is missing',
        [...body].length > ORBIT_BODY_MAX
            ? `body is ${[...body].length} chars, keep it ≤${ORBIT_BODY_MAX}`
            : '',
    ].filter(Boolean);
    if (misses.length || 'deny' in typed)
        return {
            deny: `${misses.join('; ')}; ${SHAPE}`,
            name: (words.length ? title : oneLine(body)) || 'no title',
        };
    return {
        fields: {
            ...typed,
            body,
            text: `${typed.text}\n\n${body}`,
            title: topic,
        },
        isRetired: false,
        name: title,
    };
}
