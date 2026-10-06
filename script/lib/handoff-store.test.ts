/**
 * ? Tests for the handoff store's rules. Every verb runs against a fixture
 * ? directory in a temp dir — nothing here reads or writes ~/.claude, which is
 * ? the live store other sessions are handing off through right now.
 * ?
 * ?   pnpm test        # once
 * ?   pnpm test:watch  # on change
 */

/* Core */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

/* Instruments */
import {
    STALE_AFTER_MS,
    ageOf,
    buildName,
    deleteHandoffs,
    ingestHandoff,
    listStore,
    parseName,
    peekHandoff,
    planWrite,
    readableBy,
    renameHandoff,
    sanitizeSlug,
    utcTs,
    writeHandoff,
} from './handoff-store.ts';

const TS = '20260831T120000Z';
const CST = '# META\n\nrun id: **cc·20260831·probe**\n\n# G\n\ngoal.\n';

let root: string;

beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'handoff-store-test-'));
});

afterEach(async () => {
    await fs.rm(root, { force: true, recursive: true });
});

// ? the go reader in x/ tests the same cases, so the two readers of one grammar cannot drift
const shared = JSON.parse(
    await fs.readFile(
        path.join(import.meta.dirname, 'handoff-names.json'),
        'utf8',
    ),
) as { cases: { file: string; parsed: ReturnType<typeof parseName> }[] };

describe('the filename grammar', () => {
    test.each(shared.cases)('$file parses as the shared cases say', (c) => {
        expect(parseName(c.file)).toEqual(c.parsed);
    });

    test('every field round-trips, and a topic keeps its own dashes', () => {
        const name = buildName({
            audience: 'cclio',
            author: 'ccli',
            lane: 'pm',
            shared: false,
            slug: 'pm-overhaul',
            ts: TS,
        });

        expect(name).toBe(`cclio--pm--pm-overhaul--by-ccli--${TS}.md`);
        expect(parseName(name)).toEqual({
            audience: 'cclio',
            author: 'ccli',
            lane: 'pm',
            shared: false,
            slug: 'pm-overhaul',
            ts: TS,
        });
    });

    test('-shared sits between the timestamp and the extension', () => {
        const name = buildName({
            audience: 'any',
            author: 'cw',
            lane: 'probe',
            shared: true,
            slug: 'sline-probe',
            ts: TS,
        });

        expect(name).toBe(`any--probe--sline-probe--by-cw--${TS}-shared.md`);
        expect(parseName(name)?.shared).toBe(true);
        expect(parseName(name)?.slug).toBe('sline-probe');
    });

    test('the current shape carries lane and author', () => {
        expect(
            parseName(`cclio--pm--memory-bridge--by-ccli--${TS}.md`),
        ).toEqual({
            audience: 'cclio',
            author: 'ccli',
            lane: 'pm',
            shared: false,
            slug: 'memory-bridge',
            ts: TS,
        });
    });

    test('a legacy audience-topic-timestamp name has no lane or author', () => {
        expect(
            parseName('cclio-cclio-memory-bridge-halt16-20260912T215406Z.md'),
        ).toEqual({
            audience: 'cclio',
            author: 'any',
            lane: 'any',
            shared: false,
            slug: 'cclio-memory-bridge-halt16',
            ts: '20260912T215406Z',
        });
    });

    test('a legacy timestamp-first name still parses', () => {
        expect(parseName(`${TS}-cw-old-thread.md`)).toEqual({
            audience: 'cw',
            author: 'any',
            lane: 'any',
            shared: false,
            slug: 'old-thread',
            ts: TS,
        });
    });

    test('a two-segment legacy name has no audience, so it is `any`', () => {
        expect(parseName(`sline-${TS}.md`)).toEqual({
            audience: 'any',
            author: 'any',
            lane: 'any',
            shared: false,
            slug: 'sline',
            ts: TS,
        });
    });

    test('an unknown leading token is slug, not audience', () => {
        expect(parseName(`bytes-cache-probe-${TS}.md`)?.audience).toBe('any');
        expect(parseName(`bytes-cache-probe-${TS}.md`)?.slug).toBe(
            'bytes-cache-probe',
        );
    });

    test('anything that is not a .md file is not a handoff', () => {
        expect(parseName('.DS_Store')).toBeNull();
        expect(parseName('superseded')).toBeNull();
    });

    test('a slug is kebab-cased, and cannot smuggle in a -shared suffix', () => {
        expect(sanitizeSlug('PM Overhaul!')).toBe('pm-overhaul');
        expect(sanitizeSlug('probe-shared')).toBe('probe');
        expect(sanitizeSlug('***')).toBe('handoff');
    });

    test('the timestamp is utc, compact, second-precision', () => {
        expect(utcTs(new Date('2026-08-31T12:00:00.123Z'))).toBe(TS);
    });
});

