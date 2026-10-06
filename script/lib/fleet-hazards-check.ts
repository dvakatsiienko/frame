// a hazard is a top-level `- ` bullet plus its indented continuation lines; one the diff touched carries `guard:`
const GUARD = /guard:/;
const GUARD_NONE = /guard:\s*none(?!\s*·\s*(FRM|BYT)-\d+)/;

/** the new-file line numbers a `git diff -U0` adds */
export const addedLines = (diff: string) => {
    const added = new Set<number>();
    for (const [, start, count] of diff.matchAll(
        /^@@ -\S+ \+(\d+)(?:,(\d+))? @@/gm,
    )) {
        const first = Number(start);
        for (let n = first; n < first + Number(count ?? 1); n++) added.add(n);
    }
    return added;
};

export const hazardRefusals = (staged: string, added: Set<number>) => {
    const lines = staged.split('\n');
    const refusals: Refusal[] = [];
    let i = 0;
    while (i < lines.length) {
        if (!lines[i]?.startsWith('- ')) {
            i++;
            continue;
        }
        const first = i;
        do i++;
        while (i < lines.length && /^\s+\S/.test(lines[i] ?? ''));
        const touched = Array.from(
            { length: i - first },
            (_, k) => first + k + 1,
        );
        if (!touched.some((n) => added.has(n))) continue;
        const block = lines.slice(first, i).join('\n');
        const reason = !GUARD.test(block)
            ? 'no `guard:` tag'
            : GUARD_NONE.test(block)
              ? '`guard: none` names no ticket — write `guard: none · FRM-N`'
              : undefined;
        if (reason)
            refusals.push({
                line: first + 1,
                reason,
                text: lines[first] ?? '',
            });
    }
    return refusals;
};

/* Types */
type Refusal = { line: number; reason: string; text: string };
