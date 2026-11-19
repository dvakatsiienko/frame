// the tool-call folds (PK-432, FRM-638:W23): a run of tool calls is one folded row; opened, each call is a row of its
// own, and a call opens alone to show its input. one owner for what is open; the list draws what `withCallRows` gives.

/** @typedef {import('./row-model.js').Row} Row */

const CALL = '#call-';
const CARD = '#card';

/** a call's row: its tool row's id and its place @param {string} id */
export const isCallRow = (id) => id.includes(CALL);

/** an open call's json card, a row of its own after the call's (FRM-659:W4) @param {string} id */
export const isCardRow = (id) => id.endsWith(CARD);

export function createToolFolds() {
    /** @type {Set<string>} */
    const open = new Set();
    return {
        clear: () => open.clear(),
        /** @param {string} id a tool row's or a call row's */
        isOpen: (id) => open.has(id),
        /**
         * a click on a fold or a call: it opens, or closes, alone; a click in a card changes nothing (FRM-659:W4)
         * @param {string} id @returns {boolean} whether a fold moved
         */
        toggle(id) {
            if (isCardRow(id)) return false;
            if (!open.delete(id)) open.add(id);
            return true;
        },
    };
}

/**
 * the rows with each open tool row's calls after it, one row a call, each with its own open state in its version, so
 * a call that opens is measured again
 * @param {readonly Row[]} rows @param {ReturnType<typeof createToolFolds>} folds @returns {Row[]}
 */
export function withCallRows(rows, folds) {
    return rows.flatMap((row) => {
        if (row.kind !== 'tool' || !folds.isOpen(row.id)) return [row];
        const calls = (row.calls ?? []).flatMap((call, i) => {
            const id = `${row.id}${CALL}${i}`;
            const isOpen = folds.isOpen(id);
            const callRow = {
                ...row,
                calls: [call],
                id,
                text: call.arg ? `${call.name} ${call.arg}` : call.name,
                tools: [call.name],
                version: isOpen ? 2 : 1,
            };
            return isOpen
                ? [
                      callRow,
                      // its text is the json it shows, so find counts and steps to what the card holds
                      {
                          ...callRow,
                          id: `${id}${CARD}`,
                          text: call.input ?? '',
                          version: 1,
                      },
                  ]
                : [callRow];
        });
        // an open fold draws ▾, so it is drawn again: a half step no closed version reaches
        return [{ ...row, version: row.version + 0.5 }, ...calls];
    });
}
