// a pointer left by a cut must land: a backticked path, or `name` § section naming a skill or memory file and its part
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export type Line = { file: string; line: number; text: string };
export type Dead = { file: string; line: number; target: string; why: string };

const PATH = /`((?:~\/|[\w.-]+\/)[\w./-]+\.(?:md|ts|sh|json|tsv|yml|yaml))`/g;
const SECTION = /`([\w:./-]+)`(?: skill)?(?:'s)? § ([^,;)(—`]+)/g;
const NAMED = /`([\w:.-]+)`/g;

// `clio:pm` → its SKILL.md; `fleet-vibe` → rules/fleet-vibe.md; `habit-shared-files` → the clio leaf; `crew-dna` → x's skill
function nameCandidates(root: string, name: string) {
    const ns = name.match(/^(clio|x):([\w-]+)$/);
    if (ns)
        return [
            ns[1] === 'clio'
                ? path.join(
                      root,
                      '_clio/plugin-clio/skills',
                      ns[2] ?? '',
                      'SKILL.md',
                  )
                : path.join(
                      root,
                      'home/.claude/plugin-x/skills',
                      ns[2] ?? '',
                      'SKILL.md',
                  ),
        ];
    return [
        path.join(root, 'home/.claude/rules', `${name}.md`),
        path.join(root, '_clio/memory', `${name}.md`),
        path.join(root, '_clio/plugin-clio/skills', name, 'SKILL.md'),
        path.join(root, 'home/.claude/plugin-x/skills', name, 'SKILL.md'),
        path.join(root, 'home/.claude', name),
    ];
}

// a section exists as a heading, a bold label or a numbered step that starts with its first words
export function hasSection(text: string, section: string) {
    const words = section
        .toLowerCase()
        .replace(/[^a-z0-9 ]+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    const step = words[0]?.match(/^\d+$/) ? words[0] : undefined;
    const lines = text
        .split('\n')
        .filter((line) => /^\s*#|\*\*|^\s*\d+[.)]\s/.test(line));
    if (step)
        return lines.some((line) =>
            new RegExp(`^\\s*(?:#+\\s*)?${step}[.)\\s]`).test(line),
        );
    const flat = lines.map((line) =>
        line
            .toLowerCase()
            .replace(/[^a-z0-9 ]+/g, ' ')
            .replace(/\s+/g, ' '),
    );
    // a pointer's section often runs on into prose («§ the pocket rules it»): two leading words are enough
    return (words.length === 1 ? [1] : [3, 2]).some(
        (k) =>
            words.length >= k &&
            flat.some((line) => line.includes(words.slice(0, k).join(' '))),
    );
}

export function deadPointers(root: string, lines: Line[]): Dead[] {
    return lines.flatMap((row) => {
        // a relative path resolves from any folder up from the file, or from a skill or leaf the line names
        const ups: string[] = [];
        for (
            let dir = path.dirname(path.join(root, row.file));
            dir.startsWith(root);
            dir = path.dirname(dir)
        )
            ups.push(dir);
        const named = [...row.text.matchAll(NAMED)]
            .flatMap(([, name = '']) =>
                nameCandidates(root, name).filter(existsSync),
            )
            .map((file) => path.dirname(file));
        const dirs = [
            ...ups,
            ...named,
            ...named.map((dir) => path.join(dir, 'references')),
            path.join(root, 'home/.claude'),
        ];
        const lands = (target: string) =>
            target.startsWith('~/')
                ? existsSync(path.join(process.env.HOME ?? '', target.slice(2)))
                : dirs.some((dir) => existsSync(path.join(dir, target)));
        const paths = [...row.text.matchAll(PATH)]
            .map(([, target = '']) => target)
            .filter((target) => !lands(target))
            .map((target) => ({ target, why: 'no such path' }));
        const sections = [...row.text.matchAll(SECTION)].flatMap(
            ([, name = '', section = '']) => {
                const target = `${name} § ${section.trim()}`;
                const file = [
                    ...nameCandidates(root, name),
                    ...dirs.map((dir) => path.join(dir, name)),
                ].find(
                    (candidate) =>
                        existsSync(candidate) && !candidate.endsWith('/'),
                );
                if (!file) return [{ target, why: 'no file by that name' }];
                return hasSection(readFileSync(file, 'utf8'), section)
                    ? []
                    : [{ target, why: 'no such section' }];
            },
        );
        return [...paths, ...sections].map((dead) => ({
            file: row.file,
            line: row.line,
            ...dead,
        }));
    });
}