describe('the audience gate', () => {
    test('`any` is readable by everyone, an exact token only by its own', () => {
        expect(readableBy('any', 'cw')).toBe(true);
        expect(readableBy('cclio', 'cclio')).toBe(true);
        expect(readableBy('cclio', 'cw')).toBe(false);
    });
});

describe('age', () => {
    test('reads as minutes, then hours, then days', () => {
        const now = Date.now();

        expect(ageOf(now - 20 * 60_000, now).label).toBe('20m');
        expect(ageOf(now - 5 * 3_600_000, now).label).toBe('5h');
        expect(ageOf(now - 3 * 86_400_000, now).label).toBe('3d');
    });

    test('older than seven days is flagged, and nothing more', () => {
        const now = Date.now();

        expect(ageOf(now - STALE_AFTER_MS + 60_000, now).stale).toBe(false);
        expect(ageOf(now - STALE_AFTER_MS - 60_000, now).stale).toBe(true);
        expect(ageOf(now - 9 * 86_400_000, now).days).toBe(9);
    });
});

describe('listing', () => {
    test('only *.md files count, newest first', async () => {
        await seed(`cclio-first-${TS}.md`, { minutesAgo: 30 });
        await seed(`any-second-${TS}.md`, { minutesAgo: 5 });
        await fs.writeFile(path.join(root, '.DS_Store'), 'junk');
        await fs.mkdir(path.join(root, 'superseded'));

        const entries = await listStore({ root });

        expect(entries.map((entry) => entry.slug)).toEqual(['second', 'first']);
    });

    test('a missing store lists as empty rather than throwing', async () => {
        expect(await listStore({ root: path.join(root, 'nope') })).toEqual([]);
    });
});

describe('write', () => {
    test('writes the CST under the built name, private to the user', async () => {
        const written = await writeHandoff({
            audience: 'cw',
            author: 'cclio',
            body: CST,
            lane: 'pm',
            root,
            slug: 'probe',
            ts: TS,
        });

        expect(written.error).toBeNull();
        expect(path.basename(written.value?.path ?? '')).toBe(
            `cw--pm--probe--by-cclio--${TS}.md`,
        );

        const stats = await fs.stat(
            `${root}/cw--pm--probe--by-cclio--${TS}.md`,
        );
        expect(stats.mode & 0o777).toBe(0o600);
    });

    test('the store directory is created on demand', async () => {
        const nested = path.join(root, 'deep', 'store');
        const written = await writeHandoff({
            audience: 'any',
            body: CST,
            root: nested,
            slug: 'probe',
        });

        expect(written.error).toBeNull();
        expect((await listStore({ root: nested })).length).toBe(1);
    });
});

describe('replace — the upmerge', () => {
    test('the named sibling is gone and the new file stands alone', async () => {
        await seed(`cclio-pm-${TS}.md`);

        const written = await writeHandoff({
            audience: 'cclio',
            body: CST,
            replaces: 'pm',
            root,
            slug: 'pm',
            ts: '20260831T130000Z',
        });

        expect(written.error).toBeNull();
        expect((await listStore({ root })).map((one) => one.name)).toEqual([
            'cclio--any--pm--by-any--20260831T130000Z.md',
        ]);
    });

    test('-shared is inherited from the file being replaced', async () => {
        const entries = [entry(`cw-probe-${TS}-shared.md`)];

        expect(
            planWrite({
                audience: 'cw',
                entries,
                replaces: 'probe',
                slug: 'probe',
                ts: TS,
            }).value?.shared,
        ).toBe(true);
    });

    test('an explicit --shared still wins over what it replaces', async () => {
        const entries = [entry(`cw-probe-${TS}.md`)];

        expect(
            planWrite({
                audience: 'cw',
                entries,
                replaces: 'probe',
                shared: true,
                slug: 'probe',
                ts: TS,
            }).value?.name,
        ).toBe(`cw--any--probe--by-any--${TS}-shared.md`);
    });

    test('replacing nothing is an error, never a quiet second file', async () => {
        await seed(`cclio-pm-${TS}.md`);

        const written = await writeHandoff({
            audience: 'cclio',
            body: CST,
            replaces: 'unrelated',
            root,
            slug: 'other',
        });

        expect(written.error).toMatch(/nothing was replaced/);
        expect((await listStore({ root })).length).toBe(1);
    });

    test('an ambiguous slug refuses rather than guessing', () => {
        const entries = [
            entry(`cw-probe-one-${TS}.md`),
            entry(`cw-probe-two-${TS}.md`),
        ];

        expect(
            planWrite({
                audience: 'cw',
                entries,
                replaces: 'probe',
                slug: 'probe',
                ts: TS,
            }).error,
        ).toMatch(/several pending handoffs match/);
    });
});

