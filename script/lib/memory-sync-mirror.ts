/**
 * ? memory-sync mirror — renders the cc masters into dima's `account / profile / instructions`
 * ? (claude.ai settings → account → «instructions for claude»).
 * ?
 * ? `account / profile / instructions` is the one cloud-chat destination the masters feed: it loads
 * ? on every surface, holds 32 768 chars (dima's paste test, 2026-09-23), and only dima can write
 * ? it — so the render is a paste block, and cloud-chat's own memory entries (`/preferences.md`,
 * ? `/profile.md`, the leaves) stay fully cloud-chat-native, never spliced.
 * ?
 * ? ROUTING IS A TAG IN THE MASTER, never a list here. a line `<!-- sync: cloud-chat -->` directly under a
 * ? heading sends that section — and every subsection under it — to `account / profile / instructions`; a subsection may opt
 * ? back out with `<!-- sync: none -->`, and one line inside it with a trailing `<!-- cc -->` (its deeper-indented
 * ? lines go with it). a tag on its own line before the first heading routes the
 * ? whole file. cc strips html comments at load, so a tag costs cc nothing and the masters keep
 * ? their natural section order. `pnpm memory-sync:map` prints the routing table.
 * ?
 * ? over 32 768 the field refuses the paste, so the render aborts first. the fragment renders
 * ? COMPACT: headers, bullets and marker-led paragraphs whole, plain prose and html comments
 * ? dropped — except a leaf section left with nothing but its heading, which keeps its prose.
 */

/* Core */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

type Tag = 'cloud-chat' | 'none';
const TAGS: readonly Tag[] = ['cloud-chat', 'none'];

export type Target = {
    /** where the fragment lands — `account/profile/instructions` is dima's settings field */
    path: string;
    fragment: string;
    /** chars the destination accepts */
    cap: number;
};

export type Section = { file: string; section: string; chars: number };

export type Rendered = {
    file: string;
    path: string;
    fragment: string;
    sha256: string;
    /** rendered length — what the field counts */
    chars: number;
    body: string;
    /** the tagged sections this fragment carries, in render order, with their rendered size */
    sections: Section[];
};

export type Manifest = Record<
    string,
    {
        file: string;
        sha256: string;
        chars: number;
        sources: string[];
        fragment: string;
    }
>;

/**
 * dima's own section — the top of the field, above the line. this file is its source of truth: he
 * edits it here, never in the field, because the next paste renders over the field.
 */
export const HEAD =
    'home/.claude/plugin-x-cloud-chat/skills/memory-update/instructions-head.md';

/** the line between his section and the synced part — plain text, it reads in the settings field. */
export const SEPARATOR = [
    '═'.repeat(48),
    '⬇  synced from cc memory (~/frame) — edit the masters, not below',
    '   routes: pnpm memory-sync:map',
    '═'.repeat(48),
].join('\n');

export const MARK_START = '<!-- mirror:start -->';
export const MARK_END = '<!-- mirror:end -->';

const CLAUDE = 'home/.claude';
const RULES = `${CLAUDE}/rules`;

/**
 * the masters scanned for tags, in render order. files in `rules/` not named here are scanned
 * after these, alphabetically — a new rule is never silently skipped.
 */
export const ORDER = [
    `${CLAUDE}/CLAUDE.md`,
    `${RULES}/fleet-identity.md`,
    `${RULES}/fleet-voice.md`,
    `${RULES}/dima-signals.md`,
    `${RULES}/fleet-vibe.md`,
    `${RULES}/fleet-doors.md`,
    `${RULES}/fleet-output-format.md`,
];

export const target: Target = {
    cap: 32_768,
    fragment: 'core',
    path: 'account/profile/instructions',
};

export function listMasters(root: string): string[] {
    const rules = readdirSync(join(root, RULES))
        .filter((f) => f.endsWith('.md'))
        .map((f) => `${RULES}/${f}`)
        .filter((f) => !ORDER.includes(f))
        .sort();
    return [...ORDER, ...rules];
}

const sha = (text: string) => createHash('sha256').update(text).digest('hex');

const TAG_LINE = /^<!-- sync: ([a-z-]+) -->$/;

/**
 * the compact shape. blocks are separated by blank lines; a block survives when its first line is
 * a header, a bullet, a numbered item, or a paragraph led by a rule marker (bold, 🚫 🚨 📌 ⚠️).
 * html comments, plain prose, indented examples and the file's own `**scope:**` / `**not here**`
 * navigation blocks are dropped. kept blocks stay byte-identical.
 */
