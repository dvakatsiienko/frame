/**
 * ? The rules behind `plugin-x/bin/edit-anchored`: find one exact stretch of text, refuse
 * ? anything else. The executable owns argv, the file i/o and the exit code; this owns the
 * ? decision, so the decision has tests.
 * ?
 * ? Why it exists: a bg coder in a shared checkout has `Edit` and `Write` blocked by the
 * ? isolation guard, so it edits through a script — and the scripts it writes fresh each job
 * ? are where the silent no-ops live. An `sd` pattern that matches nothing, a replacement with
 * ? a `$` the shell ate, an anchor that matches twice and rewrites the wrong one: all three
 * ? exit 0 and read as success. Matching exactly once is the whole contract.
 */

export type AnchoredEdit =
    | { error: null; line: number; text: string }
    | { error: string; line: null; text: null };

export const editAnchored = (
    source: string,
    anchor: string,
    replacement: string,
): AnchoredEdit => {
    if (anchor === '') return err('the anchor is empty');
    // A no-op write is the failure this tool exists to catch, not a thing it should perform.
    if (anchor === replacement) return err('the replacement changes nothing');

    const at = source.indexOf(anchor);
    const count = countOf(source, anchor);

    if (count !== 1) return err(`the anchor matches ${count} times, not once`);

    return {
        error: null,
        line: source.slice(0, at).split('\n').length,
        text:
            source.slice(0, at) +
            replacement +
            source.slice(at + anchor.length),
    };
};

/* Helpers */
const countOf = (source: string, anchor: string) => {
    let count = 0;

    for (let at = source.indexOf(anchor); at !== -1; ) {
        count += 1;
        at = source.indexOf(anchor, at + anchor.length);
    }

    return count;
};

const err = (message: string): AnchoredEdit => ({
    error: message,
    line: null,
    text: null,
});