describe('ingest', () => {
    test('prints the body and deletes the file', async () => {
        await seed(`any-probe-${TS}.md`);

        const taken = await ingestHandoff({ root, slug: 'probe' });

        expect(taken.value?.body).toBe(CST);
        expect(taken.value?.kept).toBe(false);
        expect(await listStore({ root })).toEqual([]);
    });

    test('a -shared file survives being pulled', async () => {
        await seed(`any-probe-${TS}-shared.md`);

        const taken = await ingestHandoff({ root, slug: 'probe' });

        expect(taken.value?.kept).toBe(true);
        expect((await listStore({ root })).length).toBe(1);
    });

    test("a bare pull never takes another agent's handoff", async () => {
        await seed(`cclio-theirs-${TS}.md`);

        const taken = await ingestHandoff({ reader: 'cw', root });

        expect(taken.error).toMatch(/addressed to another agent/);
        expect((await listStore({ root })).length).toBe(1);
    });

    test('naming the slug forces it — the deliberate exception', async () => {
        await seed(`cclio-theirs-${TS}.md`);

        const taken = await ingestHandoff({
            reader: 'cw',
            root,
            slug: 'theirs',
        });

        expect(taken.value?.entry.audience).toBe('cclio');
        expect(await listStore({ root })).toEqual([]);
    });

    test('two readable candidates and no slug refuses rather than guessing', async () => {
        await seed(`any-one-${TS}.md`);
        await seed(`any-two-${TS}.md`);

        const taken = await ingestHandoff({ reader: 'cw', root });

        expect(taken.error).toMatch(/several pending handoffs match/);
        expect((await listStore({ root })).length).toBe(2);
    });
});

describe('rename', () => {
    test('a legacy name takes the current shape, keeping its timestamp', async () => {
        await seed(`cclio-memory-bridge-${TS}.md`, { minutesAgo: 90 });
        const before = await fs.stat(
            path.join(root, `cclio-memory-bridge-${TS}.md`),
        );

        const renamed = await renameHandoff({
            author: 'cclio',
            lane: 'pm',
            root,
            slug: 'memory-bridge',
        });

        expect(renamed.value?.to).toBe(
            `cclio--pm--memory-bridge--by-cclio--${TS}.md`,
        );
        const after = await fs.stat(
            path.join(root, `cclio--pm--memory-bridge--by-cclio--${TS}.md`),
        );
        expect(after.mtimeMs).toBe(before.mtimeMs);
    });

    test('a name with no timestamp refuses rather than inventing one', async () => {
        await seed('cclio-stray.md');

        const renamed = await renameHandoff({
            lane: 'pm',
            root,
            slug: 'stray',
        });

        expect(renamed.error).toMatch(/carries no timestamp/);
        expect((await listStore({ root })).map((one) => one.name)).toEqual([
            'cclio-stray.md',
        ]);
    });
});

describe('peek', () => {
    test('returns the META block alone, and consumes nothing', async () => {
        await seed(`any-probe-${TS}.md`);

        const seen = await peekHandoff({ root, slug: 'probe' });

        expect(seen.value?.meta).toBe(
            '# META\n\nrun id: **cc·20260831·probe**',
        );
        expect((await listStore({ root })).length).toBe(1);
    });

    test('a CST with no META says so instead of guessing one', async () => {
        await seed(`any-bare-${TS}.md`, { body: '# G\n\ngoal only.\n' });

        expect(
            (await peekHandoff({ root, slug: 'bare' })).value?.meta,
        ).toBeNull();
    });
});

describe('delete', () => {
    test('--all takes -shared files too', async () => {
        await seed(`any-one-${TS}.md`);
        await seed(`cw-two-${TS}-shared.md`);

        const deleted = await deleteHandoffs({ all: true, root });

        expect(deleted.value?.length).toBe(2);
        expect(await listStore({ root })).toEqual([]);
    });

    test('one slug leaves the rest alone', async () => {
        await seed(`any-one-${TS}.md`);
        await seed(`any-two-${TS}.md`);

        await deleteHandoffs({ root, slug: 'one' });

        expect((await listStore({ root })).map((each) => each.slug)).toEqual([
            'two',
        ]);
    });
});

/* Helpers */
async function seed(
    name: string,
    { body = CST, minutesAgo = 0 } = {},
): Promise<void> {
    const file = path.join(root, name);
    await fs.mkdir(root, { recursive: true });
    await fs.writeFile(file, body);

    if (minutesAgo > 0) {
        const at = new Date(Date.now() - minutesAgo * 60_000);
        await fs.utimes(file, at, at);
    }
}

/** A listing row without touching disk — for the pure planning tests. */
function entry(name: string) {
    const parsed = parseName(name);
    if (parsed === null) throw new Error(`unparseable fixture name: ${name}`);
    return {
        ...parsed,
        mtimeMs: Date.now(),
        name,
        path: `/fixture/${name}`,
        size: 0,
    };
}
