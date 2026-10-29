/**
 * ? the memory-sync mirror renders against a fixture tree, never the live repo — except the
 * ? last block, which checks the live masters: every tag valid, the field inside its cap.
 */

/* Core */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

/* Instruments */
import {
    HEAD,
    MARK_END,
    MARK_START,
    ORDER,
    SEPARATOR,
    compact,
    listMasters,
    parseMaster,
    render,
    selectFor,
    target,
    toManifest,
} from './memory-sync-mirror.ts';

let root: string;
const write = async (rel: string, text: string) => {
    const file = path.join(root, rel);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, text);
};

beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'memory-sync-mirror-test-'));
    // every ORDER master must exist — a missing one fails the render, never skips silently
    for (const file of ORDER) await write(file, `# ${path.basename(file)}\n`);
    await write(HEAD, 'hi, my part\n');
});
afterEach(async () => {
    await fs.rm(root, { force: true, recursive: true });
});

describe('compact', () => {
    test('keeps headers, bullets and marker-led paragraphs whole; drops prose, comments, examples, scope blocks', () => {
        const src = [
            '# title',
            '**scope:** nav\n**not here →** other',
            '<!-- boundary -->',
            'plain prose that explains',
            '- a bullet\n  continued\n  - nested',
            '🚨 **the check is mechanical.** kept\nsecond line kept',
            '**any text is fenced** kept',
            '    indented example',
            '1. **Precision first.** a numbered invariant\n2. **Verified or labelled.**',
        ].join('\n\n');
        expect(compact(src)).toBe(
            [
                '# title',
                '- a bullet\n  continued\n  - nested',
                '🚨 **the check is mechanical.** kept\nsecond line kept',
                '**any text is fenced** kept',
                '1. **Precision first.** a numbered invariant\n2. **Verified or labelled.**',
            ].join('\n\n'),
        );
    });
});

describe('tags', () => {
    test('a tag routes its section and every subsection; `none` opts a child out', () => {
        const parts = parseMaster(
            '# t\n\n## a\n<!-- sync: cloud-chat -->\n\n- a\n\n### a1\n\n- a1\n\n### a2\n<!-- sync: none -->\n\n- a2\n\n## b\n\n- b\n',
        );
        expect(parts.map((p) => [p.title, p.eff])).toEqual([
            ['t', undefined],
            ['a', 'cloud-chat'],
            ['a1', 'cloud-chat'],
            ['a2', 'none'],
            ['b', undefined],
        ]);
    });

    test('a tag before the first heading routes the whole file', () => {
        const parts = parseMaster(
            '<!-- sync: cloud-chat -->\n\n**bold lead**\n\n## x\n\n- x\n',
        );
        expect(parts.every((p) => p.eff === 'cloud-chat')).toBe(true);
    });

    test('an unknown tag fails loud', () => {
        expect(() =>
            parseMaster('## a\n<!-- sync: cww -->\n', 'rules/x.md'),
        ).toThrow('rules/x.md: unknown sync tag «cww»');
    });

    test('a line tagged `<!-- cc -->` stays out of cloud-chat, its nested lines with it, its siblings kept', () => {
        const { text } = selectFor(
            '## a\n<!-- sync: cloud-chat -->\n\n- kept\n- orbit asks <!-- cc -->\n  - nested orbit detail\n- also kept\n',
        );
        expect(text).toBe('## a\n\n- kept\n- also kept');
    });

    test('selection drops the tag line, pulls ancestor headings, keeps a prose-only leaf, sizes the section', () => {
        const { text, sections } = selectFor(
            '# t\n\n## parent\n\nparent prose\n\n### kept\n<!-- sync: cloud-chat -->\n\nleaf prose only\n\n### other\n\n- no\n',
            'x.md',
        );
        expect(text).toBe('# t\n\n## parent\n\n### kept\n\nleaf prose only');
        expect(sections).toEqual([
            {
                chars: '### kept\n\nleaf prose only'.length,
                file: 'x.md',
                section: 'kept',
            },
        ]);
    });
});

describe('render', () => {
    test('masters render in ORDER, then unlisted rules alphabetically', async () => {
        await write('home/.claude/rules/zeta.md', '# z\n');
        await write('home/.claude/rules/alpha.md', '# a\n');
        expect(listMasters(root).slice(-2)).toEqual([
            'home/.claude/rules/alpha.md',
            'home/.claude/rules/zeta.md',
        ]);
    });

    test('the paste block is fenced, names its masters, carries no memory tags', async () => {
        await write(
            'home/.claude/rules/alpha.md',
            '# a\n\n## box\n<!-- sync: cloud-chat -->\n\n- b\n\n## cc only\n\n- c\n',
        );
        const r = render(root);
        expect(
            r.body.startsWith(`hi, my part\n\n${SEPARATOR}\n\n${MARK_START}\n`),
        ).toBe(true);
        expect(r.body.endsWith(`${MARK_END}\n`)).toBe(true);
        expect(r.body).toContain('<!-- home/.claude/rules/alpha.md -->');
        expect(r.body).toContain('\n- b');
        expect(r.body).not.toContain('- c');
        expect(r.body).not.toContain('[stated]');
        expect(r.file).toBe('account-profile-instructions.core.md');
    });

    test('the stamp follows his own section too', async () => {
        const before = render(root).sha256;
        await write(HEAD, 'hi, my part, edited\n');
        expect(render(root).sha256).not.toBe(before);
    });

    test('the stamp follows the tags, not only the prose', async () => {
        await write('home/.claude/rules/alpha.md', '# a\n\n## x\n\n- x\n');
        const before = render(root).sha256;
        await write(
            'home/.claude/rules/alpha.md',
            '# a\n\n## x\n<!-- sync: cloud-chat -->\n\n- x\n',
        );
        expect(render(root).sha256).not.toBe(before);
    });

    test('the manifest keys the field and lists the masters it drew from', async () => {
        await write(
            'home/.claude/rules/alpha.md',
            '# a\n\n## one\n<!-- sync: cloud-chat -->\n\n- x\n',
        );
        const m = toManifest(render(root));
        expect(Object.keys(m)).toEqual(['account/profile/instructions#core']);
        expect(m['account/profile/instructions#core']?.sources).toEqual([
            'home/.claude/rules/alpha.md',
        ]);
    });
});

describe('the live masters', () => {
    test('every tag parses and the field renders inside its cap', () => {
        const repo = path.join(import.meta.dirname, '..', '..');
        expect(render(repo).chars).toBeLessThanOrEqual(target.cap);
    });
});
