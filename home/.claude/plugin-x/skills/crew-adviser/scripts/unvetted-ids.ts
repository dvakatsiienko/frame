import { threadOfNoteId } from './lib.ts';

// the notes a clio thread owes a verdict: a 🔴 sent note to it, and a located finding of a critique it
// ran; a plan row with no thread stamp (every one before the stamp) is owed by none
export function unvettedIds(
    notes: Array<Record<string, unknown>>,
    answered: Set<unknown>,
    threadId: string,
): string[] {
    return notes
        .filter((n) => {
            if (n.channel === 'plan') {
                const finding = n.finding as { located?: boolean } | null;
                return n.thread === threadId && finding?.located === true;
            }
            return (
                threadOfNoteId(String(n.id)) === threadId &&
                String(n.note ?? '')
                    .split('\n')[1]
                    ?.startsWith('🔴 sent')
            );
        })
        .map((n) => String(n.id))
        .filter((id) => !answered.has(id));
}
