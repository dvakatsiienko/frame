import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, test } from 'vitest';

import { registerHandoffTools } from './handoff.js';

let root: string;
let client: Client;

// the tools as cw meets them: a real mcp client over an in-memory pair, a temp store under them
beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'x-cw-handoff-'));
    process.env.HANDOFF_STORE_ROOT = root;
    process.env.X_TEST = '1';

    const server = new McpServer({ name: 'x-cw-test', version: '0' });
    registerHandoffTools(server);
    const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'cw-test', version: '0' });
    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
});

const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ arguments: args, name });
    const content = result.content as { text?: string }[];
    return content.map((part) => part.text ?? '').join('\n');
};

const plant = (file: string, body = '# META\n\nrun id: **cc·20261007·t**\n') =>
    writeFile(join(root, file), body, { mode: 0o600 });

const files = () => readdir(root);

describe('the x-cw handoff tools', () => {
    test('save writes one file, authored by cw', async () => {
        const said = await call('handoff_save', {
            cst: '# META\n\nbody\n',
            lane: 'pm',
            slug: 'pm-overhaul',
        });

        expect(said).toContain('written');
        expect(await files()).toEqual([
            expect.stringMatching(
                /^any--pm--pm-overhaul--by-cw--\d{8}T\d{6}Z\.md$/,
            ),
        ]);
    });

    test('supersede leaves exactly one file', async () => {
        await plant('any--pm--pm-overhaul--by-cw--20261001T120000Z.md');

        const said = await call('handoff_supersede', {
            cst: '# META\n\nnewer\n',
            lane: 'pm',
            slug: 'pm-overhaul',
        });

        expect(said).toContain('replaced');
        expect(await files()).toEqual([
            expect.not.stringContaining('20261001T120000Z'),
        ]);
    });

    test('list separates the files addressed to another agent', async () => {
        await plant('any--code--ours--by-ccli--20261001T120000Z.md');
        await plant('cclio--pm--theirs--by-ccli--20261001T120000Z.md');

        const said = await call('handoff_list');

        expect(said).toMatch(
            /ours[\s\S]*addressed to another agent[\s\S]*theirs/,
        );
        expect(said).toContain('cc·20261007·t');
    });

    test('peek shows the META block alone and consumes nothing', async () => {
        await plant(
            'any--code--peeked--by-ccli--20261001T120000Z.md',
            '# META\n\nrun id: **cc·20261007·t**\n\n# G\n\nthe secret goal\n',
        );

        const said = await call('handoff_peek', { slug: 'peeked' });

        expect(said).toContain('run id');
        expect(said).not.toContain('the secret goal');
        expect(await files()).toHaveLength(1);
    });

    test('ingest returns the CST and deletes its file', async () => {
        await plant(
            'any--code--taken--by-ccli--20261001T120000Z.md',
            '# META\n\nthe whole cst\n',
        );

        const said = await call('handoff_ingest');

        expect(said).toContain('the whole cst');
        expect(await files()).toEqual([]);
    });

    test("a bare ingest leaves another agent's file alone", async () => {
        await plant('cclio--pm--theirs--by-ccli--20261001T120000Z.md');

        const said = await call('handoff_ingest');

        expect(said).toContain('nothing pending for cw');
        expect(await files()).toHaveLength(1);
    });

    test('delete takes one file and leaves the rest', async () => {
        await plant('any--code--one--by-ccli--20261001T120000Z.md');
        await plant('any--code--two--by-ccli--20261001T120000Z.md');

        await call('handoff_delete', { slug: 'one' });

        expect(await files()).toEqual([
            'any--code--two--by-ccli--20261001T120000Z.md',
        ]);
    });

    test('delete all takes shared files too', async () => {
        await plant('any--code--one--by-ccli--20261001T120000Z.md');
        await plant('any--code--two--by-ccli--20261001T120000Z-shared.md');

        const said = await call('handoff_delete_all');

        expect(said).toContain('deleted 2');
        expect(await files()).toEqual([]);
    });
});
