// the go arm's door to the handoff store: the store's rules live once, in script/lib/handoff-store.ts,
// so go never re-implements the filename grammar, the audience gate or ingest-deletes. one json line out.
import type { Audience, Entry } from '../../script/lib/handoff-store.ts';
import {
    ageOf,
    defaultRoot,
    ingestHandoff,
    isAudience,
    listStore,
    peekHandoff,
    readableBy,
    runIdOf,
} from '../../script/lib/handoff-store.ts';

const [op = '', ...rest] = process.argv.slice(2);
const forAt = rest.indexOf('--for');
const reader = forAt === -1 ? undefined : rest[forAt + 1];
const slug = (
    forAt === -1 ? rest : rest.filter((_, i) => i !== forAt && i !== forAt + 1)
)[0];
const root = process.env.HANDOFF_STORE_ROOT ?? defaultRoot;

const answer = (value: unknown) => {
    process.stdout.write(`${JSON.stringify(value)}\n`);
};

if (reader !== undefined && !isAudience(reader)) {
    answer({
        error: `unknown audience ${reader} — any, ccli, cclio, cw`,
        usage: true,
    });
} else if (op === 'list') {
    const all = await listStore({ root });
    const mine = reader
        ? all.filter((entry) => readableBy(entry.audience, reader as Audience))
        : all;
    answer({
        value: {
            entries: await Promise.all(mine.map(row)),
            others: await Promise.all(
                all.filter((entry) => !mine.includes(entry)).map(row),
            ),
            root,
        },
    });
} else if (op === 'peek') {
    const found = await peekHandoff({ root, slug });
    if (found.error !== null) answer({ error: found.error, usage: true });
    else {
        const { entry, meta } = found.value;
        answer({
            value: {
                age: ageOf(entry.mtimeMs).label,
                bytes: entry.size,
                meta,
                name: entry.name,
                slug: entry.slug,
            },
        });
    }
} else if (op === 'ingest') {
    const taken = await ingestHandoff({
        reader: reader as Audience | undefined,
        root,
        slug,
    });
    if (taken.error !== null) answer({ error: taken.error, usage: true });
    else {
        const { body, entry, kept } = taken.value;
        answer({ value: { body, kept, name: entry.name, slug: entry.slug } });
    }
} else answer({ error: `store.ts: unknown op ${op}`, usage: true });

async function row(entry: Entry) {
    const age = ageOf(entry.mtimeMs);
    return {
        age: age.label,
        audience: entry.audience,
        author: entry.author,
        bytes: entry.size,
        lane: entry.lane,
        name: entry.name,
        runId: await runIdOf(entry),
        shared: entry.shared,
        slug: entry.slug,
        stale: age.stale,
    };
}