export const compact = (body: string) =>
    body
        .split(/\n{2,}/)
        .filter((block) => {
            const first = block.trimStart();
            if (first.startsWith('<!--')) return false;
            if (/^\*\*(scope|not here)/.test(first)) return false;
            return /^(#|- |\d+\. |\*\*|🚫|🚨|📌|⚠|╭|╰|```)/.test(first);
        })
        .join('\n\n');

const CC_ONLY = '<!-- cc -->';

/** drops a line tagged `<!-- cc -->` and the deeper-indented lines under it: cc-only detail inside a cloud-chat section. */
export const dropCcOnly = (body: string) => {
    const out: string[] = [];
    let cut: number | undefined;
    for (const line of body.split('\n')) {
        const indent = line.length - line.trimStart().length;
        if (cut !== undefined && line.trim() && indent > cut) continue;
        cut = undefined;
        if (line.includes(CC_ONLY)) {
            cut = indent;
            continue;
        }
        out.push(line);
    }
    return out.join('\n');
};

/** drops comments and navigation blocks, keeps prose — the fallback for a prose-only leaf. */
const clean = (body: string) =>
    body
        .split(/\n{2,}/)
        .filter((block) => {
            const first = block.trimStart();
            return (
                !first.startsWith('<!--') &&
                !/^\*\*(scope|not here)/.test(first)
            );
        })
        .join('\n\n');

type Part = {
    level: number;
    title: string;
    /** the part without its tag line */
    text: string;
    own?: Tag;
    eff?: Tag;
};

/** splits a master at its headings and resolves each part's tag, inherited down the tree. */
export function parseMaster(body: string, file = 'master'): Part[] {
    const parts: Part[] = body
        .split(/^(?=#{1,6} )/m)
        .filter((p) => p.trim())
        .map((raw) => {
            const heading = raw.match(/^(#{1,6}) (.*)/);
            const lines = raw.split('\n');
            const at = heading
                ? 1
                : lines.findIndex((l) => TAG_LINE.test(l.trim()));
            const match = at >= 0 ? lines[at]?.trim().match(TAG_LINE) : null;
            let own: Tag | undefined;
            if (match?.[1]) {
                const tag = match[1];
                if (!TAGS.includes(tag as Tag))
                    throw new Error(`${file}: unknown sync tag «${tag}»`);
                own = tag as Tag;
                lines.splice(at, 1);
            }
            return {
                level: heading ? (heading[1]?.length ?? 0) : 0,
                own,
                text: lines.join('\n'),
                title: heading?.[2]?.trim() ?? '',
            };
        });
    const stack: Part[] = [];
    for (const part of parts) {
        while (stack.length && (stack.at(-1)?.level ?? 0) >= part.level)
            stack.pop();
        part.eff = part.own ?? stack.at(-1)?.eff;
        stack.push(part);
    }
    return parts;
}

/**
 * the parts routed to cloud-chat, compacted. a routed part pulls its ancestors' heading lines along so the
 * hierarchy reads; a routed leaf left with only its heading keeps its prose. each tagged section
 * reports the chars it and its subsections render to.
 */
export function selectFor(
    body: string,
    file = 'master',
): { text: string; sections: Section[] } {
    const parts = parseMaster(body, file);
    const out: string[] = [];
    const sections: Section[] = [];
    const emitted = new Set<Part>();
    const stack: Part[] = [];
    parts.forEach((part, i) => {
        while (stack.length && (stack.at(-1)?.level ?? 0) >= part.level)
            stack.pop();
        if (part.eff === 'cloud-chat') {
            if (part.own === 'cloud-chat')
                sections.push({
                    chars: 0,
                    file,
                    section: part.title || '(whole file)',
                });
            const current = sections.at(-1);
            for (const up of stack)
                if (!emitted.has(up) && up.level > 0) {
                    out.push(up.text.split('\n')[0] ?? '');
                    emitted.add(up);
                }
            const next = parts[i + 1];
            const hasRoutedChild =
                !!next && next.level > part.level && next.eff === 'cloud-chat';
            const own = dropCcOnly(part.text.trim());
            let text = compact(own);
            if (!hasRoutedChild && !text.includes('\n')) text = clean(own);
            if (text) {
                out.push(text);
                if (current) current.chars += text.length;
            }
            emitted.add(part);
        }
        stack.push(part);
    });
    return { sections, text: out.join('\n\n') };
}

export function render(root: string): Rendered {
    const bodies: string[] = [];
    const sections: Section[] = [];
    const used: string[] = [];
    for (const file of listMasters(root)) {
        const master = readFileSync(join(root, file), 'utf8');
        const picked = selectFor(master.trim(), file);
        if (!picked.text) continue;
        used.push(file);
        sections.push(...picked.sections);
        bodies.push(`<!-- ${file} -->\n\n${picked.text}`);
    }
    /**
     * over the SELECTED, COMPACTED bodies — never the raw masters. a tag change alters the
     * fragment without touching a master's prose, and a masters-only sha left that change
     * invisible: the stamp compare saw no diff and skipped the update (2026-09-21).
     */
    const head = readFileSync(join(root, HEAD), 'utf8').trim();
    const sourceSha = sha(`${head}\n\n${bodies.join('\n\n')}`);
    const body = `${head}\n\n${SEPARATOR}\n\n${MARK_START}\n<!-- rendered by script/skill-memory-sync-mirror.ts from the synced sections of ${used.map((m) => m.replace('home/.claude/', '')).join(' + ') || 'nothing'} · source-sha256: ${sourceSha} · never edit by hand -->\n\n${bodies.join('\n\n')}\n\n${MARK_END}\n`;
    return {
        body,
        chars: body.length,
        file: `${target.path.replaceAll('/', '-')}.${target.fragment}.md`,
        fragment: target.fragment,
        path: target.path,
        sections,
        sha256: sourceSha,
    };
}

export function toManifest(r: Rendered): Manifest {
    return {
        [`${r.path}#${r.fragment}`]: {
            chars: r.chars,
            file: r.file,
            fragment: r.fragment,
            sha256: r.sha256,
            sources: [...new Set(r.sections.map((x) => x.file))],
        },
    };
}
